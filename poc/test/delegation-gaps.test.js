// Roadmap 7.1 / 7.2: the two gaps Priority 6 left open.
// 7.1: a sweep registered under a grant is charged to that grant's whole chain each time it fires,
//      moves only what fits, and is suspended (not deleted) when the chain dies.
// 7.2: a batch's caller is derived from its legs; legs with different effective callers are rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Network, dollars } from '../src/network.js';
import { canon } from '../src/crypto.js';

const bal = (n, id) => n.ledger.s.accounts.get(id).balance;
const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => assert.deepEqual(inv(n).violations, [], 'no invariant violations');
const one = (n, t) => n.submit([t]).results[0];
const G = (over = {}) => ({
  grantId: 'sweeper-1', issuer: 'MPL', label: 'treasury sweeper',
  allowTypes: ['TRANSFER', 'REGISTER_SWEEP', 'CANCEL_SWEEP', 'GRANT'],
  perInstructionMax: dollars(1000), window: { seconds: 86400, maxTotal: dollars(2500) }, counterparties: null, ...over,
});
const setup = (over) => {
  const n = new Network();
  const r = n.grantAgent(G(over));
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  return n;
};
const regSweep = (n, gid, sweepId = 'sw-1', keep = 497_000) => one(n, n.agentTx(gid, 'REGISTER_SWEEP', { sweepId, from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(keep).toString() }, []));
const tick = (n, s = 1) => n.advance(s); // a heartbeat block: the end-of-block hook, and so the sweeps, run
const moved = (n, before) => before - bal(n, 'MPL:acme');
const core = (n) => canon({ a: n.ledger.s.accounts, i: n.ledger.s.issuers, q: n.ledger.s.queue, sw: n.ledger.s.sweeps, g: n.ledger.s.grants });

// ------------------------------------------------------------------ 7.1
test('7.1: a sweep registered by the institution key is untouched: no grant field, fires in full', () => {
  const n = new Network();
  const before = bal(n, 'MPL:acme');
  const r = one(n, n.tx('REGISTER_SWEEP', { sweepId: 'sw-1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(100_000).toString() }, ['ops:MPL']));
  assert.ok(r.ok, r.message);
  assert.equal('grant' in n.ledger.s.sweeps.get('sw-1'), false);
  assert.equal(moved(n, before), dollars(400_000), 'the whole excess moves, as before');
});

test('7.1: an agent-registered sweep records its grant and moves only the grant headroom, then the rest in later blocks until the window is spent', () => {
  const n = setup(); // per-instruction $1,000, window $2,500
  const start = bal(n, 'MPL:acme');
  const r = regSweep(n, 'sweeper-1'); // excess is $3,000
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.equal(n.ledger.s.sweeps.get('sw-1').grant, 'sweeper-1');
  assert.equal(moved(n, start), dollars(1000), 'first firing capped by per_instruction_max');
  tick(n);
  assert.equal(moved(n, start), dollars(2000));
  tick(n);
  assert.equal(moved(n, start), dollars(2500), 'the last firing is the $500 the window has left');
  tick(n);
  assert.equal(moved(n, start), dollars(2500), 'window spent: nothing more moves');
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(2500));
  allOk(n);
});

test('7.1: what did not fit waits: it moves after the window turns over', () => {
  const n = setup();
  const start = bal(n, 'MPL:acme');
  regSweep(n, 'sweeper-1');
  tick(n); tick(n); tick(n);
  assert.equal(moved(n, start), dollars(2500));
  tick(n, 86400 + 1); // the window turns over, and this block's end-of-block hook fires the sweep again
  assert.equal(moved(n, start), dollars(3000), 'the remaining $500 of excess moves in the new window');
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(500));
  allOk(n);
});

test('7.1: a firing consumes exactly what it moves when the excess is below the headroom', () => {
  const n = setup();
  const start = bal(n, 'MPL:acme');
  regSweep(n, 'sweeper-1', 'sw-1', 499_700); // excess $300
  assert.equal(moved(n, start), dollars(300));
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(300));
});

