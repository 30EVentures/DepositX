import test from 'node:test';
import assert from 'node:assert/strict';
import { modelCheck } from '../src/modelcheck.js';
import { Ledger } from '../src/kernel.js';

test('model check: every state reachable within 5 actions (incl. a slow core and attacks) satisfies all safety and liveness properties', () => {
  const r = modelCheck({ maxDepth: 5, maxStates: 5000 });
  assert.deepEqual(r.failures, []);
  assert.ok(r.states > 1500, `explored ${r.states} states`);
  assert.ok(r.transitions > 15000);
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
