// Adapter: answers a third-party "agent spending policy" conformance case with the REAL DepositX
// delegation path, so a boundary-semantics cross-check can be run against our own kernel.
//
// What this is and is not
//   - It translates a case (an `envelope` plus a `spend`) into the closest DepositX objects: a GRANT
//     (per_instruction_max, window max_total, counterparties, not_after) and an agent-signed TRANSFER /
//     PAYMENT. Both are submitted through `Network.submitSigned`, so the verdict comes from the kernel's
//     own `#authorize`, never from a re-implementation here.
//   - It does NOT invent semantics for ideas DepositX does not have (chains, asset allowlists, a hard
//     per-transaction ceiling, swap/bridge kinds, address case-folding, an always-ask flag). For those it
//     returns `{ abstain: '<why>' }`, and the runner reports ABSTAINED. A guess would only manufacture
//     a fake agreement or a fake disagreement.
//   - The mapping is one-way and stated here so a reader can challenge it:
//       envelope.autoApproveMax -> grant.per_instruction_max   (the threshold above which a human is asked)
//       envelope.dailyMax       -> grant.window.max_total over 86400 s
//       envelope.destinations   -> grant.counterparties (each distinct address mapped to a distinct real account;
//                                  the payer's own account is added, because the kernel checks both ends)
//       envelope.kinds          -> grant.allow_types (only 'transfer' has a DepositX counterpart)
//       envelope.active:false   -> REVOKE_GRANT
//       usedToday               -> that many cents of real in-grant transfers replayed first
//       envelope.perTxMax       -> (nothing: a grant has no hard per-instruction ceiling above its escalation threshold)
//   - Verdict translation: accepted inside the envelope = ALLOW; ESCALATION_REQUIRED (needs the institution's
//     own ops signature as well) = ESCALATE; any other refusal = DENY.
//   - Amounts are minor units (cents) on both sides, so the corpus strings are passed through untouched.
//
// Test support only: nothing under src/ imports this.

import { Network } from '../../src/network.js';
import { genKey } from '../../src/crypto.js';

const ISSUER = 'MPL';
const FROM = 'MPL:acme';
// Distinct real accounts the adapter hands out to distinct destination strings, in order of first appearance.
// The first is same-issuer (TRANSFER); the rest are cross-issuer (PAYMENT).
const POOL = ['MPL:harbour', 'NSR:cedar', 'NSR:pinnacle', 'LKS:elm', 'LKS:fjord'];
const GID = 'pg-case';
const DAY = 86400;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const abstain = (reason) => ({ abstain: reason });

// Cases whose subject is a concept DepositX has no field for. Keyed by `<set>/<id>`; the reason is ours.
const NOT_MODELLED = {
  'envelope-shape/cap-is-a-number': 'subject is perTxMax; a DepositX grant has no hard per-instruction ceiling to validate',
  'envelope-shape/per-tx-above-daily': 'subject is the perTxMax/dailyMax relation; a DepositX grant has no perTxMax',
  'envelope-shape/ceiling-above-per-tx': 'subject is the autoApproveMax/perTxMax relation; a DepositX grant has no perTxMax',
  'envelope-shape/ceiling-equals-per-tx': 'subject is the autoApproveMax/perTxMax relation; a DepositX grant has no perTxMax',
};

// Kernel error code -> the closest code in the other vocabulary. Anything not listed passes through
// unchanged, so a code disagreement shows up as a disagreement rather than being papered over.
function translate(error, message = '') {
  switch (error) {
    case 'BAD_AMOUNT': return 'INVALID_AMOUNT';
    case 'UNKNOWN_ACCOUNT': return 'INVALID_RECORD'; // the adapter only ever sends a non-account for a missing/non-string destination
    case 'UNKNOWN_GRANT': return 'NO_ENVELOPE';
    case 'GRANT_REVOKED': return 'ENVELOPE_INACTIVE';
    case 'ENVELOPE_DENIED': return /may not touch/.test(message) ? 'DESTINATION_NOT_PERMITTED' : 'KIND_NOT_PERMITTED';
    default: return error;
  }
}

function grantPayload(env, accountOf, now) {
  const kinds = env.kinds;
  const allowTypes = Array.isArray(kinds) ? (kinds.includes('transfer') ? ['TRANSFER', 'PAYMENT'] : []) : kinds;
  const dests = Array.isArray(env.destinations) ? env.destinations : null;
  return {
    allow_types: allowTypes,
    per_instruction_max: env.autoApproveMax,
    window: { seconds: DAY, max_total: env.dailyMax },
    // the kernel checks every account an instruction touches, the payer's own included
    counterparties: dests && dests.length ? [...new Set([FROM, ...dests.map(accountOf)])] : null,
    not_after: now + DAY,
  };
}

function makeAccountMapper(addresses) {
  const seen = new Map();
  for (const a of addresses) if (typeof a === 'string' && !seen.has(a)) seen.set(a, POOL[seen.size]);
  return { accountOf: (a) => seen.get(a), overflow: seen.size > POOL.length || [...seen.values()].some((v) => v === undefined) };
}

