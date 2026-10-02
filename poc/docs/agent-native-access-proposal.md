# Proposal: agent-native access (delegated, narrowing, verifiable)

Status: **signed off and implemented 2026-09-29 as roadmap Priority 6** (all three recommended options
taken: full grants build, sub-delegation now, spend counted against every ancestor's window). The body
below is the original proposal, kept as written; where the build differs, §10 says how and why.
Follows Priority 5.1 (caller-type attribution).

**Open proposal, not built:** §11 (X3) designs an institution-wide aggregate cap across sibling root grants.

## 10. Amendments made while implementing (read this first if you are comparing to the code)

- **Grantable types** are `TRANSFER`, `PAYMENT`, `ESCROW_LOCK`, `ESCROW_REFUND`, `REGISTER_SWEEP`,
  `CANCEL_SWEEP` and `GRANT` (the sub-delegation right). Mint, redeem, DvP, funding, halt/resume,
  netting and every `gov:`/`anchor`/`reconciler` action are not grantable — an explicit deny-by-default
  list in `kernel.js` (`GRANTABLE_TYPES`), not a convention. `REVOKE_GRANT` is never in a grant: the
  institution, or an *ancestor's* agent key, may revoke; a descendant may not.
- **Everything in an envelope is mandatory**: per-instruction max, window cap and a future expiry. There
  is no unbounded grant (`GRANT_UNBOUNDED`).
- **Window narrowing is enforced at use time, not by comparing window lengths at grant time.** A
  sub-grant's cap must be ≤ its parent's cap, but its window *length* is free; because spend is counted
  against every ancestor's own window, a longer or shorter child window can never let the chain spend
  more than any ancestor allows. (§3.1 said "same or shorter window"; that rule was dropped as redundant.)
- **Windows are tumbling**, anchored at the first spend, not sliding.
- **A co-signed (escalated) instruction is authorised by the institution and does not consume the
  window.** Stricter alternative (count it) rejected: the institution has explicitly approved that one.
- **Depth**: a root plus four levels of sub-grants (`MAX_GRANT_DEPTH = 5`).
- **Sweeps** were first gated only at registration; **roadmap 7.1 closed that.** A sweep registered
  under a grant records it, is charged to the grant's whole chain at every firing, moves only the
  remaining headroom (partial firing) and waits for the next window for the rest; a dead chain suspends
  it (registered and visible, moving nothing; the institution can cancel it).
- **Batch attribution (F4)** was first deferred; **roadmap 7.2 closed that.** A batch's caller is derived
  from its legs and legs with different effective callers are rejected (`BATCH_MIXED_CALLERS`).
- **Agent keys are demo-custodied by `Network`** (`agentKeys`) so the dashboard process can build test
  instructions; they are not persisted across a durable-store restart. A real agent brings its own key:
  `grantAgent({ key })` / the `GRANT` payload carries only the public half.
- **F1 and F2 are fixed** (roadmap 6.0): a queued payment keeps its caller in stored state, and the
  `kernel.js` header no longer claims nothing distinguishes callers.

## 1. The gap 5.1 leaves

5.1 answers "can an audit trail tell an agent's instruction from a human's?" It does not answer the
two harder questions an autonomous caller raises:

1. **Authority.** Today an institution's software agent must hold the institution's `ops:<issuer>`
   key — the same key that can mint, redeem, pay, and register sweeps up to the kernel's global
   `#cap`. The only way to give an agent "just the 24/7 treasury sweep" is to give it everything.
   P6 (Authority) checks *which key signed*, never *how much authority that key was meant to carry*.
2. **Truth of the declaration.** `caller.kind` is self-attested. A human holding the key can label
   themselves `agent` and vice versa.

Both have the same root: the only identity in the kernel is "a role key signed". Fix the root, not
the label.

## 2. Design in one paragraph

An institution's `ops` key signs a **grant** recorded on the ledger: an *agent key* may sign a named
set of instruction types, inside an **envelope** (per-instruction cap, rolling-window cap,
counterparty allow-list, expiry), and may itself sub-delegate only a **subset** of that envelope.
The kernel accepts an `agent:<grant_id>` signature in place of `ops:<issuer>` for covered
instructions, and stamps `caller` itself from the grant — so for delegated instructions the
agent/human distinction is *derived from which key signed*, not declared. Anything outside the
envelope needs the institution's own `ops` signature as well (**escalation**), or is rejected.
Grants can be revoked instantly. Everything is integer cents (existing `BigInt`/decimal-string
convention) and everything the kernel needs to decide is on-chain state, so the kernel stays a
pure function of `(genesis, blocks)` and replay is unchanged.

## 3. Concrete shape

### 3.1 Grant (new instruction `GRANT`, signed by `ops:<issuer>`, or by a parent grant's agent key)

```json
{
  "grant_id": "treasury-sweeper-1",
  "issuer": "MPL",
  "agent_key": "<ed25519 public key, hex>",
  "label": "treasury sweeper v3",
  "parent": null,
  "allow_types": ["REGISTER_SWEEP", "CANCEL_SWEEP", "TRANSFER"],
  "per_instruction_max": "5000000",
  "window": { "seconds": 86400, "max_total": "50000000" },
  "counterparties": ["MPL:acme", "MPL:harbour"],
  "not_after": 1790000000
}
```

Rules the kernel enforces **at grant time** (monotonic narrowing — authority only shrinks):

- `issuer` must equal the granter's issuer; a grant can never reach another issuer's accounts.
- If `parent` is set, every field must be a subset/lower-or-equal of the parent's: `allow_types ⊆`,
  `per_instruction_max ≤`, `window.max_total ≤` (same or shorter window), `counterparties ⊆`,
  `not_after ≤`. Widening is rejected (`GRANT_WIDENS_PARENT`).
- `allow_types` may never include `GRANT`-of-wider, `FUND_SP`/`DEFUND_SP`, `RESUME`, `NET_CYCLE`, or any
  `gov:`/`anchor`/`reconciler` action. Mint/redeem are excludable by default and must be named.
  The set is an explicit deny-by-default list in the kernel, not a convention.
- Amounts are decimal strings of cents, parsed by the existing `parseAmount`.

### 3.2 Using a grant

An instruction is signed by `agent:<grant_id>` instead of `ops:<issuer>`. `#sig` resolves that role to
the grant's `agent_key`, then calls a new pure `#envelope(grant, tx, time)` that returns one of:

| Result | Meaning | Kernel behaviour |
|---|---|---|
| **ALLOW** | type allowed, amount ≤ per-instruction max, window total + amount ≤ cap, counterparties ok, not expired, not revoked, whole parent chain valid | proceeds; grant's window counter updated through the journal (so rollback works) |
| **ESCALATE** | in-scope type, over an amount/window limit | rejected as `ESCALATION_REQUIRED` unless the *same instruction* also carries the institution's `ops:<issuer>` signature |
| **DENY** | type/counterparty not in scope, expired, revoked | rejected (`ENVELOPE_DENIED`, `GRANT_REVOKED`, `GRANT_EXPIRED`) |

`screen:` and `accept:` signatures are unchanged — a payment still needs the payer's screening key and
the payee issuer's acceptance. An agent grant substitutes for one signature, not the pipeline.

Escalation reuses the existing multi-signature machinery; there is no new "approval workflow" in the
kernel. A human (or a second, wider-scoped agent) countersigns the same digest.

### 3.3 Derived caller (closes the self-attestation gap, partly)

When the accepting signature is `agent:<grant_id>`, the kernel sets the recorded caller to
`{ kind: 'agent', grant_id, label }` from the grant and **ignores/validates** any `caller` the
instruction declared (mismatch → `CALLER_MISMATCH`). When the signature is the plain `ops` key,
5.1 behaviour is unchanged. Net effect: a supervisory query can distinguish "signed by a key that a
grant says belongs to software X, within envelope E" from "signed by the institution's own key,
self-labelled".

### 3.4 Revocation

`REVOKE_GRANT { grant_id }` signed by `ops:<issuer>` (or the grant's own parent agent key, for
sub-grants). Effective in the block it lands in; validity is checked by walking `parent` at use time,
so revoking a parent invalidates every descendant without enumerating them. The existing graded
halt/quarantine remains a stronger override: a quarantined issuer rejects agent instructions like any
other.

### 3.5 What stays as it is

- `inst_id` dedup and `valid_until` (≤ 60 s) already give an agent safe retries and bounded replay.
  Worth naming as a feature: **idempotent submission is already agent-grade.**
- Money: integer cents as decimal strings throughout; no floats introduced.
- Determinism: window accounting uses block time and on-chain counters only. No clocks, no I/O.

## 4. The interface an agent actually needs

The dashboard's `POST /api/action` takes `{kind: "pay", from, to, amount}` and **the server signs with
keys it holds** (`Network#sk`). That is correct for a demo and wrong for any real agent: an agent
must sign with its own key. Proposed:

- `POST /api/submit` — accepts a fully signed instruction (`inst_id, type, payload, valid_until,
  caller?, sigs`). The server never signs. Returns the block result including derived `caller`.
- `GET /api/schema` — machine-readable list of instruction types, required roles, payload shapes, and
  the **error catalog** (code, `retryable`, `remedy`, e.g. `ESCALATION_REQUIRED → add ops signature`).
  `KernelError.code` already exists; this only adds metadata.
- `GET /api/grants?issuer=…` — active grants and remaining window headroom, so an agent (or its
  supervisor) can plan within its envelope instead of discovering it by failure.

Still local-only (`127.0.0.1`), as now. This is an interface shape for the PoC, not a hosted service.

## 5. Assurance plan (this is why it is a proposal, not a tweak)

5.1 was deliberately not model-checked because `caller` is metadata no handler branches on. **Grants
are the opposite: they gate authority (P6).** They must be exhaustively checked:

- New safety property **S6 (delegation soundness)**: for every reachable state, every executed
  agent-signed instruction was inside its grant's envelope *at the time*, no revoked/expired grant
  authorized anything after revocation/expiry, and every grant's fields are ⊆ its parent's.
- New model actions: grant, sub-grant, revoke, agent-pay within cap, agent-pay over cap (escalation
  attack), agent-pay after revoke (attack), agent widening attempt (attack).
- Mutation tests (planted bugs the checker must catch): window counter not journaled (rollback leak),
  revocation not cascading to children, narrowing check comparing strings instead of BigInts,
  escalation accepted without the `ops` signature.
- Same discipline as prior priorities: spec unchecked → tests red → implement → real numbers in
  `docs/invariant-charter.md`.

## 6. Honest limits (state these in the README if built)

- **Key holder ≠ software.** A grant proves "the holder of this agent key acted in this envelope",
  not that the holder is actually autonomous software rather than a person with the key. That needs
  attestation of the running software (out of scope). What improves: the *authority* is provably
  bounded regardless, which is the property regulators and counterparties actually rely on.
- Key custody, rotation, and compromise of an agent key are out of scope for the PoC. The envelope
  bounds the damage; it does not prevent it.
- Window caps are per grant, not per institution: N sibling grants can sum to N × cap unless the
  parent's cap covers descendants (proposed: a sub-grant's spend counts against every ancestor's
  window — cheap to implement, needs a decision, see §8).
  Spend under a *tree* is now bounded by its root (Priority 6), but separate root grants still share no
  ceiling: measured, three roots with a $2,000 cap each moved $6,000 in one window. §11 (X3) proposes the fix.
