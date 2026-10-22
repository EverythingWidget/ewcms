/**
 * Write mockups into sandbox/mocks/ in one step, then confirm the mock server sees them.
 *
 *   <base64 tar.gz of .svelte/.html files> | npm run mock:push -- [--rm name1,name2]
 *   (or: node scripts/mock-push.mjs [--rm …] < file.b64)
 *
 *   --rm   optional, comma-separated mock names (without .svelte) to delete first
 *
 * Mocks stay local (git-ignored). Writes and deletes are limited to sandbox/mocks/ (names are
 * reduced to their base name). Plain Node (zlib + a small tar reader): no bash, tar or curl,
 * so the same in PowerShell, cmd and WSL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { MOCKS_DIR } from './mock-api.mjs';

const t = () => Date.now();
const args = process.argv.slice(2);
const rmList = args[0] === '--rm' ? (args[1] || '').split(',').filter(Boolean) : [];
fs.mkdirSync(MOCKS_DIR, { recursive: true });

/** The regular files in a tar archive: [{ name, data }]. */
function untar(buf) {
  const files = [];
  for (let off = 0; off + 512 <= buf.length;) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const field = (a, n) => header.toString('utf8', a, a + n).replace(/\0.*$/s, '');
    const prefix = field(345, 155);
    const name = (prefix ? `${prefix}/` : '') + field(0, 100);
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1) || '0';
    off += 512;
    if (type === '0') files.push({ name, data: buf.subarray(off, off + size) });
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}

const stdin = () =>
  new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });

const a = t();
for (const n of rmList)
  fs.rmSync(path.join(MOCKS_DIR, `${path.basename(n, '.svelte')}.svelte`), { force: true });
const b = t();
const input = (await stdin()).replace(/\s+/g, '');
const written = [];
for (const { name, data } of untar(gunzipSync(Buffer.from(input, 'base64')))) {
  const base = path.basename(name);
  if (!/\.(svelte|html)$/.test(base)) continue;
  fs.writeFileSync(path.join(MOCKS_DIR, base), data);
  written.push(base);
}
const c = t();
const port = process.env.MOCK_PORT || 5199;
let list = '';
try {
  const r = await fetch(`http://localhost:${port}/__mocks/list`, {
    signal: AbortSignal.timeout(3000),
  });
  list = await r.text();
} catch {
  // not running
}
const missing = written
  .map((f) => f.replace(/\.(svelte|html)$/, ''))
  .filter((n) => !list.includes(n));
const d = t();

console.log(`wrote: ${written.join(' ')}`);
if (rmList.length) console.log(`deleted: ${rmList.join(',')}`);
if (!list) console.log('server: not running (start it with npm run mock:serve)');
else if (missing.length) console.log(`server: missing ${missing.join(' ')}`);
else console.log('server: all listed');
console.log(`delete=${b - a}ms write=${c - b}ms check=${d - c}ms total=${d - a}ms`);
