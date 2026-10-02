// Roadmap 1.3: Batch (T7). Each leg is a fully independent, fully signed instruction, exactly
// as if submitted alone; tx_BATCH dispatches every leg to its own existing handler against the
// SAME top-level Journal that #execTx already rolls back wholesale on any error, so "all legs or
// none" falls out of the atomicity mechanism DvP and NET_CYCLE already rely on — no new rollback
// logic. #checkEnvelope (shared with #execTx) gives every leg its own inst_id/dedup/validity
// checks, so a leg cannot be replayed just because it rode inside a batch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { canon } from '../src/crypto.js';
import { batchDigestOf } from '../src/kernel.js';

const bal = (n, acct) => n.ledger.s.accounts.get(acct).balance;
const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => assert.deepEqual(inv(n).violations, [], 'no invariant violations');
const core = (n) => canon({ a: n.ledger.s.accounts, i: n.ledger.s.issuers, an: n.ledger.s.anchor, q: n.ledger.s.queue, e: n.ledger.s.escrows, sw: n.ledger.s.sweeps });

test('batch: several legs settle atomically, and every leg\'s own events are carried', () => {
  const n = new Network();
  const leg1 = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(100).toString() }, ['ops:LKS', 'screen:LKS']);
  const leg2 = n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR']);
  const leg3 = n.tx('ESCROW_LOCK', { escrowId: 'batch-esc-1', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(50).toString(), expiresAt: n.now() + 3600 }, ['ops:MPL', 'screen:MPL']);
  const before = { elm: bal(n, 'LKS:elm'), fjord: bal(n, 'LKS:fjord'), acme: bal(n, 'MPL:acme'), cedar: bal(n, 'NSR:cedar') };

  const batch = n.tx('BATCH', { legs: [leg1, leg2, leg3] }, []);
  const b = n.submit([batch]);
  const r = b.results[0];
  assert.ok(r.ok, r.message);
  assert.equal(bal(n, 'LKS:elm'), before.elm - dollars(100));
  assert.equal(bal(n, 'LKS:fjord'), before.fjord + dollars(100));
  assert.equal(bal(n, 'MPL:acme'), before.acme - dollars(200) - dollars(50));
  assert.equal(bal(n, 'NSR:cedar'), before.cedar + dollars(200));
  assert.ok(n.ledger.s.escrows.has('batch-esc-1'));
  const types = r.events.map((e) => e.type);
  // leg3 (escrow lock) is same-issuer (MPL -> MPL), so #moveCash takes the plain debit/credit
  // path with no CONVERT_OUT/CONVERT_IN, exactly like leg1's same-issuer Transfer.
  assert.deepEqual(types, ['TRANSFERRED', 'CONVERT_OUT', 'CONVERT_IN', 'PAID', 'ESCROW_LOCKED', 'BATCH_SETTLED']);
  allOk(n);
});

test('batch: one invalid leg (the last) leaves everything unchanged, including legs that would have succeeded', () => {
  const n = new Network();
  const before = core(n);
  const good = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(500_000).toString() }, ['ops:LKS', 'screen:LKS']); // would fully drain elm
  const bad = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(1).toString() }, ['ops:LKS', 'screen:LKS']); // now overdrafts
  const b = n.submit([n.tx('BATCH', { legs: [good, bad] }, [])]);
  assert.equal(b.results[0].error, 'INSUFFICIENT_FUNDS');
  assert.equal(core(n), before, 'the first leg, which alone would have succeeded, was rolled back too');
});

test('batch: an invalid FIRST leg also rolls back a valid second leg', () => {
  const n = new Network();
  const before = core(n);
  const bad = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(9_000_000).toString() }, ['ops:LKS', 'screen:LKS']);
  const good = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL']);
  const b = n.submit([n.tx('BATCH', { legs: [bad, good] }, [])]);
  assert.equal(b.results[0].error, 'VALUE_CAP_EXCEEDED');
  assert.equal(core(n), before);
});

