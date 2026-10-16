// Build a sealed evidence snapshot of the SIMULATED settlement model. The caller supplies the signing key (an Ed25519
// private KeyObject, held outside the repository); nothing here creates, stores or prints a key. Deterministic: no wall
// clock, only the head block's own time. The seal covers the wording, so the label cannot be changed after signing.
import { createHash, createPublicKey, sign as edSign, KeyObject } from 'node:crypto';
import { computeMeasures } from '../measures.js';
import { receiptView } from '../mesh/receipt.js';
import { canonical, SEAL_DOMAIN } from './canonical.mjs';

export const EVIDENCE_LABEL = 'Evidence snapshot of a SIMULATED settlement model: a proof of concept with consensus simulated in one process, no bank partner, not regulated, not final and not live. It records a simulation run; it is not evidence of any real settlement.';

export const publicKeyHex = (publicKeyObject) => publicKeyObject.export({ type: 'spki', format: 'der' }).toString('hex');

export function buildSnapshot(net, privateKey) {
  if (!(privateKey instanceof KeyObject) || privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519') throw new Error('KEY: an Ed25519 private key object is required');
  if (!net.blocks.length) throw new Error('EMPTY: there is no block to seal');
  const head = net.blocks[net.blocks.length - 1];
  const m = computeMeasures(net);
  const pub = publicKeyHex(createPublicKey(privateKey));
  const body = {
    format: 'depositx-evidence/1',
    simulated: true,
    label: EVIDENCE_LABEL,
    chainId: net.genesis.chainId,
    head: { height: head.height, hash: head.hash, stateRoot: head.header.stateRoot, time: head.header.time },
    measures: { retainedBlocks: m.retainedBlocks, replay: m.replay, invariants: m.invariants },
    receipt: receiptView(net, head.height),
  };
  const seal = { alg: 'ed25519', keyId: createHash('sha256').update(Buffer.from(pub, 'hex')).digest('hex').slice(0, 16), publicKey: pub };
  const sig = edSign(null, Buffer.from(SEAL_DOMAIN + canonical({ ...body, seal })), privateKey).toString('hex');
  return { ...body, seal: { ...seal, sig } };
}
