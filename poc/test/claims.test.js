// Claim-refusal test. DepositX is a proof of concept: consensus is simulated in one process, there is no bank
// partner and nothing here is regulated, final or live. This test scans every user-visible string the PoC
// emits or ships and REFUSES an overclaim unless the same sentence carries a qualifier.
//
// What is scanned (all of it, or the test fails):
//   - every string literal in poc/src/**/*.js (error messages, remedies, the pacs.002 text, dashboard JSON).
//     Comments are not scanned: they are not emitted. Template literals are scanned with ${...} replaced by "…".
//   - poc/public/index.html: visible text, title/aria-label/placeholder/alt attributes, and its script literals
//   - poc/README.md, the top-level README.md, and poc/docs/*.md
//
// A "claim word" is: consensus finality, final settlement, final/finality/finalised, live, production, regulated,
// licensed, approved by, insured, guaranteed. A hit is excused only if, within a few words of it (WINDOW), its sentence (a string literal, a table cell, a
// bullet, or a prose sentence) contains a qualifier from QUALIFIERS below (simulated, proof of concept, PoC, not, never,
// no, ...), OR it has an entry in test/claims-allowlist.json. Each allowlist entry is exact: file + the full
// normalised sentence + the claim word + a reason. An entry that matches nothing is itself a failure, so the list
// cannot rot into a blanket pass. Entries tagged "tracked" are known overclaims we have chosen not to edit yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POC = path.resolve(HERE, '..');
const REPO = path.resolve(POC, '..');
const ALLOWLIST_FILE = path.join(HERE, 'claims-allowlist.json');

// ---------------------------------------------------------------------------------------------- claim words
export const TERMS = [
  { id: 'consensus finality', re: /consensus[\s-]+final(ity)?/i },
  { id: 'final settlement', re: /final[\s-]+settle/i },
  { id: 'finality', re: /\bfinal(ity|is(e|es|ed)|iz(e|es|ed))\b/i },
  { id: 'final', re: /\bfinal\b/i },
  { id: 'live', re: /\blive\b/i },
  { id: 'production', re: /\bproduction\b/i },
  { id: 'regulated', re: /\bregulated\b/i },
  { id: 'licensed', re: /\blicen[sc]ed\b/i },
  { id: 'approved by', re: /\bapproved by\b/i },
  { id: 'insured', re: /\binsured\b/i },
  { id: 'guaranteed', re: /\bguarantee(s|d)?\b/i },
];
// A sentence carrying one of these is saying what the PoC is NOT, or that it is simulated. Reviewed list: widen it
// only with a reason, because every word added makes the test easier to satisfy.
// "PoC" is matched case-sensitively so a path like poc/README.md can never excuse a sentence.
export const QUALIFIERS = /\b(simulated|simulation|proof[ -]of[ -]concept|not|never|no|nor|mock|toy|illustrative|stub)\b|n't/i;
const POC_WORD = /(?<![\w/.-])(PoC|POC)(?![\w/.-])/;

export function claimsIn(sentence) {
  const hits = TERMS.filter((t) => t.re.test(sentence)).map((t) => t.id);
  // "consensus finality" / "final settlement" also contain the plain words; report the most specific one only
  return hits.filter((id) => !(id === 'finality' && hits.includes('consensus finality')) && !(id === 'final' && hits.includes('final settlement')));
}

// A qualifier only counts if it sits NEAR the claim word (WINDOW words either side, never across the sentence
// edge). A "not" at the far end of a long sentence does not excuse a claim at the other end.
export const WINDOW = 6;
export function qualified(sentence, termId = null) {
  const words = [...sentence.matchAll(/[^\s]+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  const terms = termId ? TERMS.filter((t) => t.id === termId) : TERMS;
  for (const t of terms) {
    const m = t.re.exec(sentence);
    if (!m) continue;
    const first = words.findIndex((w) => w.end > m.index);
    let last = words.findIndex((w) => w.end >= m.index + m[0].length);
    if (last < 0) last = words.length - 1;
    const from = words[Math.max(0, first - WINDOW)].start;
    const to = words[Math.min(words.length - 1, last + WINDOW)].end;
    const near = sentence.slice(from, to);
    if (QUALIFIERS.test(near) || POC_WORD.test(near)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------- extraction
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/** All string literals in JS source, with template text as one string (${...} -> …). Comments are skipped. */
export function jsStrings(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const lineOf = (p) => src.slice(0, p).split('\n').length;
  const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  let prev = ''; // last significant char (or word) seen
  const unesc = (s) => s.replace(/\\n|\\t|\\r/g, ' ').replace(/\\(.)/g, '$1');
  function readString(q) {
    const start = i; i++;
    let s = '';
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; } else if (src[i] === '\n') throw new Error(`unterminated string at line ${lineOf(start)}`); else s += src[i++];
    }
    if (i >= n) throw new Error(`unterminated string at line ${lineOf(start)}`);
    i++;
    out.push({ text: unesc(s), line: lineOf(start) });
  }
  function readTemplate() {
    const start = i; i++;
    let s = '';
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; } else if (src[i] === '$' && src[i + 1] === '{') { i += 2; s += '…'; code(true); } else s += src[i++];
    }
    if (i >= n) throw new Error(`unterminated template at line ${lineOf(start)}`);
    i++;
    out.push({ text: unesc(s), line: lineOf(start) });
  }
  function code(untilBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) throw new Error('unterminated comment'); i = e + 2; continue; }
      if (c === '"' || c === "'") { readString(c); prev = 'x'; continue; }
      if (c === '`') { readTemplate(); prev = 'x'; continue; }
      if (c === '/') {
        if (REGEX_PREV.has(prev) || prev === '' || /^(return|typeof|case|in|of|yield|await)$/.test(prev)) {
          i++; let cls = false;
          while (i < n && (src[i] !== '/' || cls)) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '\n') throw new Error(`unterminated regex at line ${lineOf(i)}`); i++; }
          i++; while (/[a-z]/i.test(src[i] || '')) i++;
          prev = 'x'; continue;
        }
        prev = '/'; i++; continue;
      }
      if (untilBrace) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) { i++; return; } depth--; }
      }
      if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(src[j] || '')) j++; prev = src.slice(i, j); i = j; continue; }
      if (/\d/.test(c)) { while (/[\w.]/.test(src[i] || '')) i++; prev = 'x'; continue; }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
    if (untilBrace) throw new Error('unterminated ${ } in template');
  }
  code(false);
  return out;
}

