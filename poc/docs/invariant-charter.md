# Invariant Charter (proof-of-concept edition)

The seven invariants of the DepositX ledger kernel, stated precisely, with the code that enforces each and
the evidence that checks it. This is the PoC counterpart of the CTO memo's epic E0.2. The TLA+ version is
**not written**: no Java runtime is installed here, so nothing could be machine-checked. The Node model
checker (`src/modelcheck.js`) plays that role for now.

Why this document exists in this form: an invariant a human has to trust a UI to believe in isn't really
an invariant. Every row below is checkable by re-running the code cited in "Checked by," independent of
the dashboard, of who's asking, and of whether the asker is a person or another program — that's the
actual point of a machine-verifiable charter, not a nicety.

**Notation.** For issuer *i*: `S_i` token supply (sum of account balances); `M_i`/`B_i` cumulative minted/
burned; `In_i`/`Out_i` cumulative converted in/out; `L_i` last attested core control balance; `H_i` open
mint holds; `R_i` pending core debits (redemptions and convert-outs); `P_i` pending core credits
(convert-ins); `SP_i` settlement position; `A` anchor total.

| ID | Statement | Enforced in | On break | Checked by |
|---|---|---|---|---|
| **P1 Conservation** | `S_i = M_i − B_i + In_i − Out_i`, exactly | `checkInvariants`, every block | halt network | fuzz (every 25 ops), model check S1, mutation "double mint", mutation "escrow release prints money" |
| **P2 Backing** | `S_i ≤ L_i + P_i` (never over-issued) and `L_i + P_i − S_i = H_i + R_i` (the gap is exactly the enumerated in-flight items); nothing in flight older than 900 s | `checkInvariants`; `tx_OPEN_HOLD/MINT/REDEEM/CLOSE_*` maintain it | over-issuance: halt; unexplained gap or aged item: quarantine issuer; quarantine older than 900 s: halt | fuzz, model check S1/S4/L1, halt tests, mutation "core credit dropped" |
| **P3 Par transfer** | every cross-issuer instruction burns and mints the same amount and moves each settlement position by exactly that amount; no fee, rate or rounding in the kernel | `assertParLegs` (Transfer/Payment/DvP legs; Escrow's lock/refund reuse the same `#moveCash` path, so they are proven by the same code, not a parallel implementation) | reject | cross-bank payment test, fuzz vs reference model |
| **P4 Settlement backing** | `SP_i ≥ 0` and `Σ SP_i = A − F` | `tx_PAYMENT` check, `checkInvariants` | reject / halt | model check S1, netting test, mutation "ignores position" |
| **P5 Non-negativity** | every balance `≥ 0` | `#debit`, `checkInvariants` | reject / halt | overdraft attack, fuzz |
| **P6 Authority** | mint needs the issuer's mint key AND a hold registered by its attestation key; debits need the payer issuer's key **or a live grant's agent key, inside the grant's envelope**; payee issuer must accept; the operator can move no balance; a grant can only narrow its parent and is dead if any ancestor is revoked or expired | `#sig` per handler; `#authorize` for grantable handlers | reject | forged/missing-signature tests, "operator cannot move a balance" test, `delegation.test.js`, model check S6 and four planted delegation bugs |
| **P7 Halt monotonicity** | once halted only `RESUME` (governance ×2 + observer, + issuer key for an issuer resume, and only if the invariants hold), `ATTEST` and `REPORT_PAR_BREAK` are accepted | `#execTx` gate, `tx_RESUME` | structural | halt/resume tests |

## Properties beyond the seven

| Property | Evidence |
|---|---|
| **Atomicity**: an instruction with any failing leg changes nothing | undo journal; DvP atomicity tests; Batch tests (2-5 legs; a failing first or last leg rolls back the rest); model check S2; fuzz "rejected op changed state"; mutation "failed redeem leaves burn"; mutation "batch: an earlier leg is not rolled back" |
| **Attacks are always refused and inert**: forged signature, replay, unbacked mint, overdraft, over-cap, release under the wrong PayOnEvent oracle | model check S3 in every reachable state (not just the initial one) |
| **Liveness**: no reachable state is a dead end; draining the core always returns to a consistent state | model check L1 at every visited state |
| **Money is conserved** across core, ledger and anchor when the core is caught up | model check S5 |
| **Determinism / replay**: state is a pure function of genesis + block log, including Escrow, Sweep and Batch state | `verifyReplay`, block-by-block replay test, crash recovery test, sweep durable-recovery test |
| **Tamper evidence**: an edited, dropped or reordered block fails recovery | `store.test.js` |
| **Idempotency**: a payment's UETR is its instruction id; a resubmission is a duplicate; a Batch leg cannot be replayed by wrapping it in a fresh outer batch | `iso20022.test.js` (within the kernel's 180 s window; a production gateway needs its own persistent UETR table); `batch.test.js` |

