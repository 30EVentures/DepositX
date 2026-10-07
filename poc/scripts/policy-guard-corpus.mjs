#!/usr/bin/env node
// Cross-check runner: feeds a third-party "agent spending policy" conformance corpus (policy-guard/1, JSON)
// to the DepositX adapter (test/support/policy-guard-adapter.js) and classifies every case.
//
//   AGREED      the adapter's answer matches the case's expectation
//   DISAGREED   the adapter answered and it differs (verdict/valid, or a code the case requires)
//   ABSTAINED   the case cannot be expressed in DepositX's model; the adapter says why
//   UNANSWERED  the adapter produced no answer (it threw)
//   UNREADABLE  the case or the adapter's answer is malformed
//
// The corpus is data: it is located by POLICY_GUARD_CORPUS (the corpus repo directory, or the folder holding
// policy-guard-1.json), defaulting to the audit clone if present. Nothing from it is copied into this repo
// or executed. If it cannot be found, read, or contains zero cases, this FAILS LOUDLY (exit 2): it never
// reports success on nothing.
//
// Usage:  node scripts/policy-guard-corpus.mjs [--check] [--emit-table]
//   (default)     print every case and the counts; exit 1 if any case is UNANSWERED/UNREADABLE
//   --check       also compare against test/policy-guard-divergences.json; exit 1 on any drift
//   --emit-table  print a skeleton divergence table (reasons are the adapter's text: curate before checking in)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { answerCase } from '../test/support/policy-guard-adapter.js';

export const STATUS = Object.freeze({ AGREED: 'AGREED', DISAGREED: 'DISAGREED', ABSTAINED: 'ABSTAINED', UNANSWERED: 'UNANSWERED', UNREADABLE: 'UNREADABLE' });
export const CORPUS_FILE = 'policy-guard-1.json';
export const TABLE_FILE = fileURLToPath(new URL('../test/policy-guard-divergences.json', import.meta.url));
const DEFAULT_DIR = path.join(os.homedir(), 'flashy-audit', 'flashy-repos', 'wdk-policy-guard');

export class CorpusError extends Error {}

/** Find the corpus file, or throw CorpusError saying exactly where it looked. */
export function locateCorpus(env = process.env) {
  const explicit = env.POLICY_GUARD_CORPUS;
  const dir = explicit || DEFAULT_DIR;
  const tried = [path.join(dir, CORPUS_FILE), path.join(dir, 'conformance', CORPUS_FILE)];
  const hit = tried.find((f) => fs.existsSync(f));
  if (!hit) {
    throw new CorpusError(`policy-guard corpus not found (${explicit ? 'POLICY_GUARD_CORPUS' : 'default path'}): looked for ${tried.join(' and ')}. Set POLICY_GUARD_CORPUS to the corpus directory.`);
  }
  return hit;
}

/** Parse and structurally validate the corpus bundle. Throws CorpusError; never returns zero cases. */
export function loadCorpus(file) {
  let b;
  try {
    b = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new CorpusError(`policy-guard corpus unreadable at ${file}: ${e.message}`);
  }
  if (!b || typeof b !== 'object' || !Array.isArray(b.sets)) throw new CorpusError(`corpus ${file} has no "sets" array`);
  if (b.contract !== 'conformance/1') throw new CorpusError(`corpus ${file}: unexpected contract ${JSON.stringify(b.contract)} (want "conformance/1")`);
  let total = 0;
  for (const s of b.sets) {
    if (!s || typeof s.name !== 'string' || !['decide', 'validate'].includes(s.kind) || !Array.isArray(s.cases)) {
      throw new CorpusError(`corpus ${file}: a set is missing a name, a known kind (decide|validate) or its cases`);
    }
    total += s.cases.length;
  }
  if (total === 0) throw new CorpusError(`corpus ${file} contains zero cases; refusing to pass vacuously`);
  return { profile: b.profile, version: b.version, sets: b.sets, total };
}

const sameCodes = (want, got) => !Array.isArray(want) || want.length === 0 || (Array.isArray(got) && want.every((c) => got.includes(c)));
const brief = (a) => (a.verdict !== undefined ? a.verdict : `valid=${a.valid}`) + (a.codes && a.codes.length ? `[${a.codes.join(',')}]` : '');

