# DepositX PoC — engineering roadmap

**Scope note.** This file plans the *buildable software* only: `poc/`, the
proof-of-concept ledger kernel. `01-execution-roadmap.md` is the business and
regulatory plan (bank consortium, board votes, legal opinions) — none of that
is something code can execute, so it stays out of this file. Where an item
below is really a business/regulatory decision, it goes under **Blocked /
needs input**, not into a coding pass.

**Source of truth for what's real.** `poc/docs/invariant-charter.md`'s "What
is NOT checked" section and `poc/README.md`'s "What it is NOT" section are the
project's own honest account of its gaps, written by an earlier session. This
roadmap is built directly from those two lists plus the technical spec's
template library (`02-technical-implementation.md` §2.5), not from guesses.

## Executive summary

The PoC kernel (2,858 lines, 34/34 tests passing) already implements three of
the eight settlement templates the spec calls for (Transfer, Convert/Payment,
DvP) plus the full par-invariant machinery (P1–P7), a durable hash-chained
store, an ISO 20022 gateway, and a bounded model checker. The largest concrete
gap against the spec's own "launch set" (§2.5) is the four Phase 2 templates:
**Escrow, PayOnEvent, Standing/Sweep, Batch**. All four are buildable on top
of the existing kernel without new dependencies (the project is deliberately
zero-dependency) because they compose from primitives already proven correct:
the account-balance model, `#moveCash`'s par-conserving Convert, and the
Journal's atomic rollback (already used by DvP and `NET_CYCLE`).

Priority order below follows the spec's own template numbering, then the
project's stated "what is not checked" gaps, then documentation and the
dashboard. Each item is independently shippable and independently testable —
if the loop stops after any item, the tree is left green.

## Priority 1 — the four missing launch-set templates (§2.5)

### [x] 1.1 Escrow (T4): lock, release, refund

**Design.** An escrow is a regular ledger account under a reserved id
(`<issuer>:escrow:<escrowId>`) so it needs no new conservation math: `LOCK`
moves funds from the payer's account into the escrow account exactly like an
existing Transfer (same issuer) or Convert (cross-issuer, via `#moveCash`,
which already proves P3 par-legs); `RELEASE` moves escrow funds to the
beneficiary; `REFUND` moves them back to the original payer, only after
`expiresAt`. Both release and refund are same-issuer moves once the escrow
account already lives at the beneficiary's issuer (chosen at lock time), so
neither needs a second cross-issuer settlement move.

**Depends on:** nothing new; reuses `#moveCash`, `#live`, `Journal`.

