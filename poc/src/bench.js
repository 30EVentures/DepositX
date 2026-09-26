// Throughput benchmark for the kernel alone: pre-signed instructions, executed in blocks, with
// signature verification, atomic execution, the end-of-block invariant hook and the state root
// all included. It does NOT include consensus or network latency, so it is an upper bound for one
// validator's execution stage, not a claim about end-to-end finality.
import { Network, dollars } from './network.js';
import { Ledger } from './kernel.js';
import { performance } from 'node:perf_hooks';

export function bench({ n = 20000, blockSize = 500 } = {}) {
  const net = new Network({ bare: true });
  // fresh genesis network with accounts and float, built with the normal (verified) path
  net.bootstrap();
  for (const [i, c] of [['MPL', 'acme'], ['NSR', 'cedar'], ['LKS', 'elm'], ['LKS', 'fjord']]) for (let k = 0; k < 4; k++) net.mint(i, c, dollars(1_000_000));
  for (const i of ['MPL', 'NSR', 'LKS']) net.fund(i, dollars(20_000_000));
  const ledger = net.ledger;
  const pairs = [['LKS:elm', 'LKS:fjord'], ['LKS:fjord', 'LKS:elm']];
  const cross = [['MPL:acme', 'NSR:cedar'], ['NSR:cedar', 'MPL:acme'], ['LKS:elm', 'MPL:acme'], ['MPL:acme', 'LKS:fjord']];
  const txs = [];
  const t0 = performance.now();
  for (let k = 0; k < n; k++) {
    if (k % 10 < 7) {
      const [f, t] = pairs[k % 2];
      txs.push(net.tx('TRANSFER', { from: f, to: t, amount: '100' }, ['ops:LKS', 'screen:LKS']));
    } else {
      const [f, t] = cross[k % cross.length];
      const a = f.split(':')[0];
      const b = t.split(':')[0];
      txs.push(net.tx('PAYMENT', { from: f, to: t, amount: '100', queueIfShort: false }, [`ops:${a}`, `screen:${a}`, `accept:${b}`]));
    }
  }
  const signMs = performance.now() - t0;
  const time = Math.max(ledger.s.time, net.now());
  const blockMs = [];
  let accepted = 0;
  const t1 = performance.now();
  for (let i = 0; i < txs.length; i += blockSize) {
    const b0 = performance.now();
    const r = ledger.executeBlock({ txs: txs.slice(i, i + blockSize), time });
    blockMs.push(performance.now() - b0);
    for (const x of r.results) if (x.ok) accepted++;
  }
  const execMs = performance.now() - t1;
  const inv = ledger.checkInvariants(time);
  blockMs.sort((a, b) => a - b);
  void Ledger;
  return {
    instructions: n,
    accepted,
    blocks: blockMs.length,
    blockSize,
    mix: '70% same-bank transfers (2 signatures each), 30% cross-bank payments (3 signatures each, settlement positions move)',
    seconds: +(execMs / 1000).toFixed(3),
    instructionsPerSecond: Math.round(n / (execMs / 1000)),
    blockMsMedian: +blockMs[Math.floor(blockMs.length / 2)].toFixed(2),
    blockMsMax: +blockMs[blockMs.length - 1].toFixed(2),
    preSignSeconds: +(signMs / 1000).toFixed(2),
    invariantsHold: inv.violations.length === 0 && !ledger.s.halt,
    caveat: 'single process, single core, no consensus, no network, no disk. An upper bound on one validator\'s execution stage only.',
  };
}

if (process.argv[1] && process.argv[1].endsWith('bench.js')) console.log(JSON.stringify(bench({ n: Number(process.argv[2]) || 20000 }), null, 2));
