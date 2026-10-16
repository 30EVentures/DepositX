// PENDING (red on purpose): X4, persistent idempotency beyond the 180 s window (docs/persistent-idempotency-proposal.md).
// Today a retry that arrives after the dedup window is a second payment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { samplePacs008 } from '../../src/iso20022.js';

test('X4 probe: the same PAYMENT inst_id re-signed 200 s later must not pay twice', () => {
  const n = new Network();
  const mk = () => n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(100).toString(), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR'], { instId: 'pay-0001-retry' });
  const before = n.ledger.s.accounts.get('NSR:cedar').balance;
  assert.equal(n.submitSigned(mk()).ok, true);
  n.advance(200);
  const again = n.submitSigned(mk());
  assert.equal(again.ok, false, 'the second payment under the same id must be refused');
  assert.equal(n.ledger.s.accounts.get('NSR:cedar').balance - before, dollars(100), 'the payee received one payment, not two');
});
test('X4 probe: one pacs.008 resent 200 s later is a duplicate, not a second ACSC', () => {
  const n = new Network();
  const xml = samplePacs008({ from: 'MPL:acme', to: 'NSR:cedar', amount: '100.00', uetr: '123e4567-e89b-42d3-a456-426614174000', msgId: 'MSG-X4' });
  assert.match(n.pacs008(xml), /<TxSts>ACSC<\/TxSts>/);
  n.advance(200);
  assert.match(n.pacs008(xml), /<TxSts>RJCT<\/TxSts>/);
});
test('X4: a signed idempotency horizon keeps the id alive until it ends; a different payload under it is IDEMPOTENCY_CONFLICT', () => {
  const n = new Network();
  const mk = (amount) => n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(amount).toString(), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR'], { instId: 'idem-0001-key', idem: { until: n.now() + 86400 } });
  assert.equal(n.submitSigned(mk(100)).ok, true);
  n.advance(200);
  assert.equal(n.submitSigned(mk(100)).error, 'DUPLICATE_INSTRUCTION');
  n.advance(200);
  assert.equal(n.submitSigned(mk(999)).error, 'IDEMPOTENCY_CONFLICT');
});
test('X4: REFUSAL: a horizon beyond the kernel ceiling, or not a whole number, is refused', () => {
  const n = new Network();
  for (const until of [n.now() + 365 * 86400, 1.5, '3', -1, null]) {
    const t = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100' }, ['ops:MPL', 'screen:MPL'], { idem: { until } });
    assert.equal(n.submitSigned(t).ok, false, String(until));
  }
});
test('X4: instructions without a horizon keep today\'s 180 s behaviour (the additive guarantee)', () => {
  const n = new Network();
  const t = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100' }, ['ops:MPL', 'screen:MPL'], { instId: 'plain-0001-key' });
  assert.equal(n.submitSigned(t).ok, true);
  assert.equal(n.submitSigned(t).error, 'DUPLICATE_INSTRUCTION');
});
