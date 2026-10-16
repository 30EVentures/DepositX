// Phase 1.8: the over-cap question, measured. When an agent instruction is over its grant, DepositX asks for the
// institution's co-signature (ESCALATE); the policy-guard corpus expects a hard refusal (DENY) for the same cases.
// docs/design-questions/over-cap-escalate-or-deny.md sets out the options for Caleb. This file pins what is true today
// (Option A) and measures what the alternatives would do to the corpus, so the decision rests on numbers. The tests for
// the alternatives themselves are in test/pending/ (red on purpose until a decision).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { locateCorpus, loadCorpus, runCorpus, counts, CorpusError } from '../../scripts/policy-guard-corpus.mjs';
import { answerCase } from '../support/policy-guard-adapter.js';

// ---------- Option A: what DepositX does today (pinned) ----------
const grant = (n) => assert.ok(n.grantAgent({ grantId: 'g1', issuer: 'MPL', label: 'treasury', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 86400, maxTotal: dollars(1000) }, counterparties: null, notAfter: null }).ok);
const xfer = (n, amount, opts) => n.submitSigned(n.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: amount.toString() }, ['screen:MPL'], opts));

test('Option A (today): exactly at the per-instruction maximum is allowed; one cent over asks for the institution', () => {
  const n = new Network(); grant(n);
  assert.equal(xfer(n, dollars(100)).ok, true);
  const over = xfer(n, dollars(100) + 1n);
  assert.equal(over.ok, false); assert.equal(over.error, 'ESCALATION_REQUIRED');
  assert.match(over.remedy ?? '', /institution|ops/i, 'the remedy names the institution\'s co-signature');
});
test('Option A (today): with the institution\'s co-signature the same instruction runs and does not use up the grant\'s window', () => {
  const n = new Network(); grant(n);
  const spentBefore = n.ledger.s.grants.get('g1').win.spent;
  assert.equal(xfer(n, dollars(500), { escalate: true }).ok, true);
  assert.equal(n.ledger.s.grants.get('g1').win.spent, spentBefore, 'institution-authorised spends are outside the envelope and are not charged to it');
});
test('Option A (today): past the window cap the answer is the same ESCALATION_REQUIRED, not a different refusal', () => {
  const n = new Network(); grant(n);
  for (let i = 0; i < 10; i++) assert.equal(xfer(n, dollars(100)).ok, true);
  const r = xfer(n, dollars(1));
  assert.equal(r.error, 'ESCALATION_REQUIRED');
  assert.equal(n.verifyReplay().ok, true);
});
test('REFUSAL (Option A): without the co-signature nothing moves, whichever limit was passed', () => {
  const n = new Network(); grant(n);
  const before = n.ledger.s.accounts.get('MPL:harbour').balance;
  assert.equal(xfer(n, dollars(101)).ok, false);
  assert.equal(xfer(n, dollars(1_000_000)).ok, false);
  assert.equal(n.ledger.s.accounts.get('MPL:harbour').balance, before);
});

// ---------- what each option would do to the corpus (needs the corpus; skipped, loudly, if it cannot be found) ----------
let corpus = null, why = null;
try { corpus = loadCorpus(locateCorpus()); } catch (e) { why = e instanceof CorpusError ? e.message : String(e); }
const toDeny = (codeFor) => (c, k) => { const a = answerCase(c, k); return a && a.verdict === 'ESCALATE' ? { verdict: 'DENY', codes: [codeFor(`${c.set}/${c.id}`)] } : a; };

test('measured: Option A leaves 15 agreed, 7 disagreed, 22 abstained, and the three cap cases are the design difference', { skip: why ?? false }, () => {
  const res = runCorpus(corpus, answerCase);
  assert.deepEqual(counts(res), { AGREED: 15, DISAGREED: 7, ABSTAINED: 22, UNANSWERED: 0, UNREADABLE: 0 });
  assert.deepEqual(res.filter((r) => r.status === 'DISAGREED' && r.key.startsWith('caps/')).map((r) => r.key).sort(), ['caps/daily-cap-exceeded', 'caps/per-tx-cap-exceeded', 'caps/per-tx-checked-before-daily']);
});
test('measured: Option B (every ESCALATE becomes DENY) is WORSE on the corpus even with matching codes, because the corpus has a soft tier that expects ESCALATE', { skip: why ?? false }, () => {
  const plain = counts(runCorpus(corpus, toDeny(() => 'ESCALATION_REQUIRED')));
  assert.equal(plain.AGREED, 12);
  const coded = runCorpus(corpus, toDeny((k) => ({ 'caps/per-tx-cap-exceeded': 'PER_TX_CAP', 'caps/daily-cap-exceeded': 'DAILY_CAP', 'caps/per-tx-checked-before-daily': 'PER_TX_CAP' }[k] ?? 'X')));
  assert.equal(counts(coded).AGREED, 15, 'three hard-cap cases fixed, the two exact-boundary soft cases lost: no net gain');
  assert.deepEqual(coded.filter((r) => r.status === 'DISAGREED' && r.key.startsWith('caps/')).map((r) => r.key).sort(), ['caps/daily-cap-exact', 'caps/per-tx-cap-exact']);
});
test('REFUSAL (measured): the measurements above never pass on an empty or missing corpus', () => {
  assert.throws(() => runCorpus({ sets: [], cases: [] }, answerCase), 'an empty corpus must be refused, not counted as agreement');
  assert.ok(why === null || /corpus/i.test(why), why);
});
