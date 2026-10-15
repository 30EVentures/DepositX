# DepositX on the FlashyOS mesh: readiness

Prepared 2026-10-14 on branch `mesh/readiness`. DepositX is a proof of concept: consensus is simulated in one process, there is no bank partner, and it is not regulated, not final and not live. Nothing in this file has been run against FlashyOS: no organisation was created, no token was minted, no request was sent, no file was published.

## 1. Audit against the mesh requirements (bad news first)

Tags: [RAN] executed here, [VERIFIED] read in the code and cross-checked by a test, [INFERENCE] reasoned, not run.

### Not ready

| # | Gap | Evidence |
|---|---|---|
| 1 | **Nobody else can call it.** The server binds to loopback only (127.0.0.1), has no TLS and no authentication, and is not deployed anywhere. A mesh peer cannot reach it today. | [VERIFIED] `server.js` `listen(PORT, '127.0.0.1')` |
| 2 | **The default mode is the demo mode.** `POST /api/action` and `POST /api/iso/pacs008` sign with the server's own keys on behalf of any local caller (mint, redeem, fund, reset, fault injection). Agent mode, which refuses them, is opt-in (`DEPOSITX_MODE=agent`). | [RAN] `mesh-surface.test.js`, `mesh-server.test.js` |
| 3 | **Heartbeats have never reached FlashyOS.** The wire format was copied from the published agent package and is exercised only against a fake collector on loopback. Whether the dashboard shows the agent is the first thing to check. | [RAN] loopback only; [INFERENCE] for the real endpoint |
| 4 | **Receipts prove little.** Every validator key is held by the host, so a receipt shows host signing, not independent agreement. It carries its own keys, so on its own it proves only that it is self-consistent. It cannot show that a given instruction is inside the block (the instruction root is a flat hash). | [VERIFIED] `receipt.js`, `verify-receipt.mjs` |
| 5 | **The measures cover the retained window only** (the last 500 simulated blocks), not all history. | [VERIFIED] `measures.js` |
| 6 | **The charter is not served on any public URL**, and the handshake file is refused until a public profile URL is configured (`DEPOSITX_PROFILE_URL`). The public conformance check (levels 1 and 2) needs such a URL and was not attempted. | [RAN] |
| 7 | **Older routes answer with a different error shape** (`{error:'not found'}`) than the new ones (`{ok:false,error,message}`), and `GET /api/state` is not a closed schema. | [VERIFIED] |

### Done or partly done

| Requirement | Status | Evidence |
|---|---|---|
| Honest charter | **done, unpublished.** `flashy/mesh/flashyos-charter.json`: roles `settlement-model` and `risk-control`, each with one measure the code computes; description says simulated, proof of concept, no bank partner, not regulated, not final, not live. The earlier draft's public ask for partner banks (`wants`) was dropped: that is a decision for the owner. | [RAN] valid under a local Python AAO checker, and under `@flashyos/aao` 0.4.2 `validateCharterDocument` and `validateCharter`, offline; of five deliberately broken variants the published validator refuses three (a bad role name, an escalation to a missing role, an unknown key) and accepts two (a placeholder email, a missing measure), which the 28 tests in `mesh-charter.test.js` do refuse |
| Measures computable from the replayable block log | **done.** `GET /api/measures` and `src/flashy/measures.js`: replay match (hash and state root) and invariant checks passed, from a fresh ledger replayed from genesis; an empty denominator is null, never 100. | [RAN] `mesh-measures.test.js` (10) |
| Machine-callable surface | **partial.** `POST /api/submit` (the caller signs), `GET /api/schema`, `/api/grants`, `/api/verify`, `/api/instruction/<id>` already existed. Added: `GET /api/openapi.json` (every object schema closed), `/.well-known/api-catalog`, `/.well-known/flashyos-charter.json`, `/.well-known/flashyos.json` (only with a public profile URL), `GET /api/receipt/<height>`, `GET /api/measures`, a closed schema for `POST /api/action`, and agent mode. Unknown paths, parameters, fields and kinds are refused. | [RAN] `mesh-surface.test.js` (47), `mesh-server.test.js` over real sockets |
| Offline-verifiable receipts, labelled simulated | **partial** (see gap 4). `GET /api/receipt/<height>` returns the header, hash, signatures, validator keys and a label; `node poc/src/flashy/mesh/verify-receipt.mjs <file> [--pin <keys.json>]` checks it with `node:crypto` only. It says plainly when nothing is pinned. Every block in `GET /api/state` now carries `receiptLabel`. | [RAN] `mesh-receipt.test.js` (28), a differential check against the network's own verifier |
| Real heartbeats | **wired, unverified against FlashyOS.** Started, block processed (throttled to one per 10 s), halted, quarantined, idle, plus a 60 s keepalive. A fixed label per state; never an account, amount, issuer, hash or instruction. A no-op unless all three variables are set. It only reads the halt flag and issuer statuses, and cannot change a block, the kernel or the graded halt. | [RAN] `mesh-wire.test.js` (12), `mesh-server.test.js` |

