// PENDING (red on purpose): X3, an institution-wide aggregate cap (docs/agent-native-access-proposal.md section 11).
// Today separate root grants of one issuer share nothing: N roots can each spend their own full cap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';

const roots = (n) => { for (const id of ['r1', 'r2', 'r3']) assert.ok(n.grantAgent({ grantId: id, issuer: 'MPL', label: id, allowTypes: ['TRANSFER'], perInstructionMax: dollars(2000), window: { seconds: 86400, maxTotal: dollars(2000) }, counterparties: null, notAfter: null }).ok); };
const xfer = (n, id, amount, opts) => n.submitSigned(n.agentTx(id, 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: amount.toString() }, ['screen:MPL'], opts));
const setBudget = (n, max) => n.submitSigned(n.tx('SET_AGENT_BUDGET', { issuer: 'MPL', window: max === null ? null : { seconds: 86400, max_total: max.toString() } }, ['ops:MPL']));

test('X3 probe (the gap, measured): three root grants of $2,000 each move $6,000 in one window with no refusal and no co-signature', () => {
  const n = new Network(); roots(n);
  const outcomes = ['r1', 'r2', 'r3'].map((id) => xfer(n, id, dollars(2000)).ok);
  // This is what the kernel does TODAY; the assertion below states what X3 wants, so this test is red until X3 is built.
  assert.deepEqual(outcomes, [true, true, false], 'with an institution budget of $4,000 the third must need a co-signature');
});
test('X3: the institution can set and lower an aggregate budget, signed by ops only', () => {
  const n = new Network();
  assert.equal(setBudget(n, dollars(3000)).ok, true);
  assert.equal(setBudget(n, dollars(1000)).ok, true);
});
test('X3: with a $3,000 budget, two $2,000 spends under different roots: the second needs the institution', () => {
  const n = new Network(); roots(n); assert.equal(setBudget(n, dollars(3000)).ok, true);
  assert.equal(xfer(n, 'r1', dollars(2000)).ok, true);
  assert.equal(xfer(n, 'r2', dollars(2000)).error, 'ESCALATION_REQUIRED');
  assert.equal(xfer(n, 'r2', dollars(2000), { escalate: true }).ok, true, 'an escalated spend does not consume the budget');
});
test('X3: REFUSAL: an agent cannot set, raise or remove the budget', () => {
  const n = new Network(); roots(n); assert.equal(setBudget(n, dollars(1000)).ok, true);
  const t = n.tx('SET_AGENT_BUDGET', { issuer: 'MPL', window: null }, ['agent:r1']);
  assert.equal(n.submitSigned(t).error, 'ENVELOPE_DENIED');
});
test('X3: REFUSAL: a budget that is not a canonical integer string of cents is refused', () => {
  const n = new Network();
  assert.equal(setBudget(n, dollars(1)).ok, true, 'a well-formed budget must be accepted, or this refusal proves nothing');
  for (const v of ['1.5', '-1', '0', '01', 1000, null]) assert.equal(n.submitSigned(n.tx('SET_AGENT_BUDGET', { issuer: 'MPL', window: { seconds: 86400, max_total: v } }, ['ops:MPL'])).ok, false, String(v));
});
test('X3: with no budget set, behaviour is exactly today\'s (the additive guarantee)', () => {
  const n = new Network(); roots(n);
  assert.deepEqual(['r1', 'r2', 'r3'].map((id) => xfer(n, id, dollars(2000)).ok), [true, true, true]);
});
