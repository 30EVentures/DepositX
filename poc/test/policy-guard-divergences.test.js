// Cross-check of the DepositX delegation path against a third-party spending-policy conformance corpus
// (policy-guard/1). The corpus is NOT in this repo: it is read from POLICY_GUARD_CORPUS (or the audit clone).
//
// Two kinds of test live here:
//   1. harness tests that always run (they use a tiny corpus written in this file), so the runner itself is
//      proven to fail loudly, to classify all five outcomes, and to catch drift in both directions;
//   2. ONE corpus test that runs only when the corpus is present. When it is absent it is reported as SKIPPED
//      (never as a pass), and the line below says so.
//
// The corpus test asserts the exact set of divergences equals test/policy-guard-divergences.json, so a NEW
// divergence and a SILENTLY-FIXED divergence both fail it. It records differences of design; no kernel
// behaviour is changed to make cases agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CorpusError, STATUS, locateCorpus, loadCorpus, runCorpus, counts, diffAgainstTable, TABLE_FILE } from '../scripts/policy-guard-corpus.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/policy-guard-corpus.mjs', import.meta.url));
const table = JSON.parse(fs.readFileSync(TABLE_FILE, 'utf8'));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pg-harness-'));
const bundle = (over = {}) => ({
  contract: 'conformance/1', profile: 'x/1', version: '0',
  sets: [
    { name: 'd', kind: 'decide', outcomes: ['ALLOW', 'ESCALATE', 'DENY'], cases: [
      { id: 'a', input: 1, expect: { verdict: 'ALLOW' } },
      { id: 'b', input: 2, expect: { verdict: 'DENY', codes: ['X'] } },
      { id: 'c', input: 3, expect: { verdict: 'ALLOW' } },
      { id: 'd', input: 4, expect: { verdict: 'ALLOW' } },
      { id: 'e', input: 5, expect: { verdict: 'ALLOW' } },
      { id: 'f', input: 6 },
    ] },
    { name: 'v', kind: 'validate', cases: [{ id: 'g', input: {}, expect: { valid: true } }] },
  ],
  ...over,
});

test('harness: a missing corpus fails loudly instead of passing on nothing', () => {
  assert.throws(() => locateCorpus({ POLICY_GUARD_CORPUS: path.join(tmp(), 'nope') }), CorpusError);
  const r = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, POLICY_GUARD_CORPUS: path.join(tmp(), 'nope') }, encoding: 'utf8' });
  assert.equal(r.status, 2, 'nonzero exit');
  assert.match(r.stderr, /^FAIL: policy-guard corpus not found/);
});

test('harness: an empty, unreadable or foreign corpus is refused', () => {
  const dir = tmp();
  const put = (o) => { const f = path.join(dir, 'c.json'); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };
  assert.throws(() => loadCorpus(put(bundle({ sets: [{ name: 'd', kind: 'decide', cases: [] }] }))), /zero cases/);
  assert.throws(() => loadCorpus(put(bundle({ sets: [] }))), /zero cases/);
  assert.throws(() => loadCorpus(put('{not json')), /unreadable/);
  assert.throws(() => loadCorpus(put(bundle({ contract: 'other/9' }))), /contract/);
  assert.throws(() => loadCorpus(put(bundle({ sets: [{ name: 'd', kind: 'mystery', cases: [{}] }] }))), CorpusError);
  assert.equal(loadCorpus(put(bundle())).total, 7);
});

