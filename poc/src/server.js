// Local demo server: static dashboard + JSON API + server-sent events. No dependencies.
// Binds to 127.0.0.1 only: this is a demonstration, not a service.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Network } from './network.js';
import { bench } from './bench.js';
import { samplePacs008 } from './iso20022.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const PORT = Number(process.env.PORT) || 8787;

const DATA = process.env.CONCORD_DATA || null; // set to a directory to make the demo durable
let net = new Network({ dataDir: DATA });
const clients = new Set();
const push = () => {
  for (const res of clients) res.write(`data: ${net.ledger.s.height}\n\n`);
};
const watch = () => net.listeners.add(push);
watch();

const cents = (v) => {
  if (typeof v === 'number') v = String(v);
  if (typeof v !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(v.trim())) throw new Error('amount must be dollars with up to two decimals');
  const [d, c = ''] = v.trim().split('.');
  return BigInt(d) * 100n + BigInt((c + '00').slice(0, 2));
};
const acct = (v) => {
  if (typeof v !== 'string' || !/^[A-Z]{3}:[a-z0-9_-]{1,40}$/.test(v)) throw new Error('bad account id');
  return v;
};
const issuerId = (v) => {
  if (!['MPL', 'NSR', 'LKS'].includes(v)) throw new Error('bad issuer');
  return v;
};

function act(b) {
  switch (b.kind) {
    case 'mint': return net.mint(issuerId(b.issuer), String(b.customer), cents(b.amount));
    case 'redeem': return net.redeem(issuerId(b.issuer), String(b.customer), cents(b.amount));
    case 'pay': return net.pay(acct(b.from), acct(b.to), cents(b.amount), { queue: !!b.queue });
    case 'dvp': return net.dvp(acct(b.seller), acct(b.buyer), 'CAN-2031', BigInt(Math.max(1, Math.min(100000, Number(b.qty) | 0))), cents(b.cash));
    case 'fund': return net.fund(issuerId(b.issuer), cents(b.amount));
    case 'defund': return net.defund(issuerId(b.issuer), cents(b.amount));
    case 'net': return net.netCycle();
    case 'resume': return net.resume(b.scope === 'issuer' ? 'issuer' : 'network', b.scope === 'issuer' ? issuerId(b.issuer) : undefined);
    case 'chaos': return net.chaos(String(b.type), b.issuer ? { issuer: issuerId(b.issuer) } : {});
    case 'advance': return net.advance(Math.max(1, Math.min(7200, Number(b.seconds) | 0)));
    case 'corePause': return net.setCorePaused(!!b.on);
    case 'reset': net.listeners.clear(); net.store?.close(); net = new Network({ dataDir: DATA, fresh: true }); watch(); push(); return { ok: true, message: 'network reset to genesis' };
    default: return { ok: false, error: 'UNKNOWN_ACTION' };
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const json = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, net.snapshot());
      if (req.method === 'GET' && url.pathname === '/api/verify') return json(res, 200, net.verifyReplay());
      if (req.method === 'GET' && url.pathname === '/api/bench') return json(res, 200, bench({ n: 20000 }));
      if (req.method === 'GET' && url.pathname === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.write('retry: 2000\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/iso/pacs008') {
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 25_000) req.destroy();
        });
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' });
          res.end(net.pacs008(body));
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/iso/sample') {
        res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
        return res.end(samplePacs008({ amount: url.searchParams.get('amount') || '25000.00' }));
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 10_000) req.destroy();
        });
        req.on('end', () => {
          try {
            json(res, 200, act(JSON.parse(body || '{}')));
          } catch (e) {
            json(res, 400, { ok: false, error: 'BAD_REQUEST', message: e.message });
          }
        });
        return;
      }
      if (req.method === 'GET') {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const full = path.join(PUBLIC, file);
        if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return json(res, 404, { error: 'not found' });
        res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
        return res.end(fs.readFileSync(full));
      }
      json(res, 405, { error: 'method not allowed' });
    } catch (e) {
      json(res, 500, { ok: false, error: 'SERVER_ERROR', message: e.message });
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Concord PoC running at http://127.0.0.1:${PORT}` + (DATA ? ` (durable: ${DATA}, ${net.recovered ? 'recovered ' + net.recovered.blocks + ' blocks' : 'new'})` : ' (in memory)')));
