// The published charter must be checkable against the code: two roles, each with one measure that the code computes
// from the replayable block log, capabilities that the code actually has, and wording that stays inside "simulated,
// proof of concept, no bank partner, not regulated, not final, not live". The structural rules below mirror the public
// AAO 0.1 schema (checked separately, offline, with the published validator; see flashy/mesh/READINESS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Network, dollars } from '../../src/network.js';
import { computeMeasures, CHECKED_INVARIANTS, INVARIANTS_PER_BLOCK } from '../../src/flashy/measures.js';
import { CHARTER_FILE } from '../../src/flashy/mesh/surface.js';

const charter = () => JSON.parse(fs.readFileSync(CHARTER_FILE, 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FAMILIES = ['growth', 'revenue', 'product', 'engineering', 'operations', 'data', 'finance', 'risk', 'governance', 'support'];
const TOP = ['aao', 'name', 'slug', 'description', 'accountableTo', 'escalation', 'roles', 'network', 'repositories'];
const CLAIM_WORDS = /\b(regulated|final|live|production|licensed|insured|approved|guaranteed|finality)\b/gi;
const NEGATIONS = /\b(not|no|never|nothing|nor)\b/i;

/** @returns {string[]} problems */
function problems(doc) {
  const out = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['NOT_AN_OBJECT'];
  for (const k of Object.keys(doc)) if (!TOP.includes(k) && !k.startsWith('x-')) out.push(`UNKNOWN_KEY:${k}`);
  if (doc.aao !== '0.1') out.push('BAD_VERSION');
  for (const k of ['name', 'description']) if (typeof doc[k] !== 'string' || !doc[k].trim()) out.push(`MISSING:${k}`);
  if (typeof doc.slug !== 'string' || !SLUG.test(doc.slug)) out.push('BAD_SLUG');
  if (typeof doc.accountableTo !== 'string' || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(doc.accountableTo) || /example\.(com|org)$/.test(doc.accountableTo)) out.push('BAD_ACCOUNTABLE');
  if (!Array.isArray(doc.roles) || doc.roles.length < 1) { out.push('NO_ROLES'); return out; }
  const names = new Set();
  for (const r of doc.roles) {
    if (typeof r.name !== 'string' || !SLUG.test(r.name) || r.name.length < 3 || r.name.length > 24 || r.name.split('-').length > 3) out.push(`BAD_ROLE_NAME:${r.name}`);
    if (names.has(r.name)) out.push(`DUPLICATE_ROLE:${r.name}`);
    names.add(r.name);
    if (!FAMILIES.includes(r.family)) out.push(`BAD_FAMILY:${r.name}`);
    if (typeof r.purpose !== 'string' || !r.purpose.trim()) out.push(`NO_PURPOSE:${r.name}`);
    if (typeof r.measure !== 'string' || !r.measure.trim()) out.push(`NO_MEASURE:${r.name}`);
    if (!Array.isArray(r.capabilities) || r.capabilities.length < 1 || r.capabilities.some((c) => typeof c !== 'string' || !c.trim())) out.push(`BAD_CAPABILITIES:${r.name}`);
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(r.humanApprovalAtOrAbove)) out.push(`BAD_APPROVAL:${r.name}`);
  }
  if (typeof doc.escalation !== 'string' || !names.has(doc.escalation)) out.push('ESCALATION_NOT_A_ROLE');
  if (doc.network) {
    for (const o of doc.network.offers || []) if (!names.has(o)) out.push(`OFFER_NOT_A_ROLE:${o}`);
    if ('wants' in doc.network) out.push('WANTS_NOT_DECIDED'); // a public ask for partners is the owner's decision, not made here
  }
  // wording: it must say what it is, and never claim more
  // the description itself must carry the whole disclaimer; each role must say it is about the simulated network
  const desc = typeof doc.description === 'string' ? doc.description : '';
  for (const must of [/simulated/i, /proof[- ]of[- ]concept/i, /no bank partner/i, /not regulated/i, /not final/i, /not live/i]) if (!must.test(desc)) out.push(`WORDING_MISSING:${must.source}`);
  for (const r of doc.roles) if (!/simulated/i.test(`${r.purpose} ${r.measure}`)) out.push(`ROLE_NOT_LABELLED_SIMULATED:${r.name}`);
  // a claim word needs a negation within six words earlier IN THE SAME SENTENCE
  const text = JSON.stringify(doc, null, 0);
  for (const m of text.matchAll(CLAIM_WORDS)) {
    const sentence = text.slice(0, m.index).split(/[.;]/).pop();
    if (!NEGATIONS.test(sentence.trim().split(/\s+/).slice(-6).join(' '))) out.push(`UNQUALIFIED_CLAIM:${m[0]}`);
  }
  return out;
}

test('the charter passes the structural rules and the wording rules', () => {
  assert.deepEqual(problems(charter()), []);
});

test('it declares exactly the two roles, escalates to the settlement role, and offers only that role', () => {
  const c = charter();
  assert.deepEqual(c.roles.map((r) => r.name), ['settlement-model', 'risk-control']);
  assert.equal(c.escalation, 'settlement-model');
  assert.deepEqual(c.network, { offers: ['settlement-model'] });
  assert.equal(c.accountableTo, '30eventures@gmail.com');
});

test('each published measure is computed by the code, from the block log, and the charter names exactly what is computed', () => {
  const c = charter();
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  const m = computeMeasures(n);
  const settle = c.roles.find((r) => r.name === 'settlement-model').measure;
  const risk = c.roles.find((r) => r.name === 'risk-control').measure;
  assert.match(settle, /replay/i); assert.match(settle, /block hash/i); assert.match(settle, /state root/i); assert.match(settle, /retained simulated blocks/i);
  assert.ok(Number.isInteger(m.replay.matched) && Number.isInteger(m.replay.total));
  for (const id of CHECKED_INVARIANTS) assert.ok(risk.includes(id), `the risk measure names ${id}`);
  assert.equal(risk.match(/P\d/g).length, CHECKED_INVARIANTS.length, 'and names no invariant the code does not check');
  assert.equal(INVARIANTS_PER_BLOCK, CHECKED_INVARIANTS.length);
  assert.ok(Number.isInteger(m.invariants.passed) && Number.isInteger(m.invariants.run));
});

test('the capabilities are things the network really does: simulate, replay, monitor, halt', () => {
  const c = charter();
  const caps = Object.fromEntries(c.roles.map((r) => [r.name, r.capabilities]));
  assert.deepEqual(caps['settlement-model'], ['simulate', 'replay']);
  assert.deepEqual(caps['risk-control'], ['monitor', 'halt']);
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  assert.equal(n.verifyReplay().ok, true, 'replay');
  assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, [], 'monitor');
  n.chaos('core_loss');
  assert.ok(n.ledger.s.halt, 'halt');
});

