// Roadmap 5.1: caller-type attribution, added from this session's own Web4/agentic-internet
// framing review (02-technical-implementation.md §10; every board seat memo's open-items
// register asks the same question). Not a new access class or a new key: whoever holds
// ops:MPL's key still authenticates as ops:MPL. `caller.kind` is that same signer's own
// self-attested declaration of whether a human or its own automation produced this
// particular instruction - as honest as that limitation sounds, and cryptographically bound
// to the instruction exactly the way `payload` already is, so it cannot be added or changed
// after the fact without invalidating the signature.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => assert.deepEqual(inv(n).violations, [], 'no invariant violations');
// `pay()` can trigger a later follow-up block (e.g. an adapter closing a core task), so the
// instruction itself is not always the most recent block - find it by type instead. Chronological
// order, not the snapshot's newest-first order, matters here since a test may pay() more than once.
function findTxs(n, type) {
  const chrono = [...n.snapshot().blocks].reverse();
  return chrono.flatMap((b) => b.txs.filter((t) => t.type === type));
}

test('caller is part of the signed digest: relabelling it after signing is a bad signature, exactly like a tampered payload', () => {
  const n = new Network();
  const t = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL'], { caller: { kind: 'human' } });
  t.caller = { kind: 'agent' }; // relabel after signing, same trick as an existing payload-tamper test
  const b = n.submit([t]);
  assert.equal(b.results[0].error, 'BAD_SIGNATURE');
  allOk(n);
});

test('omitting caller entirely still verifies and executes exactly as every existing call site does', () => {
  const n = new Network();
  const r = n.pay('MPL:acme', 'NSR:cedar', dollars(10));
  assert.ok(r.ok, r.message);
  const [payment] = findTxs(n, 'PAYMENT');
  assert.deepEqual(payment.caller, { kind: 'unspecified' }, 'no caller declared defaults to unspecified, not a crash or a guess');
  allOk(n);
});

test('a human-attributed instruction and an agent-attributed instruction are genuinely distinguishable in the block log', () => {
  const n = new Network();
  const human = n.pay('MPL:acme', 'NSR:cedar', dollars(10), { caller: { kind: 'human' } });
  assert.ok(human.ok, human.message);

  const agent = n.pay('NSR:cedar', 'MPL:acme', dollars(5), { caller: { kind: 'agent', label: 'treasury-sweep-bot' } });
  assert.ok(agent.ok, agent.message);

  const [firstPayment, secondPayment] = findTxs(n, 'PAYMENT');
  assert.deepEqual(firstPayment.caller, { kind: 'human' });
  assert.deepEqual(secondPayment.caller, { kind: 'agent', label: 'treasury-sweep-bot' });
  allOk(n);
});

test('caller survives an independent replay from genesis unchanged', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(10), { caller: { kind: 'agent', label: 'sweep-bot' } });
  const v = n.verifyReplay();
  assert.ok(v.ok, `replay disagreed with live state (blocks=${v.blocks})`);
  assert.equal(v.stateRoot, n.snapshot().stateRoot);
});
