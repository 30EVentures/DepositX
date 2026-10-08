// Roadmap 1.1 (Escrow) and 1.2 (PayOnEvent). Both reuse the account-balance model and
// #moveCash's already-proven Convert, so no new conservation math is introduced: an escrow
// is a regular ledger account under a reserved id, created at the beneficiary's issuer so
// release/refund never need a second cross-issuer settlement move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { canon } from '../src/crypto.js';

const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => {
  assert.deepEqual(inv(n).violations, [], 'no invariant violations');
  assert.equal(n.ledger.s.halt, null, 'network not halted');
};
const bal = (n, acct) => n.ledger.s.accounts.get(acct).balance;
const sp = (n, id) => n.ledger.s.issuers.get(id).sp;
const S = (n, id) => n.ledger.supplyOf(id);
// everything except height/time/dedup, matching kernel.test.js's own "state unchanged" helper
// (canon(), not JSON.stringify: balances are BigInt, which JSON.stringify cannot serialize)
const core = (n) => canon({ a: n.ledger.s.accounts, i: n.ledger.s.issuers, an: n.ledger.s.anchor, q: n.ledger.s.queue, e: n.ledger.s.escrows });

// Escrow accounts don't exist yet at genesis; helper builds a lock instruction with the
// right signature set for same-issuer vs cross-issuer, matching Transfer/Payment's own rule.
function lockTx(n, { escrowId, from, to, amount, expiresAt, releaseRole, eventName }) {
  const [a] = from.split(':');
  const [b] = to.split(':');
  const roles = a === b ? [`ops:${a}`, `screen:${a}`] : [`ops:${a}`, `screen:${a}`, `accept:${b}`];
  return n.tx('ESCROW_LOCK', { escrowId, from, to, amount: amount.toString(), expiresAt, releaseRole, eventName }, roles);
}

test('escrow lock+release: same issuer', () => {
  const n = new Network();
  const before = S(n, 'MPL');
  const r = n.submit([lockTx(n, { escrowId: 'esc1', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1000), expiresAt: n.now() + 3600 })]);
  assert.ok(r.results[0].ok, r.results[0].message);
  assert.equal(bal(n, 'MPL:acme'), dollars(500_000 - 1000));
  assert.equal(bal(n, 'MPL:harbour'), dollars(100_000)); // beneficiary not credited yet
  assert.equal(S(n, 'MPL'), before, 'supply unchanged: money moved into the escrow account, not out of the issuer');
  allOk(n);

  const rel = n.submit([n.tx('ESCROW_RELEASE', { escrowId: 'esc1' }, ['ops:MPL'])]);
  assert.ok(rel.results[0].ok, rel.results[0].message);
  assert.equal(bal(n, 'MPL:harbour'), dollars(100_000 + 1000));
  assert.equal(S(n, 'MPL'), before);
  allOk(n);

  // a second release of the same escrow is rejected
  const again = n.submit([n.tx('ESCROW_RELEASE', { escrowId: 'esc1' }, ['ops:MPL'])]);
  assert.equal(again.results[0].error, 'UNKNOWN_ESCROW');
});

test('escrow lock+release: cross issuer, exactly one settlement-position move (at lock)', () => {
  const n = new Network();
  const r = n.submit([lockTx(n, { escrowId: 'esc2', from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(2000), expiresAt: n.now() + 3600 })]);
  assert.ok(r.results[0].ok, r.results[0].message);
  n.pumpCore();
  assert.equal(sp(n, 'MPL'), dollars(2_000_000 - 2000));
  assert.equal(sp(n, 'NSR'), dollars(2_000_000 + 2000));
  assert.equal(bal(n, 'NSR:cedar'), dollars(400_000), 'beneficiary not credited yet');
  allOk(n);

  const spBefore = { MPL: sp(n, 'MPL'), NSR: sp(n, 'NSR') };
  const rel = n.submit([n.tx('ESCROW_RELEASE', { escrowId: 'esc2' }, ['ops:MPL'])]);
  assert.ok(rel.results[0].ok, rel.results[0].message);
  assert.equal(bal(n, 'NSR:cedar'), dollars(400_000 + 2000));
  assert.equal(sp(n, 'MPL'), spBefore.MPL, 'release moves no further settlement position');
  assert.equal(sp(n, 'NSR'), spBefore.NSR);
  allOk(n);
});

