// Roadmap 6.0 / 6.1: delegated, narrowing, verifiable agent authority.
// Design: docs/agent-native-access-proposal.md. An institution's ops key signs a GRANT that lets an
// agent key sign a bounded set of instruction types inside an envelope (per-instruction max, window
// cap, counterparties, expiry); sub-grants may only narrow; the kernel derives `caller` from the
// grant instead of trusting a label.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';

const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => assert.deepEqual(inv(n).violations, [], 'no invariant violations');
const bal = (n, id) => n.ledger.s.accounts.get(id).balance;
const one = (n, t) => n.submit([t]).results[0];
const G = (over = {}) => ({
  grantId: 'sweeper-1',
  issuer: 'MPL',
  label: 'treasury sweeper v3',
  allowTypes: ['TRANSFER', 'PAYMENT', 'REGISTER_SWEEP', 'CANCEL_SWEEP', 'ESCROW_LOCK', 'ESCROW_REFUND'],
  perInstructionMax: dollars(1000),
  window: { seconds: 86400, maxTotal: dollars(2500) },
  counterparties: null,
  notAfter: null, // helper fills now + 1 day
  ...over,
});
const xfer = (n, gid, amt, to = 'MPL:harbour', opts = {}) => n.agentTx(gid, 'TRANSFER', { from: 'MPL:acme', to, amount: dollars(amt).toString() }, ['screen:MPL'], opts);
const setup = (over) => {
  const n = new Network();
  const r = n.grantAgent(G(over));
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  return n;
};

// ------------------------------------------------------------------ 6.0 (F1)
test('6.0: a queued payment keeps its caller in the stored queue entry, through to NET_CYCLE', () => {
  const n = new Network();
  // drain MPL's settlement position so the payment queues rather than settles
  const sp = n.ledger.s.issuers.get('MPL').sp;
  n.defund('MPL', sp - dollars(5));
  const r = n.pay('MPL:acme', 'NSR:cedar', dollars(10), { queue: true, caller: { kind: 'agent', label: 'sweep-bot' } });
  assert.ok(r.ok, r.message);
  const q = n.ledger.s.queue;
  assert.equal(q.length, 1, 'payment is queued');
  assert.deepEqual(q[0].tx.caller, { kind: 'agent', label: 'sweep-bot' });
  allOk(n);
});

test('6.0: an unspecified-caller queued payment stores no caller key (state roots unchanged for old chains)', () => {
  const n = new Network();
  n.defund('MPL', n.ledger.s.issuers.get('MPL').sp - dollars(5));
  n.pay('MPL:acme', 'NSR:cedar', dollars(10), { queue: true });
  assert.equal('caller' in n.ledger.s.queue[0].tx, false);
});

// ------------------------------------------------------------------ GRANT validation
test('a root grant is signed by the issuer ops key and recorded on the ledger', () => {
  const n = setup();
  const g = n.ledger.s.grants.get('sweeper-1');
  assert.equal(g.issuer, 'MPL');
  assert.equal(g.parent, null);
  assert.equal(g.per_instruction_max, dollars(1000));
  allOk(n);
});

test('a grant without the issuer ops signature is rejected', () => {
  const n = new Network();
  const t = n.grantTx(G({ grantId: 'x-1' }), { signAs: 'ops:NSR' }); // wrong institution's key
  assert.equal(one(n, t).ok, false);
});

