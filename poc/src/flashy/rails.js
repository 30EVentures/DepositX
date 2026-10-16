// Two settlement rails kept apart, for the 30E demo.
//   depositx-cad     : the simulated DepositX network, CAD in integer cents. Proof of concept; consensus is simulated.
//   wdk-usdt:<chain> : a testnet stablecoin leg, integer base units (6 decimals), paid through a spend-authorization plane.
// They are DIFFERENT money. This module has no way to net, sum, convert or relabel one as the other, and refuses any
// attempt. Every outcome carries its rail and a finality label that never says more than "simulated" or "testnet".
// Dependency-free (node:crypto only). Closed schemas: unknown fields are refused.
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from 'node:crypto';

export const RAIL_CAD = 'depositx-cad';
const WDK_RAIL = /^wdk-usdt:evm:(31337|84532|43113)$/;
export const UNIT_OF = (rail) => (rail === RAIL_CAD ? 'cad-cents' : WDK_RAIL.test(rail) ? 'usdt-base6' : null);
const AMOUNT = /^(0|[1-9][0-9]*)$/;
const KEYS = ['ver', 'instructionId', 'rail', 'unit', 'amount', 'payer', 'payee', 'purpose', 'issuedAt', 'agent', 'sig'];
const DOMAIN = '30e-demo/settlement-instruction/1';

export class RailError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function canonical(v) {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new TypeError('only safe integers'); return String(v); }
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  throw new TypeError('unsupported value');
}
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
export function keyFromSeedHex(seedHex) {
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(seedHex, 'hex')]), format: 'der', type: 'pkcs8' });
  return { priv, pubHex: createPublicKey(priv).export({ type: 'spki', format: 'der' }).subarray(12).toString('hex') };
}
const sig = (key, body) => edSign(null, Buffer.from(DOMAIN + '\0' + canonical(body)), key.priv).toString('hex');
const check = (pubHex, body, s) => { try { return edVerify(null, Buffer.from(DOMAIN + '\0' + canonical(body)), createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(pubHex, 'hex')]), format: 'der', type: 'spki' }), Buffer.from(s, 'hex')); } catch { return false; } };

/** What each rail is, in words an investor can read. Never stronger than the truth. */
export function describeRail(rail) {
  if (rail === RAIL_CAD) return 'DepositX simulated network, CAD cents. Proof of concept: consensus is simulated, no bank partner.';
  if (WDK_RAIL.test(rail)) return 'Testnet stablecoin leg, base units. Not a bank deposit. Not interchangeable with depositx-cad.';
  throw new RailError('UNKNOWN_RAIL', 'unknown rail');
}
export function finalityLabel(rail) {
  if (rail === RAIL_CAD) return 'simulated';
  const m = WDK_RAIL.exec(rail);
  if (!m) throw new RailError('UNKNOWN_RAIL', 'unknown rail');
  return m[1] === '31337' ? 'simulated' : 'testnet';
}

/** What a line of this rail IS, in a fixed vocabulary. A stablecoin leg is never described as a bank deposit. */
export function kindOf(rail) {
  if (rail === RAIL_CAD) return 'simulated-deposit-token';
  if (WDK_RAIL.test(rail)) return 'testnet-stablecoin-not-a-bank-deposit';
  throw new RailError('UNKNOWN_RAIL', 'unknown rail');
}

/** Build a signed settlement instruction. The unit is derived from the rail, never supplied. */
export function makeInstruction(agentKey, { instructionId, rail, amount, payer, payee, purpose = '', issuedAt }) {
  const unit = UNIT_OF(rail);
  if (!unit) throw new RailError('UNKNOWN_RAIL', 'unknown rail');
  if (typeof amount !== 'string' || !AMOUNT.test(amount)) throw new RailError('BAD_AMOUNT', 'amount must be a canonical integer string');
  const body = { ver: '30e-demo-settlement/1', instructionId, rail, unit, amount, payer, payee, purpose, issuedAt, agent: agentKey.pubHex };
  return { ...body, sig: sig(agentKey, body) };
}