- Regulatory treatment of delegated software agents (outsourcing/third-party-risk classification,
  supervisory reporting of agent-initiated payments) is a question for counsel; nothing here asserts
  it. It extends the open question already added to `02` §10.

## 7. Findings from reading the code for this proposal

Independent of whether this is approved:

- **F1 — 5.1 gap (real bug candidate).** `tx_PAYMENT`'s queue entry rebuilds the stored transaction
  without `caller` (`src/kernel.js`, the `j.field(this.s, 'queue', …)` line). A payment that is queued
  for liquidity and later settled by `NET_CYCLE` loses its agent attribution in stored state, and its
  settlement is attributed to the operator's `NET_CYCLE` instruction. 5.1's tests didn't exercise
  queued payments. Small TDD fix; should be done regardless.
- **F2 — stale comment.** The header of `src/kernel.js` still says "Nothing here distinguishes who is
  calling … caller identity/type would need to be added, not here." False since 5.1.
- **F3 — server holds every key.** `Network#sk` signs for all roles; there is no submit-signed path
  (see §4). Fine for a demo, worth stating in README's "What it is NOT" if not already explicit.
- **F4 — batch attribution.** A `BATCH`'s legs each carry their own `caller`; the outer instruction's
  caller is not required to match. Decide whether a batch should require uniform caller kind.

