// Phase 0.4: which of the four earlier DepositX fixes have landed, checked by behaviour on THIS branch (each also has
// its own thorough tests: iso20022.test.js, delegation-gaps.test.js 8.2 to 8.4, batch.test.js). The last test pins the
// one that is still open by design, so a change to it is a visible decision.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { samplePacs008 } from '../../src/iso20022.js';

const G = (id, types) => ({ grantId: id, issuer: 'MPL', label: id, allowTypes: types, perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(10_000) }, counterparties: null, notAfter: null });

test('LANDED 1: the pacs.002 text never says "consensus finality"; it says ledger-accepted, simulated consensus', () => {
  const n = new Network();
  const xml = n.pacs008(samplePacs008({ from: 'MPL:acme', to: 'NSR:cedar', amount: '10.00' }));
  assert.match(xml, /ledger-accepted \(simulated consensus\)/);
  assert.doesNotMatch(xml, /consensus finality|final settlement/i);
});

test('LANDED 2: an escrow whose release role is a grant stops releasing the moment that grant is revoked', () => {
  const n = new Network();
  assert.ok(n.grantAgent(G('rel-1', ['TRANSFER'])).ok);
  assert.ok(n.escrowLock('MPL:acme', 'MPL:harbour', 'e1', dollars(5), { releaseRole: 'agent:rel-1' }).ok);
  assert.ok(n.revokeGrant('rel-1').ok);
  const r = n.submitSigned(n.tx('ESCROW_RELEASE', { escrowId: 'e1' }, ['agent:rel-1']));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'GRANT_REVOKED');
  assert.ok(n.ledger.s.escrows.has('e1'), 'the escrow is still held');
});

test('LANDED 3: a sibling grant cannot cancel another grant\'s sweep, nor refund its escrow', () => {
  const n = new Network();
  assert.ok(n.grantAgent(G('a-1', ['REGISTER_SWEEP', 'CANCEL_SWEEP', 'ESCROW_LOCK', 'ESCROW_REFUND'])).ok);
  assert.ok(n.grantAgent(G('b-1', ['REGISTER_SWEEP', 'CANCEL_SWEEP', 'ESCROW_LOCK', 'ESCROW_REFUND'])).ok);
  assert.ok(n.submitSigned(n.agentTx('a-1', 'REGISTER_SWEEP', { sweepId: 'sw1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(1).toString() }, [])).ok);
  assert.equal(n.submitSigned(n.agentTx('b-1', 'CANCEL_SWEEP', { sweepId: 'sw1' }, [])).error, 'SWEEP_WRONG_GRANT');
  assert.ok(n.ledger.s.sweeps.has('sw1'));
  assert.ok(n.submitSigned(n.agentTx('a-1', 'ESCROW_LOCK', { escrowId: 'e1', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString(), expiresAt: n.now() + 60, releaseRole: 'ops:MPL' }, ['screen:MPL'])).ok);
  n.advance(120);
  assert.equal(n.submitSigned(n.agentTx('b-1', 'ESCROW_REFUND', { escrowId: 'e1' }, [])).error, 'ESCROW_WRONG_GRANT');
});

test('LANDED 4 (partly): a batch whose legs were signed as bound cannot be split, reordered or padded', () => {
  const n = new Network();
  const legs = n.buildBoundBatch([
    { type: 'TRANSFER', payload: { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
    { type: 'TRANSFER', payload: { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(4).toString() }, roles: ['ops:LKS', 'screen:LKS'] },
  ]);
  assert.equal(n.submit([legs[0]]).results[0].error, 'BATCH_LEG_MISBOUND', 'standalone');
  assert.equal(n.submit([n.tx('BATCH', { legs: [legs[0]] }, [])]).results[0].error, 'BATCH_LEG_MISBOUND', 'as a smaller batch');
  assert.equal(n.submit([n.tx('BATCH', { legs: [legs[1], legs[0]] }, [])]).results[0].error, 'BATCH_LEG_MISBOUND', 'reordered');
  assert.ok(n.submit([n.tx('BATCH', { legs }, [])]).results[0].ok, 'whole and in order');
});

test('STILL OPEN by design: binding is opt-in, so a leg signed WITHOUT a batch_digest can be relayed alone', () => {
  const n = new Network();
  const unbound = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10).toString() }, ['ops:LKS', 'screen:LKS']);
  assert.ok(n.submit([unbound]).results[0].ok, 'an unbound leg is an ordinary instruction; nothing says it belonged to a batch');
});