/** Returns null when the instruction is acceptable, else a coded reason. Verified against a PINNED agent key. */
export function instructionProblem(instr, pinnedAgentPub) {
  if (!instr || typeof instr !== 'object' || Object.keys(instr).sort().join() !== [...KEYS].sort().join()) return 'SCHEMA';
  if (instr.ver !== '30e-demo-settlement/1') return 'SCHEMA';
  const unit = UNIT_OF(instr.rail);
  if (!unit) return 'UNKNOWN_RAIL';
  if (instr.unit !== unit) return 'UNIT_MISMATCH';
  if (typeof instr.amount !== 'string' || !AMOUNT.test(instr.amount) || instr.amount === '0') return 'BAD_AMOUNT';
  if (typeof instr.purpose !== 'string' || instr.purpose.length > 200) return 'SCHEMA';
  if (instr.agent !== pinnedAgentPub) return 'AGENT_NOT_PINNED';
  const { sig: s, ...body } = instr;
  if (!check(pinnedAgentPub, body, s)) return 'BAD_SIGNATURE';
  if (instr.rail === RAIL_CAD) { if (!/^[A-Z]{2,8}:[A-Za-z0-9_-]{1,40}$/.test(instr.payer) || !/^[A-Z]{2,8}:[A-Za-z0-9_-]{1,40}$/.test(instr.payee)) return 'ACCOUNT_SHAPE'; }
  else if (!/^0x[0-9a-f]{40}$/.test(instr.payer) || !/^0x[0-9a-f]{40}$/.test(instr.payee)) return 'ACCOUNT_SHAPE';
  return null;
}

/** Totals per rail. There is deliberately no method that adds across rails. */
export class RailBook {
  constructor() { this.byRail = new Map(); this.log = []; }
  record(rail, unit, amount, ref) {
    if (UNIT_OF(rail) !== unit) throw new RailError('UNIT_MISMATCH', 'unit does not belong to this rail');
    if (typeof amount !== 'string' || !AMOUNT.test(amount)) throw new RailError('BAD_AMOUNT', 'amount must be a canonical integer string');
    const e = this.byRail.get(rail) ?? { unit, total: 0n, count: 0, refs: new Set() };
    if (e.refs.has(ref)) throw new RailError('DUPLICATE_REF', 'already recorded');
    e.refs.add(ref); e.total += BigInt(amount); e.count += 1; this.byRail.set(rail, e);
    this.log.push({ rail, unit, amount, ref, finality: finalityLabel(rail), kind: kindOf(rail) });
  }
  /** Every recorded line, in order. Each carries its own rail, unit, finality label and kind. */
  lines() { return this.log.map((l) => ({ ...l })); }
  /** The total for ONE rail, in that rail's own unit. */
  totalFor(rail) {
    if (!UNIT_OF(rail)) throw new RailError('UNKNOWN_RAIL', 'unknown rail');
    const e = this.byRail.get(rail);
    return { rail, unit: UNIT_OF(rail), total: (e?.total ?? 0n).toString(), count: e?.count ?? 0, finality: finalityLabel(rail), kind: kindOf(rail) };
  }
  /** Reporting: one row per rail, never summed. */
  report() { return [...this.byRail.keys()].sort().map((r) => this.totalFor(r)); }
}

/** Refused by design: the two rails are not the same money and are never netted, summed or relabelled. */
export function convertBetweenRails() { throw new RailError('RAIL_MIX_REFUSED', 'rails are separate ledgers; no netting, summing or relabelling'); }

/**
 * Route one verified instruction to its rail.
 *  - depositx-cad: applied to the simulated DepositX network (cents -> BigInt).
 *  - wdk-usdt:*  : handed to `spendClient(instr)`, which asks the spend-authorization plane. Money moves only if the
 *                  plane authorizes AND a signer executes; the caller records the settlement when the chain says so.
 */
export async function routeInstruction({ instr, pinnedAgentPub, network, spendClient, book }) {
  const problem = instructionProblem(instr, pinnedAgentPub);
  if (problem) return { ok: false, code: problem };
  const finality = finalityLabel(instr.rail);
  if (instr.rail === RAIL_CAD) {
    if (!network) return { ok: false, code: 'NO_NETWORK' };
    let r;
    try { r = network.pay(instr.payer, instr.payee, BigInt(instr.amount), { instId: instr.instructionId }); } catch { return { ok: false, code: 'NETWORK_ERROR', rail: instr.rail }; }
    if (!r.ok) return { ok: false, code: r.error ?? 'REFUSED', rail: instr.rail, message: r.message };
    book.record(instr.rail, instr.unit, instr.amount, instr.instructionId);
    return { ok: true, rail: instr.rail, unit: instr.unit, amount: instr.amount, kind: kindOf(instr.rail), finality, height: r.height };
  }
  if (typeof spendClient !== 'function') return { ok: false, code: 'NO_SPEND_CLIENT', rail: instr.rail };
  const decision = await spendClient(instr);
  return { ok: decision?.verdict === 'ALLOW', rail: instr.rail, unit: instr.unit, amount: instr.amount, kind: kindOf(instr.rail), finality, decision };
}