test('batch: a leg cannot be replayed by wrapping the same signed instruction in a new batch', () => {
  const n = new Network();
  const leg = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(1).toString() }, ['ops:LKS', 'screen:LKS']);
  const first = n.submit([n.tx('BATCH', { legs: [leg] }, [])]);
  assert.ok(first.results[0].ok, first.results[0].message);
  const second = n.submit([n.tx('BATCH', { legs: [leg] }, [])]); // same leg, fresh outer batch id
  assert.equal(second.results[0].error, 'DUPLICATE_INSTRUCTION');
});

test('batch: nesting a BATCH inside a BATCH is rejected explicitly, not accepted or looped', () => {
  const n = new Network();
  const before = core(n);
  const leg = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(1).toString() }, ['ops:LKS', 'screen:LKS']);
  const inner = n.tx('BATCH', { legs: [leg] }, []);
  const outer = n.tx('BATCH', { legs: [inner] }, []);
  const b = n.submit([outer]);
  assert.equal(b.results[0].error, 'BATCH_NO_NESTING');
  assert.equal(core(n), before);
});

test('batch: an empty legs array is rejected', () => {
  const n = new Network();
  const b = n.submit([n.tx('BATCH', { legs: [] }, [])]);
  assert.equal(b.results[0].error, 'BATCH_EMPTY');
  const b2 = n.submit([n.tx('BATCH', {}, [])]);
  assert.equal(b2.results[0].error, 'BATCH_EMPTY');
});

test('batch: a malformed leg is rejected with the same code a standalone malformed instruction gets', () => {
  const n = new Network();
  const standalone = n.submit([{ inst_id: 'x', type: 'TRANSFER', payload: {}, valid_until: n.now() + 60, sigs: {} }]);
  const leg = { inst_id: 'x', type: 'TRANSFER', payload: {}, valid_until: n.now() + 60, sigs: {} };
  const batched = n.submit([n.tx('BATCH', { legs: [leg] }, [])]);
  assert.equal(batched.results[0].error, standalone.results[0].error);
});

test('Network wrapper: batch() matches the raw tx()+submit() path', () => {
  const n = new Network();
  const leg1 = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, ['ops:LKS', 'screen:LKS']);
  const leg2 = n.tx('TRANSFER', { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(5).toString() }, ['ops:LKS', 'screen:LKS']);
  const before = bal(n, 'LKS:elm');
  const r = n.batch([leg1, leg2]);
  assert.ok(r.ok, r.message);
  assert.equal(bal(n, 'LKS:elm'), before - dollars(10) + dollars(5));
  allOk(n);
});