## Roadmap 1.1-1.4: how the four new templates fit the existing invariants (2026-09-27)

Escrow (T4), PayOnEvent (T5), Batch (T7) and Standing/Sweep (T6) were added without any new
conservation formula:

- **Escrow/PayOnEvent** move money by calling the *same* `#moveCash` that Transfer, Payment and
  DvP already call, into a regular ledger account under a reserved id. P1-P5 apply to it exactly
  as to any other account, with no special-casing - the mutation "escrow release prints money"
  (skip the debit half of a release) is caught by **P1**, the same invariant that would catch a
  buggy mint, with zero new checker code.
- **Batch** reuses `#execTx`'s own rollback: each leg runs against the *same* journal
  `#execTx` already rolls back wholesale on any error. The mutation "an earlier leg is not
  rolled back" (a decoy journal that applies a leg's mutation directly, bypassing the undo
  record) is caught by the existing **S2** ("a rejected instruction changes nothing") property.
- **Sweep** is the one template that is genuinely new machinery (`#runSweeps`, run at
  `#endOfBlock`), because "move the excess, not the whole balance, only above a threshold" is not
  an existing primitive. It is exercised by 6 targeted tests (`sweep.test.js`), not by the model
  checker's own safety properties directly, since a sweep moving the *wrong* amount between two
  valid accounts does not by itself break P1-P5 or total money conservation - see the honest
  finding below.

## Model checker: coverage extended (2026-09-27)

The action alphabet grew from 27 to **37**: the four escrow/PayOnEvent actions (`e1` cross-issuer,
`e2` same-issuer and event-gated, plus the wrong-oracle release reclassified as an **attack**, not
a routine action - it belongs with the S3 property, not S1/S2), two sweep actions (register/cancel
at `keep=$0` so any positive balance is swept, exercising the firing path from as many states as
possible), and one Batch action (two independently-valid legs, deliberately *not* a same-amount
mirror pair - a same-amount round trip would make the second leg's settlement-position need always
exactly satisfied by the first leg's own cross-issuer contribution, hiding an atomicity bug rather
than exercising it; found by hand while testing the planted Batch mutation below). A second,
same-issuer account (`MPL:harbour`) was opened so same-issuer Escrow and Sweep have somewhere to
move to; it is **not** added to the existing `ACCTS`-driven mint/pay/redeem loops, so it does not
multiply their combinatorics.

