// DepositX Ledger Core, proof-of-concept kernel.
//
// A deterministic state machine implementing the semantics in
// 02-technical-implementation.md: per-issuer deposit tokens (model X), prefunded
// settlement positions, atomic Transfer / Convert / DvP, liquidity-saving netting,
// the seven par invariants P1-P7, and the graded halt (issuer quarantine vs network halt).
//
// It is deliberately a *pure* function of (genesis, blocks): no clocks, no randomness,
// no I/O. Time comes in with each block. Amounts are BigInt CAD cents.
//
// Who is calling is recorded, not trusted, in two ways (see docs/agent-native-access-proposal.md):
// an instruction signed with an institution's own `ops` key may carry a self-attested
// `caller: {kind, label?}` (roadmap 5.1, inside the signed digest); an instruction signed with an
// `agent:<grant_id>` key is authorised by an on-ledger GRANT - a bounded, narrowing envelope - and
// the kernel DERIVES its caller from the grant (roadmap 6.1). Everything else is identical for both.
// Consensus is NOT here; see network.js, which simulates a BFT quorum around this kernel.

import { canon, sha256, verify } from './crypto.js';

export class KernelError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}
const need = (cond, code, msg) => {
  if (!cond) throw new KernelError(code, msg);
};
const parseAmount = (s, code = 'BAD_AMOUNT') => {
  need(typeof s === 'string' && /^[1-9][0-9]{0,17}$/.test(s), code, `amount must be a positive integer string of cents, got ${s}`);
  return BigInt(s);
};
const parseNonNegAmount = (s, code = 'BAD_AMOUNT') => {
  need(typeof s === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(s), code, `amount must be a non-negative integer string of cents, got ${s}`);
  return BigInt(s);
};
const ID_RE = /^[a-z0-9_-]{1,40}$/;

export const MAX_TTL_S = 60; // valid_until must be within 60 s of block time
export const INFLIGHT_MAX_AGE_S = 900; // open holds / pending core postings older than this quarantine the issuer
export const QUARANTINE_ESCALATE_S = 900; // a quarantine older than this escalates to a network halt
const DEDUP_WINDOW_S = 180;
// Agent delegation (roadmap 6.1). Deny-by-default: only these instruction types can ever be put in a
// grant. Mint, redeem, DvP, funding, halt/resume, netting and every gov:/anchor/reconciler action are
// deliberately absent. 'GRANT' is the sub-delegation right.
export const GRANTABLE_TYPES = ['TRANSFER', 'PAYMENT', 'ESCROW_LOCK', 'ESCROW_REFUND', 'REGISTER_SWEEP', 'CANCEL_SWEEP', 'GRANT'];
const GRANTABLE = new Set(GRANTABLE_TYPES);
export const MAX_GRANT_DEPTH = 5; // a root grant plus four levels of sub-grants
const MAX_WINDOW_S = 30 * 86400;
const ACCT_RE = /^[A-Z]{3}:[a-z0-9_:-]{1,60}$/;

// Undo journal: every mutation inside a transaction is recorded so a failed
// transaction leaves state byte-identical (atomicity: all legs or none).
class Journal {
  constructor(parent = null) {
    this.undo = [];
    this.parent = parent;
  }
  field(obj, key, val) {
    const old = obj[key];
    this.undo.push(() => {
      obj[key] = old;
    });
    obj[key] = val;
  }
  set(map, key, val) {
    const had = map.has(key);
    const old = map.get(key);
    this.undo.push(() => (had ? map.set(key, old) : map.delete(key)));
    map.set(key, val);
  }
  del(map, key) {
    if (!map.has(key)) return;
    const old = map.get(key);
    this.undo.push(() => map.set(key, old));
    map.delete(key);
  }
  child() {
    return new Journal(this);
  }
  commit() {
    if (this.parent) this.parent.undo.push(...this.undo);
    this.undo = [];
  }
  rollback() {
    for (let i = this.undo.length - 1; i >= 0; i--) this.undo[i]();
    this.undo = [];
  }
}

const msgCache = new WeakMap();
export function messageOf(tx, chainId) {
  let m = msgCache.get(tx);
  if (!m) {
    m = canon({ d: 'depositx-poc-v1', chain: chainId, inst_id: tx.inst_id, type: tx.type, payload: tx.payload, valid_until: tx.valid_until, caller: tx.caller || { kind: 'unspecified' } });
    msgCache.set(tx, m);
  }
  return m;
}

// Par legs must conserve: tokens burned at the payer issuer == tokens minted at the payee issuer,
// and each issuer's settlement-position move equals its token move. (Invariant P3.)
function assertParLegs(legs) {
  let tok = 0n;
  let sp = 0n;
  const perTok = new Map();
  const perSp = new Map();
  for (const l of legs) {
    if (l.t === 'token') {
      tok += l.d;
      perTok.set(l.i, (perTok.get(l.i) || 0n) + l.d);
    } else {
      sp += l.d;
      perSp.set(l.i, (perSp.get(l.i) || 0n) + l.d);
    }
  }
  need(tok === 0n && sp === 0n, 'P3_PAR_VIOLATION', 'cross-issuer legs do not conserve value');
  for (const [i, d] of perTok) need((perSp.get(i) || 0n) === d, 'P3_PAR_VIOLATION', `settlement move at ${i} differs from token move`);
}

const sumMap = (m) => {
  let t = 0n;
  for (const v of m.values()) t += v.amount;
  return t;
};

export class Ledger {
  #derived; // caller derived from the agent grant that authorised the instruction being executed
  constructor(genesis) {
    this.genesis = genesis;
    this.chainId = genesis.chainId;
    this.params = { ...genesis.params };
    this.counters = { rejected: {}, accepted: 0 };
    const issuers = new Map();
    for (const g of genesis.issuers) {
      issuers.set(g.id, {
        id: g.id,
        name: g.name,
        keys: g.keys,
        status: 'ACTIVE',
        quarantine: null,
        minted: 0n,
        burned: 0n,
        convIn: 0n,
        convOut: 0n,
        L: 0n, // last attested core control-GL balance
        seq: 0,
        sp: 0n, // prefunded settlement position
        holds: new Map(), // holdId -> {amount, since}: core has reserved funds, token not yet minted
        redemptions: new Map(), // burned on ledger, core has not yet credited the customer
        pendingOut: new Map(), // convert-out: tokens burned at this issuer, core has not yet debited control GL
        pendingIn: new Map(), // convert-in: tokens minted here, core has not yet credited control GL
      });
    }
    this.s = {
      height: 0,
      time: 0,
      prev: '0'.repeat(64),
      issuers,
      accounts: new Map(),
      securities: new Map(genesis.securities.map((x) => [x.id, { id: x.id, name: x.name }])),
      anchor: { A: 0n, F: 0n },
      halt: null,
      queue: [],
      dedup: new Map(),
      escrows: new Map(), // escrowId -> {from, to, amount, expiresAt, releaseRole, eventName, escrowAccountId} (roadmap 1.1/1.2)
      grants: new Map(), // grantId -> agent delegation record (roadmap 6.1); absent from stateView until used
      sweeps: new Map(), // sweepId -> {from, to, keep} — same-issuer standing rule, fires in #endOfBlock (roadmap 1.4)
    };
    this.lastViolations = [];
    this.lastSweepFires = [];
    this.#derived = null;
  }

