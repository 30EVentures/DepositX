# Invariant Charter (proof-of-concept edition)

The seven invariants of the Concord ledger kernel, stated precisely, with the code that enforces each and
the evidence that checks it. This is the PoC counterpart of the CTO memo's epic E0.2. The TLA+ version is
**not written**: no Java runtime is installed here, so nothing could be machine-checked. The Node model
checker (`src/modelcheck.js`) plays that role for now.

**Notation.** For issuer *i*: `S_i` token supply (sum of account balances); `M_i`/`B_i` cumulative minted/
burned; `In_i`/`Out_i` cumulative converted in/out; `L_i` last attested core control balance; `H_i` open
mint holds; `R_i` pending core debits (redemptions and convert-outs); `P_i` pending core credits
(convert-ins); `SP_i` settlement position; `A` anchor total.

| ID | Statement | Enforced in | On break | Checked by |
|---|---|---|---|---|
| **P1 Conservation** | `S_i = M_i − B_i + In_i − Out_i`, exactly | `checkInvariants`, every block | halt network | fuzz (every 25 ops), model check S1, mutation "double mint" |
| **P2 Backing** | `S_i ≤ L_i + P_i` (never over-issued) and `L_i + P_i − S_i = H_i + R_i` (the gap is exactly the enumerated in-flight items); nothing in flight older than 900 s | `checkInvariants`; `tx_OPEN_HOLD/MINT/REDEEM/CLOSE_*` maintain it | over-issuance: halt; unexplained gap or aged item: quarantine issuer; quarantine older than 900 s: halt | fuzz, model check S1/S4/L1, halt tests, mutation "core credit dropped" |
| **P3 Par transfer** | every cross-issuer instruction burns and mints the same amount and moves each settlement position by exactly that amount; no fee, rate or rounding in the kernel | `assertParLegs` | reject | cross-bank payment test, fuzz vs reference model |
| **P4 Settlement backing** | `SP_i ≥ 0` and `Σ SP_i = A − F` | `tx_PAYMENT` check, `checkInvariants` | reject / halt | model check S1, netting test, mutation "ignores position" |
| **P5 Non-negativity** | every balance `≥ 0` | `#debit`, `checkInvariants` | reject / halt | overdraft attack, fuzz |
| **P6 Authority** | mint needs the issuer's mint key AND a hold registered by its attestation key; debits need the payer issuer's key; payee issuer must accept; the operator can move no balance | `#sig` per handler | reject | forged/missing-signature tests, "operator cannot move a balance" test |
| **P7 Halt monotonicity** | once halted only `RESUME` (governance ×2 + observer, + issuer key for an issuer resume, and only if the invariants hold), `ATTEST` and `REPORT_PAR_BREAK` are accepted | `#execTx` gate, `tx_RESUME` | structural | halt/resume tests |

## Properties beyond the seven

| Property | Evidence |
|---|---|
| **Atomicity**: an instruction with any failing leg changes nothing | undo journal; DvP atomicity tests; model check S2; fuzz "rejected op changed state"; mutation "failed redeem leaves burn" |
| **Attacks are always refused and inert**: forged signature, replay, unbacked mint, overdraft, over-cap | model check S3 in every reachable state (not just the initial one) |
| **Liveness**: no reachable state is a dead end; draining the core always returns to a consistent state | model check L1 at every visited state |
| **Money is conserved** across core, ledger and anchor when the core is caught up | model check S5 |
| **Determinism / replay**: state is a pure function of genesis + block log | `verifyReplay`, block-by-block replay test, crash recovery test |
| **Tamper evidence**: an edited, dropped or reordered block fails recovery | `store.test.js` |
| **Idempotency**: a payment's UETR is its instruction id; a resubmission is a duplicate | `iso20022.test.js` (within the kernel's 180 s window; a production gateway needs its own persistent UETR table) |

## What is NOT checked (be honest about the bounds)

- The model checker is **bounded** (state cap and depth cap, small alphabet of $1/$2 amounts, two banks). It found no violation across 40,000 states / 377,678 transitions (depth 8) and is not a proof for all states.
- **Consensus** is simulated; safety under Byzantine validators is untested. Needs the real engine and fault injection (spikes S6, S7).
- **Timing attacks, resource exhaustion, key compromise** are out of scope for a single-process kernel.
- The kernel's Node implementation has not been audited. A Rust port with Verus/Kani proofs (spike S2) is the path to machine-checked guarantees.
- Amount arithmetic uses BigInt (no overflow); a fixed-width port must prove the absence of overflow.
- **Mutation testing is only four planted bugs.** It shows the checker can find *classes* of bug; it does not bound what it would miss.