## 8. Decisions needed

1. **Scope of first cut:** grants + envelope + revoke + derived caller (recommended), or attribution-only
   fixes F1/F2 first and grants later?
2. **Sub-delegation:** build it now (narrowing is the interesting property and the model checker
   covers it) or single-level grants only, with `parent` reserved in the schema?
3. **Ancestor-window accounting** (§6): spend counts against every ancestor's window (recommended,
   stricter, simple) or per-grant only?

## 9. Proposed roadmap items (not yet in `ROADMAP.md`)

- **6.0** Fix F1 (carry `caller` into the queued tx) and F2 (header comment); test for queued-payment
  attribution surviving a `NET_CYCLE`.
- **6.1** `GRANT` / `REVOKE_GRANT` instructions, envelope check, derived caller, error codes.
- **6.2** `POST /api/submit`, `GET /api/schema`, `GET /api/grants`; dashboard shows grant headroom.
- **6.3** Model checker: S6 plus the new actions; four mutation tests.
- **6.4** Docs: README table row, "What it is NOT" update, invariant-charter entry with measured numbers.

## 10. Amendments after the build

- **Grant binding (roadmap 8.5, 2026-10-12).** The grant an agent signs under is now named inside the signed
  digest (`grant`), mandatory for any instruction carrying an `agent:<grant_id>` signature, else `GRANT_MISMATCH`.
  This closes a splice that sections 6 and 7 did not consider: with two grants sharing one agent key, the role
  label alone chose the grant, so a relayer could move signed bytes onto the broader one. See
  `grant-binding-proposal.md` and `invariant-charter.md`.

