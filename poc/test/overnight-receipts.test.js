// Overnight review, round 2: a block receipt is verified against a genesis, so it must bind the chain it claims.
// verifyReceipt checked the header hash and the validator signatures but never that the header's chainId is the
// genesis's own: a receipt signed under one chain id was accepted as proof on another that shares validator keys.
// (This proof of concept simulates its validators in one process; this pins the offline verifier's behaviour.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { canon, sha256 } from '../src/crypto.js';

test('a receipt for one chain id does not verify against another chain\'s genesis, even with the same validators', () => {
  const n = new Network();
  const b = n.pay('MPL:acme', 'MPL:harbour', dollars(1));
  const block = n.blocks[n.blocks.length - 1];
  assert.ok(Network.verifyReceipt(n.genesis, block), 'control: verifies against its own genesis');
  const other = { ...n.genesis, chainId: 'some-other-chain' };
  assert.equal(Network.verifyReceipt(other, block), false);
});

test('a receipt whose header names a different chain than the genesis is refused even if re-hashed consistently', () => {
  const n = new Network();
  n.pay('MPL:acme', 'MPL:harbour', dollars(1));
  const block = n.blocks[n.blocks.length - 1];
  const header = { ...block.header, chainId: 'forged' };
  const forged = { ...block, header, hash: sha256(canon(header)) }; // validator signatures no longer match the new hash
  assert.equal(Network.verifyReceipt(n.genesis, forged), false);
});
