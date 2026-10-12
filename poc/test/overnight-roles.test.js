// Overnight review, round 1: role and oracle names are looked up in plain objects, so names that exist on every
// object (constructor, toString, __proto__ ...) passed the "is this a known role/oracle?" checks at escrow lock
// time. Such an escrow can never be released (nobody holds that key) and is stuck until it expires.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const lock = (n, extra) => n.submitSigned(n.tx('ESCROW_LOCK', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(10).toString(), escrowId: 'e1', expiresAt: n.now() + 3600, ...extra }, ['ops:MPL', 'screen:MPL']));

for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
  test(`an escrow cannot be gated on the inherited name "${name}" as an oracle event`, () => {
    const n = new Network();
    const r = lock(n, { eventName: name });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'UNKNOWN_EVENT');
    assert.equal(n.ledger.s.escrows.size, 0);
  });
  for (const kind of ['gov', 'event', 'reconciler']) {
    test(`an escrow cannot name the release role ${kind}:${name}`, () => {
      const n = new Network();
      const r = lock(n, { releaseRole: `${kind}:${name}` });
      assert.equal(r.ok, false);
      assert.equal(r.error, 'BAD_RELEASE_ROLE');
    });
  }
}

test('control: the real oracle and a real release role still work', () => {
  const n = new Network();
  assert.ok(lock(n, { eventName: 'delivery' }).ok);
  const n2 = new Network();
  assert.ok(lock(n2, { releaseRole: 'gov:operator' }).ok);
});

test('a role with extra segments is not read as its first two (agent:p1:zz is not grant p1)', () => {
  const n = new Network();
  const g = n.grantAgent({ grantId: 'p1', issuer: 'MPL', label: 'a', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 86400, maxTotal: dollars(1000) }, counterparties: null, notAfter: null });
  assert.ok(g.ok);
  const r = lock(n, { releaseRole: 'agent:p1:zz' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'BAD_RELEASE_ROLE');
  assert.equal(lock(n, { releaseRole: 5 }).error, 'BAD_RELEASE_ROLE', 'a non-string release role is a clean rejection');
});
