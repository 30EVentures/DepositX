// Overnight review follow-ups (independent reviewers found these in the first round of fixes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const inStep = (n) => {
  assert.equal(n.ledger.s.height, n.log.length, 'ledger height equals the number of logged blocks');
  assert.ok(n.verifyReplay().ok, 'a replay from genesis reproduces the live head');
};
const nest = (d) => { let v = 'x'; for (let i = 0; i < d; i++) v = { a: v }; return v; };

test('a deeply nested payload is refused before the ledger moves, so ledger and log stay in step', () => {
  for (const depth of [100, 3000, 20000]) {
    const n = new Network();
    const t = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL']);
    t.payload.extra = nest(depth); // attached after signing: even the signer's own canon() cannot digest this
    const r = n.submitSigned(t);
    assert.equal(r.ok, false, `depth ${depth}`);
    assert.equal(r.error, 'MALFORMED');
    inStep(n);
    n.heartbeat();
    inStep(n);
  }
});

test('a modestly nested payload is still fine, and a queued payment keeps it without breaking later blocks', () => {
  const n = new Network();
  n.defund('MPL', n.ledger.s.issuers.get('MPL').sp - dollars(50));
  const t = n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: true, note: nest(8) }, ['ops:MPL', 'screen:MPL', 'accept:NSR']);
  assert.deepEqual(n.submitSigned(t).events.map((e) => e.type), ['QUEUED']);
  n.heartbeat();
  inStep(n);
});

test('a block that the kernel refuses before executing leaves no trace (height, time and dedup unchanged)', () => {
  const n = new Network();
  const before = { h: n.ledger.s.height, t: n.ledger.s.time };
  const deep = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100' }, ['ops:MPL', 'screen:MPL']);
  deep.payload.x = nest(5000);
  assert.throws(() => n.ledger.executeBlock({ txs: [deep], time: n.now() }), (e) => e.code === 'MALFORMED');
  assert.equal(n.ledger.s.height, before.h);
  assert.equal(n.ledger.s.time, before.t);
});

test('an institution-signed queued payment with a declared caller of kind unspecified still nets', () => {
  const n = new Network();
  n.defund('MPL', n.ledger.s.issuers.get('MPL').sp - dollars(50));
  const t = n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(200).toString(), queueIfShort: true }, ['ops:MPL', 'screen:MPL', 'accept:NSR'], { caller: { kind: 'unspecified', label: 'x' } });
  assert.deepEqual(n.submitSigned(t).events.map((e) => e.type), ['QUEUED']);
  n.submitSigned(n.tx('PAYMENT', { from: 'NSR:cedar', to: 'MPL:acme', amount: dollars(200).toString(), queueIfShort: true }, ['ops:NSR', 'screen:NSR', 'accept:MPL']));
  n.netCycle();
  assert.equal(n.ledger.s.queue.length, 0, 'the stored copy still verifies against what was signed');
});

test('an issuer role kind must be one of the real key kinds, not an inherited property name', () => {
  for (const role of ['constructor:MPL', 'toString:MPL', '__proto__:MPL', 'hasOwnProperty:MPL']) {
    const n = new Network();
    const r = n.submitSigned(n.tx('ESCROW_LOCK', { from: 'MPL:acme', to: 'MPL:harbour', amount: '100', escrowId: 'e1', expiresAt: n.now() + 3600, releaseRole: role }, ['ops:MPL', 'screen:MPL']));
    assert.equal(r.ok, false, role);
    assert.equal(r.error, 'BAD_RELEASE_ROLE');
  }
});

test('securities cannot be credited to an escrow account, and it cannot be unfrozen or frozen either', () => {
  const n = new Network();
  assert.ok(n.escrowLock('MPL:acme', 'NSR:cedar', 'po1', dollars(10), { eventName: 'delivery' }).ok);
  const E = 'NSR:escrow:po1';
  for (const t of [
    n.tx('CREDIT_SECURITY', { account: E, secId: 'CAN-2031', qty: '1' }, ['gov:operator', 'gov:neutral']),
    n.tx('UNFREEZE_ACCOUNT', { account: E }, ['ops:NSR']),
    n.tx('FREEZE_ACCOUNT', { account: E }, ['ops:NSR']),
  ]) {
    const r = n.submitSigned(t);
    assert.equal(r.ok, false, t.type);
    assert.equal(r.error, 'ESCROW_ACCOUNT_RESERVED', t.type);
  }
});

test('non-canonical spellings of an attested number are refused, and so are unsafe sequence numbers and times', () => {
  const n = new Network();
  const iss = n.ledger.s.issuers.get('MPL');
  const want = iss.L + 100n;
  for (const spelled of [` ${want}`, `${want} `, `+${want}`, `0${want}`]) {
    const r = n.submitSigned(n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: 'MPL-H900', amount: '100', L_after: spelled, seq: iss.seq + 1 }, ['attest:MPL']));
    assert.equal(r.ok, false, JSON.stringify(spelled));
    const a = n.submitSigned(n.tx('FUND_SP', { issuer: 'MPL', amount: '100', A_after: ` ${n.ledger.s.anchor.A + 100n}` }, ['ops:MPL', 'anchor']));
    assert.equal(a.ok, false);
  }
  const r = n.submitSigned(n.tx('ATTEST', { issuer: 'MPL', seq: 1e21, L: iss.L.toString() }, ['attest:MPL']));
  assert.equal(r.ok, false, 'a huge sequence number would block every later attestation');
  assert.equal(n.ledger.s.issuers.get('MPL').seq, iss.seq);
  assert.throws(() => n.ledger.executeBlock({ txs: [], time: 1e21 }), (e) => e.code === 'BAD_TIME');
});