**Acceptance criteria**
- [x] `tx_ESCROW_LOCK` creates the escrow account on first use, moves funds
      out of the payer's account, and is rejected if the payer's balance (or,
      cross-issuer, the payer issuer's settlement position) is insufficient —
      exactly like an existing Transfer/Payment would be.
- [x] `tx_ESCROW_RELEASE` requires the signature named at lock time (default:
      the payer's `ops` key) and moves the full escrowed amount to the named
      beneficiary account; a second release of the same `escrowId` is
      rejected (`UNKNOWN_ESCROW`).
- [x] `tx_ESCROW_REFUND` is rejected before `expiresAt` and succeeds after it,
      returning the full amount to the original payer account.
- [x] Total account-balance supply per issuer is unchanged by lock+release or
      lock+refund (a property test asserts this over both same-issuer and
      cross-issuer cases).
- [x] A cross-issuer lock correctly moves settlement positions once (at lock,
      via the existing Convert path); release/refund move no further
      settlement position, since money is already at the beneficiary's issuer.
- [x] `checkInvariants` (P1–P5) holds throughout; a fuzz or targeted test
      exercises lock → release and lock → refund and confirms no violation.
- [x] `npm test` stays green; new tests added to `test/kernel.test.js` or a
      new `test/escrow.test.js`.

### [x] 1.2 PayOnEvent (T5): release gated by a named oracle signature

**Design.** Reuses the Escrow account and lock/refund exactly; adds a second
release path, `tx_EVENT_RELEASE`, which requires a signature from a named
event-oracle key (`event:<name>`) registered in genesis — e.g. a delivery
confirmation — instead of the payer-named release role. This matches the
spec's own framing of PayOnEvent as escrow "released by a signed [...]
confirmation" (§2.4, describing the CSD DvP case as the general pattern).

**Depends on:** 1.1 (Escrow), since it reuses the escrow account and lock/
refund handlers unchanged.

**Acceptance criteria**
- [x] Genesis gains a named event-oracle keyset (at least one, e.g.
      `delivery`), mirroring how `observer` and `anchor` are already
      single-purpose named keys.
- [x] `tx_EVENT_RELEASE` succeeds only with a valid signature from the named
      oracle key, referencing the escrow by id and the event name it was
      locked against; a release attempt signed by any other key (including
      the payer's own `ops` key) is rejected.
- [x] An escrow locked for event `X` cannot be released by an event-release
      naming a different event name, even with a valid oracle signature for
      that other event.
- [x] Refund after expiry still works unchanged (no oracle involvement) —
      a stalled event does not trap funds forever.
- [x] Tests cover: correct-oracle release, wrong-signer rejection,
      wrong-event-name rejection, and expiry refund with no event fired.
- [x] `npm test` stays green.

### [x] 1.3 Batch (T7): several legs, atomic

**Design.** `tx_BATCH` carries an ordered list of legs, each leg shaped
exactly like an existing instruction's `{type, payload, sigs}`. Execution
dispatches each leg to its existing `tx_<TYPE>` handler **using the same
top-level Journal** that `#execTx` already rolls back wholesale on any
`KernelError` — so "all legs or none" falls out of the existing atomicity
mechanism with no new rollback logic, the same way DvP's two legs already do.

**Depends on:** nothing new; reuses every existing `tx_*` handler as a leg
executor.

**Acceptance criteria**
- [x] A batch of 2–5 legs (mixing Transfer, Payment, Escrow lock) where every
      leg is individually valid settles all of them in one instruction, and
      the block's events list carries every leg's own events.
- [x] A batch where the *last* leg is invalid (e.g. insufficient funds)
      leaves state byte-identical to before the batch — including the legs
      that would otherwise have individually succeeded. A test asserts this
      by snapshotting `stateRoot()` before and after the rejected batch.
- [x] Nesting a `BATCH` leg inside a `BATCH` is rejected explicitly
      (`BATCH_NO_NESTING`), not silently accepted or infinitely recursed.
- [x] An empty legs array is rejected (`BATCH_EMPTY`).
- [x] `npm test` stays green.

### [x] 1.4 Standing/Sweep (T6): a registered rule that fires deterministically

**Design.** `tx_REGISTER_SWEEP` registers a same-issuer standing rule
(`fromAccount`, `toAccount`, `keepAmount`) signed once by the payer's `ops`
key. At the end of every block (`#endOfBlock`, where invariant checks already
run identically on every validator from the same state — the same place that
makes the graded halt deterministic) any active sweep whose source balance
exceeds `keepAmount` moves the excess to its destination. Restricted to
same-issuer transfers only, so no settlement-position or cross-issuer
signature question arises. `tx_CANCEL_SWEEP` deregisters one.

**Depends on:** nothing new; reuses `#moveCash`'s same-issuer path and the
existing `#endOfBlock` hook.

**Acceptance criteria**
- [x] Registering a sweep from A to B with `keepAmount = $X`, then crediting A
      above `$X` (e.g. via a same-block mint or transfer in), causes the
      excess to move to B by the *next* block's end, with no separate
      instruction submitted by anyone.
- [x] A sweep never fires while the source balance is at or below
      `keepAmount`.
- [x] `tx_CANCEL_SWEEP` stops future firings; a cancelled sweep firing again
      is a test failure.
- [x] Two sweeps in the same block that would otherwise interact (A→B and
      B→C) both apply deterministically in a single documented order
      (registration order) — a test pins the exact resulting balances so the
      order is a tested contract, not an accident.
- [x] Sweeps are captured in `store.js` recovery (a restart replays them
      identically) — reuses the existing block-log replay, but a test
      confirms it explicitly for this new state.
- [x] `npm test` stays green.

## Priority 2 — keep the honesty file honest

### [x] 2.1 Extend the model checker's coverage to the four new templates

`poc/docs/invariant-charter.md` states the model checker found no violation
"across 40,000 states / 377,678 transitions (depth 8)" for the *existing*
action set. Adding four new transaction types without extending the model
checker's action alphabet would make that claim stale and wrong.

**Depends on:** 1.1–1.4 (all four templates must exist first).

**Acceptance criteria**
- [x] `modelcheck.js`'s action alphabet includes at least one instance each of
      Escrow lock/release/refund, event-release (correct and wrong-oracle),
      a two-leg batch, and sweep register/fire/cancel.
- [x] The extended run completes in a bounded time (document the new
      state/transition counts next to the old ones — do not silently drop the
      depth or alphabet size to make it finish faster) and finds no
      unexpected violation. If it *does* find one, that is a real kernel bug:
      fix the kernel, not the model, and say so in the commit message.
- [x] `poc/docs/invariant-charter.md`'s numbers and "What is NOT checked"
      section are updated to describe the new, larger bound honestly (do not
      claim more than what was actually run).
- [x] `npm test` stays green (the model check is already a test; it now
      covers more).

### [x] 2.2 Widen mutation testing beyond four planted bugs

The charter says plainly: "Mutation testing is only four planted bugs... it
does not bound what it would miss." Each new template is exactly the kind of
new surface a planted bug could hide in.

**Depends on:** 1.1–1.4.

**Acceptance criteria**
- [x] At least three new planted-bug mutations are added, each in a new
      template's handler (e.g., "escrow release ignores the expiry check",
      "batch leg failure doesn't roll back an earlier leg", "sweep fires
      below keepAmount").
- [x] Each planted bug is caught by the model checker or a targeted test —
      if a mutation is *not* caught, that is a real coverage gap: add the
      missing invariant or test, don't weaken the mutation.
- [x] The charter's mutation count and description are updated to match.
- [x] `npm test` stays green.

## Priority 3 — reachability and documentation

### [x] 3.1 Wire the new instruction kinds into the dashboard's action API

`poc/src/server.js`'s `act()` switch and `public/index.html`'s action list are
the only way a person (not a test) can drive the kernel today. Without this,
the four new templates exist only for tests, which contradicts the PoC's own
stated purpose ("a live dashboard").

**Depends on:** 1.1–1.4.

**Acceptance criteria**
- [x] `act()` gains cases for escrow lock/release/refund, event-release, batch
      (a small fixed 2-leg demo, not a general batch builder — matching the
      dashboard's existing level of polish for `dvp`), sweep register/cancel.
- [x] The dashboard's action list renders working controls for each new case
      using the existing form/element helpers already in `index.html` — same
      visual style, no new dependency.
- [x] Manually exercised once via `npm start` and the local dashboard (record
      the result in the session log below; this is a judgment call an
      automated test can't fully replace for a UI).
- [x] `npm test` stays green (server.js has no existing test harness; adding
      one is out of scope here — see Blocked/needs input if it seems large
      enough to warrant its own item).

### [x] 3.2 Update README.md and poc/README.md

**Depends on:** everything above.

**Acceptance criteria**
- [x] `poc/README.md`'s "What it demonstrates" table gains rows for the four
      new templates, each pointing at the code and the test that proves it,
      matching the existing table's style exactly.
- [x] `poc/README.md`'s "What it is NOT" section is re-checked line by line:
      remove anything this pass fixed, leave everything else (most of it —
      real consensus, ZK, HSMs, a Rust port — is correctly still true).
- [x] Root `README.md`'s "Read in this order" / PoC description still
      accurately describes what `poc/` covers.
- [x] No claim is added anywhere that isn't backed by a passing test.

## Priority 4 — M2 confidentiality (issuer-domain need-to-know)

Continued 2026-09-28. Grounded in `02-technical-implementation.md` T-6 and
§2.6: three confidentiality modes are specified — **M0** plain (today's PoC:
everyone sees every issuer's full customer book), **M1** ZK committed amounts
(needs real cryptographic review; correctly out of scope, see below), and
**M2** issuer-domain need-to-know, which the spec says is "fully designed and
prototyped in Phase 1" and is "the fallback that Phase 3 ships on if M1
fails" (§2.6 table). M2 is **not cryptographic** — it is an access-control
question (who is shown what), not a hiding-in-the-math one, so unlike M1 it
needs no new dependency and no crypto review to prototype at PoC scale.

### [x] 4.1 A confidentiality view: issuers see their own book, not each other's

**Design.** A pure function over the existing `snapshot()` output — the
kernel and its invariants are completely unchanged; this is a rendering
question, not a settlement one. Two viewer kinds: `{ issuer: 'MPL' }` (sees
full customer-level detail — names, deposits, tokens — for its own issuer
only; every other issuer is reduced to `{ id, name, status, quarantine }`,
since knowing whether a counterparty is safe to pay is operationally
necessary but its book is not); `{ supervisor: true }` (the Bank of Canada
observer / operator view: everything, unredacted, matching the invariant
charter's existing "supervisory 60-second claim"). An unrecognised issuer id
is treated as an outside party and sees no issuer's book in detail.

**Depends on:** nothing new; reads `Network#snapshot()`'s existing output.

**Acceptance criteria**
- [x] A supervisor view is byte-identical to today's full `snapshot()` — M2
      changes what a bank sees, never what the Bank of Canada observer sees.
- [x] An issuer view shows full customer detail (names, deposits, token
      balances) for its own issuer, and for every other issuer shows only
      `id`, `name`, `status`, `quarantine` — no customers array, no S/L/sp/
      core figures.
- [x] Two different issuers' views of the identical underlying state disagree
      about what is visible (MPL's view hides NSR's book; NSR's view hides
      MPL's) — proving this is genuine per-viewer confidentiality, not a
      global toggle.
- [x] A quarantined or halted issuer's status is visible in every view,
      including to issuers that cannot see its book — the point made in the
      design note (a payer must be able to route around a bad counterparty
      without seeing its balance sheet).
- [x] Building a view never mutates the network: calling it twice, or
      alongside an ordinary full `snapshot()`, produces the same real state
      each time (a test using the same live `Network` instance confirms this,
      not just that the view function is theoretically pure).
- [x] `GET /api/state` gains a `?viewAs=<issuerId|supervisor>` parameter
      (default `supervisor`, so today's dashboard behaviour is unchanged
      unless asked for something else) and the dashboard gains a control to
      pick which issuer's seat you are viewing from, labelled honestly as a
      confidentiality demo, not a login.
- [x] Not model-checked: M2 is a read-only view transform outside the
      transaction path, so it cannot itself create an invariant violation —
      recorded as the reasoning in `docs/invariant-charter.md`, not silently
      skipped.
- [x] `poc/docs/invariant-charter.md` and `poc/README.md`'s "What it is NOT"
      both updated: M2 is now built and demoed; M1 (real ZK) and HSMs remain
      correctly out of scope.
- [x] `npm test` stays green; new tests in `test/confidentiality.test.js`.

### [x] 4.2 External-CSD DvP: the spec's own named conditional-settlement scenario

Continued 2026-09-28. `02-technical-implementation.md` §2.4 names a specific
scenario the launch-set templates must cover but the native `tx_DVP` handler
cannot: "Bond at an external CSD (CDS): **conditional, not atomic**, via an
Escrow/PayOnEvent template released by a signed CSD confirmation (sese.025)
with deadline and refund path. Say so plainly; the residual risk window is
defined." Native `tx_DVP` always assumes *both* legs are on DepositX; this
scenario is cash-only on DepositX (the security lives at an outside
depository), which is exactly what Escrow + PayOnEvent (roadmap 1.1/1.2) were
built for — the value here is composing them *correctly* for this specific,
named, regulated shape, not inventing new kernel mechanism.

**Design.** A dedicated named oracle key, `csd-confirmation` (distinct from
the generic `delivery`/`inspection` examples, representing the external
depository's own signing authority), plus one convenience method,
`Network.externalCsdDvp(buyer, seller, escrowId, cash, { deadlineSeconds })`:
locks the cash leg in escrow, gated on the `csd-confirmation` event, with an
expiry `deadlineSeconds` out. Release is the existing `eventRelease`; refund
after the deadline is the existing `escrowRefund` — no new kernel handler.
The **residual risk window**, stated plainly per the spec's own instruction:
from the moment cash locks to the moment the CSD confirms (funds committed,
trade not yet final) or the deadline passes (funds return, trade did not
happen) — bounded exactly by `deadlineSeconds`, chosen by the buyer at lock
time, never open-ended.

**Depends on:** 1.1 (Escrow), 1.2 (PayOnEvent) — reuses both unchanged.

**Acceptance criteria**
- [x] `externalCsdDvp` locks only the cash leg; `s.securities` and every
      account's `sec` map are untouched by it — proving this is genuinely
      decoupled from DepositX's own securities ledger, unlike native `tx_DVP`.
- [x] A correct, signed CSD confirmation releases the cash to the seller;
      release under any other key (including the buyer's own, and the
      generic `delivery`/`inspection` oracles) is rejected.
- [x] Before `deadlineSeconds` elapses, a refund is rejected
      (`ESCROW_NOT_EXPIRED`) — the residual risk window is still open, and the
      cash stays locked, not returned early on a whim.
- [x] After the deadline, with no confirmation received, a refund succeeds
      and returns the cash to the buyer — the window closes without silently
      leaving money stuck.
- [x] A confirmation that arrives *after* the deadline (the CSD was slow) is
      documented as a real, named risk in this design, not silently handled
      either way — the test asserts today's actual behaviour (whichever the
      code does first) rather than asserting an untested intention.
- [x] `npm test` stays green; new tests in `test/external-csd-dvp.test.js`.
- [x] `poc/docs/invariant-charter.md` or `poc/README.md` states the residual
      risk window in the same terms as this section, so the honesty file and
      the roadmap never disagree about what "conditional, not atomic" means
      here.

### [x] 4.3 Keep the honesty file honest, again: External-CSD DvP in the model checker

Continued 2026-09-28, immediately after 4.2. Unlike M2 (4.1), External-CSD
DvP moves real balances through the real transaction path — leaving it
unexplored by the model checker would repeat exactly the gap roadmap 2.1 was
created to close for the other four templates.

**Design.** Add `externalCsdDvp` (a fixed small cross-issuer lock, `csd1`),
the correct `csdConfirm`, and a wrong-event-name release (reclassified as an
**attack**, matching the precedent for the generic PayOnEvent case in 2.1) to
`modelcheck.js`'s action alphabet. No new mutation test: the mechanism is the
already-mutation-tested `tx_ESCROW_LOCK`/`tx_EVENT_RELEASE`, so a bug there
is already caught regardless of which named convenience method calls it —
confirmed by re-running the existing escrow and wrong-oracle mutations
against the extended alphabet, not assumed.

**Acceptance criteria**
- [x] The action alphabet grows to 40 (was 37); a routine run (depth 5) finds
      zero failures and a stronger state count than before the addition.
- [x] A one-off deeper run (depth 6) also finds zero failures, giving the
      same kind of "went deeper once, still clean" data point 2.1 recorded.
- [x] The existing escrow-prints-money and wrong-oracle mutation tests still
      pass unchanged against the extended alphabet — proving the new actions
      genuinely reuse the already-covered mechanism rather than silently
      adding an untested path.
- [x] `docs/invariant-charter.md` records the real before/after numbers, in
      the same table style as 2.1's own entry.
- [x] `npm test` stays green; no new test file needed (`modelcheck.test.js`'s
      thresholds updated to the new measured numbers).

## Priority 5 — caller-type attribution (from the Web4/agentic-internet framing review)

Added 2026-09-28. Grounded in this session's own retroactive review:
`02-technical-implementation.md` §10 and every board seat memo's open-items
register now ask the same question — does the compliance/screening/
audit-trail model distinguish a member institution's own authenticated
software agent initiating an instruction (e.g. the 24/7 treasury sweeps
already in the use-case ladder) from a human doing the same thing under the
same key? Today nothing does: `messageOf()`'s signed digest and every
dashboard/API surface treat "a valid signature from role X" as the entire
identity of the caller. This priority answers that gap at PoC scale, the
same way M2 (Priority 4.1) answered issuer-domain confidentiality: a small,
honest, cryptographically-real addition, not a redesign of the trust model.

### [x] 5.1 A signed, tamper-evident caller-type field on every instruction

**Design.** Every instruction already carries `{inst_id, type, payload,
valid_until, sigs}`, and its signature covers exactly those fields via
`messageOf()`/`canon()`. Add an optional `caller: { kind: 'human' | 'agent',
label?: string }` field, included in the same signed digest — so a caller
declares itself at signing time, and that declaration is exactly as
tamper-evident as `payload` itself (changing `caller` after signing
invalidates every existing signature, the same `BAD_SIGNATURE` path already
tested for payload tampering). Omitting `caller` defaults to `{ kind:
'unspecified' }` on both the signing and verifying side, so every existing
test, stored block, and `verifyReplay()` call continues to produce
byte-identical results with no migration. This is not a new access class or
a new key: whoever holds `ops:MPL`'s key still authenticates as `ops:MPL`;
`caller.kind` is that same signer's own declaration of whether a human or
its own automation produced this particular instruction — self-attested,
not independently verified, exactly as honest as that limitation sounds.

**Depends on:** nothing new; extends the existing `tx()`/`messageOf()` pair
unchanged in shape.

**Acceptance criteria**
- [x] `caller` is part of the signed digest: an instruction signed with
      `caller: {kind:'human'}` and then relabelled to `{kind:'agent'}`
      before submission fails with `BAD_SIGNATURE`, exactly like a tampered
      `payload` does today.
- [x] Omitting `caller` entirely still verifies and executes exactly as
      every existing test does — old call sites, old stored blocks, and
      `verifyReplay()` from genesis are all unaffected (confirmed by
      running the full existing suite unmodified before adding any new
      test).
- [x] `stateView()`'s block history and `GET /api/state`'s block log both
      surface `caller.kind` per instruction (defaulting to `unspecified`
      when absent) — this is the "a supervisory query can tell them apart"
      requirement from `02` §10, not just an internal field nobody can see.
- [x] The dashboard's block log (`renderBlocks`) shows a small tag for
      agent-attributed instructions, distinct from human/unspecified ones —
      visible, not just present in the JSON.
- [x] Not model-checked, for the same reason M2 (4.1) wasn't: `caller` is
      metadata carried alongside an instruction, not a new code path that
      can itself violate P1–P7 — the existing model-checked actions (mint,
      pay, escrow, etc.) are unchanged by this; the reasoning goes in
      `docs/invariant-charter.md` next to M2's own.
- [x] `poc/README.md`'s "What it demonstrates" table gains a row; the "No
      caller-type distinction" line added to "What it is NOT" during the
      framing review is removed (it's no longer true) and replaced with an
      honest statement of what's still self-attested vs. independently
      verified.
- [x] `npm test` stays green; new tests in `test/caller-attribution.test.js`.

## Priority 6 — agent-native access: delegated, narrowing, verifiable authority

Added 2026-09-29. Design and rationale: `poc/docs/agent-native-access-proposal.md`
(signed off 2026-09-29 with all three recommended options: full grants build,
sub-delegation now, spend counted against every ancestor's window). 5.1 made the
audit trail distinguish agents from humans; this priority bounds what an agent
*may do* and makes "this was software acting inside an envelope" a fact the
kernel derives from which key signed, not a label the signer declares.

Decisions taken while turning the proposal into a spec (recorded so they are
not silently assumed): grantable types in this cut are `TRANSFER`, `PAYMENT`,
`ESCROW_LOCK`, `ESCROW_REFUND`, `REGISTER_SWEEP`, `CANCEL_SWEEP`, plus `GRANT`
itself (sub-delegation right); mint, redeem, DvP, funding, halt/resume, netting
and every `gov:`/`anchor`/`reconciler` action are NOT grantable. Per-instruction
max, window cap and expiry are mandatory, so every grant is bounded. Windows are
tumbling, anchored at the first spend. A co-signed (escalated) instruction is
authorised by the institution and does not count against the window. F4 (batch
caller uniformity) is deferred.

### [x] 6.0 Fix 5.1 gaps found while writing the proposal (F1, F2)
- [x] A queued PAYMENT keeps its `caller` in the stored queue entry (omitted
      when unspecified, so existing state roots are unchanged); test that it
      survives to `NET_CYCLE`.
- [x] `kernel.js` header comment no longer claims nothing distinguishes callers.

### [x] 6.1 `GRANT` / `REVOKE_GRANT`, envelope check, derived caller
- [x] `GRANT` signed by `ops:<issuer>` (root) or by `agent:<parent>` (sub-grant);
      bad shapes, unbounded fields, non-grantable types, unknown/foreign-issuer
      parents and depth > 4 are rejected with specific codes.
- [x] Narrowing: a sub-grant that widens types, per-instruction max, cap,
      counterparties or expiry is rejected `GRANT_WIDENS_PARENT`; sub-delegation
      requires `GRANT` in the parent's `allow_types`.
- [x] `agent:<grant_id>` signature substitutes for `ops:<issuer>` on grantable
      types; ALLOW / ESCALATE / DENY behave as specified; `screen:`/`accept:`
      unchanged.
- [x] Spend counts against the grant's window AND every ancestor's window;
      rolled back with the instruction if it fails.
- [x] Revocation (by `ops` or an ancestor's agent key) takes effect in-block and
      invalidates every descendant; expiry likewise.
- [x] Recorded caller for agent-signed instructions is derived
      `{kind:'agent', grant_id, label}`; a declared `human` is `CALLER_MISMATCH`.
- [x] Omitting all agent signatures leaves every existing test, stored block and
      replay byte-identical (no migration; `grants` absent from state until used).

### [x] 6.2 Interface an agent can actually use
- [x] `POST /api/submit` accepts a fully signed instruction (server never signs).
- [x] `GET /api/schema` lists instruction types, roles, payload shapes and an
      error catalog with `retryable` / `remedy`.
- [x] `GET /api/grants` shows grants and remaining window headroom.

### [x] 6.3 Model-check delegation (S6) and mutation-test it
- [x] Safety property S6 (delegation soundness) and new actions in `modelcheck.js`.
- [x] Four planted bugs caught: window counter not journaled, revocation not
      cascading, narrowing compared as strings, escalation accepted without `ops`.

### [x] 6.4 Docs
- [x] `poc/README.md` table row and "What it is NOT" update; `docs/invariant-charter.md`
      entry with measured numbers; proposal doc marked implemented with amendments.

## Priority 7 — close the two delegation gaps left open by Priority 6

Added 2026-09-29. Both are recorded as deferred/limits in `poc/README.md` ("What it is
NOT") and `poc/docs/agent-native-access-proposal.md` §10. Grounded in the code as it
stands: `#runSweeps` (`kernel.js`, run from `#endOfBlock`) moves `balance - keep`
directly, with no envelope, no journal and no reference to who registered the rule;
`tx_BATCH` checks no signature of its own (each leg carries its own), so the outer
result's `caller` is whatever the batch declared, which nothing verifies.

Decisions taken in this spec (recorded so they are not silently assumed; say if you
disagree before 7.1 is built): a sweep registered under a grant is **charged to that
grant's whole chain at each firing and moves only what fits** (partial firing) instead
of failing or firing in full; a sweep whose grant chain is dead (revoked, expired, an
ancestor gone) is **suspended, not deleted** — it stays registered and visible, moves
nothing, and the institution can cancel it. Sweeps registered by the institution's own
key are untouched. A batch's outer caller is **derived from its legs**, and legs with
different effective callers are rejected.

### [x] 7.1 Sweeps registered under a grant are bounded by that grant

**Design.** `REGISTER_SWEEP` authorised by `agent:<grant_id>` stores `grant: <grant_id>`
on the sweep record (omitted for institution-registered sweeps, so no existing state
root changes). At each firing `#runSweeps` computes headroom = min(the grant's
`per_instruction_max`, `max_total - spent` in every live ancestor's current window),
moves `min(excess, headroom)`, and charges that amount to every window in the chain,
using the same tumbling-window rule as `#authorize`. Firing is not an instruction, so
there is no ESCALATE path: what does not fit simply waits for the next window. The
firing must use one shared helper with `#authorize`'s window logic, not a copy.

**Acceptance criteria**
- [x] A sweep registered by the institution's own key fires exactly as today (all
      existing sweep tests unmodified and green; `sweep` records for them carry no
      `grant` field).
- [x] A sweep registered under a grant, with excess larger than the grant's headroom,
      moves exactly the headroom and no more; the remainder moves in a later window
      after the window turns over (test with `advance()`).
- [x] A firing is charged to every ancestor's window: a sibling grant's spend and the
      sweep's firings share the parent's cap (extends the existing ancestor test).
- [x] Revoking or expiring the grant, or any ancestor, suspends the sweep: it moves
      nothing, stays in `state.sweeps`, is reported in `sweepFires` as suspended, and
      `CANCEL_SWEEP` by the institution still removes it.
- [x] A sweep's firing under a grant is replay-deterministic (`verifyReplay` from genesis
      matches) and survives a durable-store restart.
- [x] Model checker: new actions (agent registers a sweep under g1; agent-registered
      sweep left running across a revoke) and S6 extended in `checkDelegation`, written
      from the spec, not from the kernel: total moved by a grant's sweeps within a
      window never exceeds any chain member's cap, and a dead chain never moves money.
      Search re-run on the delegation alphabet; numbers recorded, not assumed.
- [x] One new planted bug the checker must catch (sweep ignores the grant's window),
      written after the oracle as in 6.3, and said so in the charter.
- [x] `README.md` "Delegation limits" bullet about ungated sweep firing is removed and
      replaced by the actual behaviour; `docs/agent-native-access-proposal.md` §10's
      sweep bullet updated; `docs/invariant-charter.md` gains the new numbers.

### [x] 7.2 A batch's caller is derived from its legs (F4)

**Design.** `tx_BATCH` computes each leg's effective caller (the derived
`agent:<grant_id>` caller if the leg was agent-authorised, else its declared caller,
else `unspecified`). If they are not all identical (`canon`-equal) the batch is rejected
`BATCH_MIXED_CALLERS`; otherwise the outer `BATCH` result reports that shared caller.
The outer batch's own declared `caller` is ignored for the result, since nothing signs
it. Legs are unchanged otherwise (each is still authorised and bounded on its own).

**Acceptance criteria**
- [x] A batch whose legs are all `unspecified` behaves exactly as today, including the
      model checker's existing batch action (the routine 40-action run still reports
      3,793 states / 40,680 transitions).
- [x] A batch of legs all authorised by the same grant reports
      `{kind:'agent', grant_id, label}` on the outer result and in the block log.
- [x] A batch mixing an agent-authorised leg with an `ops`-signed leg, or two different
      grants, is rejected `BATCH_MIXED_CALLERS` and changes no state (rollback test).
- [x] An outer batch declaring `caller: {kind:'human'}` around agent legs does not get
      to report `human`.
- [x] Each agent-authorised leg still charges the grant's window once, and a batch that
      fails mid-way restores the window (extends the journal-rollback test).
- [x] `schema()` error catalog gains `BATCH_MIXED_CALLERS` with a remedy; the README
      "batch leg" limit and proposal §10's F4 bullet are removed/updated.
- [x] Model checker: existing batch action untouched; add one mixed-caller batch
      **attack** (must always be rejected and inert) and extend S6(d) to batches.

## Priority 8 — harden four findings from an external audit of this code

Added 2026-10-01. Caleb relayed four specific, line-pinpointed findings from an
external audit of `poc/`. Each is a real, verified gap (confirmed by reading the
cited lines before writing a line of fix), not assumed from the report alone.
Scope is exactly these four; the audit's other two findings (no transport auth on
any HTTP route; consensus is simulated, not real) are known, already-disclosed PoC
limits and explicitly out of scope for this pass.

### [ ] 8.1 Misleading "consensus finality" wording in the ISO 20022 output

**Finding.** `iso20022.js`'s pacs.002 ACSC status prints "consensus finality" in
`AddtlInf`, but this PoC's consensus is simulated in one process (`network.js`
`#makeBlock`: all four validator keys sign every block; nothing can disagree). An
agent consuming this message could reasonably read that phrase as a real
finality guarantee this PoC does not provide.

**Fix.** Reword to something accurate - e.g. "ledger-accepted (simulated
consensus)" - that still says the block is final on this ledger without implying
real multi-party consensus.

**Acceptance criteria**
- [ ] The ACSC `AddtlInf` string no longer contains the phrase "consensus
      finality" unqualified; it says plainly that consensus is simulated.
- [ ] `test/iso20022.test.js` gains an assertion on the exact wording so this
      cannot silently regress.
- [ ] No behavioural change: `TxSts` values, RJCT path and every other field
      are untouched.

### [ ] 8.2 ESCROW_RELEASE does not check a grant-held release role is still live

**Finding.** `tx_ESCROW_RELEASE` authorises via `this.#sig(tx, rec.releaseRole)`
only. When `releaseRole` is `agent:<gid>` (set at lock time), `#pubFor` returns
that grant's `agentKey` regardless of whether the grant has since been revoked or
expired - `#sig` only checks the raw signature, never liveness. Revoking an
agent's grant does not stop it releasing escrow funds it already holds a
`releaseRole` claim on. `ESCROW_RELEASE` is deliberately not in `GRANTABLE_TYPES`
(release of already-locked funds was never meant to go through the envelope/
window machinery), so this is specifically a missing liveness check, not a
missing envelope check.

**Fix.** When `rec.releaseRole` is `agent:<gid>`, after the signature check
succeeds, also call the existing `#chain(gid, time)` (the same liveness check
`#authorize` already applies) - it already throws `GRANT_REVOKED`/
`GRANT_EXPIRED`/`GRANT_TOO_DEEP`/`UNKNOWN_GRANT` as needed. No envelope or
window check is added here; that is correctly out of scope for release.

**Acceptance criteria**
- [ ] An escrow locked with `releaseRole: agent:<gid>` can be released normally
      while the grant is live (existing behaviour unchanged).
- [ ] Once that grant is revoked, the same release attempt fails `GRANT_REVOKED`
      and moves no money (the funds stay locked, available to refund after
      expiry by the institution).
- [ ] Same for an expired grant: `GRANT_EXPIRED`.
- [ ] A `releaseRole` naming the institution's own `ops:<issuer>` key (the
      default, no grant involved) is completely unaffected.
- [ ] `npm test` stays green; new tests in `test/escrow.test.js` or
      `test/delegation-gaps.test.js` (whichever existing file fits the pattern
      better once read).

### [ ] 8.3 CANCEL_SWEEP and ESCROW_REFUND don't check the acting grant is the one that created the record

**Finding.** Neither handler checks that the grant cancelling a sweep or
refunding an escrow is the grant that registered/locked it. `#authorize` only
checks the acting grant is live, allows the type, and (if set) lists the right
counterparties - so any same-issuer grant with `CANCEL_SWEEP`/`ESCROW_REFUND` in
its `allow_types` and matching counterparties can cancel or refund a record
belonging to a *different* grant, or one the institution registered directly.
Sweeps already record which grant registered them (`sweeps[id].grant`, from
roadmap 7.1); escrows do not yet record which grant locked them - that is
added as part of this fix.

**Fix.** Mirror `REVOKE_GRANT`'s existing ancestor check (kernel.js, in
`tx_REVOKE_GRANT`): when the acting signer is an agent grant, require it to be
either the exact grant on record, or a strict ancestor of it (walking the
recorded grant's own `parent` chain) - not the other direction, and not merely
"any live grant with the right type". A record with no grant on file (the
institution registered/locked it directly) can only be cancelled/refunded by
the institution's own `ops:` signature, never by any agent grant.

**Acceptance criteria**
- [ ] `tx_ESCROW_LOCK` records `grant: <gid>` on the escrow when an agent
      locked it (omitted when the institution locked it directly, so existing
      state roots for chains that never used grants are unchanged).
- [ ] The same grant that registered a sweep can cancel it; an ancestor of that
      grant can cancel it; a sibling or unrelated grant (even same issuer, same
      allow_types, matching counterparties) cannot - rejected `SWEEP_WRONG_GRANT`.
- [ ] Same three cases for `ESCROW_REFUND` against the locking grant - rejected
      `ESCROW_WRONG_GRANT`.
- [ ] A sweep/escrow the institution created directly cannot be cancelled/
      refunded by any agent grant, even one that would otherwise qualify under
      `#authorize`'s own checks.
- [ ] An institution's own `ops:` signature can still cancel/refund anything of
      its own issuer, exactly as before, grant or no grant.
- [ ] `schema()`'s error catalog gains `SWEEP_WRONG_GRANT` and
      `ESCROW_WRONG_GRANT` with remedies.
- [ ] `npm test` stays green; new tests in `test/delegation-gaps.test.js`
      (same file as roadmap 7.1's sweep-grant tests).
- [ ] Model checker: one new planted-bug mutation (skip this check) caught by a
      new or extended delegation action, following 6.3/7.1's own pattern.

### [ ] 8.4 A batch's "all or nothing" intent is not cryptographically bound

**Finding.** `tx_BATCH`'s outer envelope is unsigned (`network.js`'s `batch()`
calls `this.tx('BATCH', { legs: legTxs }, [])` - empty roles); each leg is a
fully independent, fully signed instruction. `BATCH_MIXED_CALLERS` (7.2) checks
the legs *agree* on a caller but does nothing to stop anyone relaying the
batch - not just its signer - from submitting a subset of the legs standalone,
or as a different, smaller batch, breaking the signer's actual "all these
together or none" intent.

**Fix.** A leg's own signed digest may optionally carry a `batch_digest` - a
hash over the exact, ordered list of `inst_id`s of every leg it was signed to
ride with (`batchDigestOf`, exported next to `messageOf`). Once a leg carries
one, the kernel refuses to execute it anywhere the ambient batch's own
recomputed digest (over whichever legs are actually present, in order) doesn't
match exactly - whether that's standalone (ambient digest is null) or inside a
differently-sized or reordered batch. Omitting `batch_digest` leaves a leg
exactly as before (opt-in protection, zero migration, matching every other
addition to the envelope so far).

**Acceptance criteria**
- [ ] `batch_digest` is part of the signed digest (`messageOf`/`tx()`), like
      `caller` before it - defaults to `null`, every existing test and stored
      block unaffected.
- [ ] Two legs signed together with a matching `batch_digest`, submitted as the
      complete, correctly-ordered batch, settle exactly as an unbound batch
      would.
- [ ] Either leg submitted standalone (not inside any batch) is rejected
      `BATCH_LEG_MISBOUND`, and moves nothing.
- [ ] Submitting only one of the two legs as a new, smaller "batch" is rejected
      the same way - the recomputed digest over that subset does not match what
      was signed.
- [ ] Reordering the same two legs into a new batch is also rejected - digest
      is order-sensitive, since batch execution order is semantically
      meaningful here.
- [ ] Adding a third, unrelated leg alongside the original two also breaks the
      match for the original two (the signer's exact set is enforced, not just
      a subset relationship).
- [ ] A leg with no `batch_digest` is completely unaffected or protected -
      documented as opt-in, not a silent behaviour change for existing demo
      buttons/tests that don't use it.
- [ ] `Network` gains a convenience builder (mirroring `agentTx`/`grantTx`'s
      style) so a real caller can actually produce a bound batch without
      hand-computing the digest themselves.
- [ ] `schema()`'s `signed_digest` description and error catalog
      (`BATCH_LEG_MISBOUND`) are updated to match.
- [ ] `npm test` stays green; new tests in `test/batch.test.js`.

## Blocked / needs input

*(Populated during the loop if something needs a decision only Caleb can
make, or is a business/regulatory action rather than code. Nothing here yet.)*

## Not in this roadmap (explicitly out of scope for a coding loop)

- Real BFT consensus, a Rust kernel port, real ZK confidentiality (**M1**),
  HSM integration, a real core-banking connector, PvP/cross-currency — all
  correctly flagged as out of scope in `poc/README.md`'s "What it is NOT" and
  gated behind spikes S1–S10 in `02-technical-implementation.md`, which need
  real infrastructure, real cryptographic review, or real bank
  counterparties, not another coding pass. (**M2**, the access-control
  confidentiality mode, is different and is Priority 4 above.)
- Anything in `00`–`04` and `board/*.md`: regulator meetings, board votes,
  legal opinions, bank onboarding — business and regulatory work, not code.

## Session log

- 2026-09-29 — Priority 7: closed both Priority 6 gaps. Spec written into this file unchecked and committed first; 19 tests in `test/delegation-gaps.test.js` written first, 13 red (the other 6 pin behaviour that must not change), then implemented. **7.1** a sweep registered under a grant stores `grant` (omitted for institution sweeps, so no state root moved); `#runSweeps` now chains, takes the headroom (per-instruction max and every ancestor's remaining window), moves `min(excess, headroom)`, and charges through `#charge` - the same helper `#authorize` now uses, extracted rather than copied. A dead chain suspends the sweep (reported in `sweepFires` as `suspended` with the reason; still registered; institution can cancel). **7.2** `tx_BATCH` collects each leg's effective caller (derived from its grant if agent-authorised, else declared, else `unspecified`), rejects `BATCH_MIXED_CALLERS` unless identical, and sets the outer result's caller from them; the outer batch's own declared caller is ignored because nothing signs it. Model checker: 3 new delegation actions (agent-registered sweep `s9`, an agent batch, a mixed-caller batch attack), the S6 oracle rewritten to walk blocks in order carrying what the action has already charged to each window, so batch legs and sweep firings are judged against what earlier ones left; two new planted bugs, plus the four earlier ones re-run against the bigger alphabet, all caught. Delegation model exhausted at depth 13: 1,767 states, 33,573 transitions, 25.1 s, zero failures; routine 40-action base run unchanged at 3,793 / 40,680. **One test expectation of my own was wrong, caught by running:** I asserted a child sweep would fire only on the *next* heartbeat after a parent transfer used up part of the shared cap, but sweeps also fire at the end of the transfer's own block, so the $500 moved in the same block; the kernel was right, the test was corrected. Full suite: 140/140 (was 119), ~67 s. Still open: demo agent keys are not persisted across restarts; nothing attests that an agent-key holder is software.


- 2026-09-29 — Priority 6: agent-native access, all of 6.0-6.4, built from `poc/docs/agent-native-access-proposal.md` after Caleb signed off with all three recommended options (full grants build, sub-delegation now, spend counted against every ancestor's window). Spec written into this file unchecked and committed first, tests before code. **6.0** found while writing the proposal, not by a test: `tx_PAYMENT`'s queue entry rebuilt the stored tx without `caller`, so a queued-then-netted payment lost its attribution in state - fixed (caller kept only when not `unspecified`, so old state roots are unchanged), and the stale "nothing here distinguishes who is calling" header comment in `kernel.js` corrected. **6.1** `GRANT`/`REVOKE_GRANT`, `#authorize` (stands in for the `ops` signature on six grantable handlers; with no agent signature it *is* the old `#sig` call, so every existing path is byte-identical - confirmed by running all 76 old tests before and after, and `grants` is absent from `stateView()` until first used so no state root changed), `#chain` (revocation/expiry of any ancestor kills the chain, so cascade needs no enumeration), tumbling windows charged to every ancestor through the same undo journal, derived caller. 31 tests in `delegation.test.js`, written first and confirmed red (all but two failed on the missing API; the 6.0 one failed for the real reason, the dropped caller). **6.2** `submitSigned`/`schema()`/`grantsView()` on `Network` plus `POST /api/submit`, `GET /api/schema`, `GET /api/grants` on the demo server; 7 tests in `agent-interface.test.js`, red first; HTTP layer checked with curl on a fresh port (bad JSON, unsigned/expired instruction, schema, empty and filtered grants, bad issuer now a 400 not a 500) but **not** a fully signed instruction over HTTP, because the demo server holds every key and an outside caller cannot obtain one - that path is covered at the `submitSigned` level only. Dashboard block-log tag distinguishes a kernel-derived agent ("agent - grant") from a self-declared one. **6.3** unlike 5.1/M2 this gates authority, so it is model-checked: oracle `checkDelegation` (S6) written from the spec with the topology fixed by the model, 13 new actions, and grants added to the compared state so S2 catches window leaks. Adding the actions to the routine alphabet would have hit the 5,000-state cap at depth 5 and silently explored less of the original model, so the routine run stays at 40 actions (3,793 states / 40,680 transitions, unchanged) and delegation is searched on a focused 16-action alphabet: exhausted at depth 12 (989 states, 15,824 transitions, 11.6 s), zero failures; the combined 53-action run is capped and reported as a data point, not a proof. Four planted bugs, all caught. Mutation tests were written after the oracle, not red-first - honest about that in the charter. **Mistakes of my own, caught by running, not inspection:** a test helper defaulted a grant's expiry to one day and a window test advanced the clock a day plus a second, so the grant expired instead of the window resetting (moved the default to seven days); the quarantine test used a same-issuer `TRANSFER`, which the kernel never gates on quarantine (only cross-issuer movement checks it) - switched to `PAYMENT`; a test error message used `JSON.stringify` on an object holding a BigInt; and my first attempt to restructure the model alphabets was lost to a tooling failure (Bash unavailable for a stretch), which I noticed by reading the file back rather than assuming the edit had landed. Deferred and stated in the README: sweeps are gated only at registration; batch legs' derived caller is not surfaced on the outer result (F4); demo agent keys are not persisted across restarts. Full suite: 119/119 (was 76), ~59 s.


*(One line per completed item, newest last.)*

- 2026-09-28 — Priority 5.1: caller-type attribution, the concrete follow-up promised at the end of the Web4/agentic-internet framing review earlier this session. Added an optional `caller: { kind: 'human'|'agent', label? }` to every instruction, included in the same signed digest as `payload` via `messageOf()`/`tx()` - not a new key or access class, just the existing signer's own declaration, exactly as tamper-evident as the payload it already signs. Defaults to `{ kind: 'unspecified' }` on both the signing and verifying side so every existing call site, stored block and `verifyReplay()` run is untouched with zero migration - confirmed by running the full 72-test suite unmodified before writing a single new test. 4 new tests in `test/caller-attribution.test.js`, written first and confirmed red against the unmodified code (3 of 4 failed as expected; the replay test passed trivially since it wasn't asserting on `caller` yet). One real test-design mistake found while implementing, not a code bug: my first `lastTx()` helper assumed the most recent block was always the instruction just submitted, but `pay()` can trigger a later adapter follow-up block (`CLOSE_CONVERT_IN`) that has nothing to do with the caller under test - fixed by searching chronologically for the actual instruction type instead of assuming block order, caught by actually running the tests and reading why two of them failed for a reason unrelated to the feature, not by inspection. Surfaced in `stateView()`'s block history, `GET /api/state`, and a new tag in the dashboard's block log (`renderBlocks`) for agent-attributed instructions - confirmed via a fresh server run, curl, and a browser console check (no errors). Deliberately not model-checked, same reasoning as M2 (4.1): `caller` is metadata no `tx_*` handler branches on, so it can't itself create a new reachable state; recorded in `docs/invariant-charter.md` next to M2's own entry, including the honest limit that this proves the declaration is tamper-evident, not that it's true - a signer can still falsely self-label. `poc/README.md`'s demonstrates table gained a row; the stale "No caller-type distinction" line added during the framing review (now incorrect) was replaced with that same honest self-attested-vs-verified limit. Full suite: 76/76 (was 72).
- 2026-09-27 — **All roadmap items complete (48/48 checkboxes).** Cleanup pass: scanned for TODO/FIXME/XXX (none), stray debug `console.log` calls (none beyond the pre-existing, intentional CLI-output ones in `bench.js`/`modelcheck.js`/`server.js`), and unused exports from this session's own additions (`parseNonNegAmount`, `ID_RE`, every new tx handler and Network method - all are used, none orphaned). Every `src/*.js` file parses cleanly. `poc/package.json`'s description updated - it still named only the original three templates. Working tree otherwise clean; nothing left uncommitted. Final numbers for the whole roadmap: 4 new kernel templates, 7 new/extended source files, 6 new test files, 60 tests (was 34), 9 commits, all on `main` (no push - remote is `30EVentures/DepositX`, private).
- 2026-09-27 — 3.1: wired all four new templates into `server.js`'s `act()` (escrowLock/escrowRelease/eventRelease/escrowRefund, registerSweep/cancelSweep, batchDemo + batchEmpty/batchNested guard-rail demos) and added matching dashboard sections 8-10 to `public/index.html`, in the existing visual style. Server-side wiring functionally tested via direct HTTP calls for all 11 new action kinds on a locally-run server (port 8799, not the one already running on 8787 for someone else - left untouched). One own mistake caught immediately, not a code bug: registering a sweep with `keepAmount:"0"` from an account that already held a balance swept its *entire* balance right away - correct, designed behaviour, not a bug; just not the demo scenario I meant to run next. Opened the real rendered page in the browser: all three new sections render correctly (copy, controls, styling matching the existing sections exactly), and a live click-through of Escrow Lock then Release worked end to end through the actual UI (blocks #53 ESCROW_LOCK, #56 ESCROW_RELEASED), not just curl. Full suite still 60/60 (server.js has no automated tests; this is the manual check the roadmap itself called for).
- 2026-09-27 — 3.2: `poc/README.md`'s "What it demonstrates" table gained rows for Escrow, PayOnEvent, Batch and Sweep (each naming its code and test), the model-check row updated with the real 37-action/depth-5-and-6 numbers, and "What it is NOT" re-checked line by line (added the sweep-safety-property limitation, updated the account count; everything else there is still correctly true - real consensus, ZK, HSMs and a Rust port remain out of scope). Root `README.md`'s PoC description and test count updated too. Test-count and timing lines that were stale (34 tests, depth-8 ~6 min) are now accurate (60 tests ~45s, depth-6 ~100s). No functional code changed; no test re-run needed.
- 2026-09-27 — Priority 2 (keep the honesty file honest). Added Network convenience wrappers for all four new templates first (`escrowLock`/`escrowRelease`/`eventRelease`/`escrowRefund`, `registerSweep`/`cancelSweep`, `batch()`), reused by both the model checker and (later) the dashboard. Extended `modelcheck.js`'s action alphabet 27 -> 37 and added a second same-issuer account, without touching the existing accounts' combinatorics. Added 3 planted-bug mutation tests (roadmap 2.2) for the new templates: an escrow-release-prints-money bug (caught by the existing **P1** invariant, no new checker code), a batch-leg-not-rolled-back bug (caught by the existing **S2** property), and a PayOnEvent wrong-oracle bug (caught by **S3**, after correctly reclassifying that model action from 'legit' to 'attack'). One real false start along the way, found and fixed, not hidden: the first version of the batch mutation test went undetected because the model's batch action used a same-amount mirror pair (pay $1 then pay $1 back), whose second leg is always self-funded by the first leg's own cross-issuer settlement contribution - fixed by using mismatched amounts ($1 then $2), confirmed by hand before changing the code. One honest non-generalizing finding recorded rather than forced: a sweep moving the wrong amount conserves total money and trips no P1-P7 formula, so only `sweep.test.js`'s own targeted tests would catch that class of bug. `poc/docs/invariant-charter.md` updated with real before/after state counts (27 actions/depth 8/40,000 states before; 37 actions/depth 5/3,560 states in the routine test; a one-off depth-6/12,181-state run for a deeper honest data point) and the new limitation. Full suite: 60/60 (was 54), ~44s (was ~16s) - not shrunk to look faster.
- 2026-09-27 — 1.4 Standing/Sweep (registered same-issuer rule, fires at `#endOfBlock`, the same deterministic hook the graded halt already uses, so no separate submitted instruction is needed and it replays identically from the log). `executeBlock` and `Network#makeBlock` now surface `sweepFires` alongside `violations`. 6 new tests in `test/sweep.test.js`, written first and confirmed red first, including a hand-computed two-sweep cascade (elm/fjord, LKS) pinned to exact resulting balances, and a durable-store recovery test confirming a registered sweep survives a restart and keeps firing. All 6 passed on the first implementation attempt — the cascade math worked out by hand matched the code's actual output exactly. Priority 1 (all four launch-set templates: Escrow, PayOnEvent, Batch, Sweep) is now complete. Full suite: 54/54.
- 2026-09-27 — 1.3 Batch (all-or-nothing legs) implemented: `#execTx`'s generic checks were already extracted into `#checkEnvelope` in the previous pass specifically for this, so `tx_BATCH` dispatches each leg to its own existing handler against the same top-level Journal and gets atomicity for free from `#execTx`'s existing rollback-on-error. 7 tests in `test/batch.test.js`, written first (red first: all 7 failed against the unmodified kernel). Two of my own test assumptions were wrong once the implementation existed — an escrow id with capital letters, and an expected same-issuer leg emitting cross-issuer CONVERT events it shouldn't — both fixed in the test, not the kernel; every atomicity, replay-protection and nesting-guard assertion passed on the first implementation attempt. Full suite: 48/48.
- 2026-09-28 — Priority 4.3: extended `modelcheck.js`'s action alphabet 37 -> 40 for External-CSD DvP (roadmap 4.2), since unlike M2 this composition moves real balances through the real transaction path and deserved exhaustive-state coverage, not just unit tests - the same reasoning that motivated Priority 2.1 for the other four templates. Added a fixed cross-issuer lock (`csd1`), the correct confirmation, and a wrong-event-name release reclassified as an attack. Zero failures at both the routine depth (5: 3,793 states, 40,680 transitions, ~31s) and a one-off deeper check (6: 13,673 states, 151,720 transitions, 116.9s). No new mutation test needed and none added: the mechanism is the already-mutation-tested `tx_ESCROW_LOCK`/`tx_EVENT_RELEASE`, confirmed by re-running the existing escrow-prints-money and wrong-oracle mutations against the extended alphabet - both still pass. `docs/invariant-charter.md` and `modelcheck.test.js`'s thresholds updated with the real measured numbers. Full suite: 72/72 (unchanged test count - this is additional coverage of existing code, not a new feature).
- 2026-09-28 — Priority 4.2: External-CSD DvP, the spec's own named conditional-settlement scenario (02-technical-implementation.md section 2.4). No new kernel handler - `Network.externalCsdDvp`/`csdConfirm` are a correctly-configured composition of Escrow (1.1) and PayOnEvent (1.2): lock the cash leg only, gated on a new dedicated `csd-confirmation` oracle (distinct from the generic `delivery`/`inspection` examples), with a deadline; release via the existing `eventRelease`, refund via the existing `escrowRefund`. 6 new tests in `test/external-csd-dvp.test.js`, written first and confirmed red, 5 of 6 passing on the first implementation attempt. Two test bugs of my own along the way, not code bugs: I tried to lock more than MPL:harbour's actual bootstrap balance, and I asserted harbour's security holdings started at zero when it is actually a bond dealer that already holds CAN-2031 from bootstrap (fixed to compare before/after, using the codebase's own BigInt-safe `canon()` since raw JSON.stringify chokes on security quantities). One real edge case investigated rather than assumed: a CSD confirmation arriving after the deadline still succeeds if nobody refunded first - proven true by the test, not guessed, and recorded plainly in `poc/README.md` as the spec itself instructs ("say so plainly; the residual risk window is defined"). Full suite: 72/72 (was 66).
- 2026-09-28 — Priority 4.1: M2 confidentiality (issuer-domain need-to-know), continuing the roadmap at Caleb's request after it had reached 48/48. Grounded in 02-technical-implementation.md T-6, which says M2 needs no cryptography, unlike M1 (ZK, still correctly out of scope) - it is access control, so it was buildable at PoC scale with no new dependency. `confidentialView(snapshot, viewer)` in `network.js`: a pure transform, not a kernel change - an issuer sees its own book in full and every other issuer's id/name/status/quarantine only (status stays visible so a payer can still avoid a quarantined counterparty without seeing its balance sheet); the supervisor view is byte-identical to today's full snapshot. Wired into `GET /api/state?viewAs=<id>` and a new "Viewing as" selector in the dashboard header. 6 new tests in `test/confidentiality.test.js`, written first and confirmed red (the import itself failed, since the function didn't exist), all 6 passing on the first implementation attempt. Two things found and fixed while wiring the dashboard, not in the design: `renderIssuers()` and the action dropdowns both assumed every issuer always has a `customers` array and would have thrown on a redacted one; and an initial `onchange="..."` inline handler didn't match this file's style (everywhere else uses `addEventListener`) - replaced. Confirmed live in the browser, not just by curl: switching to "Maple Bank" correctly showed its own full book while North Star and Lakeshore collapsed to "Confidential (M2): only status is visible to another issuer - not its book," and the payment dropdowns correctly stopped offering accounts at issuers whose book isn't visible (a disclosed, honest side effect, not a bug). Deliberately not model-checked - reasoning recorded in `docs/invariant-charter.md`: a read-only view outside the transaction path cannot itself produce a new reachable state or a P1-P7 violation. `poc/README.md`'s demonstrates table and "What it is NOT" both updated. Full suite: 66/66 (was 60).
- 2026-09-27 — 1.1 Escrow (lock/release/refund) and 1.2 PayOnEvent (event-gated release) implemented together in `kernel.js` (four new tx_ handlers, `escrows` state added to `stateView()`), `network.js` (named event-oracle keys in genesis and the dev keystore, serialized for recovery), and `test/escrow.test.js` (7 new tests, written before the code and confirmed red first). One real design bug found while writing tests, not just a test bug: ESCROW_RELEASE defaulted its release role to the payer even for event-gated escrows, which would have let a payer release their own PayOnEvent escrow unconditionally — fixed by requiring EVENT_RELEASE for any escrow with an eventName (`USE_EVENT_RELEASE`). Full suite: 41/41 passing (34 original + 7 new).
- 2026-09-27 — Roadmap created from a fresh read of `poc/src/*.js`,
  `poc/docs/invariant-charter.md`, `poc/README.md`, and
  `02-technical-implementation.md` §2.5; all 34 existing tests confirmed
  passing before any change.