test('unbounded or malformed grants are rejected with specific codes', () => {
  const n = new Network();
  const bad = (over, code) => {
    const r = n.grantAgent(G({ grantId: `b-${Math.random().toString(36).slice(2, 8)}`, ...over }));
    assert.equal(r.ok, false);
    assert.equal(r.error, code, String(Object.keys(over)));
  };
  bad({ perInstructionMax: null }, 'GRANT_UNBOUNDED');
  bad({ window: null }, 'GRANT_UNBOUNDED');
  bad({ notAfter: 1 }, 'GRANT_UNBOUNDED'); // already expired
  bad({ allowTypes: [] }, 'GRANT_BAD_TYPES');
  bad({ allowTypes: ['MINT'] }, 'GRANT_TYPE_NOT_GRANTABLE');
  bad({ allowTypes: ['REDEEM'] }, 'GRANT_TYPE_NOT_GRANTABLE');
  bad({ allowTypes: ['FUND_SP'] }, 'GRANT_TYPE_NOT_GRANTABLE');
  bad({ allowTypes: ['RESUME'] }, 'GRANT_TYPE_NOT_GRANTABLE');
  bad({ allowTypes: ['NET_CYCLE'] }, 'GRANT_TYPE_NOT_GRANTABLE');
  bad({ counterparties: [] }, 'GRANT_BAD_COUNTERPARTIES');
  bad({ issuer: 'ZZZ' }, 'UNKNOWN_ISSUER');
  allOk(n);
});

test('a grant id can be used once', () => {
  const n = setup();
  const r = n.grantAgent(G());
  assert.equal(r.error, 'GRANT_EXISTS');
});

// ------------------------------------------------------------------ narrowing
test('a sub-grant is signed by the parent agent key and may only narrow', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  const ok = n.grantAgent(G({ grantId: 'child-1', parent: 'sweeper-1', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 3600, maxTotal: dollars(200) } }));
  assert.ok(ok.ok, `${ok.error}: ${ok.message}`);
  assert.equal(n.ledger.s.grants.get('child-1').parent, 'sweeper-1');
  allOk(n);
});

test('a sub-grant that widens any field is rejected GRANT_WIDENS_PARENT', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'], counterparties: ['MPL:acme', 'MPL:harbour'] });
  const w = (over) => {
    const r = n.grantAgent(G({ grantId: `c-${Math.random().toString(36).slice(2, 8)}`, parent: 'sweeper-1', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 3600, maxTotal: dollars(200) }, counterparties: ['MPL:acme'], ...over }));
    assert.equal(r.error, 'GRANT_WIDENS_PARENT', String(Object.keys(over)));
  };
  w({ allowTypes: ['TRANSFER', 'PAYMENT'] }); // type parent lacks
  w({ perInstructionMax: dollars(1001) });
  w({ perInstructionMax: dollars(1000) + 1n }); // BigInt-exact, not string-compared
  w({ window: { seconds: 3600, maxTotal: dollars(2501) } });
  w({ counterparties: null }); // "anyone" widens a restricted parent
  w({ counterparties: ['MPL:acme', 'NSR:cedar'] });
  w({ notAfter: n.now() + 10 * 86400 });
});

test('sub-delegation needs GRANT in the parent allow_types, and depth is bounded', () => {
  const n = setup({ allowTypes: ['TRANSFER'] }); // no GRANT right
  const r = n.grantAgent(G({ grantId: 'c-1', parent: 'sweeper-1', allowTypes: ['TRANSFER'] }));
  assert.equal(r.error, 'ENVELOPE_DENIED');

  const m = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  let parent = 'sweeper-1';
  let last;
  for (let d = 1; d <= 5; d++) {
    last = m.grantAgent(G({ grantId: `d-${d}`, parent, allowTypes: ['TRANSFER', 'GRANT'] }));
    parent = `d-${d}`;
  }
  assert.equal(last.error, 'GRANT_TOO_DEEP', 'root + 4 descendants is the limit');
});

test('a grant can never reach another issuer: the sub-grant issuer must equal the parent issuer', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  const r = n.grantAgent(G({ grantId: 'c-1', issuer: 'NSR', parent: 'sweeper-1', allowTypes: ['TRANSFER'] }));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'GRANT_WRONG_ISSUER');
});

