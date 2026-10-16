// Phase 1.7: rail separation as properties. Every ledger line carries its rail and its own unit, so a stablecoin amount
// can never be reported as a bank deposit; amounts are integer minor units (canonical strings, BigInt arithmetic);
// the two rails are never summed, netted or relabelled. Seeded generators, so a failure reproduces exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network } from '../../src/network.js';
import { RAIL_CAD, RailBook, RailError, UNIT_OF, describeRail, finalityLabel, keyFromSeedHex, makeInstruction, routeInstruction } from '../../src/flashy/rails.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const WDK = ['wdk-usdt:evm:31337', 'wdk-usdt:evm:84532', 'wdk-usdt:evm:43113'];
const RAILS = [RAIL_CAD, ...WDK];
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const canonAmount = (r) => { const len = 1 + Math.floor(r() * 18); let s = String(1 + Math.floor(r() * 9)); while (s.length < len) s += Math.floor(r() * 10); return s; };

test('every ledger line carries its rail, unit, amount, reference, finality label and kind', () => {
  const r = rng(1); const b = new RailBook(); const model = [];
  for (let i = 0; i < 300; i++) { const rail = pick(r, RAILS); const amount = canonAmount(r); b.record(rail, UNIT_OF(rail), amount, `ref-${i}`); model.push({ rail, unit: UNIT_OF(rail), amount, ref: `ref-${i}` }); }
  const lines = b.lines();
  assert.equal(lines.length, 300);
  lines.forEach((l, i) => {
    assert.deepEqual(Object.keys(l).sort(), ['amount', 'finality', 'kind', 'rail', 'ref', 'unit']);
    assert.deepEqual({ rail: l.rail, unit: l.unit, amount: l.amount, ref: l.ref }, model[i]);
    assert.equal(l.finality, finalityLabel(l.rail));
    assert.ok(l.finality === 'simulated' || l.finality === 'testnet');
  });
});

test('a stablecoin line is never described as a bank deposit, and a CAD line is described as simulated', () => {
  const r = rng(2); const b = new RailBook();
  for (let i = 0; i < 200; i++) { const rail = pick(r, RAILS); b.record(rail, UNIT_OF(rail), canonAmount(r), `r${i}`); }
  for (const l of b.lines()) {
    if (l.rail === RAIL_CAD) { assert.equal(l.kind, 'simulated-deposit-token'); assert.equal(l.unit, 'cad-cents'); assert.equal(l.finality, 'simulated'); }
    else { assert.equal(l.kind, 'testnet-stablecoin-not-a-bank-deposit'); assert.equal(l.unit, 'usdt-base6'); assert.doesNotMatch(l.kind, /^simulated-deposit/); }
  }
  assert.match(describeRail(WDK[0]), /not a bank deposit/i);
  assert.match(describeRail(RAIL_CAD), /simulated/i);
});

test('per-rail totals equal an independent BigInt sum of that rail\'s lines, and no total crosses rails', () => {
  for (const seed of [3, 4, 5, 6]) {
    const r = rng(seed); const b = new RailBook(); const sums = new Map();
    for (let i = 0; i < 250; i++) { const rail = pick(r, RAILS); const amt = canonAmount(r); b.record(rail, UNIT_OF(rail), amt, `r${i}`); sums.set(rail, (sums.get(rail) ?? 0n) + BigInt(amt)); }
    for (const rail of RAILS) assert.equal(b.totalFor(rail).total, (sums.get(rail) ?? 0n).toString(), `${rail} seed ${seed}`);
    const rep = b.report();
    assert.equal(rep.length, new Set(b.lines().map((l) => l.rail)).size);
    for (const row of rep) assert.deepEqual(Object.keys(row).sort(), ['count', 'finality', 'kind', 'rail', 'total', 'unit']);
    assert.equal(typeof b.total, 'undefined'); assert.equal(typeof b.grandTotal, 'undefined');
  }
});

test('amounts beyond 2^53 are exact (integer minor units are strings and BigInt, never floats)', () => {
  const b = new RailBook();
  b.record(WDK[0], 'usdt-base6', '9007199254740993', 'a'); b.record(WDK[0], 'usdt-base6', '9007199254740993', 'b');
  assert.equal(b.totalFor(WDK[0]).total, '18014398509481986');
  assert.equal(b.lines()[0].amount, '9007199254740993');
});