| Run | Actions | Depth | States | Transitions | Time | Failures |
|---|---|---|---|---|---|---|
| Before (this session's baseline) | 27 | 8 | 40,000 (capped) | 377,678 | not recorded | 0 |
| After, routine (`modelcheck.test.js`, every test run) | 37 | 5 | 3,560 | 36,556 | ~27 s | 0 |
| After, one-off deeper check (this update, not part of the routine suite) | 37 | 6 | 12,181 | 131,720 | 99.5 s | 0 |

The routine test's depth was kept at 5 (not raised to match the old depth-8 claim) because each of
the 37 actions is more expensive per state than the old 27, and 5 already gives a stronger state
count (3,560) than a shallow run of the old alphabet would; CI time matters more than matching the
old run's depth number exactly. The depth-6 run above is the honest "we went deeper once and
still found nothing" data point the roadmap asked for - it is not re-run automatically.

## Model checker: External-CSD DvP added (roadmap 4.3, 2026-09-28)

The action alphabet grew again, 37 to **40**: `externalCsdDvp` (a fixed small cash-only lock,
`csd1`, cross-issuer acme -> cedar), the matching correct `csdConfirm`, and a wrong-event-name
release reclassified as an **attack** (claiming the CSD escrow is actually the generic `delivery`
event). Unlike M1's escrow/event-release actions, these do not exercise new kernel code -
`externalCsdDvp`/`csdConfirm` are the same `tx_ESCROW_LOCK`/`tx_EVENT_RELEASE` handlers already
covered - but they exercise that mechanism **in combination** with sweeps, batches and every other
action reachable from the same states for the first time, which is the actual point of exhaustive
search over scripted scenarios. No new mutation test was added for this: a bug in the shared
`tx_ESCROW_LOCK`/`tx_EVENT_RELEASE` code is already caught by the existing escrow-prints-money and
wrong-oracle mutations (roadmap 2.2) regardless of which named convenience method called it, and
both of those mutations still pass with the extended alphabet (confirmed, not assumed).

| Run | Actions | Depth | States | Transitions | Time | Failures |
|---|---|---|---|---|---|---|
| After 2.1 (previous baseline) | 37 | 5 | 3,560 | 36,556 | ~27 s | 0 |
| After 4.3, routine (`modelcheck.test.js`, every test run) | 40 | 5 | 3,793 | 40,680 | ~31 s | 0 |
| After 4.3, one-off deeper check (this update, not part of the routine suite) | 40 | 6 | 13,673 | 151,720 | 116.9 s | 0 |

## Roadmap 4.1: M2 confidentiality is deliberately not model-checked

`confidentialView` (`src/network.js`) is a pure, read-only transform of `Network#snapshot()`'s
already-built output. It runs entirely outside the transaction path - it cannot call a `tx_*`
handler, touch the Journal, or run before or after `#endOfBlock` - so it cannot itself produce a
state the kernel would not otherwise reach, and cannot cause a P1-P7 violation. Model-checking
existing actions under different *viewers* would test the same reachable states already covered,
rendered differently; it would not exercise anything new. What is worth testing, and is
(`test/confidentiality.test.js`, 6 tests): that a view never mutates the real network or the
snapshot it was given, that two issuers' views of the identical state genuinely disagree, and that
a quarantined issuer's status stays visible to a viewer that cannot see its book.

## Roadmap 5.1: caller-type attribution is deliberately not model-checked either

Same reasoning as M2, for a different reason: `caller` is metadata carried alongside an
instruction (like `inst_id` or `valid_until`), not a value any `tx_*` handler branches on. No
existing action's behaviour changes based on `caller.kind`, so extending the model checker's
alphabet with human- and agent-labelled variants of the same actions would explore states
already reachable today, labelled differently - not a new code path. What's worth testing, and
is (`test/caller-attribution.test.js`, 4 tests): that `caller` is part of the signed digest (so
it cannot be relabelled after signing without invalidating every signature on the instruction,
the same as a tampered `payload`), that omitting it is fully backward-compatible, that two
differently-attributed instructions are genuinely distinguishable in the block log, and that it
survives an independent replay from genesis unchanged. The honest limit, stated plainly: this
proves the *declaration* is tamper-evident, not that the declaration is *true* - a signer can
still falsely label itself `human` or `agent`. Independently verifying which one actually
produced an instruction would need attestation of the calling software itself, which is out of
scope here.

## What is NOT checked (be honest about the bounds)

- The model checker is **bounded** (state cap and depth cap, small alphabet of $1/$2 amounts,
  three accounts). It found no violation in any of the runs in the table above and is not a proof
  for all states or all amounts.
- **A sweep moving the wrong amount is not caught by any existing safety property.** Tried and
  confirmed while writing roadmap 2.2: a sweep that moves the *entire* source balance instead of
  just the excess above `keepAmount` still conserves total money and violates no P1-P7 formula -
  it is a functional-correctness bug, not a safety-invariant bug, and only `sweep.test.js`'s own
  targeted assertions ("never fires while at or below keepAmount") would catch it. Recorded here
  rather than forcing a mutation test to "pass" against a property that does not actually cover
  the bug class.
- **Consensus** is simulated; safety under Byzantine validators is untested. Needs the real engine and fault injection (spikes S6, S7).
- **Timing attacks, resource exhaustion, key compromise** are out of scope for a single-process kernel.
- The kernel's Node implementation has not been audited. A Rust port with Verus/Kani proofs (spike S2) is the path to machine-checked guarantees.
- Amount arithmetic uses BigInt (no overflow); a fixed-width port must prove the absence of overflow.
- **Mutation testing is now seven planted bugs** (four from before, three added for the new templates in roadmap 2.2). It shows the checker can find *classes* of bug; it does not bound what it would miss.

## Roadmap 6.1-6.3: agent delegation is model-checked (S6), unlike M2 and 5.1 (2026-09-29)

M2 and caller attribution were deliberately not model-checked because neither can change what any
`tx_*` handler does. Delegation is the opposite: a `GRANT` decides whether an instruction is
authorised at all, which is P6. So it gets exhaustive search and planted bugs.

**S6 (delegation soundness)** is checked after every transition by `checkDelegation` in
`modelcheck.js`, an oracle written from the spec in `docs/agent-native-access-proposal.md` that calls no
kernel code (its grant topology is fixed by the model, not read back from the state it is checking):
(a) every *accepted* agent-signed instruction was inside its grant's envelope in the state *before* it
ran, counting revocation and expiry of every ancestor, and if it exceeded the per-instruction max or
any window cap the institution's own signature was on it; (b) in every reachable state every grant
narrows its parent on every field (types, max, cap, expiry, counterparties, issuer); (c) a revoked
grant is never un-revoked; (d) the recorded caller of an accepted agent-signed instruction is the grant.
A *rejected* agent instruction leaving a window counter behind is caught by the existing **S2**, because
grants are now part of the compared state. Attacks added to **S3**: an agent over its max without the
institution, an agent signing a type outside its grant, and a sub-grant that widens (a larger max, an
extra type). All must be refused in every reachable state.

The alphabet: 16 delegation actions (grant, sub-grant, revoke by institution, revoke by parent, four
agent instructions, one escalation, an agent-registered sweep, an agent batch, five attacks including a
mixed-caller batch). Adding them to the 40-action model would push the
routine state cap (5,000) to be reached at depth 5, silently exploring *less* of the original model than
before, so the routine run keeps its 40 actions unchanged and delegation is searched on a focused
19-action alphabet (delegation plus the three funding actions it needs) that can go deep:

| Run | Actions | Depth | States | Transitions | Time | Failures |
|---|---|---|---|---|---|---|
| Routine base model, unchanged (`modelcheck.test.js`) | 40 | 5 | 3,793 | 40,680 | ~32 s | 0 |
| Delegation model, routine (`modelcheck.test.js`) | 19 | 9 | 1,315 | 19,171 | ~15 s | 0 |
| Delegation model, one-off (`node src/modelcheck.js 20 delegation`) | 19 | 13 | **1,767, exhausted** | 33,573 | 25.1 s | 0 |
| Everything combined, one-off (`node src/modelcheck.js 5 all`) | 53 | 5 | 5,001 (**capped**) | 61,623 | 47 s | 0 |

The delegation row at depth 13 is an exhausted search: no unexplored state remained, so within that
alphabet, amounts ($1/$2/$3/$10) and topology (g1 with children g2/g3) the properties hold in *every*
reachable state, not a sample. The combined row hit the state cap, so it is a data point, not a proof.

**Planted bugs the checker must catch** (`modelcheck.test.js`, all four caught, each within seven
actions): the window counter not journaled (a rejected agent instruction still consumes the window, S2);
a sub-grant stored detached from its parent so revocation does not cascade (S6); narrowing compared as
strings so `"1000" <= "200"` lets a sub-grant widen (S3/S6); escalation accepted without the
institution's signature (S3/S6). As with the earlier mutation tests these were written after the S6
oracle rather than red-first, because a mutation test is *of* the checker: each was confirmed to fail
when the corresponding kernel patch is applied and pass otherwise.

What this does not cover: the model has one issuer's grants, one window length, no clock advance (so
window reset and expiry are covered by `delegation.test.js` examples, not by the search), and a bug in a
combination of delegation and the other templates beyond mint/fund/transfer/pay is only sampled by the
capped combined run. Sweeps fired after a grant-authorised registration are not windowed (see README).