test('7.1: a firing is charged to every ancestor window, shared with sibling spend', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'REGISTER_SWEEP', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'kid', parent: 'sweeper-1', allowTypes: ['REGISTER_SWEEP'] })).ok);
  const start = bal(n, 'MPL:acme');
  const r = regSweep(n, 'kid', 'sw-1', 400_000); // $100,000 excess: only headroom moves
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.equal(moved(n, start), dollars(1000));
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(1000), 'the parent is charged for the child sweep');
  // the parent spends $1,000 itself, then the child's sweep has only $500 of the parent cap left
  const t = n.agentTx('sweeper-1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1000).toString() }, ['screen:MPL']);
  const mid = bal(n, 'MPL:acme');
  assert.ok(one(n, t).ok); // the sweep also fires at the end of this very block
  assert.equal(mid - bal(n, 'MPL:acme'), dollars(1000) + dollars(500), 'the transfer, plus a sweep firing limited to the $500 the parent cap has left');
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(2500));
  const end = bal(n, 'MPL:acme');
  tick(n);
  assert.equal(bal(n, 'MPL:acme'), end, 'parent cap exhausted: the child sweep waits');
  allOk(n);
});

test('7.1: revoking the grant suspends the sweep: it stays registered, moves nothing, is reported, and the institution can cancel it', () => {
  const n = setup();
  regSweep(n, 'sweeper-1');
  assert.ok(n.revokeGrant('sweeper-1').ok);
  const before = bal(n, 'MPL:acme');
  const b = n.submit([]);
  assert.equal(bal(n, 'MPL:acme'), before);
  assert.ok(n.ledger.s.sweeps.has('sw-1'), 'not deleted');
  const f = b.sweepFires.find((x) => x.sweepId === 'sw-1');
  assert.ok(f && f.suspended === true && f.reason === 'GRANT_REVOKED', JSON.stringify(b.sweepFires));
  assert.ok(n.cancelSweep('sw-1').ok);
  assert.equal(n.submit([]).sweepFires.length, 0);
});

test('7.1: revoking an ANCESTOR suspends a descendant grant\'s sweep, and expiry suspends it too', () => {
  const n = setup({ allowTypes: ['REGISTER_SWEEP', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'kid', parent: 'sweeper-1', allowTypes: ['REGISTER_SWEEP'] })).ok);
  regSweep(n, 'kid');
  n.revokeGrant('sweeper-1');
  const b = n.submit([]);
  assert.equal(b.sweepFires.find((x) => x.sweepId === 'sw-1').suspended, true);

  const m = setup(); // expiry
  regSweep(m, 'sweeper-1');
  const after = bal(m, 'MPL:acme');
  const e = m.submit([]);
  m.advance(7 * 86400 + 5);
  const b2 = m.submit([]);
  assert.equal(b2.sweepFires.find((x) => x.sweepId === 'sw-1').reason, 'GRANT_EXPIRED');
  assert.ok(bal(m, 'MPL:acme') <= after);
  assert.ok(e);
});

test('7.1: a suspended sweep does not block an invariant check and money is conserved', () => {
  const n = setup();
  regSweep(n, 'sweeper-1');
  n.revokeGrant('sweeper-1');
  n.submit([]);
  allOk(n);
});

test('7.1: sweep firing under a grant replays identically from genesis', () => {
  const n = setup();
  regSweep(n, 'sweeper-1');
  tick(n); tick(n); tick(n);
  tick(n, 86400 + 1);
  const v = n.verifyReplay();
  assert.ok(v.ok, `replay disagreed (blocks=${v.blocks})`);
  assert.equal(v.stateRoot, n.snapshot().stateRoot);
});

