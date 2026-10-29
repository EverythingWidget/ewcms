// The link dropdown: pinned No link / External link, a search, Pages and Items groups that scroll
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sel = readFileSync('src/editor/svelte/Select.svelte', 'utf8');
const lf = readFileSync('src/editor/svelte/LinkField.svelte', 'utf8');

test('link dropdown: grouped, pinned, searchable', () => {
  assert.match(lf, /pinned: true/);
  assert.match(lf, /label: 'External link'/);
  assert.doesNotMatch(lf, /External URL/);
  assert.match(lf, /group: 'Pages'/);
  assert.match(lf, /group: 'Items'/);
  assert.equal((lf.match(/search=\{SEARCH\}/g) || []).length, 2);
  assert.match(sel, /search = ''/);
  assert.match(sel, /class="sel__input"/);
  assert.match(sel, /sel__scroll/);
  assert.match(sel, /sel__mark/);
  assert.match(
    sel,
    /\.sel__path\s*\{[^}]*--fs-xs[^}]*--c-text-muted|\.sel__path\s*\{[^}]*--c-text-muted[^}]*--fs-xs/s,
  );
  assert.doesNotMatch(sel, /var\(--c-fill\)/);
});
