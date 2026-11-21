import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalDataLayer } from '../src/editor/server/local-data-layer.mjs';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|svelte)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('data layer contract: load, save, status and publish, the same names in both', async () => {
  const client = read('src/editor/data/local-data-layer.js');
  for (const name of ['load', 'save', 'status', 'publish'])
    assert.match(client, new RegExp(`\\b${name}[:(]`), `client ${name}`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'data-layer-'));
  fs.mkdirSync(path.join(root, 'content/en/pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/site.json'), '{ "version": 1, "name": "S" }\n');
  fs.writeFileSync(path.join(root, 'content/en/pages/index.json'), '{ "title": "Home" }\n');
  const data = createLocalDataLayer(root);
  assert.deepEqual(Object.keys(data).sort(), ['load', 'publish', 'save', 'status']);
  const loaded = data.load();
  assert.equal(loaded.mode, 'dev');
  assert.equal(loaded.files['site.json'].name, 'S');
  assert.equal(loaded.files['pages/index.json'].title, 'Home');
  assert.ok('media' in loaded && 'photos' in loaded && typeof loaded.r2 === 'boolean');
});

test('the editor loads, saves, checks the status and publishes only through the data layer', () => {
  const editor = fileURLToDir('../src/editor/');
  for (const file of walk(editor)) {
    const rel = path.relative(editor, file).split(path.sep).join('/');
    if (rel.startsWith('data/') || rel.startsWith('server/')) continue;
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      src,
      /fetch\([^)]*__editor\/(content|save|status|publish)|json\(\s*['"`]\/__editor\/(content|save|status|publish)/,
      rel,
    );
    assert.doesNotMatch(src, /\bsource\.(load|saveDev|status|publish)\(|\bsaveDev\b/, rel);
  }
  const source = read('src/editor/source.js');
  for (const name of ['load', 'saveDev', 'status', 'publish'])
    assert.doesNotMatch(source, new RegExp(`export (const|async function|function) ${name}\\b`));
  for (const f of [
    'src/editor/main.js',
    'src/editor/svelte/PublishModal.svelte',
    'src/editor/svelte/ListLead.svelte',
  ])
    assert.match(read(f), /import \{ dataLayer \} from '(\.\.?\/)+data\/index\.js'/, f);
});

function fileURLToDir(rel) {
  return path.resolve(new URL(rel, import.meta.url).pathname);
}
