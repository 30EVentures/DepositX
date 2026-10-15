// The routes this layer adds to the local server, as pure functions of (method, path, query, env) so they can be tested
// without a socket. Everything is read-only and refused by default: an unknown path under a path this layer owns is a
// closed 404, a write to a read-only path is a 405, and any query parameter is a 400. Nothing here signs anything.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { receiptView, ReceiptError, RECEIPT_LABEL } from './receipt.js';
import { computeMeasures } from '../measures.js';
import { openapiDocument } from './openapi.js';

export const CHARTER_FILE = fileURLToPath(new URL('../../../../flashy/mesh/flashyos-charter.json', import.meta.url));
const JSON_TYPE = 'application/json; charset=utf-8';
const PUBLIC_DOC = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };

const reply = (status, body, extra = {}) => ({ status, type: JSON_TYPE, headers: {}, body, ...extra });
const refuse = (status, error, message, headers = {}) => reply(status, { ok: false, error, message }, { headers });

/** A public https profile URL, or null. Loopback, IP literals, single-label hosts, credentials, query and fragment are refused. */
function profileUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) return null;
  const h = u.hostname;
  if (!h.includes('.') || h.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h === 'localhost' || h.endsWith('.localhost')) return null;
  return u.origin + (u.pathname === '/' ? '' : u.pathname.replace(/\/$/, ''));
}

export function meshRoute({ net, method, pathname, search = '', env = {} }) {
  const wellKnown = pathname.startsWith('/.well-known/');
  const owned = wellKnown || pathname === '/api/openapi.json' || pathname === '/api/measures' || pathname.startsWith('/api/receipt/');
  if (!owned) return null;
  if (method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'this path is read-only', { allow: 'GET' });
  if (search && search !== '?') return refuse(400, 'UNKNOWN_PARAMETER', 'this path takes no query parameters');

  if (pathname === '/.well-known/flashyos-charter.json') {
    return { status: 200, type: JSON_TYPE, headers: PUBLIC_DOC, raw: fs.readFileSync(CHARTER_FILE, 'utf8') };
  }
  if (pathname === '/.well-known/flashyos.json') {
    const profile = profileUrl(env.DEPOSITX_PROFILE_URL);
    if (!profile) return refuse(404, 'NOT_CONFIGURED', 'no public profile URL is configured, so no handshake is served');
    return reply(200, { mesh: 'flashyos/1', org: { slug: 'depositx', name: 'DepositX', profile } }, { headers: PUBLIC_DOC });
  }
  if (pathname === '/.well-known/api-catalog') {
    return reply(200, { linkset: [{ anchor: '/api', 'service-desc': [{ href: '/api/openapi.json', type: 'application/json' }] }] }, { type: 'application/linkset+json; charset=utf-8', headers: PUBLIC_DOC });
  }
  if (wellKnown) return refuse(404, 'NOT_FOUND', 'no such well-known file');
  if (pathname === '/api/openapi.json') return reply(200, openapiDocument(), { headers: PUBLIC_DOC });
  if (pathname === '/api/measures') {
    try { return reply(200, computeMeasures(net)); } catch { return refuse(500, 'MEASURES_UNAVAILABLE', 'the measures could not be computed from the log'); }
  }
  // /api/receipt/<height>: a plain positive whole number and nothing else
  const tail = pathname.slice('/api/receipt/'.length);
  const height = /^[1-9][0-9]{0,15}$/.test(tail) ? Number(tail) : NaN;
  if (!Number.isSafeInteger(height)) return refuse(400, 'BAD_HEIGHT', 'height must be a whole number from 1, digits only');
  try {
    return reply(200, receiptView(net, height));
  } catch (e) {
    if (e instanceof ReceiptError) return refuse(e.code === 'NOT_RETAINED' ? 404 : 400, e.code, e.message);
    return refuse(500, 'RECEIPT_UNAVAILABLE', 'the receipt could not be built');
  }
}

const GATED = new Set(['POST /api/action', 'POST /api/iso/pacs008', 'GET /api/bench']);
/** Agent mode (anything but the exact word demo) refuses every endpoint where the server signs for the caller. */
export function modeGate({ method, pathname, env = {} }) {
  const mode = env.DEPOSITX_MODE;
  if (mode === undefined || mode === 'demo') return null;
  if (!GATED.has(`${method} ${pathname}`)) return null;
  return refuse(403, 'DEMO_ACTIONS_DISABLED', 'this server is in agent mode: the demo endpoints that sign on the caller\'s behalf are off; submit instructions you have signed to /api/submit');
}

/** The state view, labelled as simulated at the top and on every block. Pure; the input is not changed. */
export function labelState(state) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) return state;
  const out = { ...state, simulated: true, simulationNote: RECEIPT_LABEL };
  if (Array.isArray(state.blocks)) out.blocks = state.blocks.map((b) => (b && typeof b === 'object' ? { ...b, receiptLabel: 'simulated validators, one process' } : b));
  return out;
}