### Roadmap 7.1 / 7.2: sweeps under a grant, and batch callers (2026-09-29)

The two gaps recorded above are closed and the search re-run on the extended alphabet (the three new
actions are in the numbers in the table above; the earlier 16-action figures were 810 states routine and
989 exhausted).

**7.1.** `#runSweeps` charges a grant-registered sweep's firing to the same windows `#authorize` charges
(one shared `#charge`), so the two cannot disagree about how a window turns over. The oracle extension
judges each firing of the model's one agent-owned sweep (`s9`, whose owner is fixed by the model, not read
from the kernel's record) against the *pre-state* window plus everything already charged in the same
action (instructions, batch legs and earlier firings), and flags any firing under a dead chain.
**7.2.** For an accepted `BATCH`, the oracle recomputes every leg's effective caller from the leg itself
(signature role, else declared caller), requires them identical, requires the batch's recorded caller to
equal them, and now also judges each leg's envelope and window use like a top-level agent instruction.

Planted bugs, both caught: a grant-registered sweep that forgets its grant (fires unbounded, S6) and a
batch accepted with mixed callers (S3/S6). As with 6.3 they were written after the oracle, not red-first.
The four earlier delegation mutants were re-run against the larger alphabet and are still caught.

Unchanged and re-confirmed: the routine 40-action base model still reports 3,793 states / 40,680
transitions with zero failures.