test('7.1: an agent-registered sweep survives a durable-store restart and keeps firing under the same window', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'depositx-'));
  const a = new Network({ dataDir: dir });
  assert.ok(a.grantAgent(G()).ok);
  regSweep(a, 'sweeper-1');
  tick(a);
  const root = a.ledger.stateRoot();
  const spent = a.ledger.s.grants.get('sweeper-1').win.spent;
  const b = new Network({ dataDir: dir });
  assert.equal(b.ledger.stateRoot(), root, 'recovery reproduced the same state');
  assert.equal(b.ledger.s.sweeps.get('sw-1').grant, 'sweeper-1');
  const before = bal(b, 'MPL:acme');
  tick(b);
  assert.equal(before - bal(b, 'MPL:acme'), dollars(500), 'window had $500 left of $2,500 after two $1,000 firings');
  assert.equal(b.ledger.s.grants.get('sweeper-1').win.spent, spent + dollars(500));
});

// ------------------------------------------------------------------ 7.2
const xfer = (n, gid, amt, opts, id) => n.agentTx(gid, 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(amt).toString() }, ['screen:MPL'], { ...opts, instId: id });
const opsXfer = (n, amt, caller) => n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(amt).toString() }, ['ops:MPL', 'screen:MPL'], { caller });
const batch = (n, legs, caller) => n.submit([n.tx('BATCH', { legs }, [], { caller })]).results[0];

test('7.2: a batch of unspecified legs behaves exactly as today and reports unspecified', () => {
  const n = new Network();
  const r = batch(n, [opsXfer(n, 10), opsXfer(n, 20)]);
  assert.ok(r.ok, r.message);
  assert.deepEqual(r.caller, { kind: 'unspecified' });
});

test('7.2: a batch whose legs all share one grant reports the derived agent caller, on the result and in the block log', () => {
  const n = setup();
  const r = batch(n, [xfer(n, 'sweeper-1', 10), xfer(n, 'sweeper-1', 20)]);
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.deepEqual(r.caller, { kind: 'agent', grant_id: 'sweeper-1', label: 'treasury sweeper' });
  const tx = n.snapshot().blocks[0].txs.find((t) => t.type === 'BATCH');
  assert.equal(tx.caller.grant_id, 'sweeper-1');
});

test('7.2: each agent leg still charges the window once', () => {
  const n = setup();
  assert.ok(batch(n, [xfer(n, 'sweeper-1', 100), xfer(n, 'sweeper-1', 200)]).ok);
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(300));
});

test('7.2: mixing an agent-authorised leg with an ops-signed leg is BATCH_MIXED_CALLERS and changes nothing', () => {
  const n = setup();
  const before = core(n);
  const r = batch(n, [xfer(n, 'sweeper-1', 10), opsXfer(n, 20)]);
  assert.equal(r.error, 'BATCH_MIXED_CALLERS');
  assert.equal(core(n), before);
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, 0n, 'the first leg\'s window charge was rolled back');
});

test('7.2: two different grants in one batch is BATCH_MIXED_CALLERS', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'other', allowTypes: ['TRANSFER'] })).ok);
  const r = batch(n, [xfer(n, 'sweeper-1', 10), xfer(n, 'other', 10)]);
  assert.equal(r.error, 'BATCH_MIXED_CALLERS');
});

test('7.2: legs that declare different callers are BATCH_MIXED_CALLERS too', () => {
  const n = new Network();
  const r = batch(n, [opsXfer(n, 10, { kind: 'human' }), opsXfer(n, 10, { kind: 'agent', label: 'bot' })]);
  assert.equal(r.error, 'BATCH_MIXED_CALLERS');
});

test('7.2: an outer batch declaring human around agent legs does not get to report human', () => {
  const n = setup();
  const r = batch(n, [xfer(n, 'sweeper-1', 10), xfer(n, 'sweeper-1', 10)], { kind: 'human' });
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.equal(r.caller.kind, 'agent');
});

