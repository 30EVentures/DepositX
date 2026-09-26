// Durable, hash-chained block log. One JSON record per line, fsync'd on append.
//   genesis.json  public genesis (validator, issuer and governance public keys)
//   keys.json     DEV keystore, mode 0600. Production keys live in HSMs, never on disk.
//   blocks.jsonl  append-only: {time, txs, hash, banks, ...}
// Recovery replays the transactions through the kernel and checks every block hash against the
// stored one, so a flipped byte anywhere in history is detected, not silently accepted.
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'blocks.jsonl');
    this.fd = null;
  }
  exists() {
    return fs.existsSync(path.join(this.dir, 'genesis.json')) && fs.existsSync(this.file);
  }
  wipe() {
    this.close();
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
  init({ genesis, keys }) {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(this.dir, 'genesis.json'), JSON.stringify(genesis));
    fs.writeFileSync(path.join(this.dir, 'keys.json'), JSON.stringify(keys), { mode: 0o600 });
    fs.writeFileSync(this.file, '');
  }
  readMeta() {
    return {
      genesis: JSON.parse(fs.readFileSync(path.join(this.dir, 'genesis.json'), 'utf8')),
      keys: JSON.parse(fs.readFileSync(path.join(this.dir, 'keys.json'), 'utf8')),
    };
  }
  append(record) {
    if (this.fd === null) this.fd = fs.openSync(this.file, 'a');
    fs.writeSync(this.fd, JSON.stringify(record) + '\n');
    fs.fsyncSync(this.fd);
  }
  // Reads all complete records. A torn final line (crash mid-write) is dropped and truncated away;
  // a corrupt line anywhere else is an error.
  load() {
    const raw = fs.readFileSync(this.file, 'utf8');
    if (raw.length === 0) return [];
    const lines = raw.split('\n');
    const tornTail = !raw.endsWith('\n');
    const complete = tornTail ? lines.slice(0, -1) : lines.slice(0, -1); // final element is '' when the file ends in \n
    const out = [];
    for (let i = 0; i < complete.length; i++) {
      try {
        out.push(JSON.parse(complete[i]));
      } catch {
        throw new Error(`STORE_CORRUPT: unreadable record at line ${i + 1}`);
      }
    }
    if (tornTail) {
      this.close();
      fs.truncateSync(this.file, complete.reduce((n, l) => n + Buffer.byteLength(l) + 1, 0));
    }
    return out;
  }
  close() {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}
