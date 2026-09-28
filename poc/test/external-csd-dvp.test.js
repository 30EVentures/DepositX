// Roadmap 4.2: 02-technical-implementation.md section 2.4's own named scenario -
// bond at an external depository, cash-only on DepositX, released by a signed
// outside confirmation, with a deadline and refund path ("say so plainly; the
// residual risk window is defined"). Composes Escrow (1.1) + PayOnEvent (1.2)
// exactly as built; no new kernel handler. externalCsdDvp is a thin, correctly-
// configured wrapper - the tests below prove the composition is right for this
// specific, named, regulated shape, not the underlying primitives again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { canon } from '../src/crypto.js';

const bal = (n, acct) => n.ledger.s.accounts.get(acct).balance;
const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => assert.deepEqual(inv(n).violations, [], 'no invariant violations');

test('external-CSD DvP locks only the cash leg: the securities ledger is untouched', () => {
  const n = new Network();
  const registryBefore = n.ledger.s.securities.size;
  // harbour is a bond dealer and already holds CAN-2031 from bootstrap; the point is that
  // externalCsdDvp does not change ANYONE's security holdings, not that they start at zero.
  const harbourSecBefore = canon(n.ledger.s.accounts.get('MPL:harbour').sec);
  const pinnacleSecBefore = canon(n.ledger.s.accounts.get('NSR:pinnacle').sec);
  const r = n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-1', dollars(50_000), { deadlineSeconds: 3600 });
  assert.ok(r.ok, r.message);
  assert.equal(n.ledger.s.securities.size, registryBefore, 'no new security was registered');
  assert.equal(canon(n.ledger.s.accounts.get('MPL:harbour').sec), harbourSecBefore, 'the buyer\'s own security holdings are unchanged');
  assert.equal(canon(n.ledger.s.accounts.get('NSR:pinnacle').sec), pinnacleSecBefore, 'the seller gets no security credited by this call - that happens at the external CSD, off DepositX');
  allOk(n);
});

test('a correct, signed CSD confirmation releases the cash; every other key is refused', () => {
  const n = new Network();
  n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-2', dollars(10_000), { deadlineSeconds: 3600 });
  const before = bal(n, 'NSR:pinnacle');

  assert.equal(n.eventRelease('csd-2', 'delivery').error, 'EVENT_MISMATCH', 'the generic delivery oracle does not confirm a CSD trade');
  const forged = n.submit([n.tx('EVENT_RELEASE', { escrowId: 'csd-2', event: 'csd-confirmation' }, ['event:csd-confirmation'], { keyOverride: { 'event:csd-confirmation': n.sk('ops:MPL') } })]);
  assert.equal(forged.results[0].error, 'BAD_SIGNATURE', 'the buyer\'s own key cannot forge the CSD\'s confirmation');
  assert.equal(bal(n, 'NSR:pinnacle'), before, 'neither wrong attempt moved any money');

  const ok = n.csdConfirm('csd-2');
  assert.ok(ok.ok, ok.message);
  assert.equal(bal(n, 'NSR:pinnacle'), before + dollars(10_000));
  allOk(n);
});

test('before the deadline, the residual risk window is still open: no refund yet', () => {
  const n = new Network();
  n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-3', dollars(5_000), { deadlineSeconds: 600 });
  n.advance(300); // half the window
  assert.equal(n.escrowRefund('csd-3').error, 'ESCROW_NOT_EXPIRED');
  // and a late confirmation still works while the window is open
  assert.ok(n.csdConfirm('csd-3').ok);
});

test('after the deadline, with no confirmation, the window closes and the cash returns - not stuck', () => {
  const n = new Network();
  const before = bal(n, 'MPL:harbour');
  n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-4', dollars(7_500), { deadlineSeconds: 600 });
  assert.equal(bal(n, 'MPL:harbour'), before - dollars(7_500), 'locked while the window is open');
  n.advance(700); // past the deadline
  const r = n.escrowRefund('csd-4');
  assert.ok(r.ok, r.message);
  assert.equal(bal(n, 'MPL:harbour'), before, 'returned in full once the window closes unconfirmed');
  allOk(n);
});

test('a confirmation that arrives after the deadline: documented actual behaviour, not an assumed one', () => {
  // A real, named risk in this design (roadmap 4.2): nothing in ESCROW_LOCK or
  // EVENT_RELEASE re-checks the deadline once the escrow exists - expiresAt is
  // only ever read by ESCROW_REFUND. So a late confirmation still succeeds
  // AS LONG AS no one has refunded it first; whichever of "confirm" or "refund"
  // reaches the ledger first wins, and the other then fails against an
  // UNKNOWN_ESCROW (already closed). This is stated here, not silently assumed.
  const n = new Network();
  n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-5', dollars(1_000), { deadlineSeconds: 600 });
  n.advance(700); // past the deadline, nobody has acted yet
  const before = bal(n, 'NSR:pinnacle');
  const late = n.csdConfirm('csd-5');
  assert.ok(late.ok, 'a late confirmation still succeeds if no one refunded first - documented, not assumed');
  assert.equal(bal(n, 'NSR:pinnacle'), before + dollars(1_000));
  assert.equal(n.escrowRefund('csd-5').error, 'UNKNOWN_ESCROW', 'the same trade cannot then also be refunded');
  allOk(n);
});

test('registration rejects an unrecognised escrow id up front, same as a plain Escrow lock', () => {
  const n = new Network();
  const r = n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-1', dollars(1), { deadlineSeconds: 60 });
  const dup = n.externalCsdDvp('MPL:harbour', 'NSR:pinnacle', 'csd-1', dollars(1), { deadlineSeconds: 60 });
  assert.ok(r.ok);
  assert.equal(dup.error, 'ESCROW_EXISTS');
});
