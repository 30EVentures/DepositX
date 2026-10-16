// The two charter measures must be COMPUTABLE from the replayable block log, and must never pass vacuously.
//   settlement-model : retained simulated blocks that replay (fresh ledger, from genesis) to the same hash and state root
//   risk-control     : invariant checks that pass, as a share of checks run (4 state invariants per block: P1, P2, P4, P5)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { computeMeasures, measuresFromBlocks, percent, INVARIANTS_PER_BLOCK } from '../../src/flashy/measures.js';

test('a healthy simulated network: every retained block replays and every invariant check passes', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  n.redeem('LKS', 'elm', dollars(100));
  const m = computeMeasures(n);
  assert.equal(m.simulated, true);
  assert.ok(m.replay.total > 0 && m.replay.matched === m.replay.total);
  assert.equal(m.replay.percent, '100.00');
  assert.equal(m.invariants.run, m.replay.total * INVARIANTS_PER_BLOCK);
  assert.equal(m.invariants.passed, m.invariants.run);
  assert.equal(m.invariants.percent, '100.00');
});

test('REFUSAL: zero blocks gives a null percentage, never a vacuous 100', () => {
  const n = new Network();
  const m = measuresFromBlocks({ genesis: n.genesis, log: [], blocks: [] });
  assert.deepEqual(m.replay, { matched: 0, total: 0, percent: null });
  assert.deepEqual(m.invariants, { passed: 0, run: 0, percent: null });
});

test('REFUSAL: a state change that is not in the log makes the replay measure fall (inflate defect)', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  n.chaos('inflate');
  const m = computeMeasures(n);
  assert.ok(m.replay.matched < m.replay.total, 'the blocks after the out-of-band change no longer replay');
  assert.notEqual(m.replay.percent, '100.00');
  assert.ok(m.invariants.passed < m.invariants.run, 'the recorded invariant violation is counted');
});

test('REFUSAL: a halt caused by a broken invariant lowers the invariant measure', () => {
  const n = new Network();
  n.chaos('core_loss');
  const m = computeMeasures(n);
  assert.ok(n.ledger.s.halt);
  assert.ok(m.invariants.passed < m.invariants.run);
});

test('REFUSAL: a tampered transaction in the log is detected by the replay measure', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  const log = JSON.parse(JSON.stringify(n.log));
  const i = log.findIndex((b) => b.txs.some((t) => t.type === 'PAYMENT'));
  log[i].txs.find((t) => t.type === 'PAYMENT').payload.amount = '1';
  const m = measuresFromBlocks({ genesis: n.genesis, log, blocks: n.blocks });
  assert.ok(m.replay.matched < m.replay.total);
});

test('REFUSAL: a tampered recorded block hash is not counted as matching', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  const blocks = n.blocks.map((b, k) => (k === n.blocks.length - 1 ? { ...b, hash: 'f'.repeat(64) } : b));
  const m = measuresFromBlocks({ genesis: n.genesis, log: n.log, blocks });
  assert.equal(m.replay.matched, m.replay.total - 1);
});

test('REFUSAL: more blocks than log entries, or a non-array, is refused rather than guessed at', () => {
  const n = new Network();
  assert.throws(() => measuresFromBlocks({ genesis: n.genesis, log: n.log.slice(1), blocks: n.blocks }), /INCONSISTENT/);
  assert.throws(() => measuresFromBlocks({ genesis: n.genesis, log: 'x', blocks: n.blocks }), /INCONSISTENT/);
  assert.throws(() => measuresFromBlocks({ genesis: null, log: [], blocks: [] }), /INCONSISTENT/);
});

test('retained window: with more log entries than retained blocks the measure covers only the retained blocks', () => {
  const n = new Network();
  for (let i = 0; i < 5; i++) n.pay('MPL:acme', 'NSR:cedar', dollars(1));
  const keep = 4;
  const m = measuresFromBlocks({ genesis: n.genesis, log: n.log, blocks: n.blocks.slice(-keep) });
  assert.equal(m.replay.total, keep);
  assert.equal(m.replay.matched, keep);
  assert.equal(m.retainedBlocks, keep);
});

test('percent is integer arithmetic, truncated to two decimals, null on an empty denominator', () => {
  assert.equal(percent(3, 7), '42.85');
  assert.equal(percent(1, 1), '100.00');
  assert.equal(percent(0, 5), '0.00');
  assert.equal(percent(0, 0), null);
  for (const bad of [[-1, 3], [4, 3], [1.5, 3], ['1', 3], [NaN, 1]]) assert.throws(() => percent(...bad), /INCONSISTENT/);
});

test('the measures are plain data: no secret, key or account name appears in them', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  const s = JSON.stringify(computeMeasures(n));
  assert.ok(!/acme|cedar|MPL|NSR|priv|key/i.test(s));
});
