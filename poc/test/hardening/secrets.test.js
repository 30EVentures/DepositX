// Phase 0.1: no secret in a tracked file. The depositx-agent token lives only in the environment or a secret store.
// The scan reads every file git tracks (or every file on disk if this is not a checkout) and refuses token-shaped
// strings, private key blocks, a literal value for the three FlashyOS variables, and the files `@flashyos/agent init`
// writes (.env with a live token, generated reporters and inference files). Fake fixtures are listed by exact string.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// exact fake values that tests are allowed to carry, each with the reason it is not a secret
export const FIXTURES = new Map([
  ['agt_test_0123456789abcdef', 'a made-up token used by the reporter tests against a fake collector on loopback'],
]);

export const RULES = [
  { id: 'PRIVATE_KEY_BLOCK', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'TOKEN_SHAPE', re: /\b(?:agt|tok|fos|flashy)_[A-Za-z0-9_]{12,}\b/ },
  { id: 'VENDOR_KEY_SHAPE', re: /\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xox[bp]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/ },
  { id: 'JWT_SHAPE', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/ },
  { id: 'BEARER_VALUE', re: /\bBearer\s+(?![<$\[{]|token\b|TOKEN\b|\.\.\.)[A-Za-z0-9._~+/=-]{16,}/ },
  { id: 'LONG_HEX_FOR_A_SECRET', re: /(?:priv(?:ate)?|secret|seed|token|passw(?:or)?d)\w*["']?\s*[:=]\s*["'][0-9a-fA-F]{32,}["']/i },
  { id: 'LITERAL_AGENT_TOKEN', re: /FLASHYOS_AGENT_TOKEN\s*[:=]\s*["']?(?![\s"'$<{]|\.\.\.|TOKEN\b|ENV\b|''|"")[^\s"',;)]{4,}/ },
];
const FORBIDDEN_FILE = [/(^|\/)\.env(\..*)?$/, /(^|\/)keys\.json$/, /\.pem$/, /\.key$/, /(^|\/)id_(rsa|ed25519)$/, /-agent-reporter\.(ts|js)$/, /(^|\/)src\/inference\.ts$/, /(^|\/)src\/agents\//, /(^|\/)depositx\.aao\.json$/, /(^|\/)\.flashyos(\/|$)/];

export function scanText(text, fixtures = FIXTURES) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const { id, re } of RULES) {
      const m = re.exec(line);
      if (!m) continue;
      const found = m[0];
      if ([...fixtures.keys()].some((f) => found.includes(f) || line.includes(f)) && id !== 'PRIVATE_KEY_BLOCK') continue;
      hits.push({ id, line: i + 1 });
    }
  });
  return hits;
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    const out = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(REPO, p)); } };
    walk(REPO);
    return out;
  }
}

test('no tracked file contains a token-shaped string, a private key block or a literal agent token', () => {
  const problems = [];
  for (const f of trackedFiles()) {
    if (f === 'poc/test/hardening/secrets.test.js') continue; // this file holds the patterns themselves
    let text; try { text = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    for (const h of scanText(text)) problems.push(`${f}:${h.line} ${h.id}`);
  }
  assert.deepEqual(problems, []);
});

test('no tracked file is one that holds or generates credentials (.env, key files, files written by the agent init command)', () => {
  const bad = trackedFiles().filter((f) => FORBIDDEN_FILE.some((re) => re.test(f)));
  assert.deepEqual(bad, []);
});

test('.gitignore keeps the usual credential files and the durable data directory out of git', () => {
  const ig = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
  for (const entry of ['.env', '.env.*', '*.pem', '*.key', 'keys.json', 'data/', '.flashyos/']) assert.ok(ig.includes(entry), `.gitignore lacks ${entry}`);
});

test('every allowed fixture is a clearly fake value with a stated reason', () => {
  for (const [value, reason] of FIXTURES) {
    assert.match(value, /^agt_test_/);
    assert.ok(reason.length > 20);
  }
});

// ---- the scanner itself must refuse what it claims to refuse (refusals first) ----
const BAD = {
  'a private key block': '-----BEGIN PRIVATE KEY-----\nMC4CAQAw\n-----END PRIVATE KEY-----',
  'an EC private key block': '-----BEGIN EC PRIVATE KEY-----',
  'an agent-style token': 'const t = "agt_9f8e7d6c5b4a3210fedcba98";',
  'a flashy-prefixed token': 'token: flashy_abcdefghijklmnop1234',
  'a vendor key': 'OPENAI=sk-abcdefghijklmnopqrstuvwxyz0123',
  'a GitHub token': 'GH=ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  'a cloud access key': 'id AKIAABCDEFGHIJKLMNOP',
  'a JWT': 'Authorization: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk',
  'a bearer value': 'curl -H "Authorization: Bearer abcdef0123456789abcdef"',
  'a hex private key assignment': 'const privateKey = "' + 'ab'.repeat(32) + '";',
  'a seed in hex': "seed: '" + '0f'.repeat(32) + "'",
  'a literal token in a shell line': "export FLASHYOS_AGENT_TOKEN='realvalue12345'",
  'a literal token in an env file line': 'FLASHYOS_AGENT_TOKEN=realvalue12345',
  'a literal token in an object': "{ FLASHYOS_AGENT_TOKEN: 'realvalue12345' }",
};
for (const [name, text] of Object.entries(BAD)) test(`REFUSAL: the scanner flags ${name}`, () => { assert.ok(scanText(text).length > 0, text); });

const GOOD = {
  'a placeholder in a shell example': "export FLASHYOS_AGENT_TOKEN='...'",
  'an angle-bracket placeholder': 'FLASHYOS_AGENT_TOKEN=<from the dashboard>',
  'an environment reference': 'FLASHYOS_AGENT_TOKEN=$TOKEN',
  'a variable in an object': '{ FLASHYOS_AGENT_TOKEN: TOKEN }',
  'an empty value': "{ FLASHYOS_AGENT_TOKEN: '' }",
  'a bearer placeholder': 'Authorization: Bearer <token>',
  'a short hex id': "const id = 'deadbeef'",
  'a public key (not a secret)': "pub: '" + 'ab'.repeat(44) + "'",
  'ordinary prose': 'The token is read from the environment only.',
};
for (const [name, text] of Object.entries(GOOD)) test(`the scanner leaves ${name} alone`, () => { assert.deepEqual(scanText(text), [], text); });

test('REFUSAL: a fixture is only excused by its exact string, not by a look-alike', () => {
  assert.deepEqual(scanText('const T = "agt_test_0123456789abcdef";'), []);
  assert.ok(scanText('const T = "agt_live_0123456789abcdef";').length > 0);
  assert.ok(scanText('const T = "agt_9876543210abcdefgh";').length > 0);
});

test('REFUSAL: a scan that reads nothing is a failure, not a pass', () => {
  assert.ok(trackedFiles().length > 50, 'the scan must see the repository');
});
