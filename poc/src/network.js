// Network host: wraps the kernel with simulated banks, adapters, a Bank-of-Canada anchor, a validator
// quorum that signs block headers (consensus is simulated, single process), and the action layer the
// dashboard and tests drive. Nothing in the kernel depends on this file.

import crypto from 'node:crypto';
import { Ledger, GRANTABLE_TYPES } from './kernel.js';
import { Bank } from './bank.js';
import { canon, genKey, sign, verify, sha256, exportKey, importKey } from './crypto.js';
import { Store } from './store.js';
import { parsePacs008, buildPacs002, centsOf, IsoError } from './iso20022.js';


// Roadmap 6.2. What an agent needs to know when an instruction fails: can it retry, and what would fix it.
// Codes not listed here are reported as { retryable: false, remedy: null } - never guessed.
export const ERROR_CATALOG = {
  ESCALATION_REQUIRED: { retryable: false, remedy: 'Outside the grant envelope: resubmit with the institution ops signature (ops:<issuer>) added alongside the agent signature, or stay within the envelope.' },
  ENVELOPE_DENIED: { retryable: false, remedy: 'The grant does not allow this instruction type or counterparty. Ask the institution for a broader grant; a co-signature cannot widen scope.' },
  GRANT_REVOKED: { retryable: false, remedy: 'The grant or one of its ancestors was revoked. Obtain a new grant.' },
  GRANT_EXPIRED: { retryable: false, remedy: 'The grant or one of its ancestors passed its not_after time. Obtain a new grant.' },
  GRANT_WIDENS_PARENT: { retryable: false, remedy: 'A sub-grant may only narrow its parent: types, per-instruction max, window cap, counterparties and expiry must all be within the parent.' },
  GRANT_WRONG_ISSUER: { retryable: false, remedy: 'A grant only authorises the issuer that created it.' },
  UNKNOWN_GRANT: { retryable: false, remedy: 'No grant with that id is on the ledger (check GET /api/grants).' },
  CALLER_MISMATCH: { retryable: false, remedy: 'An agent-signed instruction cannot declare caller.kind human; omit caller or declare agent.' },
  BAD_SIGNATURE: { retryable: false, remedy: 'A signature does not verify over the instruction digest. Re-sign the exact instruction; any change after signing invalidates it.' },
  MISSING_SIGNATURE: { retryable: false, remedy: 'A required role signature is absent. See GET /api/schema for the roles this type needs.' },
  DUPLICATE_INSTRUCTION: { retryable: false, remedy: 'This inst_id was already processed: the original outcome stands. Do not resend; use a new inst_id for a new instruction.' },
  BAD_VALIDITY: { retryable: true, remedy: 'valid_until must be within 60 seconds of block time. Re-sign with a fresh valid_until and a NEW inst_id.' },
  INSUFFICIENT_FUNDS: { retryable: true, remedy: 'The payer balance is below the amount. Retry after funds arrive, with a new inst_id.' },
  INSUFFICIENT_SETTLEMENT_POSITION: { retryable: true, remedy: 'The issuer settlement position is short. Retry later, or set queueIfShort to wait for netting.' },
  ISSUER_QUARANTINED: { retryable: true, remedy: 'The issuer is quarantined by the graded halt. Retry after it is resumed.' },
  NETWORK_HALTED: { retryable: true, remedy: 'The network is halted. Retry after RESUME.' },
  VALUE_CAP_EXCEEDED: { retryable: false, remedy: 'Above the per-instruction network cap. Split the instruction.' },
  MALFORMED: { retryable: false, remedy: 'The instruction is not a well-formed { inst_id, type, payload, valid_until, sigs } object.' },
};
export const dollars = (n) => BigInt(Math.round(n * 100));
export const fmt = (cents) => {
  const neg = cents < 0n;
  const v = neg ? -cents : cents;
  return (neg ? '-' : '') + '$' + (v / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + (v % 100n).toString().padStart(2, '0');
};

const ISSUERS = [
  { id: 'MPL', name: 'Maple Bank', customers: [{ id: 'acme', name: 'Acme Manufacturing' }, { id: 'harbour', name: 'Harbour Securities (dealer)' }] },
  { id: 'NSR', name: 'North Star Bank', customers: [{ id: 'cedar', name: 'Cedar Foods' }, { id: 'pinnacle', name: 'Pinnacle Pension Fund' }] },
  { id: 'LKS', name: 'Lakeshore Bank', customers: [{ id: 'elm', name: 'Elm Capital' }, { id: 'fjord', name: 'Fjord Freight' }, { id: 'shadow', name: 'Shadow Trading Ltd', sanctioned: true }] },
];
const QUORUM = 3; // n=4 validators (3 issuers + operator), f=1

const js = (v) => {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [k, js(x)]));
  if (Array.isArray(v)) return v.map(js);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, js(x)]));
  return v;
};

// M2 confidentiality (roadmap 4.1): a pure view over Network#snapshot()'s
// already-built output - access control, not cryptography (02-technical-
// implementation.md T-6/section 2.6). The kernel and the real settled state
// are never touched; this only changes what a caller is shown. `viewer` is
// `{ supervisor: true }` (the Bank of Canada observer / operator: everything,
// unredacted - matches the invariant charter's own "supervisory 60-second
// claim") or `{ issuer: '<id>' }` (that issuer's own book in full; every
// other issuer reduced to id/name/status/quarantine - enough to know whether
// a counterparty is safe to pay, never its book. An id matching no real
// issuer sees no issuer's book at all, same as an outside party).
export function confidentialView(snapshot, viewer = {}) {
  if (viewer.supervisor) return snapshot;
  const ownId = viewer.issuer;
  return {
    ...snapshot,
    issuers: snapshot.issuers.map((i) => (i.id === ownId ? i : { id: i.id, name: i.name, status: i.status, quarantine: i.quarantine })),
  };
}

