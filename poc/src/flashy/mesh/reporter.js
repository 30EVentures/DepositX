// FlashyOS mesh reporter (presence only). Dependency-free. Sends nothing unless ALL of FLASHYOS_ORG_ID,
// FLASHYOS_AGENT_TOKEN and FLASHYOS_AGENT_NAME are set. Wire format taken from @flashyos/agent 0.21.0:
//   POST {base}/api/v1/agents/heartbeat   {orgId, token, agentName, status, currentTask, progress}
// Rules: the token is read from the environment only and never appears in any return value, error or log line;
// the base URL must be https (http only for 127.0.0.1 in tests); failures never throw and never retry; the task
// label is a short fixed string chosen by the caller, never document contents or user text.
export const STATUSES = Object.freeze(['PLANNING', 'PRESENTING', 'BUILDING', 'ACTIVE', 'TESTING', 'DEPLOYING', 'REVIEWING', 'INCIDENT', 'IDLE']);
const DEFAULT_BASE = 'https://api.flashyos.com';
const ORG = /^[A-Za-z0-9_-]{3,64}$/;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function readConfig(env = process.env) {
  const orgId = env.FLASHYOS_ORG_ID ?? '', token = env.FLASHYOS_AGENT_TOKEN ?? '', agentName = env.FLASHYOS_AGENT_NAME ?? '';
  const baseUrl = env.FLASHYOS_API_URL ?? DEFAULT_BASE;
  if (!orgId || !token || !agentName) return { configured: false, reason: 'NOT_CONFIGURED' };
  if (!ORG.test(orgId)) return { configured: false, reason: 'BAD_ORG_ID' };
  if (!NAME.test(agentName) || agentName.length > 64) return { configured: false, reason: 'BAD_AGENT_NAME' };
  if (!/^[\x21-\x7e]{8,512}$/.test(token)) return { configured: false, reason: 'BAD_TOKEN_SHAPE' };
  let u;
  try { u = new URL(baseUrl); } catch { return { configured: false, reason: 'BAD_API_URL' }; }
  const local = u.protocol === 'http:' && u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !local) return { configured: false, reason: 'API_URL_NOT_HTTPS' };
  if (u.username || u.password || u.search || u.hash) return { configured: false, reason: 'BAD_API_URL' };
  return { configured: true, orgId, token, agentName, baseUrl: u.origin };
}

const cleanTask = (t) => String(t ?? '').replace(/[^\x20-\x7e]/g, ' ').trim().slice(0, 120);

/** Shape of the request that WOULD be sent, token redacted. Safe to print. */
export function describeHeartbeat(cfg, status, task = '', progress = 0) {
  return { url: `${cfg.baseUrl}/api/v1/agents/heartbeat`, body: { orgId: cfg.orgId, token: '[redacted]', agentName: cfg.agentName, status, currentTask: cleanTask(task), progress } };
}

export function createReporter({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  return {
    get configured() { return readConfig(env).configured; },
    /** @returns {Promise<{sent:boolean, reason?:string, httpStatus?:number}>} never throws. */
    async heartbeat(status, task = '', progress = 0) {
      const cfg = readConfig(env);
      if (!cfg.configured) return { sent: false, reason: cfg.reason };
      if (!STATUSES.includes(status)) return { sent: false, reason: 'BAD_STATUS' };
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { sent: false, reason: 'BAD_PROGRESS' };
      try {
        const res = await fetchImpl(`${cfg.baseUrl}/api/v1/agents/heartbeat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
          body: JSON.stringify({ orgId: cfg.orgId, token: cfg.token, agentName: cfg.agentName, status, currentTask: cleanTask(task), progress }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        return res.ok ? { sent: true, httpStatus: res.status } : { sent: false, reason: 'HTTP_' + res.status, httpStatus: res.status };
      } catch { return { sent: false, reason: 'NETWORK_ERROR' }; }
    },
    idle() { return this.heartbeat('IDLE', '', 0); },
  };
}
