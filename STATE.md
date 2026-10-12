# Overnight run state (branch overnight/depositx-bugs, from origin/main c672a5b)

> Summary goes here at the end. Working log below.

## Baseline
- `cd poc && npm test` (`node --test test/*.test.js`): 173 tests, 173 pass, 0 fail, on c672a5b [RAN].
- Sibling branches read first, not touched: grant-binding-mandatory (e565e49, the grant `grant`-in-digest fix, unmerged), hardening-x1 (48be21b), hardening-x2 (986ccdd, sweeps vs frozen accounts), proposals-x3-x4 (67e9502). Anything they already cover is logged as KNOWN, not re-fixed.

## Found / fixed
(see per-round entries)

## Deferred
## BLOCKED
## PROPOSALS
