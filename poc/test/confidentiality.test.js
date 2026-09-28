// Roadmap 4.1: M2 confidentiality (issuer-domain need-to-know). Per
// 02-technical-implementation.md T-6/§2.6, M2 is access control, not
// cryptography: a pure view over Network#snapshot()'s existing output. The
// kernel, the invariants and the real settled state are completely
// untouched - this only changes what a viewer is shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars, confidentialView } from '../src/network.js';

function issuer(view, id) {
  return view.issuers.find((i) => i.id === id);
}

test('supervisor view is byte-identical to the full snapshot', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(1234));
  const full = n.snapshot();
  const sup = confidentialView(full, { supervisor: true });
  assert.deepEqual(sup, full);
});

test('an issuer sees its own customers in full, and only id/name/status/quarantine for every other issuer', () => {
  const n = new Network();
  const full = n.snapshot();
  const asMPL = confidentialView(full, { issuer: 'MPL' });

  const own = issuer(asMPL, 'MPL');
  assert.deepEqual(own.customers, full.issuers.find((i) => i.id === 'MPL').customers);
  assert.equal(own.S, full.issuers.find((i) => i.id === 'MPL').S);

  for (const id of ['NSR', 'LKS']) {
    const other = issuer(asMPL, id);
    assert.equal(other.customers, undefined, `${id}'s customers must not be visible to MPL`);
    for (const field of ['S', 'L', 'In', 'H', 'R', 'diff', 'sp', 'coreGL', 'cbBalance']) {
      assert.equal(other[field], undefined, `${id}.${field} must not be visible to MPL`);
    }
    assert.equal(other.id, id);
    assert.equal(other.name, full.issuers.find((i) => i.id === id).name);
    assert.equal(other.status, 'ACTIVE');
  }
});

test('two issuers\' views of the identical state disagree about what is visible', () => {
  const n = new Network();
  const full = n.snapshot();
  const asMPL = confidentialView(full, { issuer: 'MPL' });
  const asNSR = confidentialView(full, { issuer: 'NSR' });

  assert.notDeepEqual(issuer(asMPL, 'MPL'), issuer(asNSR, 'MPL'), 'NSR must not see MPL\'s book the way MPL does');
  assert.notDeepEqual(issuer(asMPL, 'NSR'), issuer(asNSR, 'NSR'), 'MPL must not see NSR\'s book the way NSR does');
  // each still sees its OWN book identically to the full snapshot
  assert.deepEqual(issuer(asMPL, 'MPL'), full.issuers.find((i) => i.id === 'MPL'));
  assert.deepEqual(issuer(asNSR, 'NSR'), full.issuers.find((i) => i.id === 'NSR'));
});

test('a quarantined issuer\'s status is visible even to viewers who cannot see its book', () => {
  const n = new Network();
  n.chaos('core_restore', { issuer: 'NSR' }); // quarantines NSR only, no network halt
  const full = n.snapshot();
  assert.equal(full.issuers.find((i) => i.id === 'NSR').status, 'QUARANTINED');
  const asMPL = confidentialView(full, { issuer: 'MPL' });
  const nsrAsSeenByMPL = issuer(asMPL, 'NSR');
  assert.equal(nsrAsSeenByMPL.status, 'QUARANTINED', 'a payer must be able to see a bad counterparty is quarantined');
  assert.equal(nsrAsSeenByMPL.customers, undefined, 'but still not its book');
});

test('an unrecognised issuer id is treated as an outside party: no issuer\'s book is shown', () => {
  const n = new Network();
  const full = n.snapshot();
  const outsider = confidentialView(full, { issuer: 'NOPE' });
  for (const id of ['MPL', 'NSR', 'LKS']) {
    assert.equal(issuer(outsider, id).customers, undefined);
  }
});

test('building a view never mutates the network or the snapshot it was given', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(500));
  const full = n.snapshot();
  const before = JSON.stringify(full);
  confidentialView(full, { issuer: 'MPL' });
  confidentialView(full, { supervisor: true });
  assert.equal(JSON.stringify(full), before, 'the snapshot passed in must not be mutated');
  assert.equal(JSON.stringify(n.snapshot()), JSON.stringify(full), 'a fresh snapshot of the live network is unaffected by having built views');
  assert.ok(n.pay('NSR:cedar', 'MPL:acme', dollars(1)).ok, 'the network keeps settling normally afterwards');
});
