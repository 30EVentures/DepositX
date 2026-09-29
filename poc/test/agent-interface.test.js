// Roadmap 6.2: the interface an agent can actually use. The dashboard's POST /api/action has the
// SERVER sign with keys it holds; an agent must sign with its own key. submitSigned() is the
// server-free core of POST /api/submit; schema() and grantsView() back GET /api/schema and
// GET /api/grants. All amounts crossing this boundary are decimal strings of cents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const grant = (n, over = {}) => {
  const r = n.grantAgent({ grantId: 'sweeper-1', issuer: 'MPL', label: 'treasury sweeper', allowTypes: ['TRANSFER', 'PAYMENT'], perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(2500) }, ...over });
  assert.ok(r.ok, `${r.error}: ${r.message}`);
};
const xfer = (n, amt) => n.agentTx('sweeper-1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(amt).toString() }, ['screen:MPL']);

test('submitSigned executes a fully signed agent instruction and reports the derived caller', () => {
  const n = new Network();
  grant(n);
  const r = n.submitSigned(xfer(n, 100));
  assert.equal(r.ok, true);
  assert.deepEqual(r.caller, { kind: 'agent', grant_id: 'sweeper-1', label: 'treasury sweeper' });
  assert.ok(Number.isInteger(r.height));
});

test('submitSigned never signs: an unsigned instruction is rejected, not completed by the server', () => {
  const n = new Network();
  grant(n);
  const t = xfer(n, 100);
  t.sigs = {};
  const r = n.submitSigned(t);
  assert.equal(r.ok, false);
  assert.match(r.error, /MISSING_SIGNATURE|MALFORMED|UNKNOWN/);
});

test('submitSigned returns structured errors for garbage instead of throwing', () => {
  const n = new Network();
  for (const bad of [null, 'x', 42, {}, { type: 'TRANSFER' }]) {
    const r = n.submitSigned(bad);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
    assert.equal(typeof r.retryable, 'boolean');
  }
});

test('an agent retrying the same signed instruction is exactly-once: the retry is DUPLICATE_INSTRUCTION, not a second payment', () => {
  const n = new Network();
  grant(n);
  const t = xfer(n, 100);
  const before = n.ledger.s.accounts.get('MPL:harbour').balance;
  assert.equal(n.submitSigned(t).ok, true);
  const again = n.submitSigned(t);
  assert.equal(again.error, 'DUPLICATE_INSTRUCTION');
  assert.equal(again.retryable, false);
  assert.equal(n.ledger.s.accounts.get('MPL:harbour').balance, before + dollars(100));
});

test('errors carry retryable and a remedy an agent can act on', () => {
  const n = new Network();
  grant(n);
  const r = n.submitSigned(xfer(n, 1500));
  assert.equal(r.error, 'ESCALATION_REQUIRED');
  assert.equal(r.retryable, false);
  assert.match(r.remedy, /ops/i);
  const d = n.submitSigned(n.agentTx('sweeper-1', 'PAYMENT', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100', queueIfShort: false }, ['screen:MPL', 'accept:MPL']));
  assert.equal(d.ok, false);
});

test('schema() lists every instruction type, marks exactly the grantable ones, and carries an error catalog', () => {
  const s = Network.schema();
  assert.equal(s.version, 'depositx-poc-schema/1');
  const byType = Object.fromEntries(s.types.map((t) => [t.type, t]));
  for (const g of ['TRANSFER', 'PAYMENT', 'ESCROW_LOCK', 'ESCROW_REFUND', 'REGISTER_SWEEP', 'CANCEL_SWEEP', 'GRANT']) assert.equal(byType[g].grantable, true, g);
  for (const g of ['MINT', 'REDEEM', 'DVP', 'FUND_SP', 'DEFUND_SP', 'RESUME', 'NET_CYCLE', 'REVOKE_GRANT']) if (byType[g]) assert.equal(byType[g].grantable, false, g);
  assert.ok(byType.GRANT && byType.REVOKE_GRANT);
  assert.deepEqual(byType.TRANSFER.signatures, ['ops:<payer issuer> | agent:<grant_id>', 'screen:<payer issuer>']);
  for (const code of ['ESCALATION_REQUIRED', 'ENVELOPE_DENIED', 'GRANT_REVOKED', 'GRANT_EXPIRED', 'GRANT_WIDENS_PARENT', 'BAD_SIGNATURE', 'DUPLICATE_INSTRUCTION', 'BAD_VALIDITY']) {
    assert.equal(typeof s.errors[code].retryable, 'boolean', code);
    assert.equal(typeof s.errors[code].remedy, 'string', code);
  }
  assert.doesNotThrow(() => JSON.stringify(s), 'the schema is plain JSON');
});

test('grantsView reports live status and remaining headroom as decimal strings, and drops to not-live on revoke', () => {
  const n = new Network();
  grant(n);
  n.submitSigned(xfer(n, 700));
  const [g] = n.grantsView();
  assert.equal(g.id, 'sweeper-1');
  assert.equal(g.live, true);
  assert.equal(g.remaining_window, dollars(1800).toString());
  assert.equal(g.per_instruction_max, dollars(1000).toString());
  assert.equal(typeof g.window.max_total, 'string');
  assert.doesNotThrow(() => JSON.stringify(n.grantsView()));
  n.revokeGrant('sweeper-1');
  const [r] = n.grantsView();
  assert.equal(r.live, false);
  assert.equal(r.reason, 'GRANT_REVOKED');
  assert.deepEqual(n.grantsView('NSR'), [], 'filtered by issuer');
});