function openGrant(n, env, accountOf) {
  const key = genKey();
  const payload = {
    grant_id: GID, issuer: ISSUER, agent_key: key.pub, label: 'corpus case', parent: null,
    ...grantPayload(env, accountOf, n.now()),
  };
  const r = n.submitSigned(n.tx('GRANT', payload, [`ops:${ISSUER}`]));
  if (r.ok) n.agentKeys[GID] = key;
  return r;
}

function agentSpend(n, to, amount, { key } = {}) {
  const cross = typeof to === 'string' && !to.startsWith(`${ISSUER}:`);
  const type = cross ? 'PAYMENT' : 'TRANSFER';
  const roles = [`agent:${GID}`, `screen:${ISSUER}`];
  if (cross) roles.push(`accept:${to.split(':')[0]}`);
  const opts = key ? { keyOverride: { [`agent:${GID}`]: key.priv } } : {};
  return n.submitSigned(n.tx(type, { from: FROM, to, amount }, roles, opts));
}

function verdictOf(r) {
  if (r.ok) return { verdict: 'ALLOW' };
  if (r.error === 'ESCALATION_REQUIRED') return { verdict: 'ESCALATE', codes: [r.error] };
  return { verdict: 'DENY', codes: [translate(r.error, r.message)] };
}

function decide(c) {
  const { input: spend, context = {} } = c;
  const env = context.envelope;
  if (!isObj(spend)) return abstain('the adapter turns a spend object into an instruction; a non-object has nothing to translate');
  if (spend.kind !== 'transfer') return abstain(`kind ${JSON.stringify(spend.kind)}: only transfer has a DepositX counterpart (no swap, bridge, or open kind vocabulary)`);
  if (env !== null && env !== undefined && spend.chain !== env.chain) return abstain('DepositX is one ledger with no chain selector, so a chain mismatch or malformed chain id cannot be expressed');
  if (spend.asset !== 'native') return abstain('DepositX has one asset (CAD deposit tokens) and no asset allowlist; an asset other than the default cannot be expressed');
  if (env && env.alwaysEscalate) return abstain('a grant has no ask-every-time flag (per_instruction_max must be positive); the closest is having the institution sign directly');

  const allow = isObj(env) && Array.isArray(env.destinations) ? env.destinations : [];
  if (typeof spend.destination === 'string' && !allow.includes(spend.destination) && allow.some((a) => typeof a === 'string' && a.toLowerCase() === spend.destination.toLowerCase())) {
    return abstain('whether two address spellings are one account is the adapter address book\'s call, not the kernel\'s (DepositX counterparties are exact account ids), so a case-folding rule cannot be answered by the kernel');
  }

  const n = new Network();
  const { accountOf, overflow } = makeAccountMapper([...(isObj(env) && Array.isArray(env.destinations) ? env.destinations : []), spend.destination]);
  if (overflow) return abstain('more distinct destinations than the adapter has real accounts to map them onto');
  const to = typeof spend.destination === 'string' ? accountOf(spend.destination) : spend.destination; // null stays null: the kernel decides

  if (env === null || env === undefined) {
    // No envelope exists: submit under a grant id that was never created.
    return verdictOf(agentSpend(n, to ?? POOL[0], spend.amount, { key: genKey() }));
  }

  const g = openGrant(n, env, accountOf);
  if (!g.ok) return abstain(`the envelope itself cannot be a DepositX grant (${g.error}: ${g.message})`);

  let used = BigInt(context.usedToday ?? '0');
  const per = BigInt(env.autoApproveMax);
  if (used > 0n && per <= 0n) return abstain('cannot replay usedToday under a non-positive per-instruction max');
  const replayTo = Array.isArray(env.destinations) && env.destinations.length ? accountOf(env.destinations[0]) : POOL[0];
  while (used > 0n) {
    const chunk = used > per ? per : used;
    const r = agentSpend(n, replayTo, chunk.toString());
    if (!r.ok) return abstain(`could not reproduce usedToday with real in-grant spends (${r.error})`);
    used -= chunk;
  }
  if (env.active === false) {
    const rv = n.revokeGrant(GID);
    if (!rv.ok) return abstain(`could not revoke the grant (${rv.error})`);
  }
  return verdictOf(agentSpend(n, to, spend.amount));
}

function validate(c) {
  const key = `${c.set}/${c.id}`;
  if (NOT_MODELLED[key]) return abstain(NOT_MODELLED[key]);
  const env = c.input;
  if (!isObj(env)) return abstain('a grant is built from fields; a non-object envelope has nothing to translate');
  if (typeof env.chain !== 'string') return abstain('a DepositX grant has no chain field, so a missing chain cannot be expressed');
  const n = new Network();
  const { accountOf } = makeAccountMapper(Array.isArray(env.destinations) ? env.destinations : []);
  const g = openGrant(n, env, accountOf);
  return g.ok ? { valid: true } : { valid: false, codes: [g.error] };
}

/** One case in, one answer out: { verdict, codes? } | { valid, codes? } | { abstain }. Throws on a bug. */
export function answerCase(c, setKind) {
  return setKind === 'validate' ? validate(c) : decide(c);
}