### Roadmap 8: four findings from an external audit (2026-10-02)

Four line-pinpointed findings were relayed from an external audit of this code; each was confirmed against
the cited lines before it was fixed. (Two other findings from the same audit - no transport authentication
on any HTTP route, and consensus being simulated - are known PoC limits and were out of scope.)

**8.1** The pacs.002 `ACSC` text no longer says "consensus finality"; it says "ledger-accepted (simulated
consensus)", because all four validator keys sign every block in one process and nothing can disagree.
**8.2** `ESCROW_RELEASE` checked only the raw signature when `releaseRole` named an agent grant, so a revoked
or expired grant could still release escrow. It now also runs the same `#chain` liveness check `#authorize`
uses. `ESCROW_RELEASE` stays non-grantable on purpose; this adds liveness, not an envelope.
**8.3** `CANCEL_SWEEP` and `ESCROW_REFUND` accepted any live same-issuer grant with the right type and
counterparties. Both now require the acting grant to be the one that registered/locked the record or an
ancestor of it, via one shared `#grantOwnsRecord` (the same ancestor walk `REVOKE_GRANT` uses, except that the
grant itself may also act). Escrows now record the locking `grant`, omitted when the institution locked them, so
state roots for chains that never used grants are unchanged. A record with no grant on file can be cancelled or
refunded only by the institution's own key.
**8.4** A `BATCH`'s outer envelope signs nothing, so a relayer could submit a subset of its legs. A leg may now
carry a signed `batch_digest` (a hash over the exact, ordered `inst_id`s it rides with); once it does, the
kernel refuses it standalone, as a subset, reordered, or padded with an extra leg (`BATCH_LEG_MISBOUND`).
The digest is order-sensitive because batch order is semantically meaningful here. It is opt-in: a leg with
no `batch_digest` behaves exactly as before, so an unbound batch is still splittable.

Model-check coverage: 8.3 extends the delegation alphabet from 19 to 21 actions (g1 cancelling its own sweep
`s9`, legit; g2, a descendant not an ancestor, cancelling it, an attack) and the S6 oracle judges every
accepted `CANCEL_SWEEP` against the model's own record of who owns the sweep. One new planted bug (the
ownership check skipped) is caught. Because `ESCROW_REFUND` uses the same shared helper, this exercises it
too; there is no separate escrow action. 8.2 and 8.4 are covered by targeted tests, not the search: 8.2 turns
on grant revocation timing against an escrow and 8.4 on signed-digest binding, neither of which the focused
alphabet models.

