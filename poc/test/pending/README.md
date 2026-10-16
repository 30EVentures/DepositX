# Pending tests (red on purpose)

These tests describe behaviour that is **not built**. They fail today, by design, and they are NOT part of `npm test`.
Run them with `npm run test:pending`. Each one belongs to a design note or question waiting for a decision:

| File | Belongs to | Waiting for |
|---|---|---|
| `x3-aggregate-cap.pending.test.js` | `docs/agent-native-access-proposal.md` section 11 (X3) | sign-off to build an institution-wide aggregate cap |
| `x4-idempotency.pending.test.js` | `docs/persistent-idempotency-proposal.md` (X4) | sign-off to build a persistent idempotency horizon |

When a decision is made and the feature is built, move the file into `test/` (or `test/hardening/`), where it must pass.
A pending test that starts passing by accident is a signal that the design note is out of date: tell the owner.

Tests named `control` or `additive guarantee` pass today on purpose: they pin the behaviour that must NOT change when the feature is built. Every other test in these files must fail now (checked at the time of writing).
