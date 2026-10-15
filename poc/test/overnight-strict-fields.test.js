// Overnight review, rounds 1 and 7: a payload-mutation probe (every field of 22 instruction types replaced by 26 junk
// values, re-signed with the right keys) found fields that bypass the strict "canonical decimal string of cents"
// rule every other amount obeys, and integers that silently lose precision:
//  - ATTEST.L, OPEN_HOLD.L_after, FUND_SP/DEFUND_SP.A_after went through BigInt(): "" is 0, " 5" is 5, true is 1,
//    [] is 0, "-5" is -5, and junk threw (a rejection only since the kernel was made total) instead of being refused.
//  - Number.isInteger accepted 1e21 for seq, kycExpires, expiresAt and not_after.
//  - PAYMENT.queueIfShort was read for truthiness, so the STRING "false" queued the payment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const internal = (n) => n.ledger.counters.internalErrors || 0;
const JUNK_AMOUNTS = ['', ' 5', '-5', '00', '1.5', '1e3', 'x', '9'.repeat(19), true, false, [], [1], {}, null, 1.5, -1, 1e21, NaN];

test('attested amounts accept only a canonical non-negative decimal string, and refuse the rest cleanly', () => {
  const builds = {
    ATTEST: (n, v) => n.tx('ATTEST', { issuer: 'MPL', seq: n.ledger.s.issuers.get('MPL').seq + 1, L: v }, ['attest:MPL']),
    OPEN_HOLD: (n, v) => n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: 'MPL-H900', amount: '100', L_after: v, seq: n.ledger.s.issuers.get('MPL').seq + 1 }, ['attest:MPL']),
    FUND_SP: (n, v) => n.tx('FUND_SP', { issuer: 'MPL', amount: '100', A_after: v }, ['ops:MPL', 'anchor']),
    DEFUND_SP: (n, v) => n.tx('DEFUND_SP', { issuer: 'MPL', amount: '100', A_after: v }, ['ops:MPL', 'anchor']),
  };
  for (const [type, build] of Object.entries(builds)) {
    for (const v of JUNK_AMOUNTS) {
      const n = new Network();
      const before = internal(n);
      const r = n.submitSigned(build(n, v));
      assert.equal(r.ok, false, `${type} accepted ${JSON.stringify(v)}`);
      assert.equal(internal(n), before, `${type} ${JSON.stringify(v)} was refused by an accident (an exception), not a check`);
    }
  }
  // controls: the canonical forms still work, including "0"
  const n = new Network();
  const L = n.ledger.s.issuers.get('MPL').L.toString();
  assert.ok(n.submitSigned(builds.ATTEST(n, L)).ok);
  const a = n.ledger.s.anchor.A;
  assert.ok(n.submitSigned(n.tx('FUND_SP', { issuer: 'MPL', amount: '100', A_after: (a + 100n).toString() }, ['ops:MPL', 'anchor'])).ok);
});

test('integers that are not safe integers are refused for sequence numbers, expiries and validity', () => {
  for (const big of [1e21, 2 ** 53, -(2 ** 53)]) {
    let n = new Network();
    assert.equal(n.submitSigned(n.tx('OPEN_ACCOUNT', { issuer: 'MPL', holderRef: 'newco', kycRef: 'k', kycExpires: big }, ['ops:MPL'])).ok, false, `kycExpires ${big}`);
    n = new Network();
    assert.equal(n.submitSigned(n.tx('ESCROW_LOCK', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100', escrowId: 'e1', expiresAt: big }, ['ops:MPL', 'screen:MPL'])).ok, false, `expiresAt ${big}`);
    n = new Network();
    assert.equal(n.submitSigned(n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: 'MPL-H900', amount: '100', L_after: n.ledger.s.issuers.get('MPL').L.toString(), seq: big }, ['attest:MPL'])).ok, false, `seq ${big}`);
  }
  const n = new Network();
  const g = n.grantTx({ grantId: 'g1', issuer: 'MPL', label: 'a', allowTypes: ['TRANSFER'], perInstructionMax: dollars(10), window: { seconds: 3600, maxTotal: dollars(100) }, notAfter: 1e21 });
  assert.equal(n.submitSigned(g.tx).ok, false, 'a grant that never expires by way of a float');
});

test('queueIfShort must be a boolean: the string "false" does not queue a payment', () => {
  const n = new Network();
  n.defund('MPL', n.ledger.s.issuers.get('MPL').sp - dollars(50));
  for (const v of ['false', '0', 'no', [], {}, 1, 'x']) {
    const r = n.submitSigned(n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: v }, ['ops:MPL', 'screen:MPL', 'accept:NSR']));
    assert.equal(r.ok, false, `queueIfShort ${JSON.stringify(v)}`);
    assert.notEqual((r.events || []).some((e) => e.type === 'QUEUED'), true);
  }
  assert.equal(n.ledger.s.queue.length, 0);
  const ok = n.submitSigned(n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: true }, ['ops:MPL', 'screen:MPL', 'accept:NSR']));
  assert.deepEqual(ok.events.map((e) => e.type), ['QUEUED']);
});

test('kycRef and holdId are short strings, not coerced or keyed by whatever arrives', () => {
  for (const bad of [{}, [], 5, true, 'A'.repeat(81)]) {
    const n = new Network();
    assert.equal(n.submitSigned(n.tx('OPEN_ACCOUNT', { issuer: 'MPL', holderRef: 'newco', kycRef: bad, kycExpires: n.now() + 1e7 }, ['ops:MPL'])).ok, false, `kycRef ${JSON.stringify(bad)}`);
  }
  for (const bad of [{}, [], 5, true, '', 'A'.repeat(65)]) {
    const n = new Network();
    const iss = n.ledger.s.issuers.get('MPL');
    const r = n.submitSigned(n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: bad, amount: '100', L_after: (iss.L + 100n).toString(), seq: iss.seq + 1 }, ['attest:MPL']));
    assert.equal(r.ok, false, `holdId ${JSON.stringify(bad)}`);
    assert.equal(n.ledger.s.issuers.get('MPL').holds.size, 0);
  }
  const n = new Network();
  assert.ok(n.submitSigned(n.tx('OPEN_ACCOUNT', { issuer: 'MPL', holderRef: 'newco', kycRef: 'KYC-1', kycExpires: n.now() + 1e7 }, ['ops:MPL'])).ok);
  assert.ok(n.mint('MPL', 'acme', dollars(1)).ok, 'the real mint path (bank-generated hold ids) is unchanged');
});
