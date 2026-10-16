import test from 'node:test';
import assert from 'node:assert/strict';
import { modelCheck, DELEGATION_MODEL, HARD_TIER_MODEL } from '../src/modelcheck.js';
import { KernelError, Ledger, messageOf } from '../src/kernel.js';

test('model check: every state reachable within 5 actions (incl. a slow core, attacks, and the four new templates) satisfies all safety and liveness properties', () => {
  // Extended (roadmap 2.1) to cover Escrow, PayOnEvent, Batch and Sweep: 37 actions (was 27),
  // a second same-issuer account so same-issuer Escrow/Sweep have somewhere to move to, and
  // escrows/sweeps included in the state key. Extended again (roadmap 4.3) to 40 actions for
  // External-CSD DvP (roadmap 4.2), in combination with everything above, not just in isolation.
  // Measured empirically (see docs/invariant-charter.md for the honest before/after numbers)
  // rather than assumed - do not lower these thresholds to make a future change look green; a
  // real regression in reachable coverage should fail this.
  const r = modelCheck({ maxDepth: 5, maxStates: 5000 });
  assert.deepEqual(r.failures, []);
  assert.equal(r.actions, 40);
  assert.ok(r.states > 3600, `explored ${r.states} states`);
  assert.ok(r.transitions > 39000, `explored ${r.transitions} transitions`);
  assert.ok(r.quiescentChecks >= r.states - r.states * 0.75);
});

// A model checker that has never found a bug proves little. Plant bugs and require it to find them.
function withMutant(name, patch, expectKinds) {
  test(`mutation: the checker catches a planted kernel bug (${name})`, () => {
    const restore = patch();
    try {
      const r = modelCheck({ maxDepth: 5, maxStates: 5000 });
      assert.ok(r.failures.length > 0, 'the planted bug went undetected');
      assert.ok(r.failures.some((f) => expectKinds.includes(f.kind)), `expected one of ${expectKinds}, got ${r.failures.map((f) => f.kind)}`);
      assert.ok(r.failures[0].trail.length <= 5, 'a short counterexample is reported: ' + r.failures[0].trail.join(' → '));
    } finally {
      restore();
    }
  });
}

// --- roadmap 2.2: at least three new planted bugs, each in a new template's own handler,
// each expected to be caught by the SAME existing safety properties above with no new checker
// code - the value of reusing #moveCash/the Journal/#checkEnvelope rather than inventing new
// mechanisms for each template.

withMutant('escrow release credits the beneficiary without debiting the escrow account (prints money)', () => {
  const orig = Ledger.prototype.tx_ESCROW_RELEASE;
  Ledger.prototype.tx_ESCROW_RELEASE = function (tx, time, j, events) {
    const rec = this.s.escrows.get(tx.payload.escrowId);
    if (!rec) return orig.call(this, tx, time, j, events);
    const to = this.s.accounts.get(rec.to);
    j.del(this.s.escrows, tx.payload.escrowId);
    j.field(to, 'balance', to.balance + rec.amount); // bug: no debit of the escrow account
    events.push({ type: 'ESCROW_RELEASED', escrowId: tx.payload.escrowId, to: to.id, amount: rec.amount.toString() });
  };
  return () => (Ledger.prototype.tx_ESCROW_RELEASE = orig);
}, ['S1_INVARIANT']);

withMutant('batch: an earlier leg is not rolled back when a later leg fails', () => {
  // A decoy "journal" that applies mutations directly to state and never records anything to
  // undo - so the real, outer journal's rollback (already proven correct by every other test)
  // has nothing to undo for a leg run against it. Every leg but the last gets the decoy.
  const decoy = { field: (o, k, v) => { o[k] = v; }, set: (m, k, v) => m.set(k, v), del: (m, k) => m.delete(k), child: () => decoy, commit() {}, rollback() {} };
  const orig = Ledger.prototype.tx_BATCH;
  Ledger.prototype.tx_BATCH = function (tx, time, j, events) {
    const p = tx.payload;
    if (!Array.isArray(p.legs) || p.legs.length < 2) return orig.call(this, tx, time, j, events);
    p.legs.forEach((leg, i) => {
      const h = this['tx_' + leg.type];
      h.call(this, leg, time, i < p.legs.length - 1 ? decoy : j, events);
    });
    events.push({ type: 'BATCH_SETTLED', legs: p.legs.length });
  };
  return () => (Ledger.prototype.tx_BATCH = orig);
}, ['S1_INVARIANT', 'S2_REJECTION_CHANGED_STATE']);

