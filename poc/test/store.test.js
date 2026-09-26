import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Network, dollars } from '../src/network.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'concord-'));

test('crash recovery: reopening the data directory restores ledger, banks and clock exactly', () => {
  const dir = tmp();
  const a = new Network({ dataDir: dir });
  a.pay('MPL:acme', 'NSR:cedar', dollars(1234));
  a.dvp('MPL:harbour', 'NSR:pinnacle', 'CAN-2031', 7n, dollars(7000));
  a.redeem('LKS', 'elm', dollars(500));
  a.advance(30);
  const snap = a.snapshot();
  a.store.close(); // "crash"
  const b = new Network({ dataDir: dir });
  assert.equal(b.recovered.blocks, a.ledger.s.height);
  assert.equal(b.ledger.stateRoot(), a.ledger.stateRoot());
  assert.deepEqual(b.snapshot().issuers, snap.issuers, 'customers, deposits and tokens all match');
  assert.equal(b.clockOffset, 30);
  assert.equal(b.coreTasks.length, 0, 'no completed core posting is left in the backlog to be redone');
  const h0 = b.ledger.s.height;
  b.pumpCore();
  assert.equal(b.ledger.s.height, h0, 'recovery does not replay adapter follow-ups that already landed');
  // and it keeps working: the recovered network can settle new payments with the recovered keys
  assert.ok(b.pay('NSR:cedar', 'LKS:elm', dollars(10)).ok);
  assert.deepEqual(b.ledger.checkInvariants(b.ledger.s.time).violations, []);
  b.store.close();
});

test('a halt survives a restart, and so does the resume', () => {
  const dir = tmp();
  const a = new Network({ dataDir: dir });
  a.chaos('inflate');
  assert.ok(a.ledger.s.halt);
  a.store.close();
  const b = new Network({ dataDir: dir });
  assert.equal(b.ledger.s.halt?.reason, 'P1_CONSERVATION');
  b.chaos('repair');
  assert.ok(b.resume('network').ok);
  b.store.close();
  const c = new Network({ dataDir: dir });
  assert.equal(c.ledger.s.halt, null);
  assert.equal(c.ledger.stateRoot(), b.ledger.stateRoot());
  c.store.close();
});

test('a torn final write (crash mid-append) is discarded and the network still opens', () => {
  const dir = tmp();
  const a = new Network({ dataDir: dir });
  a.pay('MPL:acme', 'NSR:cedar', dollars(5));
  const root = a.ledger.stateRoot();
  a.store.close();
  fs.appendFileSync(path.join(dir, 'blocks.jsonl'), '{"time":17,"txs":[{"inst_id":"half-writ');
  const b = new Network({ dataDir: dir });
  assert.equal(b.ledger.stateRoot(), root);
  assert.ok(b.pay('MPL:acme', 'NSR:cedar', dollars(5)).ok);
  b.store.close();
  const c = new Network({ dataDir: dir }); // the truncated file is well-formed again
  assert.equal(c.ledger.stateRoot(), b.ledger.stateRoot());
  c.store.close();
});

test('tampering with history is detected on recovery: an edited amount, a dropped block or a swapped order', () => {
  const dir = tmp();
  const a = new Network({ dataDir: dir });
  a.pay('MPL:acme', 'NSR:cedar', dollars(100));
  a.store.close();
  const file = path.join(dir, 'blocks.jsonl');
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const idx = lines.findIndex((l) => l.includes('"type":"PAYMENT"'));
  assert.ok(idx > 0);

  const edited = [...lines];
  edited[idx] = edited[idx].replace('"amount":"10000"', '"amount":"90000"');
  fs.writeFileSync(file, edited.join('\n') + '\n');
  assert.throws(() => new Network({ dataDir: dir }), /STORE_CORRUPT/);

  fs.writeFileSync(file, lines.filter((_, i) => i !== idx).join('\n') + '\n');
  assert.throws(() => new Network({ dataDir: dir }), /STORE_CORRUPT/);

  const swapped = [...lines];
  [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
  fs.writeFileSync(file, swapped.join('\n') + '\n');
  assert.throws(() => new Network({ dataDir: dir }), /STORE_CORRUPT/);

  fs.writeFileSync(file, lines.join('\n') + '\n'); // restored: opens cleanly again
  const ok = new Network({ dataDir: dir });
  assert.equal(ok.ledger.s.height, lines.length);
  ok.store.close();
});

test('the dev keystore is private to the owner', () => {
  const dir = tmp();
  const a = new Network({ dataDir: dir });
  const mode = fs.statSync(path.join(dir, 'keys.json')).mode & 0o777;
  assert.equal(mode, 0o600);
  a.store.close();
});