---

# 11. Proposal X3: an institution-wide aggregate cap (not built)

Status: **proposal only, 2026-10-02, for review. No kernel code.** Follows Priorities 6 and 7. This is the
"per grant, not per institution" limit §6 already names, worked into a design.

## 11.1 The gap, measured

§6 says window caps are per grant and that a sub-grant's spend counts against every ancestor, so a *tree*
is bounded by its root. It stops there: **separate root grants have no common ancestor.** Only `ops:<issuer>`
can create a root grant, so the institution can create as many as it likes, and each carries its own
independent cap. Verified against the code rather than assumed: three root grants of the same issuer, each
with a $2,000 window cap, moved **$6,000** in one window, six agent-signed transfers, no co-signature and no
refusal. The institution's total agent-authorised outflow is therefore bounded by (number of live root
grants) x (cap), and nothing in the kernel states or enforces a single number for it.

What this does and does not protect against, stated up front so the proposal is not oversold:

- **It bounds the blast radius of compromised or misconfigured agent keys.** An attacker holding several
  agent keys, or an operator who minted a dozen overlapping roots, cannot move more than one auditable
  figure per window.
- **It gives a regulator or counterparty a single number**: "this institution's agents can move at most X per
  window", independent of how many grants exist today or are created tomorrow.
- **It does not protect against a compromised `ops:<issuer>` key.** That key can raise the cap, mint new
  grants, or skip agents entirely and sign instructions itself. The cap bounds *agents*, not the institution.

## 11.2 Options

**Option A: a separate per-issuer counter.** Add an optional `budget: {window:{seconds,max_total}, win:{start,spent}}`
to the issuer record. `#authorize` and `#runSweeps` check it in addition to the grant chain and charge it in
addition to the chain. Smallest conceptual change, but it is **new accounting code in the same two places
that already do the grant accounting**, i.e. a second implementation of "tumbling window, journaled, charged
by instructions, batch legs and sweep firings" that can drift from the first. 7.1 was specifically careful to
share one `#charge`/`#window` for exactly this reason.

**Option B (recommended): the issuer budget is the implicit root of every chain.** Store the budget as a
grant-shaped record (`{window, win, per_instruction_max: none}`) that `#chain()` appends as the final element
of every grant chain *for that issuer*, when one is set. Every existing mechanism then applies unchanged:
spend is already charged to every chain member (so sibling roots now share the top node), `#headroom` already
takes the minimum over the chain (so sweep firings are bounded by it, including partial firing), windows are
the same tumbling windows, escalation is the same ESCALATE path, and S6's chain walk covers it. Nothing is
reimplemented. When no budget is set the chain is exactly what it is today, so **existing state, replay and
every existing test are unchanged**. Costs: the synthetic node counts one level toward `MAX_GRANT_DEPTH` (5),
so real chains lose one level unless the limit is raised to 6, and the record must be hidden or labelled in
`GET /api/grants`.

**Option C: static admission control at `GRANT` time.** Reject a new root grant if the sum of live roots' caps
would exceed the budget. No runtime accounting at all. Rejected as the main design: windows have different
lengths so "sum of caps" needs a lossy normalisation (per-day?), idle or expired roots still count unless
the sum is recomputed, and it bounds what *could* be spent rather than what *was*. Cheap, though, and a
reasonable stopgap if B's depth cost is unwelcome.

## 11.3 Shape of Option B

New instruction **`SET_AGENT_BUDGET`**, payload `{ issuer, window: {seconds, max_total} | null }`, signed by
`ops:<issuer>`. It is **never grantable** (an agent can never touch its own ceiling, the same rule as
`REVOKE_GRANT`): it is simply absent from `GRANTABLE_TYPES`, which is the deny-by-default list. `null` removes
the budget. Rules, each chosen to match what the chain already does:

