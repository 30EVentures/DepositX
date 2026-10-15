// Overnight review, round 3 (authority): `caller` on an institution-signed instruction is self-attested and may be
// {kind, label?} only. The kernel accepted ANY object, so an ops-signed instruction could declare
// {kind:'agent', grant_id:'sweeper-1', label:'treasury sweeper'} - byte for byte the shape the kernel itself stamps on
// an instruction it derived from a grant - and the block log could not tell a forged attribution from a derived one.
// It also let any amount of junk ride in the caller and into the stored state (the queue keeps it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const xfer = (n, caller) => n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL'], { caller });

test('a self-declared caller cannot carry the fields the kernel derives from a grant', () => {
  const n = new Network();
  for (const caller of [
    { kind: 'agent', grant_id: 'sweeper-1', label: 'treasury sweeper' },
    { kind: 'agent', label: 'x', grant_id: 'g' },
    { kind: 'human', note: 'x'.repeat(5000) },
  ]) {
    const r = n.submitSigned(xfer(n, caller));
    assert.equal(r.ok, false, JSON.stringify(caller).slice(0, 60));
    assert.equal(r.error, 'CALLER_MISMATCH');
  }
});

test('a self-declared caller must be a plain {kind, label?} with a short string kind and label', () => {
  const n = new Network();
  for (const caller of [[], 'agent', 42, { kind: 7 }, { kind: 'agent', label: 5 }, { kind: 'agent', label: 'x'.repeat(81) }, { label: 'no kind' }, { kind: '' }]) {
    const r = n.submitSigned(xfer(n, caller));
    assert.equal(r.ok, false, JSON.stringify(caller));
    assert.equal(r.error, 'CALLER_MISMATCH');
  }
});

test('control: the supported declarations are unchanged, and a derived agent caller still comes from the grant', () => {
  const n = new Network();
  assert.ok(n.submitSigned(xfer(n, { kind: 'human' })).ok);
  assert.ok(n.submitSigned(xfer(n, { kind: 'agent', label: 'sweep-bot' })).ok);
  assert.ok(n.submitSigned(xfer(n, undefined)).ok);
  const g = n.grantAgent({ grantId: 'sweeper-1', issuer: 'MPL', label: 'treasury sweeper', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 86400, maxTotal: dollars(1000) }, counterparties: null, notAfter: null });
  assert.ok(g.ok);
  const r = n.submitSigned(n.agentTx('sweeper-1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['screen:MPL']));
  assert.ok(r.ok);
  assert.deepEqual(r.caller, { kind: 'agent', grant_id: 'sweeper-1', label: 'treasury sweeper' });
});