Test counts: before this work `npm test` ran 296 tests (the brief expected 173; `main` has grown) and `npm run test:flashy` ran a further 16 that `npm test` did not include. `npm test` now includes `test/flashy/`: 444 tests, all passing (296 + 16 + 132 new, 93 of them refusals). Every new key test was mutation-checked: 24 deliberate breakages of the new code, each turned at least one test red.

## 2. Checklist for the owner (about five minutes)

### In the FlashyOS dashboard (app.flashyos.com), by hand
1. Sign in. Create the organisation (display name `DepositX`, slug `depositx`; if the slug is taken pick another, and the charter slug and agent name must then match).
2. **Publicly listed:** your call. If you list it, keep the charter wording: simulated, proof of concept, no bank partner.
3. **Capabilities:** declare none. A capability is a claim that something is callable by others, and gaps 1 and 2 above say it is not yet.
4. Open **Connect an agent** and mint an agent named `depositx-agent`. The token is shown once. Put it straight into your shell (below); do not paste it into chat, a file in this repository or a commit. If it leaks, mint again.
5. Note the organisation id (it looks like `org_...`).

### On the machine that runs DepositX (shell only; nothing is written to disk)
```bash
export FLASHYOS_ORG_ID='org_...'
export FLASHYOS_AGENT_TOKEN='...'
export FLASHYOS_AGENT_NAME='depositx-agent'
cd poc
node src/flashy/mesh/presence.mjs            # dry run: prints the request with the token redacted, sends nothing
npm start                                    # the server now reports presence; the first line says "mesh presence on"
```
Optional variables: `DEPOSITX_MODE=agent` (refuse the server-signed demo endpoints; use this on any host others can reach), `DEPOSITX_PROFILE_URL=https://...` (a public https address you choose; only then is `/.well-known/flashyos.json` served), `PORT`, `DEPOSITX_DATA` (a directory, to make the simulated chain durable).

### What to look for
- The server's start-up line ends `mesh presence on; demo mode` (or `agent mode`). With any of the three variables missing it says `mesh presence off` and sends nothing.
- In the dashboard the agent appears in a room: ACTIVE after start, IDLE after about a minute without a block, INCIDENT after a fault injection such as `core_loss` (a halt) or `fire_alarm` (a quarantine). A `HTTP_401` in `presence.mjs --send` means a wrong token or agent name; `HTTP_403`/`404` a wrong organisation id.
- The task text is always one of: `simulated network started`, `simulated block processed`, `simulated network running`, `simulated network halted`, `simulated issuer quarantined`, or empty. Anything else is a bug.

### Verification commands
```bash
cd poc && npm test                                           # 444 tests; about 2.5 minutes
node --test test/flashy/*.test.js                            # the mesh tests only (148 tests, under 30 s)
curl -s localhost:8787/api/receipt/5 > /tmp/receipt.json && node src/flashy/mesh/verify-receipt.mjs /tmp/receipt.json
curl -s localhost:8787/api/measures
```
Validate the charter offline with the published `@flashyos/aao` package: `validateCharterDocument(JSON.parse(fs.readFileSync('flashy/mesh/flashyos-charter.json','utf8')))` returns `[]`, and so does `validateCharter`.

## 3. What is deliberately not done
- No `.well-known` file is published or hosted; the server serves them only on loopback, and the handshake only when you set a profile URL.
- No capability is declared, no organisation created, no token minted, no FlashyOS endpoint called, nobody contacted.
- Nothing was pushed or merged. The branch is local.
- The kernel, network, store and model checker are unchanged. Proposals for what would improve the surface are in section 4.

## 4. Proposals (not built)
1. A real receipt needs independent validators and a Merkle root over the instructions so an agent can prove its instruction is in a block (this breaks existing block hashes, so it belongs with the one-time digest-version change).
2. Authentication and TLS in front of the server, then declare the `settlement-model` capability.
3. A single error shape across every route, and a closed schema for `GET /api/state`.
4. An append-only measures history, so the charter measures can cover more than the retained window.