test('the purposes say what the code does and no more: halts and quarantines at the end of a block; structural rules refuse', () => {
  const p = charter().roles.find((r) => r.name === 'risk-control').purpose;
  assert.match(p, /end of every simulated block/);
  assert.match(p, /halts the simulated network, or quarantines one issuer/);
  assert.match(p, /structural rules/);
});

const MUTANTS = {
  'role name with capitals': (c) => { c.roles[0].name = 'Settlement Model'; },
  'role name too long': (c) => { c.roles[0].name = 'a-very-long-role-name-indeed'; },
  'four-word role name': (c) => { c.roles[1].name = 'risk-control-and-more'; },
  'unknown family': (c) => { c.roles[0].family = 'magic'; },
  'duplicate role': (c) => { c.roles[1].name = 'settlement-model'; },
  'escalation to a role that does not exist': (c) => { c.escalation = 'nobody'; },
  'offer that is not a role': (c) => { c.network.offers = ['settlement-model', 'lending']; },
  'unknown top-level key': (c) => { c.extra = 1; },
  'placeholder accountable email': (c) => { c.accountableTo = 'you@example.com'; },
  'no accountable email': (c) => { delete c.accountableTo; },
  'blank description': (c) => { c.description = '  '; },
  'measure removed': (c) => { delete c.roles[0].measure; },
  'capability list emptied': (c) => { c.roles[1].capabilities = []; },
  'approval level invented': (c) => { c.roles[0].humanApprovalAtOrAbove = 'NONE'; },
  'a public ask for partner banks': (c) => { c.network.wants = ['design-partner-banks']; },
  'description drops the simulated label': (c) => { c.description = c.description.replace(/simulated/gi, 'distributed'); },
  'description drops "no bank partner"': (c) => { c.description = c.description.replace('there is no bank partner', 'banks are coming'); },
  'description claims it is live': (c) => { c.description += ' It is live.'; },
  'purpose claims a regulated network': (c) => { c.roles[0].purpose += ' Runs a regulated settlement network.'; },
  'measure claims final settlement': (c) => { c.roles[0].measure += ', settled with finality and final in law'; },
  'purpose claims approval': (c) => { c.roles[1].purpose += ' Approved by the central bank.'; },
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  test(`REFUSAL: ${name}`, () => {
    const c = clone(charter()); mutate(c);
    assert.ok(problems(c).length > 0, name);
  });
}
test('REFUSAL: non-documents are refused', () => {
  for (const v of [null, undefined, 5, 'x', [], {}]) assert.ok(problems(v).length > 0);
});
test('the old draft file is gone; the charter has one canonical name', () => {
  assert.equal(fs.existsSync(CHARTER_FILE.replace('flashyos-charter.json', 'flashyos-charter.draft.json')), false);
});
