# Proposal: agent-native access (delegated, narrowing, verifiable)

Status: **signed off and implemented 2026-09-29 as roadmap Priority 6** (all three recommended options
taken: full grants build, sub-delegation now, spend counted against every ancestor's window). The body
below is the original proposal, kept as written; where the build differs, §10 says how and why.
Follows Priority 5.1 (caller-type attribution).

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