// ------------------------------------------------------------------ using a grant: ALLOW / ESCALATE / DENY
test('ALLOW: an in-envelope instruction signed only by the agent key executes and moves money', () => {
  const n = setup();
  const before = bal(n, 'MPL:harbour');
  const r = one(n, xfer(n, 'sweeper-1', 100));
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.equal(bal(n, 'MPL:harbour'), before + dollars(100));
  allOk(n);
});

test('the recorded caller is derived from the grant, not declared', () => {
  const n = setup();
  const r = one(n, xfer(n, 'sweeper-1', 10));
  assert.deepEqual(r.caller, { kind: 'agent', grant_id: 'sweeper-1', label: 'treasury sweeper v3' });
  const r2 = one(n, xfer(n, 'sweeper-1', 10, 'MPL:harbour', { caller: { kind: 'agent', label: 'whatever it says' } }));
  assert.deepEqual(r2.caller, { kind: 'agent', grant_id: 'sweeper-1', label: 'treasury sweeper v3' }, 'a declared label cannot override the derived one');
});

test('a declared caller.kind of human on an agent-signed instruction is CALLER_MISMATCH', () => {
  const n = setup();
  const r = one(n, xfer(n, 'sweeper-1', 10, 'MPL:harbour', { caller: { kind: 'human' } }));
  assert.equal(r.error, 'CALLER_MISMATCH');
});

test('the derived caller is what the block log and the queue show', () => {
  const n = setup();
  n.submit([xfer(n, 'sweeper-1', 10)]);
  const tx = n.snapshot().blocks[0].txs.find((t) => t.type === 'TRANSFER');
  assert.equal(tx.caller.kind, 'agent');
  assert.equal(tx.caller.grant_id, 'sweeper-1');
});

test('ESCALATE: over the per-instruction max needs the institution ops signature too', () => {
  const n = setup();
  const r = one(n, xfer(n, 'sweeper-1', 1500));
  assert.equal(r.error, 'ESCALATION_REQUIRED');
  const before = bal(n, 'MPL:harbour');
  const r2 = one(n, xfer(n, 'sweeper-1', 1500, 'MPL:harbour', { escalate: true }));
  assert.ok(r2.ok, `${r2.error}: ${r2.message}`);
  assert.equal(bal(n, 'MPL:harbour'), before + dollars(1500));
});

test('ESCALATE: exceeding the window cap escalates; the window is tumbling and resets', () => {
  const n = setup(); // window cap $2,500, per-instruction $1,000
  assert.ok(one(n, xfer(n, 'sweeper-1', 1000)).ok);
  assert.ok(one(n, xfer(n, 'sweeper-1', 1000)).ok);
  assert.equal(one(n, xfer(n, 'sweeper-1', 600)).error, 'ESCALATION_REQUIRED', '$2,600 total > $2,500');
  assert.ok(one(n, xfer(n, 'sweeper-1', 500)).ok, 'exactly at the cap is allowed');
  assert.equal(one(n, xfer(n, 'sweeper-1', 1)).error, 'ESCALATION_REQUIRED');
  n.advance(86400 + 1);
  assert.ok(one(n, xfer(n, 'sweeper-1', 1000)).ok, 'a new window starts');
  allOk(n);
});

test('a co-signed (escalated) instruction is institution-authorised and does not consume the window', () => {
  const n = setup();
  assert.ok(one(n, xfer(n, 'sweeper-1', 1500, 'MPL:harbour', { escalate: true })).ok);
  assert.ok(one(n, xfer(n, 'sweeper-1', 1000)).ok);
  assert.ok(one(n, xfer(n, 'sweeper-1', 1000)).ok);
  assert.equal(one(n, xfer(n, 'sweeper-1', 600)).error, 'ESCALATION_REQUIRED');
});

test('DENY: a type outside allow_types is ENVELOPE_DENIED, even with the ops key alongside', () => {
  const n = setup({ allowTypes: ['TRANSFER'] });
  const t = n.agentTx('sweeper-1', 'ESCROW_LOCK', { escrowId: 'e-1', from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString(), expiresAt: n.now() + 60, releaseRole: 'ops:MPL', eventName: null }, ['screen:MPL'], { escalate: true });
  assert.equal(one(n, t).error, 'ENVELOPE_DENIED');
});