test('escrow refund: rejected before expiry, succeeds after, same issuer and cross issuer', () => {
  const n = new Network();
  const expiresAt = n.now() + 100;
  n.submit([lockTx(n, { escrowId: 'esc3', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(500), expiresAt })]);
  n.submit([lockTx(n, { escrowId: 'esc4', from: 'LKS:elm', to: 'NSR:cedar', amount: dollars(700), expiresAt })]);
  n.pumpCore();

  const early3 = n.submit([n.tx('ESCROW_REFUND', { escrowId: 'esc3' }, ['ops:MPL'])]);
  assert.equal(early3.results[0].error, 'ESCROW_NOT_EXPIRED');
  const early4 = n.submit([n.tx('ESCROW_REFUND', { escrowId: 'esc4' }, ['ops:LKS'])]);
  assert.equal(early4.results[0].error, 'ESCROW_NOT_EXPIRED');

  n.advance(200); // past expiresAt
  const acmeBefore = bal(n, 'MPL:acme');
  const elmBefore = bal(n, 'LKS:elm');
  const spBefore = { LKS: sp(n, 'LKS'), NSR: sp(n, 'NSR') };

  const ref3 = n.submit([n.tx('ESCROW_REFUND', { escrowId: 'esc3' }, ['ops:MPL'])]);
  assert.ok(ref3.results[0].ok, ref3.results[0].message);
  assert.equal(bal(n, 'MPL:acme'), acmeBefore + dollars(500));

  const ref4 = n.submit([n.tx('ESCROW_REFUND', { escrowId: 'esc4' }, ['ops:LKS'])]);
  assert.ok(ref4.results[0].ok, ref4.results[0].message);
  n.pumpCore();
  assert.equal(bal(n, 'LKS:elm'), elmBefore + dollars(700), 'cross-issuer refund returns to the original payer account');
  assert.equal(sp(n, 'LKS'), spBefore.LKS + dollars(700), 'settlement position reverses on refund');
  assert.equal(sp(n, 'NSR'), spBefore.NSR - dollars(700));
  allOk(n);

  // a refund of an already-refunded escrow is rejected
  assert.equal(n.submit([n.tx('ESCROW_REFUND', { escrowId: 'esc3' }, ['ops:MPL'])]).results[0].error, 'UNKNOWN_ESCROW');
});

test('escrow: locking more than the payer holds leaves state unchanged, matching an ordinary payment', () => {
  const n = new Network();
  const before = core(n);
  const over = n.submit([lockTx(n, { escrowId: 'esc5', from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(600_000), expiresAt: n.now() + 60 })]);
  assert.equal(over.results[0].error, 'INSUFFICIENT_FUNDS');
  assert.equal(core(n), before);
});

test('PayOnEvent: releases only on the correctly-named event, signed by the registered oracle', () => {
  const n = new Network();
  n.submit([lockTx(n, { escrowId: 'poe1', from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(3000), expiresAt: n.now() + 3600, eventName: 'delivery' })]);
  n.pumpCore();

  // the payer's own key cannot release it via the plain path — this is the whole point of PayOnEvent
  const byPayer = n.submit([n.tx('ESCROW_RELEASE', { escrowId: 'poe1' }, ['ops:MPL'])]);
  assert.equal(byPayer.results[0].error, 'USE_EVENT_RELEASE');

  // wrong event name, even if an oracle for that name exists and signs correctly
  const wrongName = n.submit([n.tx('EVENT_RELEASE', { escrowId: 'poe1', event: 'inspection' }, ['event:inspection'])]);
  assert.equal(wrongName.results[0].error, 'EVENT_MISMATCH');

  // a signature from any other key, attached under the 'event:delivery' role, fails verification
  const forged = n.submit([
    n.tx('EVENT_RELEASE', { escrowId: 'poe1', event: 'delivery' }, ['event:delivery'], { keyOverride: { 'event:delivery': n.sk('ops:MPL') } }),
  ]);
  assert.equal(forged.results[0].error, 'BAD_SIGNATURE');

  const before = bal(n, 'NSR:cedar');
  const ok = n.submit([n.tx('EVENT_RELEASE', { escrowId: 'poe1', event: 'delivery' }, ['event:delivery'])]);
  assert.ok(ok.results[0].ok, ok.results[0].message);
  assert.equal(bal(n, 'NSR:cedar'), before + dollars(3000));
  allOk(n);
});

test('PayOnEvent: an escrow with no eventName cannot be event-released; refund still works if unclaimed', () => {
  const n = new Network();
  const expiresAt = n.now() + 100;
  n.submit([lockTx(n, { escrowId: 'poe2', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(400), expiresAt })]);
  const r = n.submit([n.tx('EVENT_RELEASE', { escrowId: 'poe2', event: 'delivery' }, ['event:delivery'])]);
  assert.equal(r.results[0].error, 'NOT_EVENT_GATED');
  n.advance(200);
  assert.ok(n.submit([n.tx('ESCROW_REFUND', { escrowId: 'poe2' }, ['ops:MPL'])]).results[0].ok);
});

