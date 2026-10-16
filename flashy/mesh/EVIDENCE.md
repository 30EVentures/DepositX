# Evidence story: sealed snapshots of the simulated settlement model

Prepared 2026-10-15, **not published**. DepositX is a proof of concept: consensus is simulated in one process, there is no bank partner, and it is not regulated, not final and not live. Everything below describes a record of a simulation run.

## What it is

A snapshot is one JSON document (`depositx-evidence/1`) holding the head block of a simulated run (height, hash, state root, block time), the two charter measures computed from the replayable log (replay match and invariant checks passed), the head block's receipt from the simulated validators, and a seal: an Ed25519 signature by a key the owner holds. The seal covers every field, including the wording, so the label cannot be changed after signing.

## What a stranger can check, offline

```bash
node poc/src/flashy/evidence/verify-snapshot.mjs snapshot.json --pin signer-public-key.txt
```

- the document is closed (no unknown field) and labelled as simulated, with the whole disclaimer, and makes no claim word without a negation;
- the measures are arithmetic: counts are whole numbers, matched is at most total, run is four invariant checks per block, the percentages follow from the counts;
- the receipt is self-consistent and describes the same block as the head (height, hash, state root, time, chain);
- the seal verifies against the **pinned** public key (`PINNED_KEY_DIFFERS` otherwise). Without `--pin` the result says plainly that the embedded key proves nothing about who sealed it.

## What it does not prove

- It is not evidence of any real settlement, deposit, bank, customer or regulator: the network is simulated and holds no real money.
- The validators in the receipt are all held by the host, so the receipt shows host signing, not independent agreement.
- The measures cover the retained window (the last 500 simulated blocks), not all history.
- The seal shows that the holder of the pinned key sealed this document; it says nothing about the key holder's identity unless the key is pinned from a source the verifier trusts.

## How to produce one (the owner, with the owner's own key)

The repository creates, stores and prints no key. With a private key held outside the repository:

```js
import { createPrivateKey } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Network } from './poc/src/network.js';
import { buildSnapshot } from './poc/src/flashy/evidence/snapshot.js';
const net = new Network();                         // play the scenario you want to record, then:
const key = createPrivateKey(readFileSync(process.env.KEY_FILE));   // your file, your environment
writeFileSync('snapshot.json', JSON.stringify(buildSnapshot(net, key), null, 2));
```

Publish the signer's **public** key through a channel the verifier can trust, and nothing else about the key.

## Before anyone outside sees it

Counsel review of the wording (see the decisions list in `flashy/hardening/STATE.md`), and the owner's decision on where the public key is pinned. Nothing here has been sent or published.
