// PENDING (red on purpose): the behaviour of options B and C in docs/design-questions/over-cap-escalate-or-deny.md.
// Option A is today's behaviour and is pinned, green, in test/hardening/conformance-options.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';

const mk = (n, extra = {}) => {
  // a grant field the kernel does not know yet: today it is ignored, so these tests fail until the option is built
  const { tx, key } = n.grantTx({ grantId: 'g1', issuer: 'MPL', label: 'treasury', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 86400, maxTotal: dollars(1000) }, counterparties: null, notAfter: null });
  Object.assign(tx.payload, extra);
  const t = n.tx('GRANT', tx.payload, ['ops:MPL']);
  const r = n.submitSigned(t);
  if (r.ok) n.agentKeys.g1 = key;
  return r;
};
const xfer = (n, amount, opts) => n.submitSigned(n.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: amount.toString() }, ['screen:MPL'], opts));

// ---- Option B: a per-grant switch, on_exceed: 'deny' (default stays 'escalate') ----
test('B: a grant with on_exceed deny refuses an over-cap instruction outright', () => {
  const n = new Network(); assert.ok(mk(n, { on_exceed: 'deny' }).ok);
  const r = xfer(n, dollars(101));
  assert.equal(r.error, 'ENVELOPE_EXCEEDED');
});
test('B: and a co-signature does not help: the agent path has no escalation on that grant', () => {
  const n = new Network(); assert.ok(mk(n, { on_exceed: 'deny' }).ok);
  assert.equal(xfer(n, dollars(101), { escalate: true }).error, 'ENVELOPE_EXCEEDED');
  assert.equal(n.ledger.s.grants.get('g1').win.spent, 0n);
});
test('B: REFUSAL: any value other than escalate or deny is a malformed grant', () => {
  for (const v of ['allow', 'DENY', '', 1, null, true, {}]) assert.equal(mk(new Network(), { on_exceed: v }).ok, false, String(v));
});
test('B: a sub-grant cannot loosen it: a parent that denies cannot have a child that escalates', () => {
  const n = new Network(); assert.ok(mk(n, { on_exceed: 'deny', allowTypes: ['TRANSFER', 'GRANT'] }).ok);
  const child = n.grantTx({ grantId: 'c1', parent: 'g1', issuer: 'MPL', label: 'c', allowTypes: ['TRANSFER'], perInstructionMax: dollars(10), window: { seconds: 3600, maxTotal: dollars(100) }, counterparties: null, notAfter: null });
  child.tx.payload.on_exceed = 'escalate';
  assert.equal(n.submitSigned(n.tx('GRANT', child.tx.payload, ['agent:g1'])).error, 'GRANT_WIDENS_PARENT');
});

// ---- Option C: two tiers: soft (today's per_instruction_max and window cap) escalate; hard_max / hard_window_max deny ----
test('C (control, passes today): between the soft and the hard cap the institution can still co-sign', () => {
  const n = new Network(); assert.ok(mk(n, { hard_max: dollars(500).toString() }).ok);
  assert.equal(xfer(n, dollars(300)).error, 'ESCALATION_REQUIRED');
  assert.equal(xfer(n, dollars(300), { escalate: true }).ok, true);
});
test('C: above the hard cap even the co-signature cannot be used on the agent path', () => {
  const n = new Network(); assert.ok(mk(n, { hard_max: dollars(500).toString() }).ok);
  assert.equal(xfer(n, dollars(501), { escalate: true }).error, 'ENVELOPE_EXCEEDED');
  assert.equal(xfer(n, dollars(501)).error, 'ENVELOPE_EXCEEDED', 'and without it, the same answer: a hard cap does not ask');
});
test('C: REFUSAL: a hard cap below the soft cap is a malformed grant, and a non-canonical one too', () => {
  for (const v of [dollars(50).toString(), '0', '-1', '1.5', 5, null, '0500']) assert.equal(mk(new Network(), { hard_max: v }).ok, false, String(v));
});
test('C: a sub-grant\'s hard cap only narrows its parent\'s', () => {
  const n = new Network(); assert.ok(mk(n, { hard_max: dollars(500).toString(), allowTypes: ['TRANSFER', 'GRANT'] }).ok);
  const child = (hard) => { const c = n.grantTx({ grantId: `c${hard}`, parent: 'g1', issuer: 'MPL', label: 'c', allowTypes: ['TRANSFER'], perInstructionMax: dollars(10), window: { seconds: 3600, maxTotal: dollars(100) }, counterparties: null, notAfter: null }); c.tx.payload.hard_max = dollars(hard).toString(); return n.submitSigned(n.tx('GRANT', c.tx.payload, ['agent:g1'])); };
  assert.equal(child(400).ok, true);
  assert.equal(child(600).error, 'GRANT_WIDENS_PARENT');
});