withMutant('PayOnEvent: a release accepts any registered oracle for the event name the attacker claims, not the one the escrow was locked against', () => {
  const orig = Ledger.prototype.tx_EVENT_RELEASE;
  Ledger.prototype.tx_EVENT_RELEASE = function (tx, time, j, events) {
    const p = tx.payload;
    const rec = this.s.escrows.get(p.escrowId);
    if (!rec || rec.eventName === null) return orig.call(this, tx, time, j, events);
    // bug: signs against the attacker's claimed event, and never checks it against rec.eventName
    const sig = tx.sigs && tx.sigs[`event:${p.event}`];
    const pub = this.genesis.eventOracles && this.genesis.eventOracles[p.event];
    if (!sig || !pub) throw new KernelError('MISSING_SIGNATURE');
    const to = this.s.accounts.get(rec.to);
    j.del(this.s.escrows, p.escrowId);
    j.field(this.s.accounts.get(rec.escrowAccountId), 'balance', this.s.accounts.get(rec.escrowAccountId).balance - rec.amount);
    j.field(to, 'balance', to.balance + rec.amount);
    events.push({ type: 'ESCROW_EVENT_RELEASED', escrowId: p.escrowId, to: to.id, amount: rec.amount.toString(), event: p.event });
  };
  return () => (Ledger.prototype.tx_EVENT_RELEASE = orig);
}, ['S3_ATTACK_ACCEPTED']);

withMutant('mint credits the customer twice: over-issuance', () => {
  const orig = Ledger.prototype.tx_MINT;
  Ledger.prototype.tx_MINT = function (tx, time, j, events) {
    orig.call(this, tx, time, j, events);
    const a = this.s.accounts.get(tx.payload.account);
    j.field(a, 'balance', a.balance + 100n);
  };
  return () => (Ledger.prototype.tx_MINT = orig);
}, ['S1_INVARIANT']);

withMutant('core credit never reaches the control balance: supply and core drift apart', () => {
  const orig = Ledger.prototype.tx_CLOSE_CONVERT_IN;
  Ledger.prototype.tx_CLOSE_CONVERT_IN = function (tx, time, j, events) {
    const iss = this.s.issuers.get(tx.payload.issuer);
    const e = iss.pendingIn.get(tx.payload.id);
    orig.call(this, tx, time, j, events);
    if (e) j.field(iss, 'L', iss.L - e.amount);
  };
  return () => (Ledger.prototype.tx_CLOSE_CONVERT_IN = orig);
}, ['S1_INVARIANT', 'S4_SUPPLY_EQ_CORE', 'L1_LIVENESS']);

withMutant('a failed redeem leaves its burn behind (atomicity broken)', () => {
  const orig = Ledger.prototype.tx_REDEEM;
  Ledger.prototype.tx_REDEEM = function (tx, time, j, events) {
    const acct = this.s.accounts.get(tx.payload.account);
    // buggy: debit first, outside the journal, then validate
    if (acct && acct.balance >= 100n) acct.balance -= 100n;
    return orig.call(this, tx, time, j, events);
  };
  return () => (Ledger.prototype.tx_REDEEM = orig);
}, ['S1_INVARIANT', 'S2_REJECTION_CHANGED_STATE', 'S3_ATTACK_CHANGED_STATE']);

withMutant('payments ignore the settlement position: the payer can spend money it never prefunded', () => {
  const orig = Ledger.prototype.tx_PAYMENT;
  Ledger.prototype.tx_PAYMENT = function (tx, time, j, events) {
    const iss = this.s.issuers.get(this.s.accounts.get(tx.payload.from).issuer);
    const saved = iss.sp;
    j.field(iss, 'sp', saved + 1_000_000_000n); // bug: pretend the position is huge during the check
    try {
      orig.call(this, tx, time, j, events);
    } finally {
      j.field(iss, 'sp', iss.sp - 1_000_000_000n);
    }
  };
  return () => (Ledger.prototype.tx_PAYMENT = orig);
}, ['S1_INVARIANT']);

