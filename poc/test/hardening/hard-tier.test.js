// Option C (owner's decision N4, 2026-10-16): a grant may carry a HARD tier above its soft one.
//   soft  = per_instruction_max and window.max_total (as before): above it the agent needs the institution's signature;
//   hard  = hard_max (per instruction) and hard_window_max (all agent-authorised outflow in the window, co-signed or
//           not): above it the agent path refuses with ENVELOPE_EXCEEDED, whoever signs.
// Absent fields mean exactly today's behaviour (the additive guarantee). Authority only narrows down a chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars, ERROR_CATALOG } from '../../src/network.js';
import { GRANTABLE_TYPES } from '../../src/kernel.js';

const D = (x) => dollars(x);
const base = (o = {}) => ({ grantId: 'g1', issuer: 'MPL', label: 'treasury', allowTypes: ['TRANSFER', 'GRANT', 'REGISTER_SWEEP'], perInstructionMax: D(100), window: { seconds: 86400, maxTotal: D(1000) }, counterparties: null, notAfter: null, ...o });
const mk = (n, o) => n.grantAgent(base(o));
const withHard = (n, o = {}) => { const r = mk(n, { hardMax: D(500), hardWindowMax: D(2000), ...o }); assert.ok(r.ok, `${r.error}: ${r.message}`); return n; };
const xfer = (n, amount, opts, id = 'g1') => n.submitSigned(n.agentTx(id, 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: amount.toString() }, ['screen:MPL'], opts));
const win = (n, id = 'g1') => n.ledger.s.grants.get(id).win.spent;
const hwin = (n, id = 'g1') => (n.ledger.s.grants.get(id).hwin || { spent: 0n }).spent;

// ------------------------------------------------------------------ the tiers
test('the soft tier is unchanged: within it allowed, just over it asks for the institution', () => {
  const n = withHard(new Network());
  assert.equal(xfer(n, D(100)).ok, true);
  assert.equal(xfer(n, D(100) + 1n).error, 'ESCALATION_REQUIRED');
});
test('between the soft and the hard cap the institution\'s co-signature still works, and is not charged to the soft window', () => {
  const n = withHard(new Network());
  assert.equal(xfer(n, D(300), { escalate: true }).ok, true);
  assert.equal(win(n), 0n);
});
test('above the hard cap the agent path refuses, with or without the co-signature, and nothing moves', () => {
  const n = withHard(new Network()); const before = n.ledger.s.accounts.get('MPL:harbour').balance;
  for (const opts of [undefined, { escalate: true }]) {
    const r = xfer(n, D(500) + 1n, opts);
    assert.equal(r.ok, false); assert.equal(r.error, 'ENVELOPE_EXCEEDED');
  }
  assert.equal(n.ledger.s.accounts.get('MPL:harbour').balance, before);
  assert.equal(win(n), 0n); assert.equal(hwin(n), 0n);
});
test('exactly at the hard cap is allowed (with the co-signature, since it is over the soft cap)', () => {
  const n = withHard(new Network());
  assert.equal(xfer(n, D(500), { escalate: true }).ok, true);
});
test('when both tiers are passed the answer is the hard one: ENVELOPE_EXCEEDED, not a request for a co-signature', () => {
  const n = withHard(new Network());
  assert.equal(xfer(n, D(900)).error, 'ENVELOPE_EXCEEDED');
});

