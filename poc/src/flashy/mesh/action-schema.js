// A closed schema for the demo action endpoint (POST /api/action): every kind, every field, with its type. Unknown
// kinds, unknown fields, missing fields and wrong types are refused before anything runs. It describes the actions the
// dashboard sends today (a test reads the dashboard source to prove it); it adds no new action.
const ISSUERS = ['MPL', 'NSR', 'LKS'];
const CHAOS = ['inflate', 'repair', 'core_restore', 'core_loss', 'reattest', 'fire_alarm', 'unbacked_mint', 'forged_sig', 'overdraft', 'replay', 'over_cap'];

// a trailing ? marks an optional field
const KINDS = {
  mint: { issuer: 'issuer', customer: 'id', amount: 'amount' },
  redeem: { issuer: 'issuer', customer: 'id', amount: 'amount' },
  pay: { from: 'acct', to: 'acct', amount: 'amount', 'queue?': 'bool' },
  dvp: { seller: 'acct', buyer: 'acct', qty: 'int', cash: 'amount' },
  fund: { issuer: 'issuer', amount: 'amount' },
  defund: { issuer: 'issuer', amount: 'amount' },
  net: {},
  resume: { scope: 'scope', 'issuer?': 'issuer' },
  chaos: { type: 'chaos', 'issuer?': 'issuer' },
  advance: { seconds: 'int' },
  corePause: { on: 'bool' },
  escrowLock: { escrowId: 'id', from: 'acct', to: 'acct', amount: 'amount', 'eventGated?': 'bool' },
  escrowRelease: { escrowId: 'id' },
  eventRelease: { escrowId: 'id' },
  escrowRefund: { escrowId: 'id' },
  registerSweep: { sweepId: 'id', from: 'acct', to: 'acct', keepAmount: 'amount' },
  cancelSweep: { sweepId: 'id' },
  batchDemo: { from1: 'acct', to1: 'acct', amount1: 'amount', from2: 'acct', to2: 'acct', amount2: 'amount' },
  batchEmpty: {},
  batchNested: { from1: 'acct', to1: 'acct', amount1: 'amount' },
  reset: {},
};
export const ACTION_KINDS = Object.freeze(Object.keys(KINDS));

const isStr = (v, max) => typeof v === 'string' && v.length >= 1 && v.length <= max;
const TYPE = {
  issuer: (v) => ISSUERS.includes(v),
  id: (v) => isStr(v, 40),
  acct: (v) => isStr(v, 64),
  amount: (v) => isStr(v, 24) || (typeof v === 'number' && Number.isFinite(v)),
  int: (v) => Number.isSafeInteger(v) || (typeof v === 'string' && /^[0-9]{1,12}$/.test(v)),
  bool: (v) => typeof v === 'boolean',
  scope: (v) => v === 'network' || v === 'issuer',
  chaos: (v) => CHAOS.includes(v),
};

/** @returns {string[]} problems; empty means the body is a well-formed action. Never throws. */
export function validateAction(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return ['NOT_AN_OBJECT'];
  const keys = Object.keys(body);
  if (typeof body.kind !== 'string' || !Object.hasOwn(KINDS, body.kind)) return ['UNKNOWN_KIND'];
  const spec = KINDS[body.kind];
  const problems = [];
  const names = new Set();
  for (const [raw, type] of Object.entries(spec)) {
    const optional = raw.endsWith('?');
    const name = optional ? raw.slice(0, -1) : raw;
    names.add(name);
    if (!Object.hasOwn(body, name) || body[name] === undefined) { if (!optional) problems.push(`MISSING:${name}`); continue; }
    if (!TYPE[type](body[name])) problems.push(`BAD_TYPE:${name}`);
  }
  for (const k of keys) if (k !== 'kind' && !names.has(k)) problems.push(`UNKNOWN_FIELD:${k}`);
  return problems;
}