  // ---------------------------------------------------------------- keys & signatures
  #pubFor(role) {
    const g = this.genesis;
    const [kind, who] = role.split(':');
    if (kind === 'gov') return g.governance[who];
    if (kind === 'observer') return g.observer;
    if (kind === 'anchor') return g.anchor;
    if (kind === 'reconciler') return g.reconcilers[who];
    if (kind === 'event') return g.eventOracles ? g.eventOracles[who] : undefined; // named oracle key, e.g. PayOnEvent's "delivery"
    if (kind === 'agent') {
      const gr = this.s.grants.get(who);
      return gr ? gr.agentKey : undefined;
    }
    const i = this.s.issuers.get(who);
    return i ? i.keys[kind === 'accept' ? 'ops' : kind] : undefined; // ops | mint | attest | screen; accept = payee issuer's ops key
  }
  #sig(tx, role) {
    const sig = tx.sigs && tx.sigs[role];
    need(sig, 'MISSING_SIGNATURE', `missing signature: ${role}`);
    const pub = this.#pubFor(role);
    need(pub, 'BAD_SIGNATURE', `unknown signer role: ${role}`);
    need(verify(pub, messageOf(tx, this.chainId), sig), 'BAD_SIGNATURE', `bad signature: ${role}`);
  }

  // ---------------------------------------------------------------- agent delegation (roadmap 6.1)
  // The live chain of a grant, leaf first. Any revoked or expired link kills the whole chain, so
  // revoking a parent invalidates every descendant without enumerating them.
  #chain(id, time) {
    const out = [];
    let cur = this.s.grants.get(id);
    need(cur, 'UNKNOWN_GRANT', `unknown grant ${id}`);
    for (let d = 0; cur; d++) {
      need(d < MAX_GRANT_DEPTH, 'GRANT_TOO_DEEP');
      need(!cur.revoked, 'GRANT_REVOKED', `grant ${cur.id} is revoked`);
      need(time <= cur.not_after, 'GRANT_EXPIRED', `grant ${cur.id} expired`);
      out.push(cur);
      cur = cur.parent ? this.s.grants.get(cur.parent) : null;
    }
    return out;
  }
  // Tumbling window anchored at the first spend: a new window opens once the old one has run its length.
  #window(g, time) {
    return g.win.spent === 0n || time >= g.win.start + g.window.seconds ? { start: time, spent: 0n } : g.win;
  }
  // Stands in for `need(sig(ops:<issuerId>))` on grantable handlers. With no agent signature it IS that
  // check, unchanged. With `agent:<grant_id>`: verify the agent key, derive the caller, then grade the
  // instruction against the grant - ALLOW (consume window), ESCALATE (also needs the institution's own
  // ops signature) or DENY. `amount` is lazy so the legacy path's error precedence is untouched.
  #authorize(tx, issuerId, { amount = null, accounts = [], time, j }) {
    const agentRoles = Object.keys(tx.sigs || {}).filter((r) => r.startsWith('agent:'));
    if (agentRoles.length === 0) return this.#sig(tx, `ops:${issuerId}`);
    need(agentRoles.length === 1, 'MULTIPLE_AGENT_SIGS', 'at most one agent signature per instruction');
    const gid = agentRoles[0].slice('agent:'.length);
    const g = this.s.grants.get(gid);
    need(g, 'UNKNOWN_GRANT', `unknown grant ${gid}`);
    need(g.issuer === issuerId, 'GRANT_WRONG_ISSUER', `grant ${gid} belongs to ${g.issuer}, not ${issuerId}`);
    this.#sig(tx, agentRoles[0]);
    const declared = tx.caller && tx.caller.kind;
    need(!declared || declared === 'unspecified' || declared === 'agent', 'CALLER_MISMATCH', 'an agent-signed instruction cannot declare itself human');
    this.#derived = { kind: 'agent', grant_id: gid, label: g.label };
    const chain = this.#chain(gid, time);
    const leaf = chain[0];
    need(leaf.allow_types.includes(tx.type), 'ENVELOPE_DENIED', `grant ${gid} does not allow ${tx.type}`);
    if (leaf.counterparties) for (const a of accounts) need(leaf.counterparties.includes(a), 'ENVELOPE_DENIED', `grant ${gid} may not touch ${a}`);
    const amt = amount ? amount() : null;
    let over = false;
    if (amt !== null) {
      if (amt > leaf.per_instruction_max) over = true;
      for (const c of chain) if (this.#window(c, time).spent + amt > c.window.max_total) over = true;
    }
    if (over) {
      need(tx.sigs[`ops:${issuerId}`], 'ESCALATION_REQUIRED', `outside grant ${gid}'s envelope: needs the ${issuerId} ops signature as well`);
      this.#sig(tx, `ops:${issuerId}`);
      return; // institution-authorised: does not consume the window
    }
    if (amt !== null) for (const c of chain) {
      const w = this.#window(c, time);
      j.set(this.s.grants, c.id, { ...c, win: { start: w.start, spent: w.spent + amt } });
    }
  }

  // The caller worth recording on a stored copy of `tx`: derived from a grant, else self-attested,
  // else nothing (omitted, so state roots of chains that never used callers are unchanged).
  #effectiveCaller(tx) {
    if (this.#derived) return { caller: this.#derived };
    return tx.caller && tx.caller.kind !== 'unspecified' ? { caller: tx.caller } : {};
  }

  // ---------------------------------------------------------------- helpers
  #issuer(id) {
    const i = this.s.issuers.get(id);
    need(i, 'UNKNOWN_ISSUER', `unknown issuer ${id}`);
    return i;
  }
  #account(id) {
    const a = this.s.accounts.get(id);
    need(a, 'UNKNOWN_ACCOUNT', `unknown account ${id}`);
    return a;
  }
  #live(id, time) {
    const a = this.#account(id);
    need(a.status === 'active', 'ACCOUNT_FROZEN', `account ${id} is frozen`);
    need(a.kycExpires > time, 'KYC_EXPIRED', `KYC attestation for ${id} expired`);
    return a;
  }
  #cap(amt) {
    need(amt <= BigInt(this.params.maxTx), 'VALUE_CAP_EXCEEDED', `above per-instruction cap of ${this.params.maxTx} cents`);
  }
  #debit(j, acct, amt) {
    need(acct.balance >= amt, 'INSUFFICIENT_FUNDS', `${acct.id} balance below instruction`);
    j.field(acct, 'balance', acct.balance - amt);
  }
  #credit(j, acct, amt) {
    j.field(acct, 'balance', acct.balance + amt);
  }

  // Move cash (tokens) between two accounts. Same issuer: plain transfer. Different issuers: par
  // Convert: burn at payer issuer, mint at payee issuer, settlement positions move 1:1.
  #moveCash(j, from, to, amt, ctx) {
    if (from.issuer === to.issuer) {
      this.#debit(j, from, amt);
      this.#credit(j, to, amt);
      return;
    }
    const A = this.#issuer(from.issuer);
    const B = this.#issuer(to.issuer);
    need(A.status === 'ACTIVE', 'ISSUER_QUARANTINED', `${A.id} is quarantined`);
    assertParLegs([
      { t: 'token', i: A.id, d: -amt },
      { t: 'token', i: B.id, d: amt },
      { t: 'sp', i: A.id, d: -amt },
      { t: 'sp', i: B.id, d: amt },
    ]);
    if (!ctx.skipSp) need(A.sp >= amt, 'INSUFFICIENT_SETTLEMENT_POSITION', `${A.id} settlement position below instruction`);
    this.#debit(j, from, amt);
    this.#credit(j, to, amt);
    j.field(A, 'sp', A.sp - amt);
    j.field(B, 'sp', B.sp + amt);
    j.field(A, 'convOut', A.convOut + amt);
    j.field(B, 'convIn', B.convIn + amt);
    j.set(A.pendingOut, ctx.instId, { amount: amt, since: ctx.time });
    j.set(B.pendingIn, ctx.instId, { amount: amt, since: ctx.time });
    ctx.events.push(
      { type: 'CONVERT_OUT', issuer: A.id, id: ctx.instId, amount: amt.toString(), account: from.id },
      { type: 'CONVERT_IN', issuer: B.id, id: ctx.instId, amount: amt.toString(), account: to.id },
    );
  }

  // ---------------------------------------------------------------- transaction handlers
  tx_OPEN_ACCOUNT(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `ops:${iss.id}`);
    need(typeof p.holderRef === 'string' && /^[a-z0-9_-]{1,40}$/.test(p.holderRef), 'BAD_HOLDER_REF');
    need(Number.isInteger(p.kycExpires), 'BAD_KYC');
    const id = `${iss.id}:${p.holderRef}`;
    need(!this.s.accounts.has(id), 'ACCOUNT_EXISTS');
    j.set(this.s.accounts, id, { id, issuer: iss.id, holder: p.holderRef, balance: 0n, sec: new Map(), status: 'active', kycRef: String(p.kycRef || ''), kycExpires: p.kycExpires });
    events.push({ type: 'ACCOUNT_OPENED', issuer: iss.id, account: id });
  }

  tx_CREDIT_SECURITY(tx, time, j, events) {
    // Registrar attestation from the securities depository, co-signed by both governance orgs.
    this.#sig(tx, 'gov:operator');
    this.#sig(tx, 'gov:neutral');
    const p = tx.payload;
    need(this.s.securities.has(p.secId), 'UNKNOWN_SECURITY');
    const a = this.#account(p.account);
    const q = parseAmount(p.qty, 'BAD_QTY');
    j.set(a.sec, p.secId, (a.sec.get(p.secId) || 0n) + q);
    events.push({ type: 'SECURITY_CREDITED', account: a.id, secId: p.secId, qty: q.toString() });
  }

  tx_FUND_SP(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `ops:${iss.id}`);
    this.#sig(tx, 'anchor');
    const x = parseAmount(p.amount);
    need(BigInt(p.A_after) === this.s.anchor.A + x, 'ANCHOR_MISMATCH', 'anchor attestation does not match funding amount');
    j.field(this.s.anchor, 'A', this.s.anchor.A + x);
    j.field(iss, 'sp', iss.sp + x);
    events.push({ type: 'SP_FUNDED', issuer: iss.id, amount: x.toString() });
  }

  tx_DEFUND_SP(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `ops:${iss.id}`);
    this.#sig(tx, 'anchor');
    const x = parseAmount(p.amount);
    need(iss.sp >= x, 'INSUFFICIENT_SETTLEMENT_POSITION');
    need(BigInt(p.A_after) === this.s.anchor.A - x, 'ANCHOR_MISMATCH');
    j.field(this.s.anchor, 'A', this.s.anchor.A - x);
    j.field(iss, 'sp', iss.sp - x);
    events.push({ type: 'SP_DEFUNDED', issuer: iss.id, amount: x.toString() });
  }

  // Core has placed a durable hold on the customer's deposit and reclassified it to the
  // tokenised-deposit control GL; the adapter registers it here. Signed by the *attestation* key.
  tx_OPEN_HOLD(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `attest:${iss.id}`);
    need(iss.status === 'ACTIVE', 'ISSUER_QUARANTINED');
    const x = parseAmount(p.amount);
    this.#cap(x);
    need(!iss.holds.has(p.holdId), 'HOLD_EXISTS');
    need(Number.isInteger(p.seq) && p.seq > iss.seq, 'STALE_ATTESTATION');
    need(BigInt(p.L_after) === iss.L + x, 'ATTESTATION_MISMATCH', 'L_after must equal previous L plus the hold');
    j.field(iss, 'L', iss.L + x);
    j.field(iss, 'seq', p.seq);
    j.set(iss.holds, p.holdId, { amount: x, since: time });
    events.push({ type: 'HOLD_OPENED', issuer: iss.id, holdId: p.holdId, amount: x.toString() });
  }

  tx_RELEASE_HOLD(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `attest:${iss.id}`);
    const h = iss.holds.get(p.holdId);
    need(h, 'UNKNOWN_HOLD');
    need(Number.isInteger(p.seq) && p.seq > iss.seq, 'STALE_ATTESTATION');
    need(BigInt(p.L_after) === iss.L - h.amount, 'ATTESTATION_MISMATCH');
    j.field(iss, 'L', iss.L - h.amount);
    j.field(iss, 'seq', p.seq);
    j.del(iss.holds, p.holdId);
    events.push({ type: 'HOLD_RELEASED', issuer: iss.id, holdId: p.holdId });
  }

  // Mint requires the issuer's *mint* key AND a matching open hold that the *attestation* key registered:
  // two independent keys must agree before a token exists (no unbacked mint).
  tx_MINT(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `mint:${iss.id}`);
    need(iss.status === 'ACTIVE', 'ISSUER_QUARANTINED');
    const h = iss.holds.get(p.holdId);
    need(h, 'NO_MATCHING_HOLD', 'mint requires an open hold registered by the attestation key');
    const acct = this.#live(p.account, time);
    need(acct.issuer === iss.id, 'WRONG_ISSUER');
    j.del(iss.holds, p.holdId);
    j.field(acct, 'balance', acct.balance + h.amount);
    j.field(iss, 'minted', iss.minted + h.amount);
    events.push({ type: 'MINTED', issuer: iss.id, account: acct.id, amount: h.amount.toString(), holdId: p.holdId });
  }

  // Redeem burns on the ledger FIRST (ledger-first ordering: the customer's claim is never lost).
  tx_REDEEM(tx, time, j, events) {
    const p = tx.payload;
    const acct = this.#live(p.account, time);
    const iss = this.#issuer(acct.issuer);
    this.#sig(tx, `ops:${iss.id}`);
    need(iss.status === 'ACTIVE', 'ISSUER_QUARANTINED');
    const x = parseAmount(p.amount);
    this.#cap(x);
    this.#debit(j, acct, x);
    j.field(iss, 'burned', iss.burned + x);
    j.set(iss.redemptions, tx.inst_id, { amount: x, since: time });
    events.push({ type: 'REDEEMED', issuer: iss.id, account: acct.id, amount: x.toString(), id: tx.inst_id });
  }

  #closeCore(tx, time, j, events, mapName, sign, evType) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `attest:${iss.id}`);
    const e = iss[mapName].get(p.id);
    need(e, 'UNKNOWN_PENDING');
    need(Number.isInteger(p.seq) && p.seq > iss.seq, 'STALE_ATTESTATION');
    need(BigInt(p.L_after) === iss.L + sign * e.amount, 'ATTESTATION_MISMATCH', 'L_after inconsistent with pending amount');
    j.field(iss, 'L', iss.L + sign * e.amount);
    j.field(iss, 'seq', p.seq);
    j.del(iss[mapName], p.id);
    events.push({ type: evType, issuer: iss.id, id: p.id });
  }
  tx_CLOSE_REDEMPTION(tx, time, j, events) {
    this.#closeCore(tx, time, j, events, 'redemptions', -1n, 'REDEMPTION_CLOSED');
  }
  tx_CLOSE_CONVERT_OUT(tx, time, j, events) {
    this.#closeCore(tx, time, j, events, 'pendingOut', -1n, 'CONVERT_OUT_CLOSED');
  }
  tx_CLOSE_CONVERT_IN(tx, time, j, events) {
    this.#closeCore(tx, time, j, events, 'pendingIn', 1n, 'CONVERT_IN_CLOSED');
  }

  // Periodic core attestation. A sequence regression is a core restored from backup: classify as
  // core lag and quarantine only that issuer. Higher sequence with a lower balance is real.
  tx_ATTEST(tx, time, j, events) {
    const p = tx.payload;
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `attest:${iss.id}`);
    need(Number.isInteger(p.seq), 'BAD_SEQ');
    if (p.seq < iss.seq) {
      if (iss.status === 'ACTIVE') {
        j.field(iss, 'status', 'QUARANTINED');
        j.field(iss, 'quarantine', { reason: 'CORE_SEQUENCE_REGRESSION', since: time });
      }
      events.push({ type: 'CORE_LAG_DETECTED', issuer: iss.id });
      return;
    }
    j.field(iss, 'L', BigInt(p.L));
    j.field(iss, 'seq', p.seq);
    events.push({ type: 'ATTESTED', issuer: iss.id, L: String(p.L) });
  }

  // Anyone holding a registered reconciler key can pull the fire alarm; restarting is expensive.
  tx_REPORT_PAR_BREAK(tx, time, j, events) {
    const p = tx.payload;
    this.#sig(tx, `reconciler:${p.reporter}`);
    const iss = this.#issuer(p.issuer);
    if (iss.status === 'ACTIVE') {
      j.field(iss, 'status', 'QUARANTINED');
      j.field(iss, 'quarantine', { reason: `REPORTED_BY_${p.reporter}`, since: time });
    }
    events.push({ type: 'PAR_BREAK_REPORTED', issuer: iss.id, reporter: p.reporter });
  }

  tx_FREEZE_ACCOUNT(tx, time, j, events) {
    const a = this.#account(tx.payload.account);
    this.#sig(tx, `ops:${a.issuer}`);
    j.field(a, 'status', 'frozen');
    events.push({ type: 'ACCOUNT_FROZEN', account: a.id });
  }
  tx_UNFREEZE_ACCOUNT(tx, time, j, events) {
    const a = this.#account(tx.payload.account);
    this.#sig(tx, `ops:${a.issuer}`);
    j.field(a, 'status', 'active');
    events.push({ type: 'ACCOUNT_UNFROZEN', account: a.id });
  }

  tx_TRANSFER(tx, time, j, events) {
    const p = tx.payload;
    const from = this.#live(p.from, time);
    const to = this.#live(p.to, time);
    need(from.issuer === to.issuer, 'USE_PAYMENT', 'cross-issuer payments use PAYMENT');
    need(from.id !== to.id, 'SELF_TRANSFER');
    this.#authorize(tx, from.issuer, { amount: () => parseAmount(p.amount), accounts: [from.id, to.id], time, j });
    this.#sig(tx, `screen:${from.issuer}`);
    const x = parseAmount(p.amount);
    this.#cap(x);
    this.#moveCash(j, from, to, x, { instId: tx.inst_id, time, events });
    events.push({ type: 'TRANSFERRED', from: from.id, to: to.id, amount: x.toString() });
  }

  // Cross-issuer payment: payer issuer debits + screens, payee issuer pre-accepts, settlement positions move.
  // If the payer's position is short and the sender allowed queueing, nothing is debited: it waits for netting.
  tx_PAYMENT(tx, time, j, events) {
    const p = tx.payload;
    const from = this.#live(p.from, time);
    const to = this.#live(p.to, time);
    need(from.issuer !== to.issuer, 'USE_TRANSFER', 'same-issuer payments use TRANSFER');
    this.#authorize(tx, from.issuer, { amount: () => parseAmount(p.amount), accounts: [from.id, to.id], time, j });
    this.#sig(tx, `screen:${from.issuer}`);
    this.#sig(tx, `accept:${to.issuer}`);
    const x = parseAmount(p.amount);
    this.#cap(x);
    const A = this.#issuer(from.issuer);
    need(A.status === 'ACTIVE', 'ISSUER_QUARANTINED', `${A.id} is quarantined`);
    if (A.sp < x && p.queueIfShort) {
      need(from.balance >= x, 'INSUFFICIENT_FUNDS');
      j.field(this.s, 'queue', [...this.s.queue, { instId: tx.inst_id, queuedAt: time, tx: { inst_id: tx.inst_id, type: tx.type, payload: tx.payload, valid_until: tx.valid_until, ...this.#effectiveCaller(tx), sigs: tx.sigs } }]);
      events.push({ type: 'QUEUED', issuer: A.id, id: tx.inst_id, amount: x.toString(), from: from.id, to: to.id });
      return;
    }
    this.#moveCash(j, from, to, x, { instId: tx.inst_id, time, events });
    events.push({ type: 'PAID', from: from.id, to: to.id, amount: x.toString(), viaConvert: true });
  }

  // Delivery versus payment: security leg and cash leg in one all-or-nothing instruction.
  tx_DVP(tx, time, j, events) {
    const p = tx.payload;
    const seller = this.#live(p.seller, time);
    const buyer = this.#live(p.buyer, time);
    need(seller.id !== buyer.id, 'SELF_TRADE');
    need(this.s.securities.has(p.secId), 'UNKNOWN_SECURITY');
    this.#sig(tx, `ops:${buyer.issuer}`);
    this.#sig(tx, `screen:${buyer.issuer}`);
    this.#sig(tx, `ops:${seller.issuer}`);
    if (seller.issuer !== buyer.issuer) this.#sig(tx, `accept:${seller.issuer}`);
    const qty = parseAmount(p.qty, 'BAD_QTY');
    const cash = parseAmount(p.cash);
    this.#cap(cash);
    const have = seller.sec.get(p.secId) || 0n;
    need(have >= qty, 'INSUFFICIENT_SECURITIES', `${seller.id} holds fewer than ${qty} ${p.secId}`);
    j.set(seller.sec, p.secId, have - qty);
    j.set(buyer.sec, p.secId, (buyer.sec.get(p.secId) || 0n) + qty);
    this.#moveCash(j, buyer, seller, cash, { instId: tx.inst_id, time, events }); // cash leg fails => security leg rolls back
    events.push({ type: 'DVP_SETTLED', seller: seller.id, buyer: buyer.id, secId: p.secId, qty: qty.toString(), cash: cash.toString() });
  }

  // Escrow (T4): the escrow account is a regular ledger account under a reserved id, created
  // at the BENEFICIARY's issuer. LOCK is exactly a Transfer (same issuer) or a par-conserving
  // Convert (cross issuer, via #moveCash) into that account, so no new conservation math is
  // needed: total per-issuer supply is unaffected by lock+release or lock+refund. RELEASE and
  // REFUND are then always same-issuer moves (escrow account -> beneficiary, or, for refund,
  // escrow account -> original payer, which for a cross-issuer lock is a reverse Convert).
  tx_ESCROW_LOCK(tx, time, j, events) {
    const p = tx.payload;
    const from = this.#live(p.from, time);
    const to = this.#account(p.to);
    need(typeof p.escrowId === 'string' && ID_RE.test(p.escrowId), 'BAD_ESCROW_ID');
    need(!this.s.escrows.has(p.escrowId), 'ESCROW_EXISTS');
    need(Number.isInteger(p.expiresAt) && p.expiresAt > time, 'BAD_EXPIRY');
    const releaseRole = p.releaseRole || `ops:${from.issuer}`;
    need(this.#pubFor(releaseRole) !== undefined, 'BAD_RELEASE_ROLE');
    const eventName = p.eventName === undefined ? null : p.eventName;
    if (eventName !== null) need(this.#pubFor(`event:${eventName}`) !== undefined, 'UNKNOWN_EVENT');
    this.#authorize(tx, from.issuer, { amount: () => parseAmount(p.amount), accounts: [from.id, to.id], time, j });
    this.#sig(tx, `screen:${from.issuer}`);
    if (from.issuer !== to.issuer) this.#sig(tx, `accept:${to.issuer}`);
    const x = parseAmount(p.amount);
    this.#cap(x);
    const escrowAcctId = `${to.issuer}:escrow:${p.escrowId}`;
    if (!this.s.accounts.has(escrowAcctId)) {
      // system-owned holding account: never expires, not reachable via OPEN_ACCOUNT's holder-ref rule
      j.set(this.s.accounts, escrowAcctId, { id: escrowAcctId, issuer: to.issuer, holder: `escrow:${p.escrowId}`, balance: 0n, sec: new Map(), status: 'active', kycRef: '', kycExpires: Number.MAX_SAFE_INTEGER });
    }
    const escrowAcct = this.s.accounts.get(escrowAcctId);
    this.#moveCash(j, from, escrowAcct, x, { instId: tx.inst_id, time, events });
    j.set(this.s.escrows, p.escrowId, { from: from.id, to: to.id, amount: x, expiresAt: p.expiresAt, releaseRole, eventName, escrowAccountId: escrowAcctId });
    events.push({ type: 'ESCROW_LOCKED', escrowId: p.escrowId, from: from.id, to: to.id, amount: x.toString(), eventGated: eventName !== null });
  }

  // Shared by ESCROW_RELEASE and EVENT_RELEASE: move the full escrowed amount to the
  // beneficiary and close the record. Always same-issuer (see tx_ESCROW_LOCK above).
  #releaseEscrow(rec, escrowId, time, j, events, eventType) {
    const escrowAcct = this.#account(rec.escrowAccountId);
    const to = this.#live(rec.to, time);
    j.del(this.s.escrows, escrowId);
    this.#debit(j, escrowAcct, rec.amount);
    this.#credit(j, to, rec.amount);
    events.push({ type: eventType, escrowId, to: to.id, amount: rec.amount.toString() });
  }
  tx_ESCROW_RELEASE(tx, time, j, events) {
    const p = tx.payload;
    const rec = this.s.escrows.get(p.escrowId);
    need(rec, 'UNKNOWN_ESCROW');
    // an event-gated escrow can ONLY be released by EVENT_RELEASE - otherwise the payer's own
    // default releaseRole would let them release their own PayOnEvent escrow unconditionally,
    // defeating the point of gating it on an event in the first place.
    need(rec.eventName === null, 'USE_EVENT_RELEASE', 'this escrow is event-gated: use EVENT_RELEASE');
    this.#sig(tx, rec.releaseRole);
    this.#releaseEscrow(rec, p.escrowId, time, j, events, 'ESCROW_RELEASED');
  }

  // PayOnEvent (T5): the same escrow, released instead by a named oracle's signature over the
  // matching event name — the escrow's own stored eventName is what gets signed for, so a
  // signature for a different (even genuinely valid) event name can never release this escrow.
  tx_EVENT_RELEASE(tx, time, j, events) {
    const p = tx.payload;
    const rec = this.s.escrows.get(p.escrowId);
    need(rec, 'UNKNOWN_ESCROW');
    need(rec.eventName !== null, 'NOT_EVENT_GATED');
    need(p.event === rec.eventName, 'EVENT_MISMATCH');
    this.#sig(tx, `event:${rec.eventName}`);
    this.#releaseEscrow(rec, p.escrowId, time, j, events, 'ESCROW_EVENT_RELEASED');
  }

  // Refund: only after expiry (so an event that never fires does not trap funds forever), by
  // the original payer's key. A cross-issuer lock reverses via the same par-conserving Convert
  // path used at lock time; the beneficiary issuer's original "accept" already covers this.
  tx_ESCROW_REFUND(tx, time, j, events) {
    const p = tx.payload;
    const rec = this.s.escrows.get(p.escrowId);
    need(rec, 'UNKNOWN_ESCROW');
    need(time >= rec.expiresAt, 'ESCROW_NOT_EXPIRED');
    const from = this.#live(rec.from, time);
    this.#authorize(tx, from.issuer, { accounts: [rec.from, rec.to], time, j });
    const escrowAcct = this.#account(rec.escrowAccountId);
    j.del(this.s.escrows, p.escrowId);
    if (from.issuer === escrowAcct.issuer) {
      this.#debit(j, escrowAcct, rec.amount);
      this.#credit(j, from, rec.amount);
    } else {
      this.#moveCash(j, escrowAcct, from, rec.amount, { instId: tx.inst_id, time, events });
    }
    events.push({ type: 'ESCROW_REFUNDED', escrowId: p.escrowId, from: from.id, amount: rec.amount.toString() });
  }

  // Batch (T7): several legs, atomic. Each leg is a fully independent, fully signed instruction
  // (same shape as a top-level tx), dispatched to its own existing handler against THIS SAME
  // journal - so #execTx's own catch block, which already rolls back the whole journal on any
  // KernelError, gives "all legs or none" for free, the same way DvP's two legs already get it.
  // #checkEnvelope gives every leg its own inst_id/dedup/validity checks, so a leg cannot be
  // replayed just because it rode inside a fresh outer batch.
  tx_BATCH(tx, time, j, events) {
    const p = tx.payload;
    need(Array.isArray(p.legs) && p.legs.length > 0, 'BATCH_EMPTY');
    for (const leg of p.legs) {
      const h = this.#checkEnvelope(leg, time);
      need(leg.type !== 'BATCH', 'BATCH_NO_NESTING');
      h.call(this, leg, time, j, events);
      j.set(this.s.dedup, leg.inst_id, time);
      this.#derived = null; // a leg's grant is not the outer BATCH's caller
    }
    events.push({ type: 'BATCH_SETTLED', legs: p.legs.length });
  }

  // Standing/Sweep (T6): a same-issuer standing rule, registered once, that fires
  // deterministically at #endOfBlock - the same every-validator-agrees hook the graded halt
  // already runs from, so no separate submitted instruction is needed for it to take effect,
  // and it replays identically from the block log. Restricted to same-issuer so no settlement
  // position or cross-issuer accept signature is ever in question.
  tx_REGISTER_SWEEP(tx, time, j, events) {
    const p = tx.payload;
    const from = this.#account(p.from);
    const to = this.#account(p.to);
    need(from.issuer === to.issuer, 'SWEEP_SAME_ISSUER_ONLY');
    need(from.id !== to.id, 'SELF_TRANSFER');
    this.#authorize(tx, from.issuer, { accounts: [from.id, to.id], time, j });
    need(typeof p.sweepId === 'string' && ID_RE.test(p.sweepId), 'BAD_SWEEP_ID');
    need(!this.s.sweeps.has(p.sweepId), 'SWEEP_EXISTS');
    const keep = parseNonNegAmount(p.keepAmount);
    j.set(this.s.sweeps, p.sweepId, { from: from.id, to: to.id, keep });
    events.push({ type: 'SWEEP_REGISTERED', sweepId: p.sweepId, from: from.id, to: to.id, keep: keep.toString() });
  }
  tx_CANCEL_SWEEP(tx, time, j, events) {
    const p = tx.payload;
    const rec = this.s.sweeps.get(p.sweepId);
    need(rec, 'UNKNOWN_SWEEP');
    const from = this.#account(rec.from);
    this.#authorize(tx, from.issuer, { accounts: [rec.from, rec.to], time, j });
    j.del(this.s.sweeps, p.sweepId);
    events.push({ type: 'SWEEP_CANCELLED', sweepId: p.sweepId });
  }

  // Agent delegation (roadmap 6.1). See docs/agent-native-access-proposal.md.
  tx_GRANT(tx, time, j, events) {
    const p = tx.payload;
    need(typeof p.grant_id === 'string' && ID_RE.test(p.grant_id), 'BAD_GRANT_ID');
    need(!this.s.grants.has(p.grant_id), 'GRANT_EXISTS');
    const iss = this.#issuer(p.issuer);
    const parentId = p.parent === undefined ? null : p.parent;
    let chain = [];
    if (parentId === null) {
      this.#sig(tx, `ops:${iss.id}`);
    } else {
      need(typeof parentId === 'string' && tx.sigs && tx.sigs[`agent:${parentId}`], 'MISSING_SIGNATURE', `a sub-grant is signed by the parent's agent key (agent:${parentId})`);
      this.#authorize(tx, iss.id, { time, j }); // also enforces GRANT in the parent's allow_types
      chain = this.#chain(parentId, time);
      need(chain.length < MAX_GRANT_DEPTH, 'GRANT_TOO_DEEP', `at most ${MAX_GRANT_DEPTH} levels`);
    }
    need(typeof p.agent_key === 'string' && /^[0-9a-f]{88}$/.test(p.agent_key), 'BAD_AGENT_KEY');
    need(p.label === undefined || (typeof p.label === 'string' && p.label.length <= 80), 'BAD_GRANT_LABEL');
    need(Array.isArray(p.allow_types) && p.allow_types.length > 0 && p.allow_types.every((x) => typeof x === 'string'), 'GRANT_BAD_TYPES');
    need(p.allow_types.every((x) => GRANTABLE.has(x)), 'GRANT_TYPE_NOT_GRANTABLE', `grantable: ${GRANTABLE_TYPES.join(', ')}`);
    need(p.per_instruction_max !== undefined && p.per_instruction_max !== null && p.window && p.window !== null && Number.isInteger(p.not_after) && p.not_after > time, 'GRANT_UNBOUNDED', 'per_instruction_max, window and a future not_after are all mandatory');
    const max = parseAmount(p.per_instruction_max, 'GRANT_BAD_AMOUNT');
    need(Number.isInteger(p.window.seconds) && p.window.seconds >= 1 && p.window.seconds <= MAX_WINDOW_S, 'GRANT_BAD_WINDOW');
    const cap = parseAmount(p.window.max_total, 'GRANT_BAD_AMOUNT');
    const cps = p.counterparties === undefined || p.counterparties === null ? null : p.counterparties;
    need(cps === null || (Array.isArray(cps) && cps.length > 0 && cps.every((a) => typeof a === 'string' && ACCT_RE.test(a))), 'GRANT_BAD_COUNTERPARTIES');
    const types = [...new Set(p.allow_types)].sort();
    const cpList = cps === null ? null : [...new Set(cps)].sort();
    if (chain.length) {
      const par = chain[0];
      const widens = !types.every((t) => par.allow_types.includes(t))
        || max > par.per_instruction_max
        || cap > par.window.max_total
        || p.not_after > par.not_after
        || (par.counterparties !== null && (cpList === null || !cpList.every((a) => par.counterparties.includes(a))));
      need(!widens, 'GRANT_WIDENS_PARENT', 'a sub-grant may only narrow its parent');
    }
    j.set(this.s.grants, p.grant_id, {
      id: p.grant_id, issuer: iss.id, agentKey: p.agent_key, label: p.label || '', parent: parentId,
      allow_types: types, per_instruction_max: max, window: { seconds: p.window.seconds, max_total: cap },
      counterparties: cpList, not_after: p.not_after, revoked: false, win: { start: 0, spent: 0n },
    });
    events.push({ type: 'GRANT_CREATED', grantId: p.grant_id, issuer: iss.id, parent: parentId });
  }
  tx_REVOKE_GRANT(tx, time, j, events) {
    const p = tx.payload;
    const g = this.s.grants.get(p.grant_id);
    need(g, 'UNKNOWN_GRANT');
    need(!g.revoked, 'GRANT_ALREADY_REVOKED');
    const agentRoles = Object.keys(tx.sigs || {}).filter((r) => r.startsWith('agent:'));
    if (agentRoles.length === 0) {
      this.#sig(tx, `ops:${g.issuer}`);
    } else {
      need(agentRoles.length === 1, 'MULTIPLE_AGENT_SIGS');
      const by = agentRoles[0].slice('agent:'.length);
      const ancestors = [];
      for (let cur = g.parent && this.s.grants.get(g.parent); cur; cur = cur.parent && this.s.grants.get(cur.parent)) ancestors.push(cur.id);
      need(ancestors.includes(by), 'REVOKE_NOT_AUTHORISED', 'only the institution or an ancestor grant may revoke');
      this.#sig(tx, agentRoles[0]);
      this.#chain(by, time); // the revoking ancestor must itself still be live
      this.#derived = { kind: 'agent', grant_id: by, label: this.s.grants.get(by).label };
    }
    j.set(this.s.grants, g.id, { ...g, revoked: true });
    events.push({ type: 'GRANT_REVOKED', grantId: g.id });
  }

  // Liquidity-saving netting. Queued payments have debited nothing. A deterministic gridlock
  // resolution finds a maximal subset whose net effect fits every settlement position, then
  // settles that subset atomically. Unsettled instructions stay queued until they expire.
  tx_NET_CYCLE(tx, time, j, events) {
    this.#sig(tx, 'gov:operator');
    need(this.s.queue.length > 0, 'QUEUE_EMPTY');
    const live = [];
    let expired = 0;
    for (const e of this.s.queue) {
      if (e.tx.valid_until < time) expired++;
      else live.push(e);
    }
    const acct = (id) => this.s.accounts.get(id);
    let cand = live
      .map((e) => ({ e, amt: BigInt(e.tx.payload.amount), from: acct(e.tx.payload.from), to: acct(e.tx.payload.to) }))
      .filter((c) => c.from && c.to && c.from.issuer !== c.to.issuer)
      .sort((a, b) => (a.e.instId < b.e.instId ? -1 : 1));
    // gridlock resolution: drop payments from the most-deficient issuer until every position covers its net
    for (let guard = 0; guard < 10000; guard++) {
      const net = new Map();
      for (const c of cand) {
        net.set(c.from.issuer, (net.get(c.from.issuer) || 0n) - c.amt);
        net.set(c.to.issuer, (net.get(c.to.issuer) || 0n) + c.amt);
      }
      let worst = null;
      let worstVal = 0n;
      for (const [iid, n] of [...net.entries()].sort()) {
        const room = this.#issuer(iid).sp + n;
        if (room < worstVal) {
          worstVal = room;
          worst = iid;
        }
      }
      if (!worst) break;
      const out = cand.filter((c) => c.from.issuer === worst);
      need(out.length > 0, 'NETTING_FAILED');
      out.sort((a, b) => (a.amt === b.amt ? (a.e.instId < b.e.instId ? -1 : 1) : a.amt > b.amt ? -1 : 1));
      cand = cand.filter((c) => c !== out[0]);
    }
    const settled = new Set();
    for (const c of cand) {
      const jj = j.child();
      try {
        const t = c.e.tx;
        this.#sig(t, `ops:${c.from.issuer}`);
        this.#sig(t, `screen:${c.from.issuer}`);
        this.#sig(t, `accept:${c.to.issuer}`);
        const from = this.#live(c.from.id, time);
        const to = this.#live(c.to.id, time);
        this.#moveCash(jj, from, to, c.amt, { instId: c.e.instId, time, events, skipSp: true });
        jj.commit();
        settled.add(c.e.instId);
        events.push({ type: 'NETTED', id: c.e.instId, amount: c.amt.toString(), from: from.id, to: to.id });
      } catch (err) {
        if (!(err instanceof KernelError)) throw err;
        jj.rollback();
      }
    }
    for (const iss of this.s.issuers.values()) need(iss.sp >= 0n, 'NETTING_FAILED', `netting would overdraw ${iss.id}`);
    const remaining = live.filter((e) => !settled.has(e.instId));
    j.field(this.s, 'queue', remaining);
    events.push({ type: 'NET_CYCLE', settled: settled.size, remaining: remaining.length, expired });
  }

  // Resume: governance threshold (2 of 2) + affected issuer + Bank of Canada observer. Only succeeds if the
  // invariants actually hold again. Expensive to restart, by design (P7).
  tx_RESUME(tx, time, j, events) {
    const p = tx.payload;
    this.#sig(tx, 'gov:operator');
    this.#sig(tx, 'gov:neutral');
    this.#sig(tx, 'observer');
    const v = this.checkInvariants(time).violations;
    if (p.scope === 'network') {
      need(this.s.halt, 'NOT_HALTED');
      need(!v.some((x) => x.action === 'HALT'), 'INVARIANTS_STILL_VIOLATED', v.filter((x) => x.action === 'HALT').map((x) => x.reason).join(','));
      j.field(this.s, 'halt', null);
      events.push({ type: 'NETWORK_RESUMED' });
      return;
    }
    need(p.scope === 'issuer', 'BAD_SCOPE');
    const iss = this.#issuer(p.issuer);
    this.#sig(tx, `ops:${iss.id}`);
    need(iss.status === 'QUARANTINED', 'NOT_QUARANTINED');
    // the escalation is a consequence of the quarantine itself, so it must not block lifting it
    const own = v.filter((x) => x.issuer === iss.id && x.reason !== 'QUARANTINE_ESCALATION');
    need(own.length === 0, 'INVARIANTS_STILL_VIOLATED', own.map((x) => x.reason).join(','));
    j.field(iss, 'status', 'ACTIVE');
    j.field(iss, 'quarantine', null);
    events.push({ type: 'ISSUER_RESUMED', issuer: iss.id });
  }

  // ---------------------------------------------------------------- execution
  // The generic checks every instruction gets, whether submitted at the top level or as one
  // leg of a BATCH (T7): well-formed envelope, fresh inst_id (dedup), a real handler, and the
  // halt gate. Returns the handler so the caller executes it against its own journal/events.
  #checkEnvelope(tx, time) {
    need(tx && typeof tx === 'object' && typeof tx.type === 'string', 'MALFORMED');
    need(typeof tx.inst_id === 'string' && tx.inst_id.length >= 8 && tx.inst_id.length <= 64, 'BAD_INST_ID');
    need(Number.isInteger(tx.valid_until) && tx.valid_until >= time && tx.valid_until <= time + MAX_TTL_S, 'BAD_VALIDITY', 'valid_until must be within 60 s of block time');
    need(!this.s.dedup.has(tx.inst_id), 'DUPLICATE_INSTRUCTION');
    const h = this['tx_' + tx.type];
    need(typeof h === 'function' && !tx.type.startsWith('_'), 'UNKNOWN_TYPE');
    if (this.s.halt) need(['RESUME', 'ATTEST', 'REPORT_PAR_BREAK'].includes(tx.type), 'NETWORK_HALTED', `network halted: ${this.s.halt.reason}`);
    return h;
  }

  #execTx(tx, time) {
    const j = new Journal();
    const events = [];
    this.#derived = null;
    try {
      const h = this.#checkEnvelope(tx, time);
      h.call(this, tx, time, j, events);
      j.set(this.s.dedup, tx.inst_id, time);
      this.counters.accepted++;
      return { instId: tx.inst_id, type: tx.type, ok: true, events, caller: this.#derived || tx.caller || { kind: 'unspecified' } };
    } catch (e) {
      j.rollback();
      if (!(e instanceof KernelError)) throw e;
      this.counters.rejected[e.code] = (this.counters.rejected[e.code] || 0) + 1;
      return { instId: tx && tx.inst_id, type: tx && tx.type, ok: false, error: e.code, message: e.message, events: [], caller: this.#derived || (tx && tx.caller) || { kind: 'unspecified' } };
    }
  }

  // ---------------------------------------------------------------- invariants
  supplyOf(issuerId) {
    let s = 0n;
    for (const a of this.s.accounts.values()) if (a.issuer === issuerId) s += a.balance;
    return s;
  }

  // Evaluates P1-P5 against current state. Pure: returns per-invariant status and the graded response
  // each violation would trigger (HALT the network, or QUARANTINE one issuer).
  checkInvariants(time) {
    const violations = [];
    const per = [];
    let spSum = 0n;
    let negBal = null;
    for (const a of this.s.accounts.values()) if (a.balance < 0n && !negBal) negBal = a.id;
    for (const i of this.s.issuers.values()) {
      const S = this.supplyOf(i.id);
      const H = sumMap(i.holds);
      const R = sumMap(i.redemptions) + sumMap(i.pendingOut);
      const In = sumMap(i.pendingIn);
      const p1 = S === i.minted - i.burned + i.convIn - i.convOut;
      const over = S > i.L + In;
      const diff = i.L + In - S;
      const p2 = !over && diff === H + R;
      let aged = false;
      for (const m of [i.holds, i.redemptions, i.pendingOut, i.pendingIn]) for (const e of m.values()) if (time - e.since > INFLIGHT_MAX_AGE_S) aged = true;
      const p4 = i.sp >= 0n;
      spSum += i.sp;
      if (!p1) violations.push({ id: 'P1', issuer: i.id, action: 'HALT', reason: 'P1_CONSERVATION' });
      if (over) violations.push({ id: 'P2', issuer: i.id, action: 'HALT', reason: 'OVER_ISSUANCE' });
      else if (!p2) violations.push({ id: 'P2', issuer: i.id, action: 'QUARANTINE', reason: 'P2_UNEXPLAINED_DIFFERENCE' });
      if (aged) violations.push({ id: 'P2', issuer: i.id, action: 'QUARANTINE', reason: 'INFLIGHT_AGED' });
      if (!p4) violations.push({ id: 'P4', issuer: i.id, action: 'HALT', reason: 'NEGATIVE_SETTLEMENT_POSITION' });
      if (i.status === 'QUARANTINED' && i.quarantine && time - i.quarantine.since > QUARANTINE_ESCALATE_S)
        violations.push({ id: 'P2', issuer: i.id, action: 'HALT', reason: 'QUARANTINE_ESCALATION' });
      per.push({ issuer: i.id, S, minted: i.minted, burned: i.burned, convIn: i.convIn, convOut: i.convOut, L: i.L, In, H, R, diff, sp: i.sp, p1, p2, p4, over, aged });
    }
    const anchorOk = spSum === this.s.anchor.A - this.s.anchor.F;
    if (!anchorOk) violations.push({ id: 'P4', issuer: null, action: 'HALT', reason: 'ANCHOR_MISMATCH' });
    if (negBal) violations.push({ id: 'P5', issuer: null, action: 'HALT', reason: 'NEGATIVE_BALANCE' });
    return { per, anchor: { A: this.s.anchor.A, F: this.s.anchor.F, spSum, ok: anchorOk }, p5: { ok: !negBal, account: negBal }, violations };
  }

  // Sweeps run BEFORE the invariant check: a firing is a plain same-issuer balance move (the
  // same shape #moveCash's same-issuer branch already produces), so it cannot itself create a
  // violation, and running it first means a sweep that clears an account back under its keep
  // is reflected in the same snapshot the invariant check and the dashboard both see.
  #runSweeps(time) {
    this.lastSweepFires = [];
    for (const [sweepId, sw] of this.s.sweeps) {
      const from = this.s.accounts.get(sw.from);
      const to = this.s.accounts.get(sw.to);
      if (!from || !to || from.balance <= sw.keep) continue;
      const excess = from.balance - sw.keep;
      from.balance -= excess;
      to.balance += excess;
      this.lastSweepFires.push({ sweepId, from: from.id, to: to.id, amount: excess.toString() });
    }
  }

  #endOfBlock(time) {
    this.#runSweeps(time);
    const { violations } = this.checkInvariants(time);
    this.lastViolations = violations;
    for (const v of violations) {
      if (v.action === 'HALT' && !this.s.halt) this.s.halt = { reason: v.reason, issuer: v.issuer, height: this.s.height, time };
      if (v.action === 'QUARANTINE') {
        const i = this.s.issuers.get(v.issuer);
        if (i.status === 'ACTIVE') {
          i.status = 'QUARANTINED';
          i.quarantine = { reason: v.reason, since: time };
        }
      }
    }
  }

  // One block = an ordered list of instructions executed against one clock reading, then the
  // end-of-block invariant hook. Every validator reaches the same verdict from the same state:
  // there is no vote to halt. A halt still commits the block, so observers stay in sync.
  executeBlock({ txs, time }) {
    need(Number.isInteger(time) && time >= this.s.time, 'BAD_TIME');
    this.s.height += 1;
    this.s.time = time;
    for (const [k, t] of this.s.dedup) if (t < time - DEDUP_WINDOW_S) this.s.dedup.delete(k);
    const results = txs.map((tx) => this.#execTx(tx, time));
    this.#endOfBlock(time);
    const header = {
      chainId: this.chainId,
      height: this.s.height,
      time,
      prev: this.s.prev,
      txRoot: sha256(canon(txs)),
      stateRoot: this.stateRoot(),
      halt: this.s.halt ? { reason: this.s.halt.reason, issuer: this.s.halt.issuer } : null,
    };
    const hash = sha256(canon(header));
    this.s.prev = hash;
    return { header, hash, results, violations: this.lastViolations, sweepFires: this.lastSweepFires };
  }

  // ---------------------------------------------------------------- views
  stateView() {
    const s = this.s;
    return {
      height: s.height,
      time: s.time,
      halt: s.halt,
      anchor: s.anchor,
      queue: s.queue,
      dedup: s.dedup,
      escrows: s.escrows,
      sweeps: s.sweeps,
      ...(s.grants.size ? { grants: s.grants } : {}),
      securities: s.securities,
      issuers: new Map([...s.issuers].map(([k, i]) => [k, { ...i, keys: undefined }])),
      accounts: new Map([...s.accounts].map(([k, a]) => [k, { ...a }])),
    };
  }
  stateRoot() {
    return sha256(canon(this.stateView()));
  }

  // Test-only chaos hook: mutates state outside the transaction path, simulating a kernel/contract
  // defect or storage corruption. The next end-of-block hook is expected to catch it.
  unsafeMutate(fn) {
    fn(this.s);
  }
}