// ---------------------------------------------------------------------------------------------
// Roadmap 6.3: delegation soundness (S6). Grants gate authority (P6), so unlike caller attribution
// they must be searched exhaustively. Run on the focused DELEGATION_MODEL alphabet (25 actions,
// extended from 19 by roadmap 8.3's CANCEL_SWEEP-ownership actions, and from 21 by 8.5's grant-binding actions: a second
// root grant g4 sharing g1's key, a legitimate g4 transfer, and the relabel attack) so the search can go deep: a
// counterexample needs mint, mint, grant, sub-grant, revoke, use.
test('model check S6: every state reachable within 9 delegation actions keeps every grant inside its parent, honours revocation through the whole chain, never lets an agent past its envelope without the institution, and never lets a grant cancel a sweep it did not register, and never lets signed bytes move onto another grant that shares the signer key', () => {
  const r = modelCheck({ maxDepth: 9, maxStates: 8000, actions: DELEGATION_MODEL });
  assert.deepEqual(r.failures, []);
  assert.equal(r.actions, 25);
  assert.equal(r.capped, false);
  assert.ok(r.states > 3000, `explored ${r.states} states`);
  assert.ok(r.transitions > 60000, `explored ${r.transitions} transitions`);
});

function withDelegationMutant(name, patch, expectKinds) {
  test(`mutation (delegation): the checker catches a planted kernel bug (${name})`, () => {
    const restore = patch();
    try {
      const r = modelCheck({ maxDepth: 7, maxStates: 5000, actions: DELEGATION_MODEL });
      assert.ok(r.failures.length > 0, 'the planted bug went undetected');
      assert.ok(r.failures.some((f) => expectKinds.includes(f.kind)), `expected one of ${expectKinds}, got ${r.failures.map((f) => f.kind)}`);
      assert.ok(r.failures[0].trail.length <= 7, 'a short counterexample is reported: ' + r.failures[0].trail.join(' → '));
    } finally {
      restore();
    }
  });
}

withDelegationMutant('the window counter is not journaled: a rejected agent instruction still consumes the window', () => {
  const orig = Ledger.prototype.tx_TRANSFER;
  Ledger.prototype.tx_TRANSFER = function (tx, time, j, events) {
    try {
      return orig.call(this, tx, time, j, events);
    } catch (e) {
      j.undo.length = 0; // bug: nothing recorded for undo, so the window bump made before the failure survives
      throw e;
    }
  };
  return () => (Ledger.prototype.tx_TRANSFER = orig);
}, ['S2_REJECTION_CHANGED_STATE']);

withDelegationMutant('a sub-grant is stored detached from its parent, so revoking the parent does not cascade', () => {
  const orig = Ledger.prototype.tx_GRANT;
  Ledger.prototype.tx_GRANT = function (tx, time, j, events) {
    orig.call(this, tx, time, j, events);
    if (tx.payload.parent) j.set(this.s.grants, tx.payload.grant_id, { ...this.s.grants.get(tx.payload.grant_id), parent: null });
  };
  return () => (Ledger.prototype.tx_GRANT = orig);
}, ['S6_DELEGATION']);

withDelegationMutant('narrowing compares money as strings ("1000" <= "200"), so a sub-grant can widen its parent', () => {
  const orig = Ledger.prototype.tx_GRANT;
  Ledger.prototype.tx_GRANT = function (tx, time, j, events) {
    const p = tx.payload;
    const par = p.parent && this.s.grants.get(p.parent);
    if (!par) return orig.call(this, tx, time, j, events);
    // the kernel freezes executed instructions, so the planted bug works on an unfrozen copy whose signed digest is cached first
    const q = { ...p };
    const copy = { ...tx, payload: q };
    messageOf(copy, this.chainId); // cache the signed digest before the payload is touched
    const real = { max: p.per_instruction_max };
    if (real.max <= par.per_instruction_max.toString()) q.per_instruction_max = par.per_instruction_max.toString(); // bug: lexicographic compare
    orig.call(this, copy, time, j, events);
    const rec = this.s.grants.get(p.grant_id);
    j.set(this.s.grants, p.grant_id, { ...rec, per_instruction_max: BigInt(real.max) });
  };
  return () => (Ledger.prototype.tx_GRANT = orig);
}, ['S3_ATTACK_ACCEPTED', 'S6_DELEGATION']);

