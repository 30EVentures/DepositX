# Concord proof of concept

A working, runnable model of the Concord ledger kernel from `../02-technical-implementation.md`:
per-issuer deposit tokens, prefunded settlement positions, atomic cross-bank payment and DvP,
liquidity-saving netting, the seven par invariants (P1–P7), and the graded halt
(quarantine one issuer vs halt the network). Zero dependencies; Node 20+.

```
cd ~/Concord/poc
npm test            # 19 tests, incl. a 1,500-operation fuzz run against an independent reference model
npm start           # dashboard at http://127.0.0.1:8787
npm run bench       # kernel throughput
```

## What it demonstrates

| Spec claim | Where it is proven |
|---|---|
| Atomic: all legs or none | `kernel.js` undo journal; tests: failed DvP/payment leaves state byte-identical |
| No unbacked mint (two independent keys) | `tx_OPEN_HOLD` (attestation key) + `tx_MINT` (mint key); test + "Unbacked mint" button |
| Par transfer, settlement backing | `assertParLegs`, P3/P4; cross-bank payment moves tokens and positions 1:1 |
| Graded halt | `checkInvariants` + `#endOfBlock`: over-issuance and conservation breaks halt the network; core lag quarantines one issuer; quarantine escalates after 15 min |
| Restart is expensive (P7) | `tx_RESUME` needs both governance keys + BoC observer key (+ the issuer's key for an issuer resume) and the invariants must hold again |
| Anyone can pull the fire alarm | `tx_REPORT_PAR_BREAK` with any reconciler key |
| Netting | `tx_NET_CYCLE` gridlock resolution; mutual $5k payments net to zero on a $1k position |
| Deterministic, replayable | `verifyReplay()` rebuilds every block hash and state root from genesis; also detects out-of-band corruption |
| Offline-verifiable finality receipt | `Network.verifyReceipt`: header hash + ≥3 of 4 validator signatures |
| Screening enforced at the edge | bank compliance refuses to sign; the kernel refuses any instruction without the screening signature |

## What it is NOT

- **No consensus.** A four-validator quorum is simulated in one process (real Ed25519 signatures over the block hash; nothing ever disagrees). CometBFT / a real BFT engine is the next step.
- **Not the production stack.** The spec calls for a Rust kernel; this is Node so it runs anywhere today. The semantics are what matter; the port is mechanical.
- **No confidentiality** (mode M0, plain amounts), no ZK, no HSMs, no persistence, no network.
- **Toy core banking.** The bank simulator is a few dozen lines; real cores are the hard part (see the onboarding playbook).
- **Simplifications:** account IDs are readable (`MPL:acme`), not hashed commitments; one screening key per bank; the anchor is a mock; time is supplied per block.
- The benchmark measures one validator's execution stage on one core with everything signed and verified. It is an upper bound, not end-to-end finality.

## Files

- `src/kernel.js` — the state machine (pure, deterministic; no clock, randomness or I/O)
- `src/network.js` — banks, adapters, anchor, simulated validators, action layer, snapshots
- `src/bank.js` — toy core banking
- `src/server.js` + `public/index.html` — dashboard (binds to 127.0.0.1 only)
- `test/kernel.test.js` — the suite
