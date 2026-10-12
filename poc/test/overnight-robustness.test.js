// Overnight review, round 1 (ledger): the kernel must be TOTAL. Any instruction - however malformed, and
// whoever signed it - gets a rejection result; it never throws out of executeBlock. A throw escapes after the
// block height and clock have already advanced, so the live ledger and its own block log disagree and a replay
// from genesis no longer matches (found by running it, see STATE.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network } from '../src/network.js';

import { Ledger } from '../src/kernel.js';
// every handler the kernel has, so a new instruction type is covered without editing this list
const TYPES = Object.getOwnPropertyNames(Ledger.prototype).filter((k) => k.startsWith('tx_')).map((k) => k.slice(3));
const BAD_PAYLOADS = [undefined, null, 'x', 42, [], true];

// the ledger and its log must stay in step, and a replay from genesis must still reproduce the live head
const inStep = (n) => {
  assert.equal(n.ledger.s.height, n.log.length, 'ledger height equals the number of logged blocks');
  assert.ok(n.verifyReplay().ok, 'a replay from genesis reproduces the live head');
};

test('a missing or non-object payload is a rejection for every instruction type, never an exception', () => {
  const n = new Network();
  for (const type of TYPES) {
    for (const payload of BAD_PAYLOADS) {
      const t = { inst_id: `bad-${type.toLowerCase()}-${String(payload).slice(0, 3)}-${Math.random().toString(36).slice(2, 8)}`, type, valid_until: n.now() + 30, sigs: {}, ...(payload === undefined ? {} : { payload }) };
      const r = n.submitSigned(t);
      assert.equal(r.ok, false, `${type} with payload ${JSON.stringify(payload)} must be rejected`);
      assert.notEqual(r.error, undefined);
    }
  }
  inStep(n);
});

test('a malformed instruction does not desynchronise the ledger from its log', () => {
  const n = new Network();
  const before = n.ledger.s.height;
  const r = n.submitSigned({ inst_id: 'aaaaaaaa1', type: 'TRANSFER', valid_until: n.now() + 10, sigs: {} });
  assert.equal(r.ok, false);
  assert.equal(n.ledger.s.height, n.log.length, `height ${before} -> ${n.ledger.s.height} but the log has ${n.log.length} blocks`);
  n.heartbeat(); // normal operation continues
  inStep(n);
});

test('a wrongly typed field inside a payload is a rejection, even from an unauthenticated caller', () => {
  const n = new Network();
  const t = n.tx('ESCROW_LOCK', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100', escrowId: 'e1', expiresAt: n.now() + 3600, releaseRole: { not: 'a string' } }, []);
  const r = n.submitSigned(t);
  assert.equal(r.ok, false);
  inStep(n);
});

test('malformed numeric fields in a payload signed by a TRUSTED key are rejected, not thrown', () => {
  const n = new Network();
  const cases = [
    n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: 'h1', amount: '100', L_after: 'not-a-number', seq: 1e9 }, ['attest:MPL']),
    n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: 'h2', amount: '100', seq: 1e9 }, ['attest:MPL']), // L_after missing
    n.tx('ATTEST', { issuer: 'MPL', seq: 1e9, L: 'zz' }, ['attest:MPL']),
    n.tx('ATTEST', { issuer: 'MPL', seq: 1e9, L: 1.5 }, ['attest:MPL']),
    n.tx('FUND_SP', { issuer: 'MPL', amount: '100', A_after: 'zz' }, ['ops:MPL', 'anchor']),
  ];
  for (const t of cases) {
    const r = n.submitSigned(t);
    assert.equal(r.ok, false, `${t.type} ${JSON.stringify(t.payload)}`);
  }
  inStep(n);
});