| Run | Actions | Depth | States | Transitions | Time | Failures |
|---|---|---|---|---|---|---|
| Delegation model, routine (`modelcheck.test.js`) | 21 | 9 | 1,315 | 21,189 | ~16 s | 0 |
| Delegation model, one-off (`node src/modelcheck.js 20 delegation`) | 21 | 13 | **1,767, exhausted** | 37,107 | 27.3 s | 0 |
| Routine base model, unchanged | 40 | 5 | 3,793 | 40,680 | ~32 s | 0 |
| Base model, one-off (`node src/modelcheck.js 6`) | 40 | 6 | 13,685-13,687 | 151,720 | ~121 s | 0 |

**A measurement correction.** The depth-6 base-model state count is *not* deterministic: three runs gave
13,685, 13,686 and 13,687 states with identical transitions (151,720) and zero failures, and the pre-change
commit shows the same spread, so it is not caused by this pass. The earlier-recorded 13,673 predates
roadmap 5-7 and is not directly comparable. The likely cause is wall-clock time leaking into which
representative of an aliased state is explored first; it was not investigated further. The routine depth-5
figure is stable (3,793). Treat depth-6 state counts as accurate to roughly two states.

### Hardening X1: authority is checked before state is read (pre-authentication leak)

P6 says who may move a balance; it did not say what an unauthenticated caller may learn. Before X1 the
handlers resolved accounts, escrows, sweeps and grants before verifying a signature, so `POST /api/submit`
leaked, through the error code alone, which accounts exist, which are frozen or KYC-expired, which grant ids
exist and which issuer owns them. Now: (a) a signature the handler needs is named from the caller's own input
(an account id carries its issuer) and verified before any lookup; (b) when the signer lives in state, a
`#gate` first needs one valid signature from a key that exists independent of that object; (c) an
`agent:<id>` signature for a nonexistent grant is `BAD_SIGNATURE`, identical to a wrong key, and the grant's
issuer is compared only after its key verified. Evidence: `test/preauth-leak.test.js` (identical result objects
for bad/missing/partly-valid signatures against absent vs present vs frozen vs KYC-expired targets, and
foreign/revoked/unknown grants, for every affected type; plus a regression group showing the specific errors
are unchanged once the signature verifies).

**Replay:** error codes are not hashed. `txRoot` is the hash of the submitted instructions and `stateRoot` of
state (the rejected-code counters are not in it); a rejected instruction changes neither state nor dedup. The
success condition of every handler is unchanged, so a block log written by the previous kernel replays to the
same block hashes and state roots (checked by recovering a store written by the pre-fix code, which contained
rejected probes, with the post-fix code). **Deliberate changes visible to callers:** (1) a caller with a missing or bad signature now gets the signature
error where it used to get a state error (that is the fix); (2) a signature naming a nonexistent grant is
`BAD_SIGNATURE`, not `UNKNOWN_GRANT`; (3) where the signer lives in state (`ESCROW_RELEASE`, `ESCROW_REFUND`,
`CANCEL_SWEEP`, `REVOKE_GRANT`), a caller holding no valid key at all gets `MISSING_SIGNATURE`/`BAD_SIGNATURE`
before the `UNKNOWN_*` lookup; a caller with some valid participant key still gets `UNKNOWN_*` as before;
(4) a caller whose valid signatures are for the wrong roles gets the missing-signature error ahead of
state-free shape errors such as `SELF_TRADE`.