withDelegationMutant('escalation is accepted without the institution signature: the envelope is not enforced', () => {
  const orig = Ledger.prototype.tx_TRANSFER;
  Ledger.prototype.tx_TRANSFER = function (tx, time, j, events) {
    const role = Object.keys(tx.sigs || {}).find((r) => r.startsWith('agent:'));
    const rec = role && this.s.grants.get(role.slice(6));
    if (!rec) return orig.call(this, tx, time, j, events);
    const saved = { max: rec.per_instruction_max, window: rec.window };
    rec.per_instruction_max = 10n ** 15n; // bug: the envelope is effectively unlimited
    rec.window = { ...rec.window, max_total: 10n ** 15n };
    try {
      return orig.call(this, tx, time, j, events);
    } finally {
      rec.per_instruction_max = saved.max;
      rec.window = saved.window;
      const cur = this.s.grants.get(rec.id);
      if (cur !== rec) {
        cur.per_instruction_max = saved.max;
        cur.window = { ...cur.window, max_total: saved.window.max_total };
      }
    }
  };
  return () => (Ledger.prototype.tx_TRANSFER = orig);
}, ['S3_ATTACK_ACCEPTED', 'S6_DELEGATION']);

// Roadmap 7.1 / 7.2: the two gaps Priority 6 left open, each with a planted bug.
withDelegationMutant('a sweep registered under a grant is not bounded by it: the grant is dropped from the sweep record, so it fires unbounded', () => {
  const orig = Ledger.prototype.tx_REGISTER_SWEEP;
  Ledger.prototype.tx_REGISTER_SWEEP = function (tx, time, j, events) {
    orig.call(this, tx, time, j, events);
    const { grant, ...rest } = this.s.sweeps.get(tx.payload.sweepId); // bug: forgets which grant it belongs to
    j.set(this.s.sweeps, tx.payload.sweepId, rest);
  };
  return () => (Ledger.prototype.tx_REGISTER_SWEEP = orig);
}, ['S6_DELEGATION']);

withDelegationMutant('a batch is accepted although its legs have different effective callers', () => {
  const orig = Ledger.prototype.tx_BATCH;
  Ledger.prototype.tx_BATCH = function (tx, time, j, events) {
    for (const leg of tx.payload.legs) this['tx_' + leg.type].call(this, leg, time, j, events); // bug: no shared-caller check
    events.push({ type: 'BATCH_SETTLED', legs: tx.payload.legs.length });
  };
  return () => (Ledger.prototype.tx_BATCH = orig);
}, ['S3_ATTACK_ACCEPTED', 'S6_DELEGATION']);

// Roadmap 8.3: an external-audit finding. CANCEL_SWEEP checked only that the acting grant was live
// and allowed the type - never that it was the grant (or an ancestor) that registered the sweep.
withDelegationMutant('CANCEL_SWEEP does not check the acting grant registered the sweep: any grant with CANCEL_SWEEP in its envelope can cancel any sweep', () => {
  const orig = Ledger.prototype.tx_CANCEL_SWEEP;
  Ledger.prototype.tx_CANCEL_SWEEP = function (tx, time, j, events) {
    try {
      return orig.call(this, tx, time, j, events);
    } catch (e) {
      if (!(e instanceof KernelError) || e.code !== 'SWEEP_WRONG_GRANT') throw e;
      // bug: proceed exactly as if the ownership check had passed
      j.del(this.s.sweeps, tx.payload.sweepId);
      events.push({ type: 'SWEEP_CANCELLED', sweepId: tx.payload.sweepId });
    }
  };
  return () => (Ledger.prototype.tx_CANCEL_SWEEP = orig);
}, ['S3_ATTACK_ACCEPTED', 'S6_DELEGATION']);

// Roadmap 8.5: grant binding. The planted bug is a kernel that lets the role label choose the grant again: the
// signed digest is computed (and cached) as signed, then the instruction's declared grant is rewritten to match
// its agent role, so the signature still verifies and the relabel check sees agreement. Applies to legs too.
withDelegationMutant('the grant is taken from the role label again: signed bytes can be moved onto another grant that shares the key', () => {
  const orig = Ledger.prototype.executeBlock;
  Ledger.prototype.executeBlock = function (b) {
    const rebind = (tx) => {
      if (!tx || typeof tx !== 'object') return;
      const role = Object.keys(tx.sigs || {}).find((r) => r.startsWith('agent:'));
      if (role) { messageOf(tx, this.chainId); tx.grant = role.slice(6); } // cache the signed digest, then rewrite the claim
      if (tx.type === 'BATCH' && tx.payload && Array.isArray(tx.payload.legs)) tx.payload.legs.forEach(rebind);
    };
    b.txs.forEach(rebind);
    return orig.call(this, b);
  };
  return () => (Ledger.prototype.executeBlock = orig);
}, ['S3_ATTACK_ACCEPTED', 'S6_DELEGATION']);

