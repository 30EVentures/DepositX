// Overnight review, round 2: a block receipt is verified against a genesis, so it must bind the chain it claims.
// verifyReceipt checked the header hash and the validator signatures but never that the header's chainId is the
// genesis's own: a receipt signed under one chain id was accepted as proof on another that shares validator keys.
// (This proof of concept simulates its validators in one process; this pins the offline verifier's behaviour.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { canon, sha256, sign } from '../src/crypto.js';

test('a receipt for one chain id does not verify against another chain\'s genesis, even with the same validators', () => {
  const n = new Network();
  const b = n.pay('MPL:acme', 'MPL:harbour', dollars(1));
  const block = n.blocks[n.blocks.length - 1];
  assert.ok(Network.verifyReceipt(n.genesis, block), 'control: verifies against its own genesis');
  const other = { ...n.genesis, chainId: 'some-other-chain' };
  assert.equal(Network.verifyReceipt(other, block), false);
});

test('a header for another chain that the real validators signed is refused too', () => {
  const n = new Network();
  n.pay('MPL:acme', 'MPL:harbour', dollars(1));
  const block = n.blocks[n.blocks.length - 1];
  const header = { ...block.header, chainId: 'forged' };
  const hash = sha256(canon(header));
  // re-signed by the genuine validator keys, so the hash and signatures are internally consistent: only the chain id is wrong
  const sigs = Object.fromEntries(Object.entries(n.K.validators).map(([id, k]) => [id, sign(k.priv, hash)]));
  const forged = { ...block, header, hash, sigs };
  assert.equal(Network.verifyReceipt({ ...n.genesis, chainId: 'forged' }, forged), true, 'control: consistent with a genesis that names that chain');
  assert.equal(Network.verifyReceipt(n.genesis, forged), false);
});
