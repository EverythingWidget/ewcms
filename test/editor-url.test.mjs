import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as editorUrl from '../src/editor/lib/editor-url.js';

const { editorHref, wantsEditor } = editorUrl;

const u = (s) => new URL(s, 'http://localhost');

test('a top-level page with ?edit gets the editor', () => {
  assert.equal(wantsEditor(u('/?edit')), true);
  assert.equal(wantsEditor(u('/photography/?edit&tab=motion')), true);
  assert.equal(wantsEditor(u('/about/?edit='), { 'sec-fetch-dest': 'document' }), true);
  assert.equal(wantsEditor(u('/about/')), false);
  assert.equal(wantsEditor(u('/about/?tab=motion')), false);
});

test('the preview never gets the editor (no recursion)', () => {
  assert.equal(wantsEditor(u('/?edit&draft=abc')), false);
  assert.equal(wantsEditor(u('/?edit'), { 'sec-fetch-dest': 'iframe' }), false);
});

test('editorHref puts a bare edit flag first', () => {
  assert.equal(editorHref(u('/about/?tab=motion&edit=')), '/about/?edit&tab=motion');
  assert.equal(editorHref(u('/?edit=')), '/?edit');
  assert.equal(editorHref(u('/x/?edit&source=people#a')), '/x/?edit&source=people#a');
});

test('the old /edit/?path=… addresses are gone: no redirect, the editor is ?edit only', () => {
  assert.equal('legacyRedirect' in editorUrl, false);
  assert.equal(wantsEditor(u('/edit/?path=%2Fabout%2F')), false);
  const plugin = fs.readFileSync(
    new URL('../src/cli/vite-plugin-static-site.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(plugin, /legacyRedirect|\/edit\//);
  // /sandbox still moves to /sandbox/
  assert.match(
    plugin,
    /if \(url\.pathname === '\/sandbox'\) \{\s*res\.writeHead\(302, \{ Location: '\/sandbox\/' \+ url\.search \}\);/,
  );
});