test('7.2: a batch that fails mid-way restores the window', () => {
  const n = setup({ perInstructionMax: dollars(4_000_000), window: { seconds: 86400, maxTotal: dollars(4_000_000) } });
  const r = batch(n, [xfer(n, 'sweeper-1', 100), xfer(n, 'sweeper-1', 900_000)]); // acme holds $500,000
  assert.equal(r.error, 'INSUFFICIENT_FUNDS');
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, 0n);
});

test('7.2: BATCH_MIXED_CALLERS is in the machine-readable error catalog with a remedy', () => {
  const s = Network.schema();
  assert.equal(typeof s.errors.BATCH_MIXED_CALLERS.remedy, 'string');
  assert.equal(s.errors.BATCH_MIXED_CALLERS.retryable, false);
});

// ------------------------------------------------------------------ 8.3 (external audit finding)
// Neither CANCEL_SWEEP nor ESCROW_REFUND checked that the acting grant was the one that registered/
// locked the record - #authorize only checked the acting grant was live, allowed the type, and (if
// set) listed the right counterparties. Any same-issuer grant with the right allow_types and
// counterparties could cancel or refund a record belonging to a DIFFERENT grant, or one the
// institution registered directly. Fix mirrors REVOKE_GRANT's own ancestor check.
test('8.3: an unrelated sibling grant cannot cancel another grant\'s sweep; the registering grant can', () => {
  const n = setup({ allowTypes: ['REGISTER_SWEEP', 'CANCEL_SWEEP', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'other-1', allowTypes: ['REGISTER_SWEEP', 'CANCEL_SWEEP'] })).ok, 'a second, unrelated root grant on the same issuer');
  regSweep(n, 'sweeper-1');
  const wrong = one(n, n.agentTx('other-1', 'CANCEL_SWEEP', { sweepId: 'sw-1' }, []));
  assert.equal(wrong.error, 'SWEEP_WRONG_GRANT');
  assert.ok(n.ledger.s.sweeps.has('sw-1'), 'not cancelled');
  const right = one(n, n.agentTx('sweeper-1', 'CANCEL_SWEEP', { sweepId: 'sw-1' }, []));
  assert.ok(right.ok, right.message);
  assert.ok(!n.ledger.s.sweeps.has('sw-1'));
  allOk(n);
});

test('8.3: an ancestor of the registering grant can cancel its descendant\'s sweep; an unrelated sibling cannot', () => {
  const n = setup({ allowTypes: ['REGISTER_SWEEP', 'CANCEL_SWEEP', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'kid', parent: 'sweeper-1', allowTypes: ['REGISTER_SWEEP', 'CANCEL_SWEEP'] })).ok);
  assert.ok(n.grantAgent(G({ grantId: 'kid-sibling', parent: 'sweeper-1', allowTypes: ['CANCEL_SWEEP'] })).ok);
  regSweep(n, 'kid');
  const wrong = one(n, n.agentTx('kid-sibling', 'CANCEL_SWEEP', { sweepId: 'sw-1' }, []));
  assert.equal(wrong.error, 'SWEEP_WRONG_GRANT', 'a sibling is neither the registering grant nor its ancestor');
  const right = one(n, n.agentTx('sweeper-1', 'CANCEL_SWEEP', { sweepId: 'sw-1' }, []));
  assert.ok(right.ok, right.message);
  allOk(n);
});

test('8.3: a sweep the institution registered directly cannot be cancelled by any agent grant, only by the institution', () => {
  const n = setup();
  assert.ok(n.registerSweep('sw-inst', 'MPL:acme', 'MPL:harbour', dollars(400_000)).ok);
  const wrong = one(n, n.agentTx('sweeper-1', 'CANCEL_SWEEP', { sweepId: 'sw-inst' }, []));
  assert.equal(wrong.error, 'SWEEP_WRONG_GRANT');
  assert.ok(n.cancelSweep('sw-inst').ok, 'the institution itself is unaffected');
  allOk(n);
});

