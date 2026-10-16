// Phase 1.5 (X1 follow-up): the earlier X1 fix made a missing or bad signature answer the same whatever the target's
// state. Several checks were added after it (reserved escrow accounts, caller shape, grant binding, strict numerics,
// depth bound). This file proves none of them reopened the oracle: for every instruction type that names an account,
// an unauthenticated caller gets the IDENTICAL result whether the target is missing, ordinary, frozen, KYC-expired
// or an escrow holding account, and whether the payload is shaped well or badly in the fields that name state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';

function world() {
  const n = new Network();
  const kyc = n.now() + 1e7;
  const open = (issuer, ref, exp = kyc) => n.submit([n.tx('OPEN_ACCOUNT', { issuer, holderRef: ref, kycRef: 'k', kycExpires: exp }, [`ops:${issuer}`])]);
  for (const I of ['MPL', 'NSR']) {
    open(I, 'stale', n.now() + 5);
    open(I, 'spare');
  }
  n.submit([n.tx('FREEZE_ACCOUNT', { account: 'MPL:harbour' }, ['ops:MPL'])]);
  n.submit([n.tx('FREEZE_ACCOUNT', { account: 'NSR:pinnacle' }, ['ops:NSR'])]);
  assert.ok(n.escrowLock('MPL:acme', 'MPL:spare', 'po1', dollars(5), { eventName: 'delivery' }).ok); // makes MPL:escrow:po1
  assert.ok(n.escrowLock('NSR:cedar', 'NSR:spare', 'po2', dollars(5), { eventName: 'delivery' }).ok); // makes NSR:escrow:po2
  n.clockOffset += 10; // the 'stale' accounts are now KYC-expired
  return n;
}
// targets that all belong to ONE issuer: the issuer in an account id is the caller's own input and is allowed to
// shape the answer (it names the signature required); what must not shape it is the STATE of the named account
const ORDINARY = { MPL: 'MPL:acme', NSR: 'NSR:cedar' };
const FROZEN = { MPL: 'MPL:harbour', NSR: 'NSR:pinnacle' };
const targets = (I) => ({ ghost: `${I}:ghost`, ordinary: ORDINARY[I], frozen: FROZEN[I], stale: `${I}:stale`, escrow: `${I}:escrow:${I === 'MPL' ? 'po1' : 'po2'}`, ghostEscrow: `${I}:escrow:nope` });
const A = dollars(1).toString();
// every instruction shape that names an account: [issuer of the target, builder(target) -> [type, payload, roles]]
const SHAPES = {
  'TRANSFER (as payee)': ['MPL', (t) => ['TRANSFER', { from: 'MPL:acme', to: t, amount: A }, ['ops:MPL', 'screen:MPL']]],
  'TRANSFER (as payer)': ['MPL', (t) => ['TRANSFER', { from: t, to: 'MPL:spare', amount: A }, ['ops:MPL', 'screen:MPL']]],
  'PAYMENT (as payee)': ['NSR', (t) => ['PAYMENT', { from: 'MPL:acme', to: t, amount: A, queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR']]],
  'REDEEM': ['MPL', (t) => ['REDEEM', { account: t, amount: A }, ['ops:MPL']]],
  'FREEZE_ACCOUNT': ['MPL', (t) => ['FREEZE_ACCOUNT', { account: t }, ['ops:MPL']]],
  'UNFREEZE_ACCOUNT': ['MPL', (t) => ['UNFREEZE_ACCOUNT', { account: t }, ['ops:MPL']]],
  'ESCROW_LOCK (to)': ['NSR', (t) => ['ESCROW_LOCK', { from: 'MPL:acme', to: t, amount: A, escrowId: 'zz1', expiresAt: 4_000_000_000 }, ['ops:MPL', 'screen:MPL', 'accept:NSR']]],
  'REGISTER_SWEEP (to)': ['MPL', (t) => ['REGISTER_SWEEP', { sweepId: 'zz1', from: 'MPL:acme', to: t, keepAmount: '0' }, ['ops:MPL']]],
  'REGISTER_SWEEP (from)': ['MPL', (t) => ['REGISTER_SWEEP', { sweepId: 'zz1', from: t, to: 'MPL:spare', keepAmount: '0' }, ['ops:MPL']]],
  'DVP (buyer)': ['NSR', (t) => ['DVP', { seller: 'MPL:acme', buyer: t, secId: 'CAN-2031', qty: '1', cash: A }, ['ops:NSR', 'screen:NSR', 'ops:MPL', 'accept:MPL']]],
  'CREDIT_SECURITY': ['MPL', (t) => ['CREDIT_SECURITY', { account: t, secId: 'CAN-2031', qty: '1' }, ['gov:operator', 'gov:neutral']]],
};
// signature states an attacker can present: none, wrong key for every role, or a valid signature for only some roles
function presented(n, type, payload, roles, how) {
  if (how === 'none') return { ...n.tx(type, payload, [], {}), sigs: {} };
  if (how === 'wrong-key') { const t = n.tx(type, payload, roles, {}); const other = n.tx(type, payload, roles.slice(0, 1), { keyOverride: Object.fromEntries(roles.map((r) => [r, n.K.gov.operator.priv])) }); return { ...t, sigs: { ...other.sigs, ...Object.fromEntries(roles.map((r) => [r, other.sigs[roles[0]]])) } }; }
  const t = n.tx(type, payload, roles.slice(1), {}); // the first role is simply missing
  return t;
}
const strip = (r) => ({ ok: r.ok, error: r.error, message: r.message, retryable: r.retryable, remedy: r.remedy });

for (const how of ['none', 'wrong-key', 'first-role-missing']) {
  for (const [shape, [issuer, build]] of Object.entries(SHAPES)) {
    test(`REFUSAL (no oracle): ${shape}, signatures ${how}: the answer does not depend on the target's state`, () => {
      const n = world();
      const answers = {};
      for (const [label, acct] of Object.entries(targets(issuer))) {
        const [type, payload, roles] = build(acct);
        const t = presented(n, type, payload, roles, how);
        const nn = n; // one shared world: nothing here is accepted, so the world does not change
        answers[label] = JSON.stringify(strip(nn.submitSigned(t)));
      }
      const distinct = new Set(Object.values(answers));
      assert.equal(distinct.size, 1, `an unauthenticated caller can tell the targets apart: ${JSON.stringify(answers, null, 1)}`);
      assert.equal(JSON.parse([...distinct][0]).ok, false);
    });
  }
}

test('REFUSAL (no oracle): the new byte-only checks may differ (they depend on the caller\'s own bytes) but never on state', () => {
  const n = world();
  // a bad caller shape is refused the same way against every target, because it is a function of the bytes alone
  const shapeAnswers = new Set();
  for (const acct of Object.values(targets('MPL'))) {
    const t = n.tx('TRANSFER', { from: 'MPL:acme', to: acct, amount: A }, ['ops:MPL', 'screen:MPL'], { caller: { kind: 'agent', grant_id: 'x' } });
    shapeAnswers.add(JSON.stringify(strip(n.submitSigned(t))));
  }
  assert.equal(shapeAnswers.size, 1);
  assert.equal(JSON.parse([...shapeAnswers][0]).error, 'CALLER_MISMATCH');
});

test('the same instruction, properly signed, DOES get the specific reason (the secrecy is only before authentication)', () => {
  const n = world();
  const reasons = {};
  for (const [label, acct] of Object.entries(targets('MPL'))) {
    const [type, payload, roles] = SHAPES['TRANSFER (as payee)'][1](acct);
    reasons[label] = n.submitSigned(n.tx(type, payload, roles)).error;
  }
  assert.equal(reasons.ghost, 'UNKNOWN_ACCOUNT');
  assert.equal(reasons.ghostEscrow, 'UNKNOWN_ACCOUNT');
  assert.equal(reasons.frozen, 'ACCOUNT_FROZEN');
  assert.equal(reasons.stale, 'KYC_EXPIRED');
  assert.equal(reasons.escrow, 'ESCROW_ACCOUNT_RESERVED');
  assert.equal(reasons.ordinary, 'SELF_TRANSFER', 'the payer is MPL:acme itself: a state-free shape error, only seen once signed');
});
