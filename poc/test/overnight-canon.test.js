// Overnight review, round 8: the canonical form that is signed and hashed must be injective - two different JSON
// documents must never share one canonical string. norm() built objects with `o[k] = ...` on a plain object, where
// the key "__proto__" sets the prototype instead of creating a member, so any "__proto__" member silently vanished:
// a signed instruction, or a stored block, could carry or change that member without altering its digest or hash.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canon } from '../src/crypto.js';
import { Network, dollars } from '../src/network.js';
import { messageOf } from '../src/kernel.js';

test('a "__proto__" member is part of the canonical form', () => {
  const withIt = JSON.parse('{"a":1,"__proto__":{"b":2}}');
  assert.notEqual(canon(withIt), canon({ a: 1 }));
  assert.notEqual(canon(withIt), canon(JSON.parse('{"a":1,"__proto__":{"b":3}}')));
  assert.notEqual(canon(JSON.parse('{"a":1,"__proto__":"x"}')), canon({ a: 1 }));
  assert.equal(canon(JSON.parse('[{"__proto__":{"polluted":true}}]')), '[{"__proto__":{"polluted":true}}]');
  assert.equal(({}).polluted, undefined, 'canonicalising does not pollute Object.prototype');
});

test('ordinary canonical forms are byte-for-byte unchanged', () => {
  assert.equal(canon({ b: 2, a: [1, { d: 4n, c: undefined }], m: new Map([['z', 1], ['y', 2]]) }), '{"a":[1,{"d":"n:4"}],"b":2,"m":{"$map":[["y",2],["z",1]]}}');
});

test('adding a "__proto__" member to a signed instruction invalidates its signature', () => {
  const n = new Network();
  const t = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL']);
  const v = JSON.parse(JSON.stringify(t));
  v.payload = JSON.parse(JSON.stringify(v.payload).replace(/}$/, ',"__proto__":{"x":1}}'));
  assert.notEqual(messageOf(v, n.genesis.chainId), messageOf(t, n.genesis.chainId));
  assert.equal(n.submitSigned(v).error, 'BAD_SIGNATURE');
});
