// Overnight review, round 1: an agent-authorised PAYMENT that the settlement position cannot cover used to be
// QUEUED for liquidity-saving netting, charged against the grant's window, and then never settled:
// NET_CYCLE re-verifies the queued copy with the institution's `ops` signature (which an agent payment does not
// carry) and the stored copy no longer matches the digest the agent signed (its caller was replaced by the derived
// one). It sat until expiry. Netting for agents is a proposal (STATE.md); until then the kernel must say no up front.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

function setup() {
  const n = new Network();
  const sp = n.ledger.s.issuers.get('MPL').sp;
  assert.ok(n.defund('MPL', sp - dollars(50)).ok); // MPL has $50 of settlement position left
  const g = n.grantAgent({ grantId: 'ag1', issuer: 'MPL', label: 'payer', allowTypes: ['PAYMENT'], perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(5000) }, counterparties: null, notAfter: null });
  assert.ok(g.ok, g.error);
  return n;
}
const pay = (n, queue) => n.agentTx('ag1', 'PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: queue }, ['screen:MPL', 'accept:NSR']);

test('an agent payment the position cannot cover is refused up front instead of queued and stranded', () => {
  const n = setup();
  const r = n.submitSigned(pay(n, true));
  assert.equal(r.ok, false, 'must not be queued');
  assert.equal(r.error, 'AGENT_QUEUE_UNSUPPORTED');
  assert.equal(n.ledger.s.queue.length, 0);
  assert.equal(n.ledger.s.grants.get('ag1').win.spent, 0n, 'the refused payment consumed none of the grant window');
  assert.ok(n.verifyReplay().ok);
});

test('an agent payment with queueIfShort set but enough position still settles at once', () => {
  const n = new Network();
  const g = n.grantAgent({ grantId: 'ag1', issuer: 'MPL', label: 'payer', allowTypes: ['PAYMENT'], perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(5000) }, counterparties: null, notAfter: null });
  assert.ok(g.ok);
  const r = n.submitSigned(pay(n, true));
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.deepEqual(r.events.map((e) => e.type), ['CONVERT_OUT', 'CONVERT_IN', 'PAID']);
});

test('control: an institution-signed queued payment still nets (the queue itself is unchanged)', () => {
  const n = setup();
  const t = n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: true }, ['ops:MPL', 'screen:MPL', 'accept:NSR']);
  assert.deepEqual(n.submitSigned(t).events.map((e) => e.type), ['QUEUED']);
  n.submitSigned(n.tx('PAYMENT', { from: 'NSR:cedar', to: 'MPL:acme', amount: dollars(200).toString(), queueIfShort: true }, ['ops:NSR', 'screen:NSR', 'accept:MPL']));
  n.netCycle();
  assert.equal(n.ledger.s.queue.length, 0);
});

test('a queued payment that rode in a bound batch still nets (the stored copy keeps the signed batch_digest)', () => {
  const n = new Network();
  n.defund('MPL', n.ledger.s.issuers.get('MPL').sp - dollars(50));
  const legs = n.buildBoundBatch([
    { type: 'PAYMENT', payload: { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: true }, roles: ['ops:MPL', 'screen:MPL', 'accept:NSR'] },
    { type: 'TRANSFER', payload: { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, roles: ['ops:MPL', 'screen:MPL'] },
  ]);
  const r = n.submitSigned(n.tx('BATCH', { legs }, []));
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.equal(n.ledger.s.queue.length, 1);
  n.submitSigned(n.tx('PAYMENT', { from: 'NSR:cedar', to: 'MPL:acme', amount: dollars(200).toString(), queueIfShort: true }, ['ops:NSR', 'screen:NSR', 'accept:MPL']));
  n.netCycle();
  assert.equal(n.ledger.s.queue.length, 0, 'the bound leg settled in the netting cycle');
});