test('DENY: a counterparty outside the allow-list is ENVELOPE_DENIED', () => {
  const n = setup({ counterparties: ['MPL:acme', 'MPL:harbour'] });
  const t = n.agentTx('sweeper-1', 'PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(5).toString(), queueIfShort: false }, ['screen:MPL', 'accept:NSR']);
  assert.equal(one(n, t).error, 'ENVELOPE_DENIED');
  assert.ok(one(n, xfer(n, 'sweeper-1', 5)).ok, 'inside the list is fine');
});

test('DENY: an expired grant', () => {
  const n = setup({ notAfter: null });
  n.advance(7 * 86400 + 5);
  assert.equal(one(n, xfer(n, 'sweeper-1', 1)).error, 'GRANT_EXPIRED');
});

test('an agent key cannot authorise for a different issuer, and an unknown grant is rejected', () => {
  const n = setup(); // MPL grant
  const t = n.agentTx('sweeper-1', 'TRANSFER', { from: 'NSR:cedar', to: 'NSR:pinnacle', amount: dollars(1).toString() }, ['screen:NSR']);
  assert.equal(one(n, t).error, 'GRANT_WRONG_ISSUER');
  const u = xfer(n, 'sweeper-1', 1);
  u.sigs['agent:nope'] = u.sigs['agent:sweeper-1'];
  delete u.sigs['agent:sweeper-1'];
  assert.equal(one(n, u).error, 'UNKNOWN_GRANT');
});

test('a forged agent signature (another key) is BAD_SIGNATURE', () => {
  const n = setup();
  const t = xfer(n, 'sweeper-1', 5);
  const other = n.agentTx('sweeper-1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(6).toString() }, ['screen:MPL']);
  t.sigs['agent:sweeper-1'] = other.sigs['agent:sweeper-1']; // signature over a different message
  assert.equal(one(n, t).error, 'BAD_SIGNATURE');
});

test('the screening and acceptance signatures are still required alongside an agent signature', () => {
  const n = setup();
  const t = xfer(n, 'sweeper-1', 5);
  delete t.sigs['screen:MPL'];
  assert.equal(one(n, t).error, 'MISSING_SIGNATURE');
});

test('an agent-signed instruction that fails later leaves the window untouched (journal rollback)', () => {
  const n = setup({ perInstructionMax: dollars(4_000_000), window: { seconds: 86400, maxTotal: dollars(4_000_000) } });
  const t = n.agentTx('sweeper-1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(900_000).toString() }, ['screen:MPL']); // acme holds $500,000
  assert.equal(one(n, t).error, 'INSUFFICIENT_FUNDS', 'fails after the envelope check has already run');
  const w = n.ledger.s.grants.get('sweeper-1').win;
  assert.equal(w.spent, 0n, 'nothing spent by a failed instruction');
});

// ------------------------------------------------------------------ ancestor accounting + revocation
test('spend under a sub-grant counts against every ancestor window', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'], window: { seconds: 86400, maxTotal: dollars(1000) }, perInstructionMax: dollars(1000) });
  for (const id of ['kid-a', 'kid-b']) {
    const r = n.grantAgent(G({ grantId: id, parent: 'sweeper-1', allowTypes: ['TRANSFER'], perInstructionMax: dollars(800), window: { seconds: 86400, maxTotal: dollars(800) } }));
    assert.ok(r.ok, `${r.error}: ${r.message}`);
  }
  assert.ok(one(n, xfer(n, 'kid-a', 700)).ok);
  // kid-b's own window is untouched, but the PARENT's $1,000 cap already has $700 spent
  assert.equal(one(n, xfer(n, 'kid-b', 400)).error, 'ESCALATION_REQUIRED');
  assert.ok(one(n, xfer(n, 'kid-b', 300)).ok);
  assert.equal(n.ledger.s.grants.get('sweeper-1').win.spent, dollars(1000));
  allOk(n);
});

test('revocation by ops takes effect in-block and cascades to every descendant', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'kid', parent: 'sweeper-1', allowTypes: ['TRANSFER', 'GRANT'] })).ok);
  assert.ok(n.grantAgent(G({ grantId: 'grandkid', parent: 'kid', allowTypes: ['TRANSFER'] })).ok);
  assert.ok(one(n, xfer(n, 'grandkid', 10)).ok);
  const r = n.revokeGrant('sweeper-1');
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  for (const id of ['sweeper-1', 'kid', 'grandkid']) assert.equal(one(n, xfer(n, id, 10)).error, 'GRANT_REVOKED', id);
  allOk(n);
});

