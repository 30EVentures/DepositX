// A toy core-banking system plus adapter state for one issuing bank.
// The bank's core stays the legal source of truth for the deposit liability. It holds each customer's
// ordinary deposit and a "tokenised deposits control" GL (L). The ledger is authoritative for who owns
// which token at the consensus instant. Ordering follows the spec:
//   mint:   core hold + reclass first (L up), then ledger mint   -> S <= L always
//   redeem: ledger burn first, then core credits the customer    -> customer claim never lost

export class Bank {
  constructor(id, name, customers, cbBalance) {
    this.id = id;
    this.name = name;
    this.customers = new Map(customers.map((c) => [c.id, { ...c }]));
    this.controlGL = 0n; // tokenised-deposits control GL == what the core will attest as L
    this.seq = 0; // adapter attestation sequence
    this.cbBalance = cbBalance; // funds at the central bank, outside the ledger
    this.holdCounter = 0;
  }

  customer(id) {
    const c = this.customers.get(id);
    if (!c) throw new Error(`unknown customer ${id} at ${this.id}`);
    return c;
  }

  // Core places a durable hold: debit the customer's ordinary deposit, credit the control GL.
  // No new liability is created: the deposit is reclassified inside the same bank.
  placeHold(custId, amt) {
    const c = this.customer(custId);
    if (c.ordinary < amt) return null;
    c.ordinary -= amt;
    this.controlGL += amt;
    return { holdId: `${this.id}-H${++this.holdCounter}`, L_after: this.controlGL, seq: ++this.seq };
  }

  reverseHold(custId, amt) {
    this.customer(custId).ordinary += amt;
    this.controlGL -= amt;
    return { L_after: this.controlGL, seq: ++this.seq };
  }

  // Ledger burned tokens: the core now pays the customer out of the control GL.
  creditRedemption(custId, amt) {
    this.customer(custId).ordinary += amt;
    this.controlGL -= amt;
    return { L_after: this.controlGL, seq: ++this.seq };
  }

  // Cross-bank convert. Payer bank's control liability is extinguished (settled through its position);
  // payee bank's control liability rises, funded by the position it received.
  postConvertOut(amt) {
    this.controlGL -= amt;
    return { L_after: this.controlGL, seq: ++this.seq };
  }
  postConvertIn(amt) {
    this.controlGL += amt;
    return { L_after: this.controlGL, seq: ++this.seq };
  }

  attestation() {
    return { L: this.controlGL, seq: ++this.seq };
  }

  snapshot() {
    return {
      customers: [...this.customers.values()].map((c) => ({ ...c, ordinary: c.ordinary.toString() })),
      controlGL: this.controlGL.toString(),
      seq: this.seq,
      cbBalance: this.cbBalance.toString(),
      holdCounter: this.holdCounter,
    };
  }
  restore(o) {
    this.customers = new Map(o.customers.map((c) => [c.id, { ...c, ordinary: BigInt(c.ordinary) }]));
    this.controlGL = BigInt(o.controlGL);
    this.seq = o.seq;
    this.cbBalance = BigInt(o.cbBalance);
    this.holdCounter = o.holdCounter;
  }
}