test('harness: all five outcomes are told apart', () => {
  const corpus = loadCorpus((() => { const f = path.join(tmp(), 'c.json'); fs.writeFileSync(f, JSON.stringify(bundle())); return f; })());
  const answers = {
    a: { verdict: 'ALLOW' },                             // AGREED
    b: { verdict: 'DENY', codes: ['Y'] },                // DISAGREED: outcome agrees but the required code is missing
    c: { abstain: 'no such concept here' },              // ABSTAINED
    d: null,                                             // THROWS -> UNANSWERED
    e: { verdict: 'MAYBE' },                             // not one of the set's outcomes -> UNREADABLE
    f: { verdict: 'ALLOW' },                             // case has no expect block -> UNREADABLE
    g: { valid: false },                                 // DISAGREED
  };
  const r = runCorpus(corpus, (c) => { if (answers[c.id] === null) throw new Error('boom'); return answers[c.id]; });
  const by = Object.fromEntries(r.map((x) => [x.id, x.status]));
  assert.deepEqual(by, { a: 'AGREED', b: 'DISAGREED', c: 'ABSTAINED', d: 'UNANSWERED', e: 'UNREADABLE', f: 'UNREADABLE', g: 'DISAGREED' });
  assert.deepEqual(counts(r), { AGREED: 1, DISAGREED: 2, ABSTAINED: 1, UNANSWERED: 1, UNREADABLE: 2 });
});

test('harness: drift is caught in both directions and unexplained entries are refused', () => {
  const res = (status, got) => ({ key: 'k/1', status, got });
  const pinned = (status, got, reason = 'because') => ({ divergences: { 'k/1': { status, got, reason } } });
  assert.deepEqual(diffAgainstTable([res(STATUS.AGREED)], { divergences: {} }), []);
  assert.match(diffAgainstTable([res(STATUS.DISAGREED, 'DENY')], { divergences: {} })[0], /NEW divergence k\/1/);
  assert.match(diffAgainstTable([res(STATUS.AGREED)], pinned(STATUS.DISAGREED, 'DENY'))[0], /SILENTLY FIXED k\/1/);
  assert.match(diffAgainstTable([res(STATUS.DISAGREED, 'ALLOW')], pinned(STATUS.DISAGREED, 'DENY'))[0], /CHANGED k\/1/);
  assert.match(diffAgainstTable([res(STATUS.ABSTAINED)], pinned(STATUS.DISAGREED, 'DENY'))[0], /CHANGED k\/1/);
  assert.match(diffAgainstTable([res(STATUS.ABSTAINED)], pinned(STATUS.ABSTAINED, undefined, ''))[0], /no reason/);
});

test('the checked-in table is well formed (every entry explained, only known statuses)', () => {
  const ids = Object.keys(table.divergences);
  assert.ok(ids.length > 0, 'an empty table would mean the corpus test checks nothing');
  for (const [k, v] of Object.entries(table.divergences)) {
    assert.ok([STATUS.DISAGREED, STATUS.ABSTAINED].includes(v.status), `${k}: status`);
    assert.ok(typeof v.reason === 'string' && v.reason.length > 10, `${k}: reason`);
    assert.equal(v.status === STATUS.DISAGREED, typeof v.got === 'string', `${k}: DISAGREED entries pin what DepositX said, ABSTAINED ones do not`);
  }
});

let located = null;
let why = '';
try { located = locateCorpus(); } catch (e) { why = e.message; }

if (!located) {
  console.log(`SKIPPED: policy-guard corpus cross-check not run: ${why}`);
  test('policy-guard corpus cross-check (needs POLICY_GUARD_CORPUS)', { skip: `corpus unavailable: ${why}` }, () => {});
} else {
  test('policy-guard corpus: DepositX divergences equal the pinned table', () => {
    const corpus = loadCorpus(located);
    assert.equal(corpus.profile, table.corpus.profile);
    assert.equal(corpus.version, table.corpus.version, 'corpus version changed: re-review every table entry against the new corpus');
    assert.equal(corpus.total, table.corpus.cases, 'corpus case count changed: re-review the table');
    const results = runCorpus(corpus);
    assert.equal(results.length, corpus.total, 'every case produced a result');
    const c = counts(results);
    assert.equal(c.UNANSWERED + c.UNREADABLE, 0, `no case may go unanswered or unreadable: ${JSON.stringify(c)}`);
    assert.ok(c.AGREED > 0, 'at least one case must genuinely agree, or the adapter is answering nothing');
    assert.deepEqual(diffAgainstTable(results, table), []);
  });
}