// Option C (hard tier): its own small alphabet, so it can be searched to exhaustion. The oracle (S6 g) never lets an
// accepted agent instruction exceed a hard limit down its chain, co-signed or not, and counts co-signed spends in the hard window.
test('model check S6(g): within 12 hard-tier actions no instruction passes a hard limit, co-signed or not, and the hard window counts co-signed spends', () => {
  const r = modelCheck({ maxDepth: 12, maxStates: 5000, actions: HARD_TIER_MODEL });
  assert.deepEqual(r.failures, []);
  assert.equal(r.actions, 9);
  assert.equal(r.exhausted, true, 'the search ran out of new states, it did not stop at a cap');
  assert.ok(r.states > 100, `explored ${r.states} states`);
});
function withHardTierMutant(name, patch, expectKinds) {
  test(`mutation (hard tier): the checker catches a planted kernel bug (${name})`, () => {
    const restore = patch();
    try {
      const r = modelCheck({ maxDepth: 8, maxStates: 5000, actions: HARD_TIER_MODEL });
      assert.ok(r.failures.length > 0, 'the planted bug went undetected');
      assert.ok(r.failures.some((f) => expectKinds.includes(f.kind)), `expected one of ${expectKinds}, got ${r.failures.map((f) => f.kind)}`);
    } finally { restore(); }
  });
}
const coSigned = (tx) => Object.keys(tx.sigs || {}).some((k) => k.startsWith('ops:'));
const agentRec = (self, tx) => { const role = Object.keys(tx.sigs || {}).find((r) => r.startsWith('agent:')); return role && self.s.grants.get(role.slice(6)); };
withHardTierMutant('the hard cap is skipped when the institution co-signs', () => {
  const orig = Ledger.prototype.tx_TRANSFER;
  Ledger.prototype.tx_TRANSFER = function (tx, time, j, events) {
    const rec = agentRec(this, tx);
    if (!rec || rec.hard_max === undefined || !coSigned(tx)) return orig.call(this, tx, time, j, events);
    const saved = rec.hard_max; delete rec.hard_max; // bug: a co-signature lifts the hard cap
    try { return orig.call(this, tx, time, j, events); } finally { const cur = this.s.grants.get(rec.id); rec.hard_max = saved; if (cur !== rec) cur.hard_max = saved; }
  };
  return () => (Ledger.prototype.tx_TRANSFER = orig);
}, ['S3_ATTACK_ACCEPTED', 'S6_DELEGATION']);
withHardTierMutant('co-signed spends are not counted in the hard window', () => {
  const orig = Ledger.prototype.tx_TRANSFER;
  Ledger.prototype.tx_TRANSFER = function (tx, time, j, events) {
    const rec = agentRec(this, tx);
    const before = rec && rec.hwin;
    const out = orig.call(this, tx, time, j, events);
    if (rec && before && coSigned(tx)) { const cur = this.s.grants.get(rec.id); if (cur && cur.hwin) cur.hwin = { ...before }; } // bug: forgets the co-signed spend
    return out;
  };
  return () => (Ledger.prototype.tx_TRANSFER = orig);
}, ['S6_DELEGATION', 'S3_ATTACK_ACCEPTED']);
withHardTierMutant('the hard window is never checked, only the per-instruction hard cap', () => {
  const orig = Ledger.prototype.tx_TRANSFER;
  Ledger.prototype.tx_TRANSFER = function (tx, time, j, events) {
    const rec = agentRec(this, tx);
    if (!rec || rec.hard_window_max === undefined) return orig.call(this, tx, time, j, events);
    const saved = rec.hard_window_max; rec.hard_window_max = 10n ** 15n; // bug: the hard window is effectively unlimited (the counter still runs)
    try { return orig.call(this, tx, time, j, events); } finally { const cur = this.s.grants.get(rec.id); rec.hard_window_max = saved; if (cur !== rec) cur.hard_window_max = saved; }
  };
  return () => (Ledger.prototype.tx_TRANSFER = orig);
}, ['S6_DELEGATION', 'S3_ATTACK_ACCEPTED']);