// split text into sentences; abbreviations are protected so "e.g. production" stays in one piece
function sentences(text) {
  const protectedText = text.replace(/\b(e\.g|i\.e|vs|etc|cf|approx)\./gi, (m) => m.replace('.', '\u0000'));
  return protectedText.split(/(?<=[.!?])\s+/).map((s) => norm(s.replace(/\u0000/g, '.'))).filter(Boolean);
}

/** Markdown -> sentence units: each table cell, bullet, and prose sentence is its own unit. */
export function mdUnits(md) {
  const units = [];
  let para = [];
  const flush = () => { if (para.length) units.push(...sentences(para.join(' '))); para = []; };
  for (const raw of md.split('\n')) {
    const line = raw.trim().replace(/\*\*/g, '');
    if (!line) { flush(); continue; }
    if (line.startsWith('|')) { flush(); for (const cell of line.split('|')) units.push(...sentences(cell)); continue; }
    if (/^([-*]|\d+\.)\s/.test(line) || /^#{1,6}\s/.test(line)) flush();
    para.push(line.replace(/^([-*]|\d+\.|#{1,6})\s+/, ''));
  }
  flush();
  return units;
}

/** HTML -> sentence units from visible text and user-visible attributes, plus every literal in <script>. */
export function htmlUnits(html) {
  const units = [];
  let rest = html.replace(/<!--[\s\S]*?-->/g, ' ');
  rest = rest.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, js) => { for (const s of jsStrings(js)) units.push(...sentences(s.text)); return ' '; });
  rest = rest.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  for (const m of rest.matchAll(/\b(?:title|aria-label|placeholder|alt)="([^"]*)"/gi)) units.push(...sentences(m[1]));
  // inline tags keep a sentence together; every other tag (p, div, h1, li, button, ...) ends it
  const text = rest.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (_, tag) => (/^(span|b|i|em|strong|code|a|small|mark|u|kbd)$/i.test(tag) ? ' ' : '\n\n')).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  for (const block of text.split(/\n\s*\n/)) units.push(...sentences(block));
  return units;
}

function walk(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext)); else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Everything that is scanned: [{ file (repo-relative), units: [string] }]. */
export function collect() {
  const files = [];
  for (const f of walk(path.join(POC, 'src'), '.js')) files.push({ f, kind: 'js' });
  files.push({ f: path.join(POC, 'public', 'index.html'), kind: 'html' });
  files.push({ f: path.join(POC, 'README.md'), kind: 'md' });
  files.push({ f: path.join(REPO, 'README.md'), kind: 'md' });
  for (const f of walk(path.join(POC, 'docs'), '.md')) files.push({ f, kind: 'md' });
  return files.map(({ f, kind }) => {
    const text = fs.readFileSync(f, 'utf8');
    const units = kind === 'js' ? jsStrings(text).flatMap((s) => sentences(s.text)) : kind === 'html' ? htmlUnits(text) : mdUnits(text);
    return { file: path.relative(REPO, f), units };
  });
}

/** Unexcused findings: [{ file, term, sentence }], plus which allowlist entries were used. */
export function findOverclaims(scanned, allowlist) {
  const used = new Set();
  const findings = [];
  for (const { file, units } of scanned) {
    for (const u of units) {
      for (const term of claimsIn(u)) {
        if (qualified(u, term)) continue;
        const idx = allowlist.findIndex((e) => e.file === file && e.term === term && e.string === u);
        if (idx >= 0) { used.add(idx); continue; }
        findings.push({ file, term, sentence: u });
      }
    }
  }
  return { findings, used };
}

