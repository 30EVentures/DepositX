# Overnight run state (branch overnight/depositx-bugs, from origin/main c672a5b)

> Summary goes here at the end. Working log below.

## Baseline
- `cd poc && npm test` (`node --test test/*.test.js`): 173 tests, 173 pass, 0 fail, on c672a5b [RAN].
- Sibling branches read first, not touched: grant-binding-mandatory (e565e49, the grant `grant`-in-digest fix, unmerged), hardening-x1 (48be21b), hardening-x2 (986ccdd, sweeps vs frozen accounts), proposals-x3-x4 (67e9502). Anything they already cover is logged as KNOWN, not re-fixed.

## Found / fixed (each: red test first, then smallest fix; suite after each)
| # | Round | Finding | Proof | Fix commit |
|---|---|---|---|---|
| 1 | 1 ledger | A handler that throws (no payload, non-string releaseRole, BigInt of junk from a trusted key) escaped executeBlock after height/clock advanced but before the block was logged: one unauthenticated payload-less submit made `verifyReplay()` false for good on origin/main | [RAN] `ledger height 25 log 24, replay ok? false` on a git-archive of origin/main; 4 tests red | 0e167c9 `#execTx` converts non-KernelError to MALFORMED (counted in `counters.internalErrors`) |
| 2 | 1 ledger | Agent PAYMENT with `queueIfShort` and a short position was queued, charged to the grant window, and never settled (NET_CYCLE needs the ops signature the agent payment lacks; stored copy's caller no longer matches the signed digest) | [RAN] NET_CYCLE `settled:0 remaining:1` with enough position; control (ops-signed) nets | refused up front: `AGENT_QUEUE_UNSUPPORTED` |
| 3 | 1 ledger | `#pubFor` used plain-object lookups: `constructor`/`toString`/`__proto__` passed the known-oracle (`UNKNOWN_EVENT`) and known-release-role checks, and `agent:p1:zz` was read as grant p1 | [RAN] 21 tests red | `Object.hasOwn`, max two role segments |
| 4 | 2 consensus | `Network.verifyReceipt` never compared `header.chainId` with the genesis, so a receipt verified against another chain's genesis | [RAN] red test | chain-id check; tolerates missing sigs |
| 5 | 3 authority | Institution-signed `caller` could be any object, including `{kind:'agent', grant_id, label}` = the exact shape the kernel stamps when it derives a caller from a grant (forged provenance), plus unbounded junk into log/queue | [RAN] 2 tests red | `CALLER_MISMATCH` unless `{kind, label?}` with length caps |

Test count: 173 -> 207 (+34), all passing.

## Deferred
## BLOCKED
## PROPOSALS
