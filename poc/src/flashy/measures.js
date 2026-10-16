// The two numbers the charter publishes, computed from the replayable block log of the SIMULATED network.
//   replay     : retained blocks that replay (fresh ledger, from genesis) to the same block hash and state root
//   invariants : state invariant checks (P1, P2, P4, P5: four per block) that passed, from each block's recorded violations
// Read-only: it builds its own throwaway Ledger and never touches the live one. An empty denominator is null, never 100.
import { Ledger } from '../kernel.js';

export const CHECKED_INVARIANTS = Object.freeze(['P1', 'P2', 'P4', 'P5']);
export const INVARIANTS_PER_BLOCK = CHECKED_INVARIANTS.length;
const CHECKED = CHECKED_INVARIANTS;

const inconsistent = (why) => Object.assign(new Error(`INCONSISTENT: ${why}`), { code: 'INCONSISTENT' });

/** a/b as a decimal string with two places, integer arithmetic only, truncated; null when b is 0. */
export function percent(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < 0 || a > b) throw inconsistent('percent needs 0 <= a <= b, both whole numbers');
  if (b === 0) return null;
  const hundredths = Number((BigInt(a) * 10000n) / BigInt(b));
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
}

export function measuresFromBlocks({ genesis, log, blocks }) {
  if (!genesis || typeof genesis !== 'object' || !Array.isArray(genesis.issuers)) throw inconsistent('no genesis');
  if (!Array.isArray(log) || !Array.isArray(blocks)) throw inconsistent('log and blocks must be arrays');
  const offset = log.length - blocks.length;
  if (offset < 0) throw inconsistent('more recorded blocks than log entries');

  const ledger = new Ledger(genesis);
  let matched = 0;
  let broken = false; // once a replay step throws, nothing after it can be reproduced
  log.forEach((entry, i) => {
    let res = null;
    if (!broken) {
      try {
        res = ledger.executeBlock({ txs: entry.txs, time: entry.time });
      } catch {
        broken = true;
      }
    }
    if (i < offset) return;
    const rec = blocks[i - offset];
    if (res && rec && rec.header && res.hash === rec.hash && res.header.stateRoot === rec.header.stateRoot) matched += 1;
  });

  let failed = 0;
  for (const b of blocks) {
    const ids = new Set((Array.isArray(b && b.violations) ? b.violations : []).map((v) => v && v.id));
    failed += CHECKED.filter((id) => ids.has(id)).length;
  }
  const run = blocks.length * INVARIANTS_PER_BLOCK;
  const passed = run - failed;
  return {
    simulated: true,
    basis: 'replay of the simulated block log from genesis in a fresh ledger; proof of concept, consensus simulated in one process',
    retainedBlocks: blocks.length,
    replay: { matched, total: blocks.length, percent: percent(matched, blocks.length) },
    invariants: { passed, run, percent: percent(passed, run) },
  };
}

export const computeMeasures = (net) => measuresFromBlocks({ genesis: net.genesis, log: net.log, blocks: net.blocks });