const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')).entries;

// ---------------------------------------------------------------------------------------------- tests
test('claims scanner: finds string literals, skips comments and regexes, handles templates', () => {
  const src = [
    "// a comment saying 'live' is skipped",
    "const a = 'it is live';",
    'const b = "and regulated";',
    'const re = /["\'] live/g; const d = 10 / 2 / 5;',
    'const t = `final ${x + `inner live`} done`;',
    '/* block */ const e = "esc \\" quote";',
  ].join('\n');
  const got = jsStrings(src).map((s) => s.text);
  assert.deepEqual(got, ['it is live', 'and regulated', 'inner live', 'final … done', 'esc " quote']);
  assert.throws(() => jsStrings("const a = 'oops"), /unterminated/);
});

test('claims scanner: an overclaim is caught, a qualified or disclaiming sentence is not', () => {
  const bad = ['The network is live.', 'Consensus finality in 2 seconds.', 'Final settlement is reached.', 'A regulated bank rail.', 'Deposits are insured and guaranteed.', 'Approved by the regulator.', 'Production ready.', 'Licensed to operate.'];
  for (const s of bad) assert.ok(claimsIn(s).length > 0 && !qualified(s, claimsIn(s)[0]), `should be refused: ${s}`);
  assert.deepEqual(claimsIn('Consensus finality.'), ['consensus finality']);
  const fine = ['Consensus is simulated, so there is no finality.', 'This is a proof of concept, not live.', 'Not regulated.', 'Never insured.', 'A PoC of a live-looking dashboard.'];
  assert.ok(!qualified('See [poc/](poc/README.md) for the live dashboard.', 'live'), 'a poc/ path is not a qualifier');
  for (const s of fine) assert.ok(qualified(s, claimsIn(s)[0]), `should be excused: ${s}`);
  const far = 'The ledger offers offline-checkable finality receipts for every single block ever produced by this network, which is, mind you, not the other way around.';
  assert.ok(!qualified(far, 'finality'), 'a distant "not" must not excuse a claim');
  assert.deepEqual(claimsIn('Settles under test with a live grant.'), ['live']);
});

test('claims scanner: markdown and html are split into the units a reader sees', () => {
  const md = '# Title\n\nA live network. It is simulated.\n\n| a | The ledger is final. |\n- bullet one is regulated\n- bullet two\n';
  assert.deepEqual(mdUnits(md), ['Title', 'A live network.', 'It is simulated.', 'a', 'The ledger is final.', 'bullet one is regulated', 'bullet two']);
  const html = '<h1 title="Live view">Hi</h1><script>const s = "NOT FINAL"; /* x */</script><p>Plain text.</p><!-- hidden live -->';
  const u = htmlUnits(html);
  assert.ok(u.includes('NOT FINAL') && u.includes('Live view') && u.includes('Plain text.'));
  assert.ok(!u.some((x) => /hidden/.test(x)));
});

test('claims: the scan covers real files and real strings (a scan over nothing is a failure)', () => {
  const scanned = collect();
  assert.ok(scanned.length > 0, 'zero files scanned');
  const names = scanned.map((s) => s.file);
  for (const must of ['README.md', 'poc/README.md', 'poc/public/index.html', 'poc/src/iso20022.js', 'poc/src/network.js', 'poc/src/kernel.js', 'poc/src/server.js']) {
    assert.ok(names.includes(must), `${must} must be scanned`);
  }
  for (const s of scanned) assert.ok(s.units.length > 0, `${s.file} yielded no text to scan`);
  const all = scanned.flatMap((s) => s.units);
  // known user-visible strings must have been reached, so a broken extractor cannot pass silently
  assert.ok(all.some((u) => /ledger-accepted \(simulated consensus\)/.test(u)), 'pacs.002 text was not reached');
  assert.ok(all.some((u) => /Outside the grant envelope: resubmit with the institution ops signature/.test(u)), 'ERROR_CATALOG remedy was not reached');
  assert.ok(all.length > 500, `suspiciously little text scanned: ${all.length}`);
});

test('claims: no user-visible string overclaims (consensus finality, final, live, production, regulated, licensed, approved by, insured, guaranteed) without a qualifier', () => {
  const { findings } = findOverclaims(collect(), allowlist);
  assert.deepEqual(findings.map((f) => `${f.file} [${f.term}] ${f.sentence}`), []);
});

test('claims allowlist: every entry is exact, explained, and still needed', () => {
  assert.ok(Array.isArray(allowlist));
  const { used } = findOverclaims(collect(), allowlist);
  allowlist.forEach((e, i) => {
    assert.ok(e.file && e.string && e.term && typeof e.reason === 'string' && e.reason.trim().length > 15, `entry ${i} needs file, string, term and a real reason`);
    assert.ok(TERMS.some((t) => t.id === e.term), `entry ${i}: unknown term ${e.term}`);
    assert.ok(used.has(i), `entry ${i} matches no sentence any more (stale): ${e.file} :: ${e.string.slice(0, 80)}`);
  });
});
