// Hardening X2: a standing sweep must not move money when TRANSFER itself would refuse to.
// #runSweeps (run from #endOfBlock) used to check only "both accounts exist and the source is over
// keep", so it kept firing during a network halt, while an issuer was quarantined, and from/to a frozen
// or KYC-expired account. A sweep is suspended - not deleted - while any of those holds, reported in
// `sweepFires` with the reason, and fires again by itself once the condition clears.
//
// Harness: a sweep only reveals a missing check when there is excess PENDING at the moment the condition
// holds. A grant-registered sweep with a short window leaves exactly that: after its window is spent the
// remainder waits, and a window turnover would release it. A CONTROL (no condition) proves the harness
// would see a bad firing, so the "nothing moved" assertions below are not vacuous.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const bal = (n, id) => n.ledger.s.accounts.get(id).balance;
const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const lastFires = (n) => n.blocks[n.blocks.length - 1].sweepFires || [];
const submit1 = (n, t) => n.submit([t]).results[0];

// Source holds $3,000 of excess; the grant lets $1,000 per instruction and $2,500 per 600 s window, so
// after three heartbeats $2,500 has moved and $500 is left pending until the window turns over.
function scenario({ src = 'MPL:acme', dst = 'MPL:harbour', kycShort = null } = {}) {
  const n = new Network();
  if (kycShort) {
    const open = submit1(n, n.tx('OPEN_ACCOUNT', { issuer: 'MPL', holderRef: 'kycx', kycRef: 'KYC-X', kycExpires: n.now() + kycShort }, ['ops:MPL']));
    assert.ok(open.ok, open.message);
  }
  const srcIsKyc = src === 'MPL:kycx';
  if (srcIsKyc) {
    const fund = submit1(n, n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:kycx', amount: dollars(3000).toString() }, ['ops:MPL', 'screen:MPL']));
    assert.ok(fund.ok, fund.message);
  }
  const g = n.grantAgent({ grantId: 'sweeper', issuer: 'MPL', label: 'liveness harness', allowTypes: ['REGISTER_SWEEP', 'CANCEL_SWEEP'], perInstructionMax: dollars(1000), window: { seconds: 600, maxTotal: dollars(2500) }, counterparties: null, notAfter: null });
  assert.ok(g.ok, g.message);
  const keep = srcIsKyc ? 0n : bal(n, src) - dollars(3000);
  const reg = submit1(n, n.agentTx('sweeper', 'REGISTER_SWEEP', { sweepId: 'sw-1', from: src, to: dst, keepAmount: keep.toString() }, []));
  assert.ok(reg.ok, `${reg.error}: ${reg.message}`);
  n.advance(1); n.advance(1); n.advance(1);
  assert.equal(bal(n, src) - keep, dollars(500), 'harness precondition: exactly $500 of excess is pending');
  assert.equal(n.ledger.s.grants.get('sweeper').win.spent, dollars(2500), 'harness precondition: the window is spent');
  return { n, src, dst, keep };
}

// Turn the window over, so a sweep that was merely waiting for headroom now has some.
const turnWindow = (n) => n.advance(700);

function assertSuspended(s, reason) {
  const before = bal(s.n, s.src);
  const spentBefore = s.n.ledger.s.grants.get('sweeper').win.spent;
  turnWindow(s.n);
  assert.equal(bal(s.n, s.src), before, 'no money left the source');
  const f = lastFires(s.n).find((x) => x.sweepId === 'sw-1');
  assert.ok(f && f.suspended === true && f.amount === '0' && f.reason === reason, `expected suspended ${reason}, got ${JSON.stringify(lastFires(s.n))}`);
  assert.ok(s.n.ledger.s.sweeps.has('sw-1'), 'the sweep is suspended, not deleted');
  assert.equal(s.n.ledger.s.grants.get('sweeper').win.spent, spentBefore, 'a suspended firing is not charged to the grant window');
  assert.deepEqual(inv(s.n).violations.filter((v) => v.id !== 'P2'), [], 'no invariant violation introduced');
}

// ------------------------------------------------------------------ control
test('X2 control: with no condition applied, the pending excess DOES move once the window turns over', () => {
  const s = scenario();
  const before = bal(s.n, s.src);
  turnWindow(s.n);
  assert.equal(before - bal(s.n, s.src), dollars(500), 'the harness can see a firing; the tests below are not vacuous');
});

// ------------------------------------------------------------------ the three cases
test('X2: a sweep does not fire during a network halt, and fires again once the network is resumed', () => {
  const s = scenario();
  s.n.chaos('core_loss', { issuer: 'MPL' });
  assert.ok(s.n.ledger.s.halt, 'the network is halted');
  assertSuspended(s, 'NETWORK_HALTED');
  // clear the halt: re-attest the true balance, then resume with the co-signatures. The RESUME block's own
  // end-of-block hook runs the sweeps, so the waiting excess moves in that very block - sample first.
  s.n.chaos('reattest', { issuer: 'MPL' });
  const before = bal(s.n, s.src);
  const r = s.n.resume('network');
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.equal(s.n.ledger.s.halt, null);
  assert.equal(before - bal(s.n, s.src), dollars(500), 'once resumed, the waiting sweep fires by itself, in the block that clears the halt');
});

test('X2: a sweep does not fire while its issuer is quarantined', () => {
  const s = scenario();
  s.n.chaos('core_restore', { issuer: 'MPL' });
  assert.equal(s.n.ledger.s.issuers.get('MPL').status, 'QUARANTINED');
  assert.equal(s.n.ledger.s.halt, null, 'quarantine, not a halt');
  assertSuspended(s, 'ISSUER_QUARANTINED');
});

test('X2: quarantine is issuer-scoped - another issuer\'s sweep keeps firing while MPL is quarantined', () => {
  const n = new Network();
  const keep = bal(n, 'NSR:cedar');
  assert.ok(n.registerSweep('nsr-1', 'NSR:cedar', 'NSR:pinnacle', keep).ok);
  n.chaos('core_restore', { issuer: 'MPL' });
  assert.equal(n.ledger.s.issuers.get('MPL').status, 'QUARANTINED');
  // a same-issuer transfer into the sweep source creates $5 of excess at the healthy issuer
  const t = submit1(n, n.tx('TRANSFER', { from: 'NSR:pinnacle', to: 'NSR:cedar', amount: dollars(5).toString() }, ['ops:NSR', 'screen:NSR']));
  assert.ok(t.ok, t.message);
  assert.equal(bal(n, 'NSR:cedar'), keep, 'NSR is ACTIVE, so its sweep moved the $5 straight back out');
});

for (const [name, mk, freeze] of [
  ['source', () => scenario(), 'MPL:acme'],
  ['destination', () => scenario(), 'MPL:harbour'],
]) {
  test(`X2: a sweep does not fire from or to a frozen account (${name} frozen), and fires again when unfrozen`, () => {
    const s = mk();
    const f = submit1(s.n, s.n.tx('FREEZE_ACCOUNT', { account: freeze }, ['ops:MPL']));
    assert.ok(f.ok, f.message);
    assertSuspended(s, 'ACCOUNT_FROZEN');
    const before = bal(s.n, s.src); // the UNFREEZE block's own end-of-block hook runs the sweeps, so sample first
    const u = submit1(s.n, s.n.tx('UNFREEZE_ACCOUNT', { account: freeze }, ['ops:MPL']));
    assert.ok(u.ok, u.message);
    assert.equal(before - bal(s.n, s.src), dollars(500), 'unfrozen: the waiting sweep fires again, in the block that unfreezes');
  });
}

test('X2: a sweep does not fire when the SOURCE account\'s KYC attestation has expired', () => {
  const s = scenario({ src: 'MPL:kycx', kycShort: 400 });
  assertSuspended(s, 'KYC_EXPIRED');
});

test('X2: a sweep does not fire when the DESTINATION account\'s KYC attestation has expired', () => {
  const s = scenario({ dst: 'MPL:kycx', kycShort: 400 });
  assertSuspended(s, 'KYC_EXPIRED');
});

// ------------------------------------------------------------------ institution-registered sweeps (no grant)
test('X2: an institution-registered sweep is gated the same way (quarantined issuer)', () => {
  const n = new Network();
  const keep = bal(n, 'NSR:cedar');
  assert.ok(n.registerSweep('nsr-q', 'NSR:cedar', 'NSR:pinnacle', keep).ok);
  n.chaos('core_restore', { issuer: 'NSR' });
  assert.equal(n.ledger.s.issuers.get('NSR').status, 'QUARANTINED');
  // same-issuer TRANSFER is still accepted under quarantine (pinned below), and it creates $5 of excess
  const t = submit1(n, n.tx('TRANSFER', { from: 'NSR:pinnacle', to: 'NSR:cedar', amount: dollars(5).toString() }, ['ops:NSR', 'screen:NSR']));
  assert.ok(t.ok, t.message);
  assert.equal(bal(n, 'NSR:cedar'), keep + dollars(5), 'the quarantined issuer\'s sweep did not move the excess');
  const f = lastFires(n).find((x) => x.sweepId === 'nsr-q');
  assert.ok(f && f.suspended === true && f.reason === 'ISSUER_QUARANTINED', JSON.stringify(lastFires(n)));
  assert.ok(n.ledger.s.sweeps.has('nsr-q'));
});

test('X2: an institution-registered sweep is gated the same way (frozen destination)', () => {
  const n = new Network();
  const keep = bal(n, 'MPL:acme');
  assert.ok(n.registerSweep('mpl-f', 'MPL:acme', 'MPL:harbour', keep).ok);
  assert.ok(submit1(n, n.tx('FREEZE_ACCOUNT', { account: 'MPL:harbour' }, ['ops:MPL'])).ok);
  const harbour = bal(n, 'MPL:harbour');
  const m = n.mint('MPL', 'acme', dollars(10)); // $10 of excess appears at the source
  assert.ok(m.ok, m.message);
  assert.equal(bal(n, 'MPL:harbour'), harbour, 'nothing was swept into the frozen account');
  assert.equal(bal(n, 'MPL:acme'), keep + dollars(10));
});

// ------------------------------------------------------------------ pins and invariants
test('X2 pin: a same-issuer TRANSFER is still accepted while its issuer is quarantined - sweeps are deliberately STRICTER', () => {
  // #moveCash checks quarantine only on its cross-issuer branch. The X2 requirement suspends sweeps
  // under quarantine anyway (a standing automated rule should not keep moving value in an issuer the
  // graded halt has flagged); this pin records that this is a policy choice, not "same as TRANSFER".
  const n = new Network();
  n.chaos('core_restore', { issuer: 'NSR' });
  assert.equal(n.ledger.s.issuers.get('NSR').status, 'QUARANTINED');
  const t = submit1(n, n.tx('TRANSFER', { from: 'NSR:cedar', to: 'NSR:pinnacle', amount: dollars(1).toString() }, ['ops:NSR', 'screen:NSR']));
  assert.ok(t.ok, 'same-issuer TRANSFER is accepted under quarantine');
});

test('X2: a suspension replays identically from genesis', () => {
  const s = scenario();
  s.n.chaos('core_loss', { issuer: 'MPL' });
  turnWindow(s.n);
  const v = s.n.verifyReplay();
  assert.ok(v.ok, `replay disagreed (blocks=${v.blocks})`);
  assert.equal(v.stateRoot, s.n.snapshot().stateRoot);
});

test('X2: a suspended sweep can still be cancelled by the institution', () => {
  const s = scenario();
  s.n.chaos('core_restore', { issuer: 'MPL' });
  turnWindow(s.n);
  assert.ok(s.n.ledger.s.sweeps.has('sw-1'));
  assert.ok(s.n.cancelSweep('sw-1').ok);
  assert.ok(!s.n.ledger.s.sweeps.has('sw-1'));
});
