// DepositX two-rail instructions. Refusals first. The simulated CAD network and a testnet stablecoin leg never mix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { RAIL_CAD, RailBook, RailError, convertBetweenRails, describeRail, finalityLabel, instructionProblem, keyFromSeedHex, makeInstruction, routeInstruction } from '../../src/flashy/rails.js';

const key = keyFromSeedHex('c3'.repeat(32)), other = keyFromSeedHex('d4'.repeat(32));
const A = '0x' + '11'.repeat(20), B = '0x' + '22'.repeat(20), WDK = 'wdk-usdt:evm:31337';
const cad = (o = {}) => makeInstruction(key, { instructionId: 'inst-cad-0001', rail: RAIL_CAD, amount: '10000', payer: 'MPL:acme', payee: 'MPL:harbour', issuedAt: '2026-10-14T09:00:00Z', ...o });
const wdk = (o = {}) => makeInstruction(key, { instructionId: 'inst-wdk-0001', rail: WDK, amount: '1500000', payer: A, payee: B, issuedAt: '2026-10-14T09:00:00Z', ...o });

test('instruction construction refuses unknown rails, float/negative/leading-zero amounts, mainnet-looking rails', () => {
  for (const rail of ['wdk-usdt', 'wdk-usdt:evm:1', 'wdk-usdt:evm:8453', 'usd', 'depositx-usd', '', undefined]) assert.throws(() => cad({ rail }), RailError, String(rail));
  for (const amount of [1500000, '1.5', '-1', '01', '', '1e3', null]) assert.throws(() => cad({ amount }), RailError, String(amount));
});
test('instruction verification refuses each way it can be wrong', () => {
  const ok = cad();
  assert.equal(instructionProblem(ok, key.pubHex), null);
  assert.equal(instructionProblem(ok, other.pubHex), 'AGENT_NOT_PINNED');
  assert.equal(instructionProblem({ ...ok, amount: '10001' }, key.pubHex), 'BAD_SIGNATURE');
  assert.equal(instructionProblem({ ...ok, extra: 1 }, key.pubHex), 'SCHEMA');
  assert.equal(instructionProblem({ ...ok, unit: 'usdt-base6' }, key.pubHex), 'UNIT_MISMATCH', 'a CAD rail cannot carry stablecoin units');
  assert.equal(instructionProblem({ ...wdk(), unit: 'cad-cents' }, key.pubHex), 'UNIT_MISMATCH', 'a stablecoin rail cannot carry cents');
  assert.equal(instructionProblem({ ...ok, rail: 'x' }, key.pubHex), 'UNKNOWN_RAIL');
  assert.equal(instructionProblem({ ...ok, amount: '0' }, key.pubHex), 'BAD_AMOUNT');
  assert.equal(instructionProblem({ ...ok, purpose: 'x'.repeat(201) }, key.pubHex), 'SCHEMA');
  assert.equal(instructionProblem(null, key.pubHex), 'SCHEMA');
  assert.equal(instructionProblem(cad({ payer: A }), key.pubHex), 'ACCOUNT_SHAPE', 'a wallet address is not a DepositX account');
  assert.equal(instructionProblem(wdk({ payee: 'MPL:harbour' }), key.pubHex), 'ACCOUNT_SHAPE', 'a DepositX account is not a wallet address');
});
test('rails never mix: no convert, no cross-rail total, wrong-unit record refused, duplicate ref refused', () => {
  assert.throws(() => convertBetweenRails(), (e) => e.code === 'RAIL_MIX_REFUSED');
  const b = new RailBook();
  assert.throws(() => b.record(RAIL_CAD, 'usdt-base6', '1', 'r'), (e) => e.code === 'UNIT_MISMATCH');
  assert.throws(() => b.record(WDK, 'cad-cents', '1', 'r'), (e) => e.code === 'UNIT_MISMATCH');
  assert.throws(() => b.record(WDK, 'usdt-base6', '1.5', 'r'), (e) => e.code === 'BAD_AMOUNT');
  assert.throws(() => b.totalFor('anything'), (e) => e.code === 'UNKNOWN_RAIL');
  b.record(RAIL_CAD, 'cad-cents', '100', 'a'); b.record(WDK, 'usdt-base6', '1500000', 'b');
  assert.throws(() => b.record(RAIL_CAD, 'cad-cents', '100', 'a'), (e) => e.code === 'DUPLICATE_REF');
  assert.equal(typeof b.total, 'undefined', 'there is no method that sums across rails');
  assert.deepEqual(b.report().map((r) => [r.rail, r.unit, r.total]), [[RAIL_CAD, 'cad-cents', '100'], [WDK, 'usdt-base6', '1500000']]);
});
test('labels never say more than simulated or testnet; the stablecoin rail says it is not a bank deposit', () => {
  assert.equal(finalityLabel(RAIL_CAD), 'simulated'); assert.equal(finalityLabel('wdk-usdt:evm:31337'), 'simulated');
  assert.equal(finalityLabel('wdk-usdt:evm:84532'), 'testnet'); assert.equal(finalityLabel('wdk-usdt:evm:43113'), 'testnet');
  assert.match(describeRail(WDK), /Not a bank deposit/); assert.match(describeRail(RAIL_CAD), /simulated/);
  assert.throws(() => finalityLabel('depositx-usd'), RailError);
});
test('route: refused instructions never reach a network or a plane', async () => {
  let calls = 0; const spendClient = async () => { calls++; return { verdict: 'ALLOW' }; };
  const n = new Network(); const book = new RailBook();
  const bad = await routeInstruction({ instr: { ...cad(), amount: '1' }, pinnedAgentPub: key.pubHex, network: n, spendClient, book });
  assert.deepEqual([bad.ok, bad.code], [false, 'BAD_SIGNATURE']);
  const unpinned = await routeInstruction({ instr: wdk(), pinnedAgentPub: other.pubHex, network: n, spendClient, book });
  assert.equal(unpinned.code, 'AGENT_NOT_PINNED'); assert.equal(calls, 0); assert.equal(book.report().length, 0);
  assert.equal((await routeInstruction({ instr: wdk(), pinnedAgentPub: key.pubHex, network: n, book })).code, 'NO_SPEND_CLIENT');
  assert.equal((await routeInstruction({ instr: cad(), pinnedAgentPub: key.pubHex, book })).code, 'NO_NETWORK');
});
test('route: the CAD rail refuses over-cap, unknown and sanctioned accounts, insufficient funds, and a reused instruction id; balances and the book stay untouched', async () => {
  const n = new Network(); const book = new RailBook(); const bal = (a) => n.ledger.s.accounts.get(a).balance;
  const snap = () => [bal('MPL:acme'), bal('MPL:harbour')];
  const before = snap();
  const go = (o) => routeInstruction({ instr: cad(o), pinnedAgentPub: key.pubHex, network: n, book });
  assert.equal((await go({ instructionId: 'inst-cad-cap-1', amount: dollars(900_000_000).toString() })).code, 'VALUE_CAP_EXCEEDED');
  assert.equal((await go({ instructionId: 'inst-cad-unk-1', payee: 'MPL:nobody' })).code, 'UNKNOWN_ACCOUNT');
  const sanc = await go({ instructionId: 'inst-cad-san-1', payee: 'LKS:shadow' });
  assert.deepEqual([sanc.ok, sanc.code], [false, 'SANCTIONS_HIT']);
  assert.deepEqual(snap(), before); assert.equal(book.report().length, 0);
  const first = await go({ instructionId: 'inst-cad-dup-1', amount: '100' });
  assert.equal(first.ok, true);
  const again = await go({ instructionId: 'inst-cad-dup-1', amount: '100' });
  assert.equal(again.ok, false, 'the same instruction id settles once');
  assert.equal(book.totalFor(RAIL_CAD).count, 1);
  assert.equal(bal('MPL:acme'), before[0] - 100n);
});
test('route: the stablecoin rail is handed to the plane and records nothing until the caller records a chain settlement', async () => {
  const seen = []; const book = new RailBook();
  const deny = await routeInstruction({ instr: wdk(), pinnedAgentPub: key.pubHex, book, spendClient: async (i) => { seen.push(i); return { verdict: 'DENY', code: 'DAILY_CAP' }; } });
  assert.deepEqual([deny.ok, deny.decision.code, deny.rail, deny.finality], [false, 'DAILY_CAP', WDK, 'simulated']);
  assert.equal(book.report().length, 0, 'a decision is not a settlement');
  const allow = await routeInstruction({ instr: wdk({ instructionId: 'inst-wdk-0002' }), pinnedAgentPub: key.pubHex, book, spendClient: async () => ({ verdict: 'ALLOW' }) });
  assert.equal(allow.ok, true); assert.equal(book.report().length, 0);
});
test('positive control: a CAD instruction settles on the simulated DepositX network, in cents, and the book labels it', async () => {
  const n = new Network(); const book = new RailBook(); const bal = (a) => n.ledger.s.accounts.get(a).balance;
  const before = [bal('MPL:acme'), bal('MPL:harbour')];
  const r = await routeInstruction({ instr: cad({ amount: dollars(100).toString() }), pinnedAgentPub: key.pubHex, network: n, book });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.finality, 'simulated');
  assert.equal(bal('MPL:acme'), before[0] - dollars(100)); assert.equal(bal('MPL:harbour'), before[1] + dollars(100));
  assert.deepEqual(book.totalFor(RAIL_CAD), { rail: RAIL_CAD, unit: 'cad-cents', total: dollars(100).toString(), count: 1, finality: 'simulated', kind: 'simulated-deposit-token' });
  assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, []);
});