// ------------------------------------------------------------------ the hard window counts EVERYTHING the agent path moves
test('the hard window counts in-envelope and co-signed spends alike, and refuses past its cap', () => {
  const n = withHard(new Network());
  assert.equal(xfer(n, D(100)).ok, true);                         // in envelope
  for (let i = 0; i < 3; i++) assert.equal(xfer(n, D(500), { escalate: true }).ok, true, `co-signed ${i}`); // 1500 so far -> 1600
  assert.equal(hwin(n), D(1600));
  assert.equal(xfer(n, D(400), { escalate: true }).ok, true);     // exactly 2000
  assert.equal(xfer(n, 1n, { escalate: true }).error, 'ENVELOPE_EXCEEDED', 'one cent past the hard window, even co-signed');
  assert.equal(xfer(n, 1n).error, 'ENVELOPE_EXCEEDED', 'and without the co-signature');
  assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, []);
});
test('the hard window tumbles like the soft one: after its length a new window opens', () => {
  const n = withHard(new Network());
  assert.equal(xfer(n, D(500), { escalate: true }).ok, true);
  for (let i = 0; i < 3; i++) assert.equal(xfer(n, D(500), { escalate: true }).ok, true);
  assert.equal(xfer(n, D(1), { escalate: true }).error, 'ENVELOPE_EXCEEDED');
  n.advance(86400 + 1);
  assert.equal(xfer(n, D(500), { escalate: true }).ok, true);
  assert.equal(hwin(n), D(500));
});
test('a refused instruction consumes none of the hard window (the counter is journaled)', () => {
  const n = withHard(new Network());
  const r = xfer(n, D(500) + D(4_000_000), { escalate: true }); // refused for the hard cap
  assert.equal(r.ok, false); assert.equal(hwin(n), 0n);
  const poor = xfer(n, D(500), { escalate: true }, 'g1'); // fine
  assert.equal(poor.ok, true);
  const t = n.agentTx('g1', 'TRANSFER', { from: 'MPL:ghost', to: 'MPL:harbour', amount: D(10).toString() }, ['screen:MPL'], { escalate: true });
  assert.equal(n.submitSigned(t).ok, false);
  assert.equal(hwin(n), D(500), 'the rejected instruction left the counter where it was');
});
test('a sweep under the grant is limited by the hard window headroom as well as the soft one', () => {
  const n = new Network();
  withHard(n, { perInstructionMax: D(100), window: { seconds: 86400, maxTotal: D(200) }, hardMax: D(200), hardWindowMax: D(250) });
  assert.equal(xfer(n, D(200), { escalate: true }).ok, true); // co-signed: uses the hard window, not the soft one
  assert.equal(hwin(n), D(200));
  const keep = n.ledger.s.accounts.get('MPL:acme').balance - D(1000);
  const before = n.ledger.s.accounts.get('MPL:harbour').balance;
  assert.ok(n.submitSigned(n.agentTx('g1', 'REGISTER_SWEEP', { sweepId: 'sw1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: keep.toString() }, [])).ok); // fires at the end of this very block
  assert.equal(n.ledger.s.accounts.get('MPL:harbour').balance - before, D(50), 'the soft headroom is $100 but only $50 of the hard window are left');
  assert.equal(hwin(n), D(250));
  n.heartbeat();
  assert.equal(n.ledger.s.accounts.get('MPL:harbour').balance - before, D(50), 'and then nothing: the hard window is used up');
  assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, []);
});
test('inside a batch, a leg over the hard cap refuses the whole batch', () => {
  const n = withHard(new Network());
  const legs = [n.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: D(10).toString() }, ['screen:MPL']), n.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: (D(500) + 1n).toString() }, ['screen:MPL'], { escalate: true })];
  const r = n.submitSigned(n.tx('BATCH', { legs }, []));
  assert.equal(r.ok, false); assert.equal(r.error, 'ENVELOPE_EXCEEDED');
  assert.equal(win(n), 0n);
});

// ------------------------------------------------------------------ additive: no hard fields, no change
test('a grant without hard fields has the record it always had, and behaves as before', () => {
  const n = new Network(); assert.ok(mk(n).ok);
  const rec = n.ledger.s.grants.get('g1');
  assert.deepEqual(Object.keys(rec).sort(), ['agentKey', 'allow_types', 'counterparties', 'id', 'issuer', 'label', 'not_after', 'parent', 'per_instruction_max', 'revoked', 'win', 'window']);
  assert.equal(xfer(n, D(900), { escalate: true }).ok, true, 'no hard tier: the co-signature authorises any amount, as today');
});
test('the grants view shows the hard tier only when it exists', () => {
  const n = new Network(); mk(n, { grantId: 'plain' }); withHard(n, { grantId: 'tiered' });
  const v = Object.fromEntries(n.grantsView().map((g) => [g.id, g]));
  assert.equal(v.tiered.hard_max, D(500).toString()); assert.equal(v.tiered.hard_window_max, D(2000).toString());
  assert.ok(!('hard_max' in v.plain)); assert.ok(!('hard_window_max' in v.plain));
});
test('ENVELOPE_EXCEEDED is in the error catalogue with a remedy and is not retryable', () => {
  assert.equal(ERROR_CATALOG.ENVELOPE_EXCEEDED.retryable, false);
  assert.match(ERROR_CATALOG.ENVELOPE_EXCEEDED.remedy, /hard/i);
});
test('a tiered run replays identically from genesis', () => {
  const n = withHard(new Network());
  xfer(n, D(50)); xfer(n, D(300), { escalate: true }); xfer(n, D(600), { escalate: true }); n.advance(100); xfer(n, D(100));
  assert.ok(n.verifyReplay().ok);
});