test('an ancestor agent key can revoke a descendant, but a descendant cannot revoke its ancestor or a sibling', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  assert.ok(n.grantAgent(G({ grantId: 'kid-a', parent: 'sweeper-1', allowTypes: ['TRANSFER', 'GRANT'] })).ok);
  assert.ok(n.grantAgent(G({ grantId: 'kid-b', parent: 'sweeper-1', allowTypes: ['TRANSFER'] })).ok);
  assert.equal(n.revokeGrant('sweeper-1', { by: 'kid-a' }).error, 'REVOKE_NOT_AUTHORISED');
  assert.equal(n.revokeGrant('kid-b', { by: 'kid-a' }).error, 'REVOKE_NOT_AUTHORISED');
  assert.ok(n.revokeGrant('kid-b', { by: 'sweeper-1' }).ok);
  assert.equal(one(n, xfer(n, 'kid-b', 1)).error, 'GRANT_REVOKED');
  assert.ok(one(n, xfer(n, 'kid-a', 1)).ok, 'the sibling is unaffected');
});

test('a quarantined issuer rejects agent instructions like any other', () => {
  const n = setup();
  n.ledger.unsafeMutate((s) => {
    s.issuers.get('MPL').status = 'QUARANTINED';
  });
  const t = n.agentTx('sweeper-1', 'PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(1).toString(), queueIfShort: false }, ['screen:MPL', 'accept:NSR']);
  assert.equal(one(n, t).error, 'ISSUER_QUARANTINED');
});

// ------------------------------------------------------------------ zero migration + replay
test('with no grants, state is byte-identical to before: grants is absent from the state view', () => {
  const n = new Network();
  assert.equal('grants' in n.ledger.stateView(), false);
});

test('grants, agent instructions and revocation replay from genesis to the same state root', () => {
  const n = setup({ allowTypes: ['TRANSFER', 'GRANT'] });
  n.grantAgent(G({ grantId: 'kid', parent: 'sweeper-1', allowTypes: ['TRANSFER'] }));
  one(n, xfer(n, 'kid', 25));
  one(n, xfer(n, 'sweeper-1', 1500, 'MPL:harbour', { escalate: true }));
  n.revokeGrant('kid');
  const v = n.verifyReplay();
  assert.ok(v.ok, `replay disagreed (blocks=${v.blocks})`);
  assert.equal(v.stateRoot, n.snapshot().stateRoot);
});

test('an agent-authorised sweep registers and fires exactly like an ops-authorised one', () => {
  const n = setup({ counterparties: ['MPL:acme', 'MPL:harbour'] });
  const t = n.agentTx('sweeper-1', 'REGISTER_SWEEP', { sweepId: 'sw-1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(100_000).toString() }, []);
  const r = one(n, t);
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  assert.ok(n.ledger.s.sweeps.has('sw-1'));
  const c = n.agentTx('sweeper-1', 'CANCEL_SWEEP', { sweepId: 'sw-1' }, []);
  assert.ok(one(n, c).ok);
  allOk(n);
});