test('PayOnEvent: locking against an unregistered event name is rejected up front', () => {
  const n = new Network();
  const r = n.submit([lockTx(n, { escrowId: 'poe3', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(100), expiresAt: n.now() + 60, eventName: 'no-such-event' })]);
  assert.equal(r.results[0].error, 'UNKNOWN_EVENT');
});

test('Network wrappers: escrowLock/escrowRelease/eventRelease/escrowRefund match the raw tx()+submit() path', () => {
  const n = new Network();
  const lock = n.escrowLock('MPL:acme', 'NSR:cedar', 'w1', dollars(400), { eventName: 'delivery' });
  assert.ok(lock.ok, lock.message);
  assert.ok(n.ledger.s.escrows.has('w1'));
  assert.equal(n.eventRelease('w1', 'inspection').error, 'EVENT_MISMATCH');
  const before = bal(n, 'NSR:cedar');
  assert.ok(n.eventRelease('w1', 'delivery').ok);
  assert.equal(bal(n, 'NSR:cedar'), before + dollars(400));

  const lock2 = n.escrowLock('MPL:acme', 'MPL:harbour', 'w2', dollars(50), { expiresAt: n.now() + 60 });
  assert.ok(lock2.ok, lock2.message);
  assert.equal(n.escrowRefund('w2').error, 'ESCROW_NOT_EXPIRED');
  const before2 = bal(n, 'MPL:acme');
  assert.ok(n.escrowRelease('w2').ok);
  assert.equal(n.escrowRelease('w2').error, 'UNKNOWN_ESCROW');
  void before2;
  allOk(n);
});

// Roadmap 8.2 (external audit finding): ESCROW_RELEASE checked only the raw signature on a
// grant-held releaseRole, never whether the grant was still live. Revoking the agent's grant
// did not stop it releasing escrow funds it already held a releaseRole claim on. The institution
// locks these escrows with its own ops key; only the designated releaser is an agent grant.
test('a grant-held escrow release role stops working the moment its grant is revoked or expired', () => {
  const n = new Network();
  const grant = n.grantAgent({ grantId: 'releaser-1', issuer: 'MPL', label: 'release bot', allowTypes: ['TRANSFER'], perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(2000) }, counterparties: null, notAfter: n.now() + 3600 });
  assert.ok(grant.ok, grant.message);

  // live grant: release works exactly as a plain releaseRole would
  const lock1 = n.escrowLock('MPL:acme', 'NSR:cedar', 'rel-live', dollars(100), { releaseRole: 'agent:releaser-1' });
  assert.ok(lock1.ok, lock1.message);
  const before = bal(n, 'NSR:cedar');
  const rel1 = n.escrowRelease('rel-live');
  assert.ok(rel1.ok, rel1.message);
  assert.equal(bal(n, 'NSR:cedar'), before + dollars(100));

  // revoked grant: the same releaseRole must now fail, and move nothing
  const lock2 = n.escrowLock('MPL:acme', 'NSR:cedar', 'rel-revoked', dollars(50), { releaseRole: 'agent:releaser-1' });
  assert.ok(lock2.ok, lock2.message);
  assert.ok(n.revokeGrant('releaser-1').ok);
  const before2 = bal(n, 'NSR:cedar');
  const escBefore = canon(n.ledger.s.escrows.get('rel-revoked'));
  assert.equal(n.escrowRelease('rel-revoked').error, 'GRANT_REVOKED');
  assert.equal(bal(n, 'NSR:cedar'), before2, 'no money moved');
  assert.equal(canon(n.ledger.s.escrows.get('rel-revoked')), escBefore, 'the escrow record is untouched, still refundable after expiry');
  allOk(n);
});

test('a grant-held escrow release role stops working once its grant expires', () => {
  const n = new Network();
  const grant = n.grantAgent({ grantId: 'releaser-2', issuer: 'MPL', label: 'release bot', allowTypes: ['TRANSFER'], perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(2000) }, counterparties: null, notAfter: n.now() + 100 });
  assert.ok(grant.ok, grant.message);
  const lock = n.escrowLock('MPL:acme', 'NSR:cedar', 'rel-expired', dollars(50), { expiresAt: n.now() + 7200, releaseRole: 'agent:releaser-2' });
  assert.ok(lock.ok, lock.message);
  n.advance(200); // past the grant's not_after, well before the escrow's own expiry
  assert.equal(n.escrowRelease('rel-expired').error, 'GRANT_EXPIRED');
  allOk(n);
});

test('a plain, non-grant releaseRole (the institution\'s own ops key) is unaffected by the grant-liveness check', () => {
  const n = new Network();
  const lock = n.escrowLock('MPL:acme', 'MPL:harbour', 'rel-plain', dollars(20));
  assert.ok(lock.ok, lock.message);
  assert.ok(n.escrowRelease('rel-plain').ok);
  allOk(n);
});