export class Network {
  constructor(opts = {}) {
    this.opts = opts;
    this.listeners = new Set();
    this.reset();
  }

  // ------------------------------------------------------------------ setup
  // With opts.dataDir the network is durable: every block is appended (fsync'd) to a hash-chained log and
  // reopening the same directory recovers by replaying it. Without it, everything lives in memory.
  reset() {
    this.store = this.opts.dataDir ? new Store(this.opts.dataDir) : null;
    if (this.store && this.store.exists() && !this.opts.fresh) return this.#recover();
    this.#fresh();
    if (this.store) {
      this.store.wipe();
      this.store.init({ genesis: this.genesis, keys: this.#serializeKeys() });
    }
    if (!this.opts.bare) this.bootstrap();
  }

  #serializeKeys() {
    const K = this.K;
    const ex = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, exportKey(v)]));
    return { issuers: Object.fromEntries(Object.entries(K.issuers).map(([id, o]) => [id, ex(o)])), gov: ex(K.gov), validators: ex(K.validators), observer: exportKey(K.observer), anchor: exportKey(K.anchor), recOperator: exportKey(K.rec.operator), event: ex(K.event) };
  }
  #deserializeKeys(o) {
    const im = (x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, importKey(v)]));
    const K = { issuers: Object.fromEntries(Object.entries(o.issuers).map(([id, x]) => [id, im(x)])), gov: im(o.gov), validators: im(o.validators), observer: importKey(o.observer), anchor: importKey(o.anchor), rec: { operator: importKey(o.recOperator) }, event: o.event ? im(o.event) : {} };
    K.rec.observer = K.observer;
    return K;
  }

  #resetRuntime() {
    this.banks = Object.fromEntries(
      ISSUERS.map((i) => [i.id, new Bank(i.id, i.name, i.customers.map((c) => ({ ...c, ordinary: dollars(5_000_000) })), dollars(50_000_000))]),
    );
    this.sanctioned = new Set(ISSUERS.flatMap((i) => i.customers.filter((c) => c.sanctioned).map((c) => `${i.id}:${c.id}`)));
    this.blocks = [];
    this.log = [];
    this.clockOffset = 0;
    this.agentKeys = {}; // grantId -> keypair, demo-only custody: a real agent holds its own key and never shares it with the network
    this.corePaused = false;
    this.coreTasks = [];
    this.chaosState = {};
    this.counter = 0;
  }

  #fresh() {
    const K = { issuers: {}, gov: {}, validators: {}, rec: {} };
    for (const i of ISSUERS) K.issuers[i.id] = { ops: genKey(), mint: genKey(), attest: genKey(), screen: genKey() };
    K.gov.operator = genKey();
    K.gov.neutral = genKey();
    K.observer = genKey(); // Bank of Canada supervisory node (non-voting)
    K.anchor = genKey(); // anchor gateway
    K.event = { delivery: genKey(), inspection: genKey(), 'csd-confirmation': genKey() }; // PayOnEvent (T5) named oracles
    K.rec.operator = genKey();
    K.rec.observer = K.observer; // the observer can also pull the fire alarm
    K.validators.operator = genKey();
    for (const i of ISSUERS) K.validators[i.id] = genKey();
    this.K = K;
    this.genesis = {
      chainId: 'depositx-poc',
      params: { maxTx: '500000000' }, // $5,000,000.00 per instruction (capped pilot)
      issuers: ISSUERS.map((i) => ({ id: i.id, name: i.name, keys: Object.fromEntries(Object.entries(K.issuers[i.id]).map(([k, v]) => [k, v.pub])) })),
      governance: { operator: K.gov.operator.pub, neutral: K.gov.neutral.pub },
      observer: K.observer.pub,
      anchor: K.anchor.pub,
      reconcilers: { operator: K.rec.operator.pub, observer: K.observer.pub },
      eventOracles: Object.fromEntries(Object.entries(K.event).map(([name, k]) => [name, k.pub])),
      securities: [{ id: 'CAN-2031', name: 'Government of Canada 3.0% 2031 (illustrative)' }],
      validators: Object.entries(K.validators).map(([id, k]) => ({ id, pub: k.pub })),
    };
    this.ledger = new Ledger(this.genesis);
    this.#resetRuntime();
  }

  // Crash recovery: replay every stored block through the kernel and require the recomputed block hash to
  // equal the stored one. Any altered, dropped or reordered history fails here.
  #recover() {
    const { genesis, keys } = this.store.readMeta();
    this.genesis = genesis;
    this.K = this.#deserializeKeys(keys);
    this.ledger = new Ledger(genesis);
    this.#resetRuntime();
    const records = this.store.load();
    let last = null;
    for (const [n, rec] of records.entries()) {
      if (rec.unsafe) {
        this.#applyUnsafe(rec.unsafe);
        continue;
      }
      const res = this.ledger.executeBlock({ txs: rec.txs, time: rec.time });
      if (res.hash !== rec.hash) throw new Error(`STORE_CORRUPT: block ${res.header.height} (record ${n + 1}) replays to a different hash; history was altered`);
      this.log.push({ time: rec.time, txs: rec.txs });
      this.blocks.push(this.#makeBlock(res));
      if (this.blocks.length > 500) this.blocks.shift();
      last = rec;
    }
    if (last) {
      for (const [id, snap] of Object.entries(last.banks)) this.banks[id].restore(snap);
      this.coreTasks = last.tasks.map((t) => ({ ...t, amount: BigInt(t.amount), posted: t.posted ? { L_after: BigInt(t.posted.L_after), seq: t.posted.seq } : undefined }));
      this.clockOffset = last.clockOffset;
      this.corePaused = last.corePaused;
      this.counter = last.counter;
    }
    this.recovered = { blocks: records.length };
  }

  #applyUnsafe(u) {
    const amount = BigInt(u.amount);
    this.chaosState.inflated = u.kind === 'inflate' ? (this.chaosState.inflated || 0n) + amount : 0n;
    this.ledger.unsafeMutate((st) => (st.accounts.get('LKS:elm').balance += u.kind === 'inflate' ? amount : -amount));
  }

  // Opens every customer account, seeds the securities holding, prefunds settlement positions and
  // mints a starting float so the dashboard opens on a live, non-empty network.
  bootstrap() {
    const kyc = this.now() + 10 * 365 * 86400;
    for (const i of ISSUERS)
      for (const c of i.customers) this.submit([this.tx('OPEN_ACCOUNT', { issuer: i.id, holderRef: c.id, kycRef: `KYC-${i.id}-${c.id}`, kycExpires: kyc }, [`ops:${i.id}`])]);
    this.submit([this.tx('CREDIT_SECURITY', { account: 'MPL:harbour', secId: 'CAN-2031', qty: '1000' }, ['gov:operator', 'gov:neutral'])]);
    for (const i of ISSUERS) this.fund(i.id, dollars(2_000_000));
    const float = [['MPL', 'acme', 500_000], ['MPL', 'harbour', 100_000], ['NSR', 'cedar', 400_000], ['NSR', 'pinnacle', 600_000], ['LKS', 'elm', 350_000], ['LKS', 'fjord', 150_000]];
    for (const [i, c, n] of float) this.mint(i, c, dollars(n));
  }

  now() {
    return Math.floor(Date.now() / 1000) + this.clockOffset;
  }

  sk(role) {
    const [kind, who] = role.split(':');
    if (kind === 'gov') return this.K.gov[who].priv;
    if (kind === 'observer') return this.K.observer.priv;
    if (kind === 'anchor') return this.K.anchor.priv;
    if (kind === 'reconciler') return this.K.rec[who].priv;
    if (kind === 'event') return this.K.event[who].priv;
    if (kind === 'agent') return this.agentKeys[who].priv; // a delegated agent's own key (roadmap 6.1), never an institution key
    if (kind === 'accept') return this.K.issuers[who].ops.priv;
    return this.K.issuers[who][kind].priv;
  }

  // Builds and signs a transaction. `roles` are the signatures the kernel will require.
  // `caller` (roadmap 5.1): the signer's own self-attested `{ kind: 'human'|'agent'|'unspecified', label? }`
  // for THIS instruction. Not a new key or a new access class - whoever holds the role's key still
  // authenticates as that role. Included in the signed digest, so it is exactly as tamper-evident as
  // `payload`: relabelling it after signing invalidates every signature already on the instruction.
  tx(type, payload, roles, { ttl = 60, keyOverride = {}, instId, caller } = {}) {
    const t = { inst_id: instId || `${type.toLowerCase()}-${Date.now().toString(36)}-${(++this.counter).toString(36)}-${crypto.randomBytes(3).toString('hex')}`, type, payload, valid_until: this.now() + ttl, caller: caller || { kind: 'unspecified' }, sigs: {} };
    // sign using the same canonical message the kernel verifies
    const msg = canon({ d: 'depositx-poc-v1', chain: this.genesis.chainId, inst_id: t.inst_id, type: t.type, payload: t.payload, valid_until: t.valid_until, caller: t.caller });
    for (const r of roles) t.sigs[r] = sign(keyOverride[r] || this.sk(r), msg);
    return t;
  }

  // ------------------------------------------------------------------ agent interface (roadmap 6.2)
  // The server-free core of POST /api/submit: takes an instruction the CALLER already signed and submits
  // it as-is. Nothing here signs, completes or repairs an instruction. Never throws on bad input.
  submitSigned(tx) {
    const fail = (error, message) => ({ ok: false, error, message, retryable: !!(ERROR_CATALOG[error] || {}).retryable, remedy: (ERROR_CATALOG[error] || {}).remedy || null });
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) return fail('MALFORMED', 'instruction must be a JSON object');
    if (typeof tx.type !== 'string' || typeof tx.inst_id !== 'string' || !tx.sigs || typeof tx.sigs !== 'object') return fail('MALFORMED', 'needs inst_id, type, payload, valid_until and sigs');
    let block;
    try {
      block = this.submit([tx]);
    } catch (e) {
      return fail('MALFORMED', e.message);
    }
    const r = block.results[0];
    this.pumpCore();
    const info = ERROR_CATALOG[r.error] || {};
    return { ok: r.ok, error: r.error, message: r.message, retryable: r.ok ? false : !!info.retryable, remedy: r.ok ? null : info.remedy || null, events: r.events, caller: r.caller, height: block.height, hash: block.hash };
  }

  // Grants with live status and remaining window headroom; every amount a decimal string of cents.
  grantsView(issuer) {
    const time = Math.max(this.ledger.s.time, this.now());
    return [...this.ledger.s.grants.values()].filter((g) => !issuer || g.issuer === issuer).map((g) => {
      const st = this.ledger.grantStatus(g.id, time);
      return {
        id: g.id, issuer: g.issuer, label: g.label, parent: g.parent, allow_types: g.allow_types,
        per_instruction_max: g.per_instruction_max.toString(), window: { seconds: g.window.seconds, max_total: g.window.max_total.toString() },
        counterparties: g.counterparties, not_after: g.not_after, revoked: g.revoked,
        live: st.live, reason: st.reason, remaining_window: st.remaining_window.toString(),
      };
    });
  }

  // Machine-readable description of the instruction interface. Plain JSON, no BigInt.
  static schema() {
    const SIG = { TRANSFER: ['ops:<payer issuer> | agent:<grant_id>', 'screen:<payer issuer>'], PAYMENT: ['ops:<payer issuer> | agent:<grant_id>', 'screen:<payer issuer>', 'accept:<payee issuer>'], ESCROW_LOCK: ['ops:<payer issuer> | agent:<grant_id>', 'screen:<payer issuer>', 'accept:<payee issuer> (cross-issuer only)'], ESCROW_REFUND: ['ops:<payer issuer> | agent:<grant_id>'], REGISTER_SWEEP: ['ops:<issuer> | agent:<grant_id>'], CANCEL_SWEEP: ['ops:<issuer> | agent:<grant_id>'], GRANT: ['ops:<issuer> (root grant) | agent:<parent grant_id> (sub-grant)'], REVOKE_GRANT: ['ops:<issuer> | agent:<an ancestor grant_id>'] };
    const types = Object.getOwnPropertyNames(Ledger.prototype).filter((k) => k.startsWith('tx_')).map((k) => k.slice(3)).sort().map((type) => ({ type, grantable: GRANTABLE_TYPES.includes(type), signatures: SIG[type] || null }));
    return {
      version: 'depositx-poc-schema/1',
      envelope: { instruction: ['inst_id', 'type', 'payload', 'valid_until', 'caller?', 'sigs'], signed_digest: 'canonical JSON of { d, chain, inst_id, type, payload, valid_until, caller }', signature: 'ed25519, hex', amounts: 'decimal strings of integer cents', valid_until: 'within 60 seconds of block time', idempotency: 'inst_id is unique; a resubmission is DUPLICATE_INSTRUCTION, never a second execution' },
      grantable_types: GRANTABLE_TYPES,
      types,
      errors: ERROR_CATALOG,
    };
  }

  // ------------------------------------------------------------------ agent delegation (roadmap 6.1)
  // Builds (does not submit) a GRANT: signed by the issuer's ops key for a root grant, or by the parent
  // grant's agent key for a sub-grant. Returns { tx, key } - the new agent's keypair is only kept once
  // the kernel accepts the grant (see grantAgent).
  grantTx(o, { signAs } = {}) {
    const key = o.key || genKey(); // a real agent brings its own key and shares only the public half
    const parentRec = o.parent ? this.ledger.s.grants.get(o.parent) : null;
    const notAfter = o.notAfter != null ? o.notAfter : parentRec ? parentRec.not_after : this.now() + 7 * 86400;
    const big = (v) => (v == null ? null : v.toString());
    const payload = {
      grant_id: o.grantId, issuer: o.issuer, agent_key: key.pub, label: o.label, parent: o.parent || null,
      allow_types: o.allowTypes, per_instruction_max: big(o.perInstructionMax),
      window: o.window ? { seconds: o.window.seconds, max_total: big(o.window.maxTotal) } : null,
      counterparties: o.counterparties || null, not_after: notAfter,
    };
    const role = signAs || (o.parent ? `agent:${o.parent}` : `ops:${o.issuer}`);
    const known = role.startsWith('agent:') ? this.agentKeys[role.slice(6)] : this.K.issuers[role.split(':')[1]];
    const tx = this.tx('GRANT', payload, known ? [role] : []);
    return { tx, key };
  }
  grantAgent(o) {
    const { tx, key } = this.grantTx(o);
    const block = this.submit([tx]);
    const r = block.results[0];
    if (r.ok) this.agentKeys[o.grantId] = key;
    return { ok: r.ok, error: r.error, message: r.message, grantId: o.grantId, caller: r.caller, height: block.height };
  }
  // Revoke by the institution (default) or by an ancestor grant's agent key (`by`).
  revokeGrant(grantId, { by } = {}) {
    const g = this.ledger.s.grants.get(grantId);
    const role = by ? `agent:${by}` : `ops:${g ? g.issuer : 'MPL'}`;
    const block = this.submit([this.tx('REVOKE_GRANT', { grant_id: grantId }, [role])]);
    const r = block.results[0];
    return { ok: r.ok, error: r.error, message: r.message, height: block.height };
  }
  // Builds an instruction authorised by an agent grant instead of the institution's ops key. `roles` are the
  // remaining required signatures (screen:/accept:); `escalate` adds the institution's ops signature as well.
  agentTx(grantId, type, payload, roles, { escalate = false, caller, ttl, instId } = {}) {
    const g = this.ledger.s.grants.get(grantId);
    const rs = [`agent:${grantId}`, ...roles];
    if (escalate) rs.push(`ops:${g ? g.issuer : String(payload.from || payload.issuer || '').split(':')[0]}`); // an unknown grant is the kernel's to reject
    return this.tx(type, payload, rs, { caller, ttl, instId });
  }

  // ------------------------------------------------------------------ consensus (simulated)
  #makeBlock(res) {
    const sigs = {};
    for (const [id, k] of Object.entries(this.K.validators)) sigs[id] = sign(k.priv, res.hash);
    const block = {
      height: res.header.height,
      hash: res.hash,
      header: res.header,
      sigs,
      quorum: QUORUM,
      results: res.results.map((r) => ({ instId: r.instId, type: r.type, ok: r.ok, error: r.error, message: r.message, events: r.events, caller: r.caller })),
      violations: res.violations,
      sweepFires: res.sweepFires,
    };
    block.receiptOk = Network.verifyReceipt(this.genesis, block);
    return block;
  }

  // `consumeTask`: an adapter follow-up that this block completes. It is removed from the backlog BEFORE the
  // record is persisted, so a crash right after this block cannot make recovery redo it.
  submit(txs, { consumeTask } = {}) {
    const time = Math.max(this.ledger.s.time, this.now());
    const res = this.ledger.executeBlock({ txs, time });
    this.log.push({ time, txs });
    const block = this.#makeBlock(res);
    this.blocks.push(block);
    if (this.blocks.length > 500) this.blocks.shift();
    for (const r of res.results) if (r.ok) this.#onEvents(r.events);
    if (consumeTask && res.results[0].error !== 'NETWORK_HALTED') this.coreTasks = this.coreTasks.filter((x) => x !== consumeTask);
    if (this.store) {
      this.store.append({
        time,
        txs,
        hash: res.hash,
        banks: Object.fromEntries(Object.entries(this.banks).map(([id, b]) => [id, b.snapshot()])),
        tasks: this.coreTasks.map((t) => ({ ...t, amount: t.amount.toString(), posted: t.posted ? { L_after: t.posted.L_after.toString(), seq: t.posted.seq } : undefined })),
        clockOffset: this.clockOffset,
        corePaused: this.corePaused,
        counter: this.counter,
      });
    }
    for (const l of this.listeners) l({ type: 'block', height: block.height });
    return block;
  }

  // A finality receipt is verifiable offline: header hash plus at least QUORUM validator signatures.
  static verifyReceipt(genesis, block) {
    if (sha256(canon(block.header)) !== block.hash) return false;
    let n = 0;
    for (const v of genesis.validators) if (block.sigs[v.id] && verify(v.pub, block.hash, block.sigs[v.id])) n++;
    return n >= QUORUM;
  }

  heartbeat() {
    return this.submit([]);
  }

  // Recompute the whole chain from genesis and the transaction log: same headers, same state roots.
  verifyReplay() {
    const l = new Ledger(this.genesis);
    let ok = true;
    let last = null;
    for (const b of this.log) {
      const r = l.executeBlock(b);
      last = r;
    }
    const mine = this.blocks.slice(-1)[0];
    if (last && mine) ok = last.hash === mine.hash && last.header.stateRoot === mine.header.stateRoot;
    return { ok, blocks: this.log.length, stateRoot: last ? last.header.stateRoot : null, hash: last ? last.hash : null };
  }

  // ------------------------------------------------------------------ adapters (core follow-ups)
  #onEvents(events) {
    for (const e of events) {
      if (e.type === 'REDEEMED') this.coreTasks.push({ kind: 'closeRedemption', issuer: e.issuer, id: e.id, amount: BigInt(e.amount), cust: e.account.split(':')[1] });
      if (e.type === 'CONVERT_OUT') this.coreTasks.push({ kind: 'closeConvertOut', issuer: e.issuer, id: e.id, amount: BigInt(e.amount) });
      if (e.type === 'CONVERT_IN') this.coreTasks.push({ kind: 'closeConvertIn', issuer: e.issuer, id: e.id, amount: BigInt(e.amount) });
    }
  }

  // The adapter observes ledger events and posts them to the core, then registers the core's new balance.
  // Pausing simulates a core that is slow or down: in-flight amounts accumulate, then age out.
  pumpCore() {
    if (this.corePaused) return 0;
    let done = 0;
    while (this.coreTasks.length) {
      const t = this.coreTasks[0];
      const bank = this.banks[t.issuer];
      if (!t.posted) {
        t.posted = t.kind === 'closeRedemption' ? bank.creditRedemption(t.cust, t.amount) : t.kind === 'closeConvertOut' ? bank.postConvertOut(t.amount) : bank.postConvertIn(t.amount);
      }
      const type = { closeRedemption: 'CLOSE_REDEMPTION', closeConvertOut: 'CLOSE_CONVERT_OUT', closeConvertIn: 'CLOSE_CONVERT_IN' }[t.kind];
      const tx = this.tx(type, { issuer: t.issuer, id: t.id, L_after: t.posted.L_after.toString(), seq: t.posted.seq }, [`attest:${t.issuer}`]);
      const block = this.submit([tx], { consumeTask: t });
      const r = block.results[0];
      if (!r.ok && r.error === 'NETWORK_HALTED') break; // retry after the network resumes
      if (r.ok) done++;
    }
    return done;
  }

  // ------------------------------------------------------------------ actions
  #res(block, extra = {}) {
    const r = block.results[0];
    return { ok: r.ok, error: r.error, message: r.message, height: block.height, ...extra };
  }

  mint(issuer, cust, amt) {
    const bank = this.banks[issuer];
    const hold = bank.placeHold(cust, amt);
    if (!hold) return { ok: false, stage: 'core', error: 'CORE_INSUFFICIENT_DEPOSIT', message: 'customer deposit is below the requested amount' };
    const open = this.submit([this.tx('OPEN_HOLD', { issuer, holdId: hold.holdId, amount: amt.toString(), L_after: hold.L_after.toString(), seq: hold.seq }, [`attest:${issuer}`])]);
    if (!open.results[0].ok) {
      bank.reverseHold(cust, amt);
      this.pumpCore();
      return this.#res(open, { stage: 'open-hold' });
    }
    const mint = this.submit([this.tx('MINT', { issuer, holdId: hold.holdId, account: `${issuer}:${cust}` }, [`mint:${issuer}`])]);
    if (!mint.results[0].ok) {
      const rev = bank.reverseHold(cust, amt);
      this.submit([this.tx('RELEASE_HOLD', { issuer, holdId: hold.holdId, L_after: rev.L_after.toString(), seq: rev.seq }, [`attest:${issuer}`])]);
    }
    this.pumpCore();
    return this.#res(mint, { stage: 'mint' });
  }

  redeem(issuer, cust, amt) {
    const block = this.submit([this.tx('REDEEM', { account: `${issuer}:${cust}`, amount: amt.toString() }, [`ops:${issuer}`])]);
    this.pumpCore();
    return this.#res(block, { stage: 'redeem' });
  }

  #complianceCheck(fromAcct, toAcct) {
    for (const a of [fromAcct, toAcct]) if (this.sanctioned.has(a)) return { ok: false, stage: 'bank-compliance', error: 'SANCTIONS_HIT', message: `${a} is on the sanctions list: the issuing bank's compliance service will not issue a screening receipt, so nothing is submitted` };
    return null;
  }

  pay(fromAcct, toAcct, amt, { queue = false, instId, caller } = {}) {
    const blocked = this.#complianceCheck(fromAcct, toAcct);
    if (blocked) return blocked;
    const [a] = fromAcct.split(':');
    const [b] = toAcct.split(':');
    const same = a === b;
    const tx = same
      ? this.tx('TRANSFER', { from: fromAcct, to: toAcct, amount: amt.toString() }, [`ops:${a}`, `screen:${a}`], { instId, caller })
      : this.tx('PAYMENT', { from: fromAcct, to: toAcct, amount: amt.toString(), queueIfShort: queue }, [`ops:${a}`, `screen:${a}`, `accept:${b}`], { instId, caller });
    const block = this.submit([tx]);
    this.pumpCore();
    return this.#res(block, { stage: 'payment', events: block.results[0].events.map((e) => e.type) });
  }

  // ISO 20022 gateway: pacs.008 in, pacs.002 out. The UETR becomes the kernel instruction id, so a
  // resubmitted message is recognised as a duplicate (exactly-once, within the kernel's dedup window).
  pacs008(xml) {
    let m;
    try {
      m = parsePacs008(xml);
    } catch (e) {
      if (!(e instanceof IsoError)) throw e;
      return buildPacs002({ settled: false, error: 'NARR', message: `invalid message: ${e.message}` });
    }
    let r;
    try {
      r = this.pay(m.debtor.account, m.creditor.account, centsOf(m.amount), { instId: m.uetr });
    } catch (e) {
      r = { ok: false, error: 'UNKNOWN_ACCOUNT', message: 'unknown account' };
    }
    const block = this.blocks[this.blocks.length - 1];
    return buildPacs002({ msgId: m.msgId, endToEndId: m.endToEndId, uetr: m.uetr, settled: !!r.ok, error: r.error, message: r.message, height: r.height, hash: r.ok ? this.blocks.find((b) => b.height === r.height).hash : block.hash, time: this.ledger.s.time });
  }

  dvp(sellerAcct, buyerAcct, secId, qty, cash) {
    const blocked = this.#complianceCheck(buyerAcct, sellerAcct);
    if (blocked) return blocked;
    const [s] = sellerAcct.split(':');
    const [b] = buyerAcct.split(':');
    const roles = [...new Set([`ops:${b}`, `screen:${b}`, `ops:${s}`, ...(s !== b ? [`accept:${s}`] : [])])];
    const block = this.submit([this.tx('DVP', { seller: sellerAcct, buyer: buyerAcct, secId, qty: qty.toString(), cash: cash.toString() }, roles)]);
    this.pumpCore();
    return this.#res(block, { stage: 'dvp' });
  }

  // Escrow (T4) / PayOnEvent (T5). Convenience wrappers over the raw tx()/submit() pair every
  // other action already uses; the caller does not need to know which key a release requires -
  // it is looked up from the escrow record itself, exactly as a real client would read it back
  // from state rather than remembering it.
  escrowLock(from, to, escrowId, amt, { expiresAt, releaseRole, eventName } = {}) {
    const [a] = from.split(':');
    const [b] = to.split(':');
    const roles = a === b ? [`ops:${a}`, `screen:${a}`] : [`ops:${a}`, `screen:${a}`, `accept:${b}`];
    const exp = expiresAt || this.now() + 3600;
    const block = this.submit([this.tx('ESCROW_LOCK', { escrowId, from, to, amount: amt.toString(), expiresAt: exp, releaseRole, eventName }, roles)]);
    this.pumpCore();
    return this.#res(block, { stage: 'escrow-lock' });
  }
  escrowRelease(escrowId) {
    const rec = this.ledger.s.escrows.get(escrowId);
    if (!rec) return { ok: false, error: 'UNKNOWN_ESCROW', message: 'no such escrow', stage: 'escrow-release' };
    const block = this.submit([this.tx('ESCROW_RELEASE', { escrowId }, [rec.releaseRole])]);
    this.pumpCore();
    return this.#res(block, { stage: 'escrow-release' });
  }
  eventRelease(escrowId, event) {
    const block = this.submit([this.tx('EVENT_RELEASE', { escrowId, event }, [`event:${event}`])]);
    this.pumpCore();
    return this.#res(block, { stage: 'event-release' });
  }
  escrowRefund(escrowId) {
    const rec = this.ledger.s.escrows.get(escrowId);
    if (!rec) return { ok: false, error: 'UNKNOWN_ESCROW', message: 'no such escrow', stage: 'escrow-refund' };
    const from = this.ledger.s.accounts.get(rec.from);
    const block = this.submit([this.tx('ESCROW_REFUND', { escrowId }, [`ops:${from.issuer}`])]);
    this.pumpCore();
    return this.#res(block, { stage: 'escrow-refund' });
  }

  // Standing/Sweep (T6). Same-issuer only; see kernel.js.
  registerSweep(sweepId, from, to, keepAmount) {
    const [a] = from.split(':');
    const block = this.submit([this.tx('REGISTER_SWEEP', { sweepId, from, to, keepAmount: keepAmount.toString() }, [`ops:${a}`])]);
    return this.#res(block, { stage: 'register-sweep' });
  }
  cancelSweep(sweepId) {
    const rec = this.ledger.s.sweeps.get(sweepId);
    if (!rec) return { ok: false, error: 'UNKNOWN_SWEEP', message: 'no such sweep', stage: 'cancel-sweep' };
    const from = this.ledger.s.accounts.get(rec.from);
    const block = this.submit([this.tx('CANCEL_SWEEP', { sweepId }, [`ops:${from.issuer}`])]);
    return this.#res(block, { stage: 'cancel-sweep' });
  }

  // Batch (T7). legTxs: an array of already-built, already-signed tx() objects (each leg needs
  // its own signatures, exactly as if submitted alone - see kernel.js's tx_BATCH).
  batch(legTxs) {
    const block = this.submit([this.tx('BATCH', { legs: legTxs }, [])]);
    this.pumpCore();
    return this.#res(block, { stage: 'batch' });
  }

  // External-CSD DvP (roadmap 4.2, 02-technical-implementation.md section 2.4): the bond
  // lives at an outside depository, so only the cash leg is on DepositX - a correctly-
  // configured Escrow (1.1) gated on the dedicated csd-confirmation oracle (1.2), not a
  // new kernel mechanism. The residual risk window - funds locked, trade not yet final -
  // is exactly [now, now + deadlineSeconds]: eventRelease can confirm it at any point up
  // to expiry, escrowRefund can close it once the deadline has passed.
  externalCsdDvp(buyer, seller, escrowId, cash, { deadlineSeconds = 3600 } = {}) {
    return this.escrowLock(buyer, seller, escrowId, cash, { expiresAt: this.now() + deadlineSeconds, eventName: 'csd-confirmation' });
  }
  csdConfirm(escrowId) {
    return this.eventRelease(escrowId, 'csd-confirmation');
  }

  fund(issuer, amt) {
    const bank = this.banks[issuer];
    if (bank.cbBalance < amt) return { ok: false, stage: 'central-bank', error: 'CB_INSUFFICIENT_FUNDS', message: 'not enough central-bank funds to prefund the position' };
    const A_after = this.ledger.s.anchor.A + amt;
    const block = this.submit([this.tx('FUND_SP', { issuer, amount: amt.toString(), A_after: A_after.toString() }, [`ops:${issuer}`, 'anchor'])]);
    if (block.results[0].ok) bank.cbBalance -= amt;
    return this.#res(block, { stage: 'fund' });
  }

  defund(issuer, amt) {
    const A_after = this.ledger.s.anchor.A - amt;
    const block = this.submit([this.tx('DEFUND_SP', { issuer, amount: amt.toString(), A_after: A_after.toString() }, [`ops:${issuer}`, 'anchor'])]);
    if (block.results[0].ok) this.banks[issuer].cbBalance += amt;
    return this.#res(block, { stage: 'defund' });
  }

  netCycle() {
    const block = this.submit([this.tx('NET_CYCLE', {}, ['gov:operator'])]);
    this.pumpCore();
    return this.#res(block, { stage: 'net-cycle', events: block.results[0].events.filter((e) => e.type === 'NET_CYCLE' || e.type === 'NETTED') });
  }

  resume(scope, issuer) {
    const roles = ['gov:operator', 'gov:neutral', 'observer', ...(scope === 'issuer' ? [`ops:${issuer}`] : [])];
    const block = this.submit([this.tx('RESUME', { scope, issuer }, roles)]);
    if (block.results[0].ok) this.pumpCore();
    return this.#res(block, { stage: 'resume' });
  }

  advance(seconds) {
    this.clockOffset += seconds;
    const b = this.heartbeat();
    return { ok: true, height: b.height, message: `clock advanced ${seconds}s; heartbeat block committed` };
  }

  setCorePaused(on) {
    this.corePaused = !!on;
    if (!on) this.pumpCore();
    return { ok: true };
  }

  // ------------------------------------------------------------------ chaos
  chaos(type, p = {}) {
    const L = this.ledger;
    switch (type) {
      case 'inflate': {
        // Simulates a kernel/contract defect: credit an account without a mint.
        this.store?.append({ unsafe: { kind: 'inflate', amount: dollars(1_000_000).toString() } });
        this.#applyUnsafe({ kind: 'inflate', amount: dollars(1_000_000).toString() });
        const b = this.heartbeat();
        return { ok: true, height: b.height, message: 'injected $1,000,000 of tokens with no mint (a ledger defect). The end-of-block hook decides what happens.' };
      }
      case 'repair': {
        if (this.chaosState.inflated) {
          this.store?.append({ unsafe: { kind: 'repair', amount: this.chaosState.inflated.toString() } });
          this.#applyUnsafe({ kind: 'repair', amount: this.chaosState.inflated.toString() });
        }
        const b = this.heartbeat();
        return { ok: true, height: b.height, message: 'state repaired (defect patched). Resume still needs the co-signatures.' };
      }
      case 'core_restore': {
        const i = p.issuer || 'NSR';
        const cur = L.s.issuers.get(i);
        const tx = this.tx('ATTEST', { issuer: i, L: (cur.L - dollars(1)).toString(), seq: Math.max(0, cur.seq - 3) }, [`attest:${i}`]);
        const b = this.submit([tx]);
        return { ok: true, height: b.height, message: `${i}'s core was restored from an older backup and attested an old sequence number. Classified as core lag: quarantine that issuer only.` };
      }
      case 'core_loss': {
        const i = p.issuer || 'MPL';
        const cur = L.s.issuers.get(i);
        const bad = (cur.L * 7n) / 10n;
        const b = this.submit([this.tx('ATTEST', { issuer: i, L: bad.toString(), seq: this.banks[i].seq + 1 }, [`attest:${i}`])]);
        this.banks[i].seq += 1;
        return { ok: true, height: b.height, message: `${i} attested a control balance 30% below token supply, at a higher sequence: real over-issuance. Network halt.` };
      }
      case 'reattest': {
        const i = p.issuer || 'MPL';
        const at = this.banks[i].attestation();
        const b = this.submit([this.tx('ATTEST', { issuer: i, L: at.L.toString(), seq: at.seq }, [`attest:${i}`])]);
        return { ok: true, height: b.height, message: `${i} re-attested its true control balance after reconciliation.` };
      }
      case 'fire_alarm': {
        const i = p.issuer || 'LKS';
        const b = this.submit([this.tx('REPORT_PAR_BREAK', { issuer: i, reporter: 'observer', evidence: 'observer reconciler disagrees with operator' }, ['reconciler:observer'])]);
        return { ok: true, height: b.height, message: `the Bank of Canada observer's independent reconciler pulled the fire alarm on ${i}. Anyone can quarantine; restarting is expensive.` };
      }
      case 'unbacked_mint': {
        const b = this.submit([this.tx('MINT', { issuer: 'MPL', holdId: 'MPL-H999999', account: 'MPL:acme' }, ['mint:MPL'])]);
        return this.#res(b, { message: 'a compromised mint key tried to mint with no matching hold from the attestation key' });
      }
      case 'forged_sig': {
        const b = this.submit([this.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: '100000', queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR'], { keyOverride: { 'ops:MPL': this.K.issuers.NSR.ops.priv } })]);
        return this.#res(b, { message: "a payment signed with another bank's key" });
      }
      case 'overdraft': {
        const b = this.submit([this.tx('TRANSFER', { from: 'LKS:fjord', to: 'LKS:elm', amount: dollars(400_000).toString() }, ['ops:LKS', 'screen:LKS'])]);
        return this.#res(b, { message: 'attempted overdraft' });
      }
      case 'replay': {
        const t = this.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: '100' }, ['ops:LKS', 'screen:LKS']);
        const b1 = this.submit([t]);
        const b2 = this.submit([t]);
        return { ok: b1.results[0].ok && !b2.results[0].ok, error: b2.results[0].error, message: 'the same signed instruction was sent twice; the second must be rejected', height: b2.height };
      }
      case 'over_cap': {
        const b = this.submit([this.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(6_000_000).toString(), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR'])]);
        return this.#res(b, { message: 'instruction above the capped-pilot $5,000,000 limit' });
      }
      default:
        return { ok: false, error: 'UNKNOWN_CHAOS' };
    }
  }

  // ------------------------------------------------------------------ views
  snapshot() {
    const L = this.ledger;
    const time = L.s.time || this.now();
    const inv = L.checkInvariants(time);
    const rejected = L.counters.rejected;
    const issuers = [...L.s.issuers.values()].map((i) => {
      const p = inv.per.find((x) => x.issuer === i.id);
      const bank = this.banks[i.id];
      return js({
        id: i.id,
        name: i.name,
        status: i.status,
        quarantine: i.quarantine,
        S: p.S, minted: i.minted, burned: i.burned, convIn: i.convIn, convOut: i.convOut,
        L: i.L, In: p.In, H: p.H, R: p.R, diff: p.diff, sp: i.sp,
        p1: p.p1, p2: p.p2, p4: p.p4,
        coreGL: bank.controlGL, cbBalance: bank.cbBalance,
        customers: [...bank.customers.values()].map((c) => {
          const a = L.s.accounts.get(`${i.id}:${c.id}`);
          return { id: c.id, name: c.name, ordinary: c.ordinary, token: a ? a.balance : 0n, sec: a ? Object.fromEntries(a.sec) : {}, sanctioned: !!c.sanctioned, frozen: a ? a.status !== 'active' : false };
        }),
      });
    });
    const anyViol = (id) => inv.violations.some((v) => v.id === id);
    const invariants = [
      { id: 'P1', name: 'Conservation', rule: 'supply = minted − burned + converted in − converted out, exactly', status: inv.per.every((x) => x.p1) ? 'ok' : 'violated', response: 'network halt' },
      { id: 'P2', name: 'Backing (par)', rule: 'supply ≤ core control balance (+ inbound), and the gap is exactly the enumerated in-flight items', status: inv.per.every((x) => x.p2 && !x.aged) ? 'ok' : inv.per.some((x) => x.over) ? 'violated' : 'warning', response: 'over-issuance halts the network; anything else quarantines one issuer' },
      { id: 'P3', name: 'Par transfer', rule: 'every cross-issuer leg conserves value 1:1 (no fee, rate or rounding)', status: 'enforced', detail: `${rejected.P3_PAR_VIOLATION || 0} violations rejected`, response: 'instruction rejected' },
      { id: 'P4', name: 'Settlement backing', rule: 'positions never negative; Σ positions = anchor total', status: inv.per.every((x) => x.p4) && inv.anchor.ok ? 'ok' : 'violated', response: 'network halt' },
      { id: 'P5', name: 'Non-negativity', rule: 'no account balance below zero', status: inv.p5.ok ? 'ok' : 'violated', response: 'network halt' },
      { id: 'P6', name: 'Authority', rule: 'only the right key set can mint or debit; the operator can move nothing', status: 'enforced', detail: `${(rejected.BAD_SIGNATURE || 0) + (rejected.MISSING_SIGNATURE || 0)} bad-signature rejections`, response: 'instruction rejected' },
      { id: 'P7', name: 'Halt monotonicity', rule: 'once halted, only a co-signed Resume clears it', status: L.s.halt ? 'halted' : 'enforced', detail: L.s.halt ? `halted: ${L.s.halt.reason}` : 'not halted', response: 'structural' },
    ];
    void anyViol;
    const blocks = this.blocks.slice(-40).reverse().map((b) => ({
      height: b.height, hash: b.hash, time: b.header.time, finalSigs: Object.keys(b.sigs).length, quorum: b.quorum,
      halt: b.header.halt, receiptOk: b.receiptOk, txs: b.results.map((r) => ({ type: r.type, ok: r.ok, error: r.error, message: r.message, events: r.events.map((e) => e.type), caller: r.caller })), stateRoot: b.header.stateRoot,
    }));
    return js({
      height: L.s.height,
      time,
      halt: L.s.halt,
      params: { maxTx: L.params.maxTx },
      validators: { n: 4, f: 1, quorum: QUORUM, note: 'consensus is simulated in-process; signatures are real Ed25519' },
      issuers,
      anchor: { A: L.s.anchor.A, F: L.s.anchor.F, spSum: inv.anchor.spSum, ok: inv.anchor.ok },
      queue: L.s.queue.map((q) => ({ id: q.instId, from: q.tx.payload.from, to: q.tx.payload.to, amount: q.tx.payload.amount })),
      invariants,
      accepted: L.counters.accepted,
      rejectedTotal: Object.values(rejected).reduce((a, b) => a + b, 0),
      rejected,
      corePaused: this.corePaused,
      coreBacklog: this.coreTasks.length,
      clockOffset: this.clockOffset,
      securities: [...L.s.securities.values()],
      blocks,
      stateRoot: L.stateRoot(),
    });
  }
}