- **Over the budget is ESCALATE, not DENY**: the instruction needs the institution's own `ops` signature as
  well, exactly as one over a grant cap does today, and an escalated instruction does not consume the budget.
- **Sweep firings charge it** through the shared `#charge`, and a suspended firing (7.1, X2) charges nothing.
- **Escrow locks charge at lock; refunds do not credit back.** Conservative: the budget bounds outflow
  *authorised*, not net outflow. See decision 4.
- **Batch legs** each charge once, and a failing batch restores the counter, as the grant windows do.
- **Lowering takes effect at once.** Raising is an authority widening and is also `ops`-signed; whether it
  should take a second key or a delay is decision 2.

## 11.4 Invariant and model-checker changes it would need

**Invariants.** P1 to P5 and P7 are untouched: the budget moves no money and changes no balance. It extends
**P6 (Authority)** with one clause: *in any one tumbling window, the sum of non-escalated agent-authorised
outflow of an issuer, across all of its grants and sweep firings, never exceeds that issuer's budget.* This is
the same shape as S6(a), lifted from a chain to the whole issuer.

**New property S6(e), aggregate soundness.** Judged by the existing oracle style: it re-derives the rule from
the block log and the model's own record of which grants exist, sharing no code with the kernel, and walks
each action's blocks in order carrying what the action has already charged (as 7.1 does for sweep firings).

**Model actions** (the delegation alphabet is 21 actions and exhausts at 1,767 states, so expect growth and
possibly a deeper search or a larger cap; measure before promising exhaustion):
a second root grant `g4`, sibling of `g1` (the model's only roots today are `g1`; `g3` is an attack-only
sub-grant); `set budget MPL $3 / 86400 s`; `lower budget to $1`; `agent g4 transfer $2`; and the key attack,
**`agent g1 transfer $2` then `agent g4 transfer $2`**, each inside its own cap, jointly over the budget, where
the second must be refused without a co-signature; plus `ATTACK agent g1 signs SET_AGENT_BUDGET`, which must
always be rejected.

**Planted bugs the checker must catch** (written after the oracle, as in 6.3 and 7.1): the budget charged for
only the first root grant of an issuer; sweep firings not charged to it; the counter not journaled (caught by
S2 because it is part of compared state); money compared as strings; an escalated instruction consuming the
budget in one path but not another.

**Unchanged and to be re-confirmed**: the routine 40-action base model (3,793 / 40,680) and every existing
delegation figure when no budget is set, which is the proof that B is additive.

## 11.5 Honest limits

- **Tumbling windows allow a burst of up to 2x the cap across a boundary** (spend at the end of one window and
  the start of the next). Same property as every grant window; a sliding window is rejected as out of
  proportion here.
- **The cap bounds agents only**, as 11.1 says. It does not bound escalated spend (the institution approved it)
  or direct `ops` instructions.
- **It bounds value, not count.** A flood of tiny in-cap instructions is a separate (rate-limit) question.
- **Currency**: integer CAD cents only, like everything else here.

## 11.6 Decisions needed

1. **Option B (recommended)**, A, or C as a stopgap? B's cost is one chain level; if that matters, raise
   `MAX_GRANT_DEPTH` to 6 deliberately rather than let it shrink silently.
2. **Who may change the budget**: `ops` alone (recommended for the PoC), or a raise needing a second key
   (`gov:`) or a delay.
3. **Optional or mandatory**: unset means unlimited, as today (recommended: additive, no migration), or a
   mandatory default that every issuer must set.
4. **Do escrow refunds credit the budget back?** Recommended no: simpler and strictly more conservative.
5. **Should an escalated, co-signed instruction count?** Recommended no, matching §10's existing decision for
   grant windows (the institution explicitly approved that one).

## 11.7 Proposed roadmap items (not added to `ROADMAP.md`)

- **X3.1** Spec and acceptance criteria into `ROADMAP.md`, unchecked; prototype check that all 209 tests pass
  unmodified with no budget set.
- **X3.2** `SET_AGENT_BUDGET`, the synthetic chain root, `GET /api/grants` presentation, error codes and
  `schema()` entries.
- **X3.3** Targeted tests first (including the three-roots case from 11.1, now refused), then implementation.
- **X3.4** Model checker: `g4`, the budget actions, S6(e), five planted bugs; real numbers into the charter.
- **X3.5** Docs: README row and limits, charter entry, this proposal marked implemented with amendments.
