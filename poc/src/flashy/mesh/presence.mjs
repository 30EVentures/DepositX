#!/usr/bin/env node
// Presence for this product on the FlashyOS mesh. DRY RUN unless you pass --send.
//   node <this file>                  show what would be sent (token redacted), send nothing
//   node <this file> --send           send ONE IDLE heartbeat and print the outcome
//   node <this file> --send --every 60   keep sending one every 60 s (10..3600) until Ctrl-C
// Needs FLASHYOS_ORG_ID, FLASHYOS_AGENT_TOKEN, FLASHYOS_AGENT_NAME in the environment. Never prints the token.
import { createReporter, describeHeartbeat, readConfig } from './reporter.js';

const args = process.argv.slice(2);
const send = args.includes('--send');
const ei = args.indexOf('--every');
const every = ei >= 0 ? Number(args[ei + 1]) : 0;
if (ei >= 0 && !(Number.isInteger(every) && every >= 10 && every <= 3600)) { console.error('--every takes whole seconds from 10 to 3600'); process.exit(2); }
const cfg = readConfig();
if (!cfg.configured) { console.error(`not configured (${cfg.reason}). Set FLASHYOS_ORG_ID, FLASHYOS_AGENT_TOKEN, FLASHYOS_AGENT_NAME.`); process.exit(2); }
console.log(JSON.stringify(describeHeartbeat(cfg, 'IDLE'), null, 2));
if (!send) { console.log('\ndry run: nothing sent. Add --send to send.'); process.exit(0); }
const r = createReporter();
const once = async () => { const out = await r.idle(); console.log(`${new Date().toISOString()} heartbeat: ${out.sent ? 'sent' : 'NOT sent'}${out.reason ? ' (' + out.reason + ')' : ''}`); return out; };
const first = await once();
if (!every) process.exit(first.sent ? 0 : 1);
setInterval(once, every * 1000);