// ---- refusals: junk is refused, and a refusal leaves the book untouched ----
const junkAmounts = (r) => [
  () => String(1 + Math.floor(r() * 1000)) + '.5', () => '-' + canonAmount(r), () => '0' + canonAmount(r), () => canonAmount(r) + 'e2', () => canonAmount(r) + '.0',
  () => ' ' + canonAmount(r), () => canonAmount(r) + ' ', () => '', () => '+' + canonAmount(r), () => canonAmount(r) + 'n', () => '0x' + canonAmount(r),
  () => Number(canonAmount(r).slice(0, 9)), () => BigInt(canonAmount(r)), () => null, () => undefined, () => ({}), () => [canonAmount(r)], () => true, () => NaN, () => '１２３',
];
test('REFUSAL: 400 random non-canonical amounts are refused with BAD_AMOUNT and leave the book unchanged', () => {
  const r = rng(7); const gens = junkAmounts(r); const b = new RailBook(); b.record(RAIL_CAD, 'cad-cents', '5', 'seed');
  for (let i = 0; i < 400; i++) {
    const rail = pick(r, RAILS); const bad = pick(r, gens)();
    assert.throws(() => b.record(rail, UNIT_OF(rail), bad, `x${i}`), (e) => e instanceof RailError && e.code === 'BAD_AMOUNT', String(bad));
  }
  assert.equal(b.lines().length, 1);
  assert.equal(b.totalFor(RAIL_CAD).total, '5');
});
test('REFUSAL: 400 random wrong-unit or unknown-rail records are refused and leave the book unchanged', () => {
  const r = rng(8); const b = new RailBook();
  const units = ['cad-cents', 'usdt-base6', 'usd', 'cents', '', 'USDT', undefined, null];
  let refused = 0;
  for (let i = 0; i < 400; i++) {
    const rail = pick(r, [...RAILS, 'wdk-usdt', 'wdk-usdt:evm:1', 'wdk-usdt:evm:8453', 'usd', '', undefined]); const unit = pick(r, units);
    const ok = UNIT_OF(rail) === unit && UNIT_OF(rail) !== null;
    if (ok) { b.record(rail, unit, canonAmount(r), `ok${i}`); continue; }
    assert.throws(() => b.record(rail, unit, canonAmount(r), `no${i}`), (e) => e instanceof RailError && (e.code === 'UNIT_MISMATCH' || e.code === 'UNKNOWN_RAIL'));
    refused++;
  }
  assert.ok(refused > 250);
  assert.ok(b.lines().every((l) => UNIT_OF(l.rail) === l.unit));
});
test('REFUSAL: a repeated reference on a rail is refused; the same reference on the other rail is a different line', () => {
  const b = new RailBook();
  b.record(RAIL_CAD, 'cad-cents', '1', 'same'); b.record(WDK[0], 'usdt-base6', '1', 'same');
  assert.throws(() => b.record(RAIL_CAD, 'cad-cents', '2', 'same'), (e) => e.code === 'DUPLICATE_REF');
  assert.throws(() => b.record(WDK[0], 'usdt-base6', '2', 'same'), (e) => e.code === 'DUPLICATE_REF');
  assert.equal(b.lines().length, 2);
});

// ---- routing ----
const key = keyFromSeedHex('c3'.repeat(32));
const ADDR = (r) => '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');
test('a stablecoin instruction never touches the simulated network or the CAD book (60 random instructions)', async () => {
  const r = rng(9); const book = new RailBook(); let netCalls = 0; const network = { pay() { netCalls++; return { ok: true, height: 1 }; } };
  let allowed = 0;
  for (let i = 0; i < 60; i++) {
    const amount = canonAmount(r);
    const instr = makeInstruction(key, { instructionId: `wdk-${i}-aaaa`, rail: pick(r, WDK), amount, payer: ADDR(r), payee: ADDR(r), issuedAt: '2026-10-14T09:00:00Z' });
    const out = await routeInstruction({ instr, pinnedAgentPub: key.pubHex, network, book, spendClient: async () => ({ verdict: pick(r, ['ALLOW', 'DENY', 'ESCALATE']) }) });
    assert.equal(out.rail, instr.rail); assert.ok(['simulated', 'testnet'].includes(out.finality)); assert.equal(out.kind, 'testnet-stablecoin-not-a-bank-deposit');
    if (out.ok) allowed++;
  }
  assert.equal(netCalls, 0, 'the CAD network was never asked to move anything');
  assert.equal(book.totalFor(RAIL_CAD).total, '0'); assert.equal(book.lines().length, 0);
  assert.ok(allowed > 0 && allowed < 60);
});
test('a CAD instruction moves exactly its amount on the simulated network, in cents, and is recorded on the CAD rail only', async () => {
  const r = rng(10); const n = new Network(); const book = new RailBook();
  for (let i = 0; i < 25; i++) {
    const amount = String(100 + Math.floor(r() * 5000));
    const before = n.ledger.s.accounts.get('MPL:harbour').balance;
    const instr = makeInstruction(key, { instructionId: `cad-${i}-bbbb`, rail: RAIL_CAD, amount, payer: 'MPL:acme', payee: 'MPL:harbour', issuedAt: '2026-10-14T09:00:00Z' });
    const out = await routeInstruction({ instr, pinnedAgentPub: key.pubHex, network: n, book });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.unit, 'cad-cents'); assert.equal(out.amount, amount); assert.equal(out.kind, 'simulated-deposit-token');
    assert.equal(n.ledger.s.accounts.get('MPL:harbour').balance - before, BigInt(amount));
  }
  assert.equal(book.lines().length, 25); assert.ok(book.lines().every((l) => l.rail === RAIL_CAD));
  assert.equal(book.totalFor(WDK[0]).total, '0');
});
test('REFUSAL: a refused instruction records no line on any rail (random tampering, 200 cases)', async () => {
  const r = rng(11); const n = new Network(); const book = new RailBook();
  for (let i = 0; i < 200; i++) {
    const rail = pick(r, RAILS);
    const good = makeInstruction(key, { instructionId: `t-${i}-cccc`, rail, amount: canonAmount(r), payer: rail === RAIL_CAD ? 'MPL:acme' : ADDR(r), payee: rail === RAIL_CAD ? 'MPL:harbour' : ADDR(r), issuedAt: '2026-10-14T09:00:00Z' });
    const tweaks = [{ amount: '1' + good.amount }, { rail: pick(r, RAILS.filter((x) => x !== rail)) }, { unit: rail === RAIL_CAD ? 'usdt-base6' : 'cad-cents' }, { payer: 'nobody' }, { extra: 1 }, { sig: '00'.repeat(64) }, { agent: keyFromSeedHex('d4'.repeat(32)).pubHex }];
    const bad = { ...good, ...pick(r, tweaks) };
    const out = await routeInstruction({ instr: bad, pinnedAgentPub: key.pubHex, network: n, book, spendClient: async () => { throw new Error('must not be reached'); } });
    assert.equal(out.ok, false);
  }
  assert.equal(book.lines().length, 0);
});
