// Phase 1.8: the over-cap question, measured. When an agent instruction is over its grant, DepositX asks for the
// institution's co-signature (ESCALATE); the policy-guard corpus expects a hard refusal (DENY) for the same cases.
// docs/design-questions/over-cap-escalate-or-deny.md set out the options; the owner chose C (two tiers) on 2026-10-16 and it
// is built (test/hardening/hard-tier.test.js). This file keeps the grants WITHOUT a hard tier pinned as they always were
// (the additive guarantee) and measures the corpus.
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

test('measured: with the hard tier built (option C) the corpus reads 22 agreed, 4 disagreed, 18 abstained; the three cap cases and four envelope-shape cases moved', { skip: why ?? false }, () => {
  const res = runCorpus(corpus, answerCase);
  assert.deepEqual(counts(res), { AGREED: 22, DISAGREED: 4, ABSTAINED: 18, UNANSWERED: 0, UNREADABLE: 0 });
  assert.deepEqual(res.filter((r) => r.status === 'DISAGREED').map((r) => r.key).sort(), ['envelopes/no-envelope', 'records/amount-leading-zeros', 'records/amount-zero', 'records/transfer-without-destination'], 'what is left is by design: strict integer strings and the X1 pre-authorization rule');
  const moved = ['caps/per-tx-cap-exceeded', 'caps/daily-cap-exceeded', 'caps/per-tx-checked-before-daily', 'envelope-shape/cap-is-a-number', 'envelope-shape/per-tx-above-daily', 'envelope-shape/ceiling-above-per-tx', 'envelope-shape/ceiling-equals-per-tx'];
  assert.deepEqual(res.filter((r) => moved.includes(r.key)).map((r) => r.status), moved.map(() => 'AGREED'), 'the three cap cases and the four envelope-shape cases now agree');
});
test('measured: turning every ESCALATE into DENY on top of option C would be worse again (19 agreed): the soft tier is real', { skip: why ?? false }, () => {
  const plain = counts(runCorpus(corpus, toDeny(() => 'ESCALATION_REQUIRED')));
  assert.equal(plain.AGREED, 19);
});
test('REFUSAL (measured): the measurements above never pass on an empty or missing corpus', () => {
  assert.throws(() => runCorpus({ sets: [], cases: [] }, answerCase), 'an empty corpus must be refused, not counted as agreement');
  assert.ok(why === null || /corpus/i.test(why), why);
});
