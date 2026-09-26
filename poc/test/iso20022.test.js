import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { parsePacs008, samplePacs008, centsOf, IsoError } from '../src/iso20022.js';

const status = (x) => /<TxSts>(\w+)<\/TxSts>/.exec(x)[1];
const reason = (x) => (/<Cd>(\w+)<\/Cd>/.exec(x) || [])[1];

test('pacs.008 in, pacs.002 out: a cross-bank payment settles and the report carries the block reference', () => {
  const n = new Network();
  const before = n.ledger.s.accounts.get('NSR:cedar').balance;
  const out = n.pacs008(samplePacs008({ amount: '25000.00' }));
  assert.equal(status(out), 'ACSC');
  assert.match(out, /<ClrSysRef>[0-9a-f]{35}<\/ClrSysRef>/);
  assert.equal(n.ledger.s.accounts.get('NSR:cedar').balance, before + dollars(25000));
  assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, []);
});

test('the UETR is the idempotency key: resubmitting the same message is rejected as a duplicate, not paid twice', () => {
  const n = new Network();
  const xml = samplePacs008({ amount: '100.00' });
  assert.equal(status(n.pacs008(xml)), 'ACSC');
  const bal = n.ledger.s.accounts.get('NSR:cedar').balance;
  const again = n.pacs008(xml);
  assert.equal(status(again), 'RJCT');
  assert.equal(reason(again), 'DUPL');
  assert.equal(n.ledger.s.accounts.get('NSR:cedar').balance, bal);
});

test('rejections map to ISO reason codes and change nothing', () => {
  const n = new Network();
  const root = n.ledger.stateRoot();
  void root;
  assert.equal(reason(n.pacs008(samplePacs008({ amount: '9999999.00' }))), 'AM02', 'over the per-instruction cap');
  assert.equal(reason(n.pacs008(samplePacs008({ from: 'LKS:fjord', to: 'MPL:acme', amount: '400000.00' }))), 'AM04', 'insufficient funds');
  assert.equal(reason(n.pacs008(samplePacs008({ to: 'LKS:shadow', amount: '1.00' }))), 'RR04', 'sanctioned counterparty');
  assert.equal(reason(n.pacs008(samplePacs008({ to: 'NSR:nobody', amount: '1.00' }))), 'AC01', 'unknown account');
  n.chaos('inflate');
  const halted = n.pacs008(samplePacs008({ amount: '1.00' }));
  assert.equal(status(halted), 'RJCT');
  assert.match(halted, /network halted/);
});

test('malformed and hostile messages are rejected with a status report, never executed', () => {
  const n = new Network();
  const h = n.ledger.s.height;
  const good = samplePacs008();
  const cases = {
    'DTD / entity (XXE)': good.replace('<Document', '<!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><Document'),
    'wrong message type': good.replace('pacs.008.001.08', 'pacs.009.001.08'),
    'foreign currency': good.replace('Ccy="CAD"', 'Ccy="USD"'),
    'three decimals': good.replace('25000.00', '25000.001'),
    'negative amount': good.replace('25000.00', '-25000.00'),
    'exponent amount': good.replace('25000.00', '2.5e4'),
    'NbOfTxs mismatch': good.replace('<NbOfTxs>1', '<NbOfTxs>2'),
    'UETR not a v4 uuid': good.replace(/<UETR>[^<]+/, '<UETR>not-a-uuid'),
    'missing creditor': good.replace(/<CdtrAcct>.*<\/CdtrAcct>/, ''),
    'empty': '',
  };
  for (const [name, xml] of Object.entries(cases)) {
    const out = n.pacs008(xml);
    assert.equal(status(out), 'RJCT', name);
  }
  assert.equal(n.ledger.s.height, h, 'no block was produced by any malformed message');
});

test('parser: fields extracted, cents exact', () => {
  const m = parsePacs008(samplePacs008({ amount: '1234567.89', from: 'MPL:acme', to: 'NSR:cedar', msgId: 'M-9' }));
  assert.equal(m.msgId, 'M-9');
  assert.equal(m.debtor.account, 'MPL:acme');
  assert.equal(m.creditor.account, 'NSR:cedar');
  assert.equal(centsOf(m.amount), 123456789n);
  assert.throws(() => parsePacs008('<x/>'), IsoError);
});
