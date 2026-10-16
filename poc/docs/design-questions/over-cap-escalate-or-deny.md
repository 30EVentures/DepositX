# Design question for the owner: when an agent is over its grant, ask the institution or refuse?

Status: **a question, not a change.** Nothing in the kernel was altered. Written 2026-10-15 for a decision. DepositX is a proof of concept: consensus is simulated, there is no bank partner, and it is not regulated.

## 1. What happens today (Option A)

A grant has a per-instruction maximum and a window cap. An agent instruction that stays inside both is allowed. One that goes over either is **not refused**: it needs the institution's own `ops` signature as well (`ESCALATION_REQUIRED`), and an instruction the institution co-signs runs and is **not charged** to the grant's window. There is no tier above that on the agent path: with the institution's signature, any amount up to the network's per-instruction cap goes through.

Pinned, green: `test/hardening/conformance-options.test.js` (at the maximum is allowed, one cent over escalates, a co-signed spend does not use the window, nothing moves without the co-signature).

## 2. Why it is a question

The policy-guard conformance corpus (44 cases, `policy-guard/1` 0.1.2) has a two-tier model: a soft `autoApproveMax` that escalates, and a hard `perTxMax` / daily cap that **denies**. DepositX has only the soft tier. Measured on this branch, [RAN] with the corpus in the local audit clone:

| | agreed | disagreed | abstained |
|---|---:|---:|---:|
| Option A, today | 15 | 7 | 22 |
| Option B, naive (every ESCALATE reported as DENY) | **12** | 10 | 22 |
| Option B, with the corpus's cap codes | 15 | 7 | 22 |
| Option C, two tiers (estimate, not built) | up to 18 to 22 | | |

Three of the seven disagreements are this question (`caps/per-tx-cap-exceeded`, `caps/daily-cap-exceeded`, `caps/per-tx-checked-before-daily`). Two more (`records/transfer-without-destination`, `envelopes/no-envelope`) are a deliberate consequence of hardening X1 (an unauthenticated caller must not learn which accounts or grants exist), and two (`amount-zero`, `amount-leading-zeros`) are the strict integer-string rule. Four abstentions (`envelope-shape/*`) exist because a DepositX grant has no hard tier to compare against, which option C would remove.

(The earlier count of 17 / 5 / 22 was taken before X1 was merged; X1 added the two reasoned divergences above.)

## 3. The options

**A. Keep it.** Over the grant means ask the institution. Honest about what DepositX is: the institution stays the authority above any agent, and an agent can always be rescued by its institution. Cost: three corpus disagreements stay, by design, and there is no way to say "never, whoever signs" on the agent path.

**B. Replace escalation with refusal.** Over the grant is refused (`ENVELOPE_EXCEEDED`). Measured above: **no gain** (15 agreed either way) and a real loss: it removes the institution's co-signature path, which the delegation design and invariant P6 rely on, and the corpus's soft-tier cases then disagree. A per-grant switch (`on_exceed: "deny"`, default `escalate`) makes it opt-in and keeps the default, but only moves the three cases for grants that opt in.

**C. Two tiers.** Keep today's maximum and window cap as the **soft** tier (escalate), and add an optional **hard** tier (`hard_max`, `hard_window_max`): above it the agent path refuses with `ENVELOPE_EXCEEDED` even with the institution's signature. This matches the corpus's model, fixes the three cap cases, and makes the four `envelope-shape` abstentions expressible. Cost: a new field in the signed GRANT payload (additive: absent means today's behaviour, so existing state and replay are unchanged), narrowing rules for the new field, a change to `#authorize` and to the sweep headroom calculation, new model-checker actions and a planted bug for each, and a decision on whether an institution may override a hard tier at all (recommended: no, that is the point of the tier; it can revoke and re-issue the grant).

## 4. Recommendation

**C**, if the goal is to be checkable against an outside corpus and to give an owner a "never above this" line for an agent; **A** if the goal is only to model the institution-above-agent design, in which case record the three disagreements as permanent and stop. **B as a default is not recommended** (no gain, loses the co-signature path). I have not built any of them.

## 5. Tests

- Option A: green now, `test/hardening/conformance-options.test.js` (including the measurements above, which skip with a stated reason if the corpus is not present).
- Options B and C: `test/pending/over-cap-options.pending.test.js`, red on purpose until a decision (see `test/pending/README.md`). `npm run test:pending` runs them.

## 6. Decision needed

1. A, B (default or per-grant switch), or C?
2. If C: may an institution co-signature ever exceed a hard tier? (Recommended no.)
3. If C: are the new field names (`hard_max`, `hard_window_max`) acceptable, and may the GRANT payload gain them under the single digest-version change already pending?