function classify(set, c, answer) {
  const key = `${set.name}/${c.id}`;
  const base = { key, set: set.name, id: c.id, why: c.why };
  if (typeof c.id !== 'string' || !c.expect || typeof c.expect !== 'object') return { ...base, status: STATUS.UNREADABLE, detail: 'case has no id or no expect block' };
  const expected = c.expect;
  if (set.kind === 'decide' && typeof expected.verdict !== 'string') return { ...base, status: STATUS.UNREADABLE, detail: 'decide case without an expected verdict' };
  if (set.kind === 'validate' && typeof expected.valid !== 'boolean') return { ...base, status: STATUS.UNREADABLE, detail: 'validate case without an expected valid flag' };
  let a;
  try {
    a = answer({ set: set.name, id: c.id, input: c.input, context: c.context }, set.kind);
  } catch (e) {
    return { ...base, status: STATUS.UNANSWERED, detail: `adapter threw: ${e.message}` };
  }
  if (a && typeof a.abstain === 'string' && a.abstain) return { ...base, status: STATUS.ABSTAINED, detail: a.abstain };
  const wellFormed = a && typeof a === 'object' && (set.kind === 'decide' ? Array.isArray(set.outcomes) ? set.outcomes.includes(a.verdict) : typeof a.verdict === 'string' : typeof a.valid === 'boolean');
  if (!wellFormed) return { ...base, status: STATUS.UNREADABLE, detail: `adapter answer not usable: ${JSON.stringify(a)}` };
  const got = brief(a);
  const verdictOk = set.kind === 'decide' ? a.verdict === expected.verdict : a.valid === expected.valid;
  if (!verdictOk) return { ...base, status: STATUS.DISAGREED, got, detail: `expected ${set.kind === 'decide' ? expected.verdict : `valid=${expected.valid}`}, adapter said ${got}` };
  if (!sameCodes(expected.codes, a.codes)) return { ...base, status: STATUS.DISAGREED, got, detail: `outcome agrees but required code(s) ${expected.codes.join(',')} missing; adapter said ${got}` };
  return { ...base, status: STATUS.AGREED, got };
}

/** Run every case. `answer` is injectable so the harness itself can be tested with a stub. */
export function runCorpus(corpus, answer = answerCase) {
  const results = [];
  for (const s of corpus.sets) for (const c of s.cases) results.push(classify(s, c, answer));
  if (results.length === 0) throw new CorpusError('no cases were run; refusing to pass vacuously');
  return results;
}

export const counts = (results) => Object.fromEntries(Object.values(STATUS).map((st) => [st, results.filter((r) => r.status === st).length]));

/** The comparable fingerprint of a run: every non-agreeing case with its status and (for DISAGREED) what DepositX said. */
export function divergencesOf(results) {
  const out = {};
  for (const r of results) if (r.status !== STATUS.AGREED) out[r.key] = r.status === STATUS.DISAGREED ? { status: r.status, got: r.got } : { status: r.status };
  return out;
}

/** Compare a run against the checked-in table. Returns human-readable problems; empty means identical. */
export function diffAgainstTable(results, table) {
  const problems = [];
  const now = divergencesOf(results);
  const pinned = table.divergences || {};
  for (const k of Object.keys(now)) {
    if (!pinned[k]) problems.push(`NEW divergence ${k}: ${now[k].status}${now[k].got ? ` (${now[k].got})` : ''}; review it and add it to the table with a reason`);
  }
  for (const k of Object.keys(pinned)) {
    if (!now[k]) problems.push(`SILENTLY FIXED ${k}: pinned as ${pinned[k].status} but now AGREED; remove it from the table deliberately`);
    else if (now[k].status !== pinned[k].status || (now[k].got || null) !== (pinned[k].got || null)) {
      problems.push(`CHANGED ${k}: pinned ${pinned[k].status}${pinned[k].got ? ` (${pinned[k].got})` : ''}, now ${now[k].status}${now[k].got ? ` (${now[k].got})` : ''}`);
    }
  }
  for (const [k, v] of Object.entries(pinned)) if (typeof v.reason !== 'string' || !v.reason.trim()) problems.push(`table entry ${k} has no reason`);
  return problems;
}

function main(argv) {
  let file, corpus, results;
  try {
    file = locateCorpus();
    corpus = loadCorpus(file);
    results = runCorpus(corpus);
  } catch (e) {
    if (e instanceof CorpusError) {
      console.error(`FAIL: ${e.message}`);
      return 2;
    }
    throw e;
  }
  if (argv.includes('--emit-table')) {
    const sk = divergencesOf(results);
    for (const r of results) if (sk[r.key]) sk[r.key].reason = r.detail;
    console.log(JSON.stringify({ corpus: { profile: corpus.profile, version: corpus.version, cases: corpus.total }, divergences: sk }, null, 2));
    return 0;
  }
  console.log(`${corpus.profile} v${corpus.version} (${file})`);
  for (const r of results) console.log(`  ${r.status.padEnd(10)} ${r.key}${r.status === STATUS.AGREED ? '' : `\n             ${r.detail}`}`);
  const c = counts(results);
  console.log(`\n  ${Object.entries(c).map(([k, v]) => `${k.toLowerCase()} ${v}`).join('  ')}  (of ${results.length})`);
  let code = c.UNANSWERED + c.UNREADABLE > 0 ? 1 : 0;
  if (argv.includes('--check')) {
    const table = JSON.parse(fs.readFileSync(TABLE_FILE, 'utf8'));
    const problems = diffAgainstTable(results, table);
    if (table.corpus && (table.corpus.version !== corpus.version || table.corpus.cases !== corpus.total)) problems.push(`corpus is ${corpus.version}/${corpus.total} cases but the table was reviewed against ${table.corpus.version}/${table.corpus.cases}`);
    if (problems.length) {
      console.error(`\nDRIFT against ${path.basename(TABLE_FILE)}:\n  - ${problems.join('\n  - ')}`);
      code = 1;
    } else console.log(`  matches the pinned divergence table (${Object.keys(table.divergences).length} entries)`);
  }
  return code;
}

// Compare real paths so a symlinked or relative invocation still runs main (a runner that silently does
// nothing when launched through a link would exit 0 having checked nothing).
const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
if (invoked && invoked === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
