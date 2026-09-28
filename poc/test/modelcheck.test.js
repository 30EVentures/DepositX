import test from 'node:test';
import assert from 'node:assert/strict';
import { modelCheck } from '../src/modelcheck.js';
import { KernelError, Ledger } from '../src/kernel.js';

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
