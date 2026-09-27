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
