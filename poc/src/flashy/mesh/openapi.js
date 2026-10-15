// An OpenAPI 3.1 description of the machine-callable endpoints of the SIMULATED network. Every object schema defined
// here is closed (additionalProperties false). It lists only the agent contract: read-only views, the receipt and
// measure endpoints, outcome lookup, and the submit endpoint where the CALLER signs. The server-signed demo endpoints
// (POST /api/action, POST /api/iso/pacs008) are deliberately not part of it.
const closed = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const error = closed({ ok: { const: false }, error: str('machine-readable code'), message: str('human-readable detail') });
const refusal = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Refusal' } } } });
const okJson = (description, schema) => ({ description, content: { 'application/json': { schema } } });

export function openapiDocument() {
  const header = closed({ chainId: str('simulated chain id'), height: { type: 'integer', minimum: 1 }, time: { type: 'integer' }, prev: str('previous block hash'), txRoot: str('hash of the instructions'), stateRoot: str('hash of the state'), halt: { oneOf: [{ type: 'null' }, closed({ reason: str('halt reason'), issuer: { type: ['string', 'null'] } })] } });
  const receipt = closed({ simulated: { const: true }, label: str('states that the validators are simulated'), trust: str('what the document does and does not prove'), chainId: str('chain id'), receipt: closed({ height: { type: 'integer', minimum: 1 }, hash: str('block hash', { pattern: '^[0-9a-f]{64}$' }), header, sigs: { type: 'object', additionalProperties: str('Ed25519 signature, hex') }, quorum: { type: 'integer', minimum: 1 } }), validators: { type: 'array', items: closed({ id: str('validator id'), pub: str('public key, hex') }) }, verifyWith: str('offline verifier command') });
  const measure = closed({ matched: { type: 'integer', minimum: 0 }, total: { type: 'integer', minimum: 0 }, percent: { type: ['string', 'null'] } });
  const measures = closed({ simulated: { const: true }, basis: str('how it is computed'), retainedBlocks: { type: 'integer', minimum: 0 }, replay: measure, invariants: closed({ passed: { type: 'integer', minimum: 0 }, run: { type: 'integer', minimum: 0 }, percent: { type: ['string', 'null'] } }) });
  const instruction = closed({ inst_id: str('unique id, 8 to 64 characters'), type: str('instruction type, see /api/schema'), payload: { type: 'object' }, valid_until: { type: 'integer' }, caller: closed({ kind: str('kind'), label: str('label') }, ['kind']), batch_digest: { type: ['string', 'null'] }, grant: str('the grant an agent signs under'), sigs: { type: 'object', additionalProperties: str('Ed25519 signature, hex') } }, ['inst_id', 'type', 'payload', 'valid_until', 'sigs']);
  const outcome = closed({ found: { type: 'boolean' }, ok: { type: 'boolean' }, type: str('instruction type'), error: { type: ['string', 'null'] }, height: { type: 'integer' }, hash: str('block hash'), via: str('batch instruction that carried this leg') }, ['found']);
  const get = (summary, description, response, extra = {}) => ({ get: { summary, description, ...extra, responses: { 200: response, 400: refusal('refused: a parameter is not accepted'), 404: refusal('not found'), 405: refusal('method not allowed') } } });
  return {
    openapi: '3.1.0',
    info: {
      title: 'DepositX simulated network, machine-callable surface',
      version: '1',
      description: 'A proof of concept of par, atomic settlement between banks\' deposit tokens. Consensus is simulated in one process, there is no bank partner, and it is not regulated, not final and not live. Every response about blocks or receipts comes from simulated validators. Requests are refused by default: unknown paths, parameters and fields are errors.',
    },
    servers: [{ url: 'http://127.0.0.1:8787', description: 'local demo server; it binds to loopback only' }],
    'x-simulated': true,
    paths: {
      '/api/schema': get('Instruction shapes, required signatures and the error catalogue', 'Read-only. The catalogue says which errors are retryable.', okJson('schema document', { type: 'object' })),
      '/api/grants': get('Delegation grants with remaining window headroom', 'Amounts are decimal strings of integer cents.', okJson('grants', { type: 'array', items: { type: 'object' } }), { parameters: [{ name: 'issuer', in: 'query', required: false, schema: { enum: ['MPL', 'NSR', 'LKS'] } }] }),
      '/api/verify': get('Replay the whole log from genesis and compare', 'Read-only.', okJson('replay result', closed({ ok: { type: 'boolean' }, blocks: { type: 'integer' }, stateRoot: { type: ['string', 'null'] }, hash: { type: ['string', 'null'] } }))),
      '/api/receipt/{height}': get('A block receipt from the simulated validators', 'Self-contained and offline-verifiable. It carries its own validator keys, so on its own it proves only self-consistency; pin the keys to check who signed.', okJson('receipt document', receipt), { parameters: [{ name: 'height', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }] }),
      '/api/measures': get('The two charter measures, computed from the replayable block log', 'Replay match and invariant checks over the retained blocks. An empty denominator is null, never 100.', okJson('measures', measures)),
      '/api/instruction/{inst_id}': get('How an instruction ended', 'Needs the digest of the signed message as ?digest=; without the exact signed bytes nothing is returned. found false means unknown to this node, not that it never ran.', okJson('outcome', outcome), { parameters: [{ name: 'inst_id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'digest', in: 'query', required: true, schema: { type: 'string', pattern: '^[0-9a-f]{64}$' } }] }),
      '/api/submit': {
        post: {
          summary: 'Submit an instruction the CALLER has signed; the server never signs on this path',
          description: 'Refused with a machine-readable code and a remedy; see /api/schema.',
          requestBody: { required: true, content: { 'application/json': { schema: instruction } } },
          responses: { 200: okJson('result (ok true or false, with error, retryable and remedy)', { type: 'object' }), 400: refusal('not valid JSON') },
        },
      },
      '/.well-known/flashyos-charter.json': get('The published charter', 'A charter draft in the public AAO format.', okJson('charter', { type: 'object' })),
    },
    components: { schemas: { Refusal: error } },
  };
}