// ------------------------------------------------------------------ REFUSALS: malformed tiers
test('REFUSAL: a hard cap below the soft cap is a malformed grant', () => {
  assert.equal(mk(new Network(), { hardMax: D(50) }).ok, false);
  assert.equal(mk(new Network(), { hardWindowMax: D(500) }).ok, false);
  assert.equal(mk(new Network(), { hardMax: D(100) }).ok, true, 'equal to the soft cap is allowed: it removes the co-signature tier');
});
test('REFUSAL: a hard per-instruction cap above the hard window cap is malformed (one instruction cannot exceed its window); equal is allowed', () => {
  assert.equal(mk(new Network(), { hardMax: D(3000), hardWindowMax: D(2000) }).ok, false);
  assert.equal(mk(new Network(), { hardMax: D(2000), hardWindowMax: D(2000) }).ok, true);
});
const rawGrant = (n, patch) => { const { tx } = n.grantTx(base({ grantId: 'raw' })); Object.assign(tx.payload, patch); return n.submitSigned(n.tx('GRANT', tx.payload, ['ops:MPL'])); };
for (const bad of ['0', '-1', '1.5', '0500', '', ' 5', '1e3', 5, 5.5, null, true, [], {}, '9'.repeat(19)]) {
  test(`REFUSAL: hard_max ${JSON.stringify(bad)} is refused`, () => { assert.equal(rawGrant(new Network(), { hard_max: bad }).ok, false); });
  test(`REFUSAL: hard_window_max ${JSON.stringify(bad)} is refused`, () => { assert.equal(rawGrant(new Network(), { hard_window_max: bad }).ok, false); });
}
test('REFUSAL: a refused tiered grant is not created and leaves no trace', () => {
  const n = new Network(); const before = n.ledger.s.grants.size;
  assert.equal(rawGrant(n, { hard_max: D(1).toString() }).ok, false);
  assert.equal(n.ledger.s.grants.size, before);
});

// ------------------------------------------------------------------ REFUSALS: authority only narrows
const child = (n, id, o) => n.grantAgent({ grantId: id, parent: 'g1', issuer: 'MPL', label: id, allowTypes: ['TRANSFER'], perInstructionMax: D(10), window: { seconds: 3600, maxTotal: D(100) }, counterparties: null, notAfter: null, ...o });
test('REFUSAL: a sub-grant\'s hard caps may only narrow its parent\'s', () => {
  const n = withHard(new Network());
  assert.equal(child(n, 'c1', { hardMax: D(400) }).ok, true);
  assert.equal(child(n, 'c2', { hardMax: D(600) }).error, 'GRANT_WIDENS_PARENT');
  assert.equal(child(n, 'c3', { hardWindowMax: D(1500) }).ok, true);
  assert.equal(child(n, 'c4', { hardWindowMax: D(2500) }).error, 'GRANT_WIDENS_PARENT');
  assert.equal(n.ledger.s.grants.has('c2') || n.ledger.s.grants.has('c4'), false);
});
test('a sub-grant with no hard tier of its own is still bound by every ancestor\'s hard tier', () => {
  const n = withHard(new Network()); assert.ok(child(n, 'c1', { perInstructionMax: D(100), window: { seconds: 3600, maxTotal: D(1000) } }).ok);
  assert.equal(xfer(n, D(501), { escalate: true }, 'c1').error, 'ENVELOPE_EXCEEDED', 'the parent\'s hard_max applies down the chain');
});
test('a descendant\'s spends count against the ancestor\'s hard window', () => {
  const n = withHard(new Network(), { window: { seconds: 86400, maxTotal: D(600) }, hardWindowMax: D(700) });
  assert.ok(child(n, 'c1', { perInstructionMax: D(100), window: { seconds: 3600, maxTotal: D(600) } }).ok);
  assert.equal(xfer(n, D(500), { escalate: true }, 'c1').ok, true);
  assert.equal(xfer(n, D(200), { escalate: true }).ok, true);
  assert.equal(xfer(n, 1n, { escalate: true }, 'c1').error, 'ENVELOPE_EXCEEDED');
  assert.equal(hwin(n, 'g1'), D(700));
});
test('a parent without a hard tier can have a child that sets one (narrower than unlimited)', () => {
  const n = new Network(); assert.ok(mk(n).ok);
  assert.equal(child(n, 'c1', { hardMax: D(300) }).ok, true);
  assert.equal(xfer(n, D(301), { escalate: true }, 'c1').error, 'ENVELOPE_EXCEEDED');
});
test('REFUSAL: revocation and expiry still win over everything (a hard tier does not revive a dead grant)', () => {
  const n = withHard(new Network()); assert.ok(n.revokeGrant('g1').ok);
  assert.equal(xfer(n, D(1)).error, 'GRANT_REVOKED');
});
test('REFUSAL: an agent cannot raise its own hard cap (a grant is immutable; only a new grant widens, signed by the institution)', () => {
  const n = withHard(new Network());
  const t = n.tx('GRANT', { ...n.grantTx(base({ grantId: 'g1' })).tx.payload, hard_max: D(5000).toString() }, ['agent:g1']);
  assert.equal(n.submitSigned(t).ok, false);
  assert.equal(n.ledger.s.grants.get('g1').hard_max, D(500));
});