**Decision on the envelope checks.** `MALFORMED`, `BAD_INST_ID`, `BAD_VALIDITY`, `UNKNOWN_TYPE` and `NETWORK_HALTED`
read only the caller's bytes, the block time or the public halt flag, so they stay before authorisation.
`DUPLICATE_INSTRUCTION` does reveal one bit of state ("an instruction with this inst_id was accepted in the last
180 s"); it also stays, because it is recorded only for accepted instructions, is useful only to someone who
already holds the id (use high-entropy ids; a guessable UETR is a residual), and is what makes a retry
exactly-once. Not widened to a larger restructure in this item.

### Hardening X2: sweeps are held to the liveness TRANSFER enforces (2026-10-02)

`#runSweeps` (run from `#endOfBlock`) used to check only that both accounts exist and the source is over `keep`.
It therefore kept moving money during a network halt, while the issuer was quarantined, and from or to a frozen
or KYC-expired account - all cases where the same movement submitted as a TRANSFER is refused. A sweep is a
standing instruction that fires without anyone submitting anything, so it must not be the one path that ignores
those gates.

**The rule.** Before a firing, `#sweepBlockedBy` checks, in `#live`'s own order: network halted
(`NETWORK_HALTED`), the issuer not ACTIVE (`ISSUER_QUARANTINED`), then each of the two accounts for frozen
(`ACCOUNT_FROZEN`) and expired KYC (`KYC_EXPIRED`). A blocked sweep is **suspended, not deleted**: it stays
registered and visible, moves nothing, is reported in `sweepFires` as `{suspended: true, reason}`, can still be
cancelled by the institution, and fires again by itself in the block that clears the condition (the RESUME or
UNFREEZE block's own end-of-block hook runs the sweeps). The check runs before the grant logic, so a suspended
firing is never charged to a grant window. The suspension is reported only when excess exists, matching the
existing dead-grant suspension.

**Two honest limits, both recorded in the code.**
1. *The block that detects a break has already run its sweeps.* Sweeps run before the invariant check (so a
   sweep that clears an account back under `keep` is reflected in the same snapshot), and a same-issuer move is
   conservation-neutral, so this cannot create a violation; suspension begins with the next block.
2. *Suspending under quarantine is stricter than TRANSFER, not equal to it.* `#moveCash` checks quarantine only
   on its cross-issuer branch, so a same-issuer TRANSFER is still accepted while its issuer is quarantined
   (`sweep-liveness.test.js` pins this). Suspending sweeps there is a policy choice, made because a standing
   automated rule should not keep moving value in an issuer the graded halt has flagged; it is not "the same
   check as TRANSFER". Whether TRANSFER itself should refuse under quarantine is a separate question, not
   changed here.

**Evidence.** 13 tests in `test/sweep-liveness.test.js`, written first; 8 were red against the unmodified kernel
(each failing on "money moved", not on a harness error); the other five (the control, the pin, the issuer-scope
guard, the replay test and the cancel test) were green throughout. The harness uses a grant-registered sweep with a short window, which leaves excess
*pending* when the condition hits (an institution sweep fires immediately, leaving nothing to observe), plus a
control with no condition applied, so the "nothing moved" assertions are not vacuous. Institution-registered
sweeps are covered separately for quarantine and a frozen destination. Full suite 209/209 (was 196).

**What the model checker does and does not say about this - read before relying on its numbers.**

| Run (clock frozen, `Date.now` pinned) | Before X2 | After X2 |
|---|---|---|
| Base model, depth 5 | 3,793 states / 40,680 transitions, 0 failures | identical |
| Base model, depth 6 | 13,442 / 151,720, 0 failures | identical |
| Delegation model, exhausted (depth 13) | 1,767 / 37,107, 0 failures | identical |

The numbers are unchanged and S1-S6 hold, so X2 caused no regression in the space the checker covers. But the
checker **provides no coverage of X2 itself**. Counting suspended firings during both searches found none from
halt, quarantine, freeze or KYC (the delegation model only ever hits `GRANT_REVOKED`, 6,772 times). The reason
is structural, not a missing action: `modelCheck` fails **S1** whenever an action leaves a violation or a halt,
and its quiescence check (L1) requires no violations and no halt, so halted and quarantined states are, by
design, unreachable under legitimate actions. Frozen accounts are reachable in principle but no freeze action is
in the alphabet, and KYC expiry needs a clock advance the model does not take. X2's correctness therefore rests
on the targeted tests above, not on the search. Closing the gap needs a decision, not just more actions: a
"fault" action class exempt from S1/L1 for the state it deliberately produces, a property S7 (a sweep moves
nothing while the network is halted or its issuer quarantined, judged from the model's own tracking of which
conditions hold, not read from the kernel), freeze/unfreeze actions for the frozen case, and a patchable
predicate so a mutation test can plant "sweep ignores the gate". That changes what the safety properties assert,
so it is proposed here and left for sign-off.
