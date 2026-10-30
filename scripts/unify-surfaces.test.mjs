// The side panel and its cards on the surface roles (_mixins.scss surface()): every control reads
// the role colours from the surface it is on; no fallbacks, no panel-only input tokens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../src/editor/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const svelte = readdirSync(new URL('svelte/', root)).filter((f) => f.endsWith('.svelte'));
const all = [read('styles/editor.scss'), ...svelte.map((f) => read(`svelte/${f}`))].join('\n');

test('the page, the panel, the cards and the dialogs are surfaces', () => {
  assert.match(
    read('styles/editor.scss'),
    /\.ed \{[^}]*@include surface\(var\(--c-bg\), \$quiet: 52%\);/,
  );
  assert.match(
    read('styles/editor.scss'),
    /\.modal__box \{[^}]*@include surface\(var\(--c-card\), \$quiet: 45%\);/,
  );
  assert.match(read('svelte/App.svelte'), /@include surface\(var\(--c-surface\), \$quiet: 50%\);/);
  assert.match(
    read('svelte/WidgetInspector.svelte'),
    /\.card:not\(\.card--bare\) \{\s*@include surface\(var\(--c-card\), \$quiet: 45%\);/,
  );
  for (const f of ['Toasts', 'SectionToolbar', 'WidgetToolbar'])
    assert.match(read(`svelte/${f}.svelte`), /@include surface\(var\(--c-card\)\);/, f);
  for (const f of ['Section', 'CurtainSection', 'PagesList'])
    assert.match(
      read(`svelte/${f}.svelte`),
      /@include surface\(var\(--c-card\), \$quiet: 45%\);/,
      f,
    );
  assert.match(
    read('svelte/WidgetRow.svelte'),
    /@include surface\(var\(--c-widget-card\), \$quiet: 45%\);/,
  );
  assert.match(
    read('svelte/SeoSection.svelte'),
    /@include surface\(var\(--c-surface-2\), \$quiet: 45%\);/,
  );
});

test('no role fallbacks, no panel-only input tokens', () => {
  assert.doesNotMatch(
    all,
    /var\(--(field-bg|field-tile|field-hover|text-quiet|text-strong|selected-bg|selected-fg|focus-line),/,
  );
  assert.doesNotMatch(all, /--c-shadow|--c-input|--c-focus-ring|--field-hover-line|--c-settings/);
  const tokens = read('styles/_tokens.scss');
  assert.doesNotMatch(tokens, /--c-shadow:|--c-input:|--c-focus-ring:|--c-settings:/);
});
