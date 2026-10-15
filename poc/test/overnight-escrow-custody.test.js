// Overnight review, round 6: an escrow's funds sit in a reserved-id account ("NSR:escrow:<id>") that README and
// charter describe as moving only by ESCROW_RELEASE / EVENT_RELEASE / ESCROW_REFUND. Nothing stopped a generic
// instruction from addressing that account, so the beneficiary's OWN bank (ops + screen of the issuer that holds the
// escrow) could TRANSFER the escrowed money to its customer with no oracle event, leaving the escrow record open at
// a zero balance and the payer unable to be refunded. The same hole existed for REDEEM, PAYMENT, DVP, sweeps,
// FREEZE and a nested ESCROW_LOCK.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const E = 'NSR:escrow:po1';
const bal = (n, id) => n.ledger.s.accounts.get(id).balance;
function gated() {
  const n = new Network();
  const lock = n.escrowLock('MPL:acme', 'NSR:cedar', 'po1', dollars(1000), { eventName: 'delivery' });
  assert.ok(lock.ok, `${lock.error}`);
  assert.equal(bal(n, E), dollars(1000));
  return n;
}
const intact = (n) => { assert.equal(bal(n, E), dollars(1000), 'the escrowed money did not move'); assert.ok(n.ledger.s.escrows.has('po1'), 'the escrow is still open'); };

test('the beneficiary\'s bank cannot TRANSFER escrowed money out without the oracle event', () => {
  const n = gated();
  const cedar = bal(n, 'NSR:cedar');
  const r = n.submitSigned(n.tx('TRANSFER', { from: E, to: 'NSR:cedar', amount: dollars(1000).toString() }, ['ops:NSR', 'screen:NSR']));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'ESCROW_ACCOUNT_RESERVED');
  assert.equal(bal(n, 'NSR:cedar'), cedar);
  intact(n);
  // and the real release path still works afterwards
  const rel = n.eventRelease('po1', 'delivery');
  assert.ok(rel.ok, `${rel.error}: ${rel.message}`);
  assert.equal(bal(n, 'NSR:cedar'), cedar + dollars(1000));
});

test('no other generic instruction can touch an escrow account', () => {
  const n = gated();
  const cases = [
    ['TRANSFER into it', n.tx('TRANSFER', { from: 'NSR:pinnacle', to: E, amount: dollars(5).toString() }, ['ops:NSR', 'screen:NSR'])],
    ['PAYMENT into it from another issuer', n.tx('PAYMENT', { from: 'MPL:harbour', to: E, amount: dollars(5).toString(), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR'])],
    ['REDEEM from it', n.tx('REDEEM', { account: E, amount: dollars(1000).toString() }, ['ops:NSR'])],
    ['FREEZE it', n.tx('FREEZE_ACCOUNT', { account: E }, ['ops:NSR'])],
    ['sweep out of it', n.tx('REGISTER_SWEEP', { sweepId: 'sw1', from: E, to: 'NSR:cedar', keepAmount: '0' }, ['ops:NSR'])],
    ['sweep into it', n.tx('REGISTER_SWEEP', { sweepId: 'sw2', from: 'NSR:cedar', to: E, keepAmount: '0' }, ['ops:NSR'])],
    ['nested ESCROW_LOCK into it', n.tx('ESCROW_LOCK', { from: 'NSR:pinnacle', to: E, amount: dollars(5).toString(), escrowId: 'nest', expiresAt: n.now() + 600 }, ['ops:NSR', 'screen:NSR'])],
    ['DVP with it as buyer', n.tx('DVP', { seller: 'MPL:harbour', buyer: E, secId: 'CAN-2031', qty: '1', cash: dollars(5).toString() }, ['ops:NSR', 'screen:NSR', 'ops:MPL', 'accept:MPL'])],
  ];
  for (const [what, t] of cases) {
    const r = n.submitSigned(t);
    assert.equal(r.ok, false, what);
    assert.equal(r.error, 'ESCROW_ACCOUNT_RESERVED', `${what}: ${r.error} ${r.message}`);
  }
  intact(n);
  n.advance(1); n.heartbeat();
  assert.equal(bal(n, E), dollars(1000), 'no sweep moved anything either');
});

test('control: lock, release and refund (same- and cross-issuer) still work', () => {
  const n = new Network();
  assert.ok(n.escrowLock('MPL:acme', 'MPL:harbour', 'same', dollars(10)).ok);
  assert.ok(n.escrowRelease('same').ok);
  assert.ok(n.escrowLock('MPL:acme', 'NSR:cedar', 'cross', dollars(10), { expiresAt: n.now() + 120 }).ok);
  n.advance(130);
  const rf = n.escrowRefund ? n.escrowRefund('cross') : null;
  if (rf) assert.ok(rf.ok, `${rf.error}`);
});
