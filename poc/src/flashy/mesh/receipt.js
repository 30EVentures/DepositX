// A block receipt as a self-describing document: the signed header, the validator signatures, and the public keys
// needed to check them, labelled for what it is. Read-only over the network object; nothing is signed here.
export const RECEIPT_LABEL = 'Receipt signed by SIMULATED validators: all four validator keys live in one process (proof of concept, no independent parties).';
export const RECEIPT_TRUST = 'This document carries its own validator keys, so it proves only that it is self-consistent. Who signed needs the validator keys pinned out of band, and here every key is held by the host.';

export class ReceiptError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const plain = (v) => JSON.parse(JSON.stringify(v));

export function receiptView(net, height) {
  if (!Number.isSafeInteger(height) || height < 1) throw new ReceiptError('BAD_HEIGHT', 'height must be a whole number from 1');
  const b = net.blocks.find((x) => x.height === height);
  if (!b) throw new ReceiptError('NOT_RETAINED', 'that block is not in the retained window of this simulated network');
  return plain({
    simulated: true,
    label: RECEIPT_LABEL,
    trust: RECEIPT_TRUST,
    chainId: net.genesis.chainId,
    receipt: { height: b.height, hash: b.hash, header: b.header, sigs: b.sigs, quorum: b.quorum },
    validators: net.genesis.validators.map(({ id, pub }) => ({ id, pub })),
    verifyWith: 'node poc/src/flashy/mesh/verify-receipt.mjs <receipt.json> [--pin <validator-keys.json>]',
  });
}