test('8.3: an unrelated grant cannot refund another grant\'s escrow; the locking grant can, after expiry', () => {
  const n = setup({ allowTypes: ['ESCROW_LOCK', 'ESCROW_REFUND', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'other-1', allowTypes: ['ESCROW_LOCK', 'ESCROW_REFUND'] })).ok);
  const lock = one(n, n.agentTx('sweeper-1', 'ESCROW_LOCK', { escrowId: 'e-1', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString(), expiresAt: n.now() + 60, releaseRole: 'ops:MPL', eventName: null }, ['screen:MPL']));
  assert.ok(lock.ok, lock.message);
  assert.equal(n.ledger.s.escrows.get('e-1').grant, 'sweeper-1');
  n.advance(120);
  const wrong = one(n, n.agentTx('other-1', 'ESCROW_REFUND', { escrowId: 'e-1' }, []));
  assert.equal(wrong.error, 'ESCROW_WRONG_GRANT');
  assert.ok(n.ledger.s.escrows.has('e-1'), 'not refunded');
  const right = one(n, n.agentTx('sweeper-1', 'ESCROW_REFUND', { escrowId: 'e-1' }, []));
  assert.ok(right.ok, right.message);
  assert.ok(!n.ledger.s.escrows.has('e-1'));
  allOk(n);
});

test('8.3: an ancestor of the locking grant can refund its descendant\'s escrow; an unrelated sibling cannot', () => {
  const n = setup({ allowTypes: ['ESCROW_LOCK', 'ESCROW_REFUND', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'kid', parent: 'sweeper-1', allowTypes: ['ESCROW_LOCK', 'ESCROW_REFUND'] })).ok);
  assert.ok(n.grantAgent(G({ grantId: 'kid-sibling', parent: 'sweeper-1', allowTypes: ['ESCROW_REFUND'] })).ok);
  const lock = one(n, n.agentTx('kid', 'ESCROW_LOCK', { escrowId: 'e-2', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString(), expiresAt: n.now() + 60, releaseRole: 'ops:MPL', eventName: null }, ['screen:MPL']));
  assert.ok(lock.ok, lock.message);
  n.advance(120);
  const wrong = one(n, n.agentTx('kid-sibling', 'ESCROW_REFUND', { escrowId: 'e-2' }, []));
  assert.equal(wrong.error, 'ESCROW_WRONG_GRANT');
  const right = one(n, n.agentTx('sweeper-1', 'ESCROW_REFUND', { escrowId: 'e-2' }, []));
  assert.ok(right.ok, right.message);
  allOk(n);
});

test('8.3: an escrow the institution locked directly cannot be refunded by any agent grant, only by the institution', () => {
  const n = setup({ allowTypes: ['ESCROW_REFUND'] });
  const lock = n.escrowLock('MPL:acme', 'MPL:harbour', 'e-3', dollars(5), { expiresAt: n.now() + 60 });
  assert.ok(lock.ok, lock.message);
  assert.equal('grant' in n.ledger.s.escrows.get('e-3'), false);
  n.advance(120);
  const wrong = one(n, n.agentTx('sweeper-1', 'ESCROW_REFUND', { escrowId: 'e-3' }, []));
  assert.equal(wrong.error, 'ESCROW_WRONG_GRANT');
  assert.ok(n.escrowRefund('e-3').ok, 'the institution itself is unaffected');
  allOk(n);
});

test('8.3: SWEEP_WRONG_GRANT and ESCROW_WRONG_GRANT are in the machine-readable error catalog with remedies', () => {
  const s = Network.schema();
  for (const code of ['SWEEP_WRONG_GRANT', 'ESCROW_WRONG_GRANT']) {
    assert.equal(typeof s.errors[code].remedy, 'string', code);
    assert.equal(s.errors[code].retryable, false, code);
  }
});