// --------------------------------------------------------------------------------------------
// Roadmap 8.4 (external audit finding): a BATCH's outer envelope is unsigned - each leg is a
// fully independent, fully signed instruction, so anyone relaying it (not just its signer) could
// submit a subset of the legs standalone, or as a smaller/reordered batch, breaking the signer's
// actual "all these together or none" intent. Fix: a leg's own signed digest may optionally carry
// a `batch_digest` - a hash over the exact, ordered inst_ids it was signed to ride with. Once a
// leg carries one, the kernel refuses to execute it anywhere the ambient batch's own recomputed
// digest doesn't match exactly. Omitted, a leg behaves exactly as every test above already shows.
function boundLegs(n, specs) {
  // Two-pass, like a real signer would do: decide every leg's final inst_id first (so the digest
  // is fixed before anything is signed), THEN sign each leg against that digest.
  const instIds = specs.map((s, i) => s.instId || `batchleg-${i}-${n.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const digest = batchDigestOf(instIds);
  return specs.map((s, i) => n.tx(s.type, s.payload, s.roles, { instId: instIds[i], batchDigest: digest }));
}

test('8.4: a bound batch with every leg present, in order, settles exactly like an unbound one', () => {
  const n = new Network();
  const before = { elm: bal(n, 'LKS:elm'), fjord: bal(n, 'LKS:fjord') };
  const legs = boundLegs(n, [
    { type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
    { type: 'TRANSFER', payload: { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(4).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
  ]);
  const r = n.batch(legs);
  assert.ok(r.ok, r.message);
  assert.equal(bal(n, 'LKS:elm'), before.elm - dollars(10) + dollars(4));
  assert.equal(bal(n, 'LKS:fjord'), before.fjord + dollars(10) - dollars(4));
  allOk(n);
});

test('8.4: a bound leg submitted standalone (no batch at all) is refused and moves nothing', () => {
  const n = new Network();
  const before = core(n);
  const [leg] = boundLegs(n, [{ type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, roles: ['ops:LKS', 'screen:LKS'] }]);
  const r = n.submit([leg]);
  assert.equal(r.results[0].error, 'BATCH_LEG_MISBOUND');
  assert.equal(core(n), before);
});

test('8.4: relaying only one of two bound legs as a smaller batch is refused for the leg that rides alone', () => {
  const n = new Network();
  const before = core(n);
  const legs = boundLegs(n, [
    { type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
    { type: 'TRANSFER', payload: { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(4).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
  ]);
  const r = n.batch([legs[0]]); // relay only the first leg, as its own one-leg batch
  assert.equal(r.error, 'BATCH_LEG_MISBOUND');
  assert.equal(core(n), before, 'nothing moved - not even the first leg alone');
});

test('8.4: reordering the same two bound legs into a new batch is refused: the digest is order-sensitive', () => {
  const n = new Network();
  const before = core(n);
  const legs = boundLegs(n, [
    { type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
    { type: 'TRANSFER', payload: { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(4).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
  ]);
  const r = n.batch([legs[1], legs[0]]); // same legs, reversed order
  assert.equal(r.error, 'BATCH_LEG_MISBOUND');
  assert.equal(core(n), before);
});

test('8.4: adding a third, unrelated leg alongside the original two also breaks the original pair\'s binding', () => {
  const n = new Network();
  const before = core(n);
  const legs = boundLegs(n, [
    { type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
    { type: 'TRANSFER', payload: { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(4).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
  ]);
  const extra = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL']); // not bound to anything
  const r = n.batch([...legs, extra]);
  assert.equal(r.error, 'BATCH_LEG_MISBOUND');
  assert.equal(core(n), before, 'the signer\'s exact intended set is enforced, not a subset relationship');
});

test('8.4: Network.buildBoundBatch produces legs that settle together, and none of them runs alone', () => {
  const n = new Network();
  const spec = (amt) => ({ type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(amt).toString() }, roles: ['ops:LKS', 'screen:LKS'] });
  const legs = n.buildBoundBatch([spec(3), spec(4)]);
  assert.ok(legs.every((l) => typeof l.batch_digest === 'string' && l.batch_digest === legs[0].batch_digest));
  assert.equal(n.submit([legs[0]]).results[0].error, 'BATCH_LEG_MISBOUND');
  assert.equal(n.submit([legs[1]]).results[0].error, 'BATCH_LEG_MISBOUND');
  const before = bal(n, 'LKS:fjord');
  const r = n.batch(legs);
  assert.ok(r.ok, r.message);
  assert.equal(bal(n, 'LKS:fjord'), before + dollars(7));
  allOk(n);
});

test('8.4: a leg with no batch_digest is completely unaffected - every existing batch test above still passes unbound', () => {
  const n = new Network();
  const leg = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(1).toString() }, ['ops:LKS', 'screen:LKS']);
  assert.equal(leg.batch_digest, null);
  const r = n.submit([leg]); // unbound: standalone is fine, exactly as before this roadmap item
  assert.ok(r.results[0].ok, r.results[0].message);
});

test('8.4: batch_digest is part of the signed digest: stripping it after signing (to make a bound leg look unbound) is a bad signature, not a bypass', () => {
  const n = new Network();
  const before = core(n);
  const [leg] = boundLegs(n, [{ type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(1).toString() }, roles: ['ops:LKS', 'screen:LKS'] }]);
  leg.batch_digest = null; // strip the binding so the standalone check passes - the signature must still catch it
  const r = n.submit([leg]);
  assert.equal(r.results[0].error, 'BAD_SIGNATURE');
  assert.equal(core(n), before);
});

test('8.4: BATCH_LEG_MISBOUND is in the machine-readable error catalog with a remedy, and the schema documents batch_digest', () => {
  const s = Network.schema();
  assert.equal(typeof s.errors.BATCH_LEG_MISBOUND.remedy, 'string');
  assert.equal(s.errors.BATCH_LEG_MISBOUND.retryable, false);
  assert.match(s.envelope.signed_digest, /batch_digest/);
});
