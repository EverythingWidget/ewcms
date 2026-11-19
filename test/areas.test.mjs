// The editor's areas (src/editor/areas.js, AreaList.svelte): one list, the single place each
// part of the site opens from; no top tabs, no Sources / Media in the footer; the areas not
// built yet disabled ("Coming soon"); Theme holds the item templates, Animations the timing,
// the library and the page entrance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AREAS, PANELS, areaOf, areaSubs } from '../src/editor/areas.js';
import { loadUi } from '../scripts/load-ui.mjs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('the areas, in order: Pages, Media, Sources, Theme, Animations, Site settings, History', () => {
  assert.deepEqual(
    AREAS.map((a) => a.label),
    ['Pages', 'Media', 'Sources', 'Theme', 'Animations', 'Site settings', 'History'],
  );
  // where each opens: the side panel, a window over the editor, or not yet
  assert.deepEqual(Object.fromEntries(AREAS.map((a) => [a.id, a.opens])), {
    pages: 'panel',
    media: 'modal',
    sources: 'modal',
    theme: 'panel',
    animations: 'panel',
    settings: 'panel',
    history: 'soon',
  });
  // ui.panel's values: the list, then the side panel's areas (one name each: id = state value)
  assert.deepEqual(PANELS, ['areas', 'pages', 'theme', 'animations', 'settings']);
  assert.equal(areaOf('settings').label, 'Site settings');
  assert.equal(areaOf('nope'), undefined);
});

test("each area's second line says what it holds, counted", () => {
  const s = areaSubs({ pages: 5, photos: 35, sources: 3, items: 10, templates: 7 });
  assert.equal(s.pages, 'Site parts and 5 pages');
  assert.equal(s.media, '35 photos');
  assert.equal(s.sources, '3 sources, 10 items');
  assert.equal(s.theme, '7 templates');
  assert.equal(
    areaSubs({ pages: 1, photos: 1, sources: 1, items: 1, templates: 1 }).theme,
    '1 template',
  );
  assert.equal(areaSubs().media, '0 photos');
  for (const a of AREAS) assert.ok(s[a.id], a.id);
});

test('the editor opens on the areas; only Pages edits', async () => {
  const { ui } = await loadUi();
  assert.equal(ui.panel, 'areas');
  assert.equal(ui.mode, 'browse');
  assert.match(
    src('main.js'),
    /if \(panel !== 'pages' && ui\.mode !== 'browse'\) setMode\('browse'\);/,
  );
});

test('AreaList: a card per area (20px icon in a 36px column), Coming soon disabled, Media and Sources open their windows', () => {
  const list = src('svelte/AreaList.svelte');
  assert.match(list, /\{#each AREAS as area \(area\.id\)\}/);
  assert.match(list, /disabled=\{soon\}/);
  assert.match(list, /<span class="arow__soon">Coming soon<\/span>/);
  assert.match(list, /if \(area\.id === 'media'\) return openMedia\(\{ key: ui\.media\.key \}\);/);
  assert.match(list, /if \(area\.id === 'sources'\) return openSources\(\);/);
  assert.match(list, /if \(area\.opens === 'panel'\) actions\.setPanel\(area\.id\);/);
  assert.match(list, /width: 36px;/);
  assert.match(list, /font-size: var\(--fs-2xl\);/);
  assert.match(list, /min-height: 48px;/);
  assert.match(src('styles/_tokens.scss'), /--fs-2xl: 20px;/);
});

test('one place each: no top tabs, no Sources or Media in the footer; the head 12px under Edit / Publish', () => {
  const app = src('svelte/App.svelte');
  assert.doesNotMatch(app, /<Tabs|import Tabs/);
  assert.doesNotMatch(app, /openSources|openMedia/);
  const foot = app.slice(app.indexOf('<footer class="ed-foot">'), app.indexOf('</footer>'));
  assert.doesNotMatch(foot, /icon="database"|icon="images"/);
  assert.match(app, /\.ed-head \{\s*flex: none;\s*padding: var\(--space-4\) 0 var\(--space-3\);/);
  // the area open, else the list
  const area = app.slice(app.indexOf('<div class="ed-area"'), app.indexOf('<!-- (i) [ Desktop'));
  const order = [
    "ui.panel === 'pages'",
    '<ContentPanel',
    "ui.panel === 'theme'",
    '<ThemePanel',
    "ui.panel === 'animations'",
    '<AnimationsPanel',
    "ui.panel === 'settings'",
    '<SettingsPanel',
    '{:else}',
    '<AreaList',
  ];
  const at = order.map((s) => area.indexOf(s));
  assert.ok(
    at.every((n, i) => n >= 0 && (i === 0 || n > at[i - 1])),
    at.join(' '),
  );
  // an area comes in from the right, the list comes back from the left
  assert.match(app, /const dir = next === 'areas' \|\|/);
});

test('every area but the list has the head back to it (AreaHead: ← Back to areas)', () => {
  const head = src('svelte/AreaHead.svelte');
  assert.match(head, /backLabel="Back to areas"/);
  assert.match(head, /onback=\{\(\) => actions\.setPanel\('areas'\)\}/);
  assert.match(
    src('svelte/PagesList.svelte'),
    /<AreaHead id="pages" \{actions\} trailing=\{addPage\} \/>/,
  );
  assert.match(src('svelte/PagesList.svelte'), /<AreaHead id="theme" \{actions\} \/>/);
  assert.match(src('svelte/AnimationsPanel.svelte'), /<AreaHead id="animations" \{actions\} \/>/);
  assert.match(src('svelte/SettingsPanel.svelte'), /<AreaHead id="settings" \{actions\} \/>/);
});

test('Pages: Site parts first (Header, Footer), then the menu and Not linked; no empty icon column', () => {
  const list = src('svelte/PagesList.svelte');
  const pages = list.slice(list.indexOf('{:else}\n    {#if !level}'));
  const at = ["head('Site parts')", 'SITE_PARTS', 'bind:this={subList}', "head('Not linked'"].map(
    (s) => pages.indexOf(s),
  );
  assert.ok(
    at.every((n, i) => n >= 0 && (i === 0 || n > at[i - 1])),
    at.join(' '),
  );
  assert.doesNotMatch(list, /head\('Site'\)/);
  // no empty lead: only a grip or a lock has one; the text starts 12px in without
  assert.doesNotMatch(list, /<span class="prow__lead" aria-hidden="true"><\/span>/);
  assert.match(
    list,
    /\.prow:not\(:has\(\.prow__lead\)\) \.prow__open \{\s*padding-left: var\(--space-3\);/,
  );
});

test("Theme: Fonts and styles Coming soon, the templates; a template's ← and Done come back to Theme", () => {
  assert.match(
    src('svelte/PageHead.svelte'),
    /if \(isItemTemplate\) return actions\.setPanel\('theme'\);/,
  );
  assert.match(
    src('svelte/App.svelte'),
    /if \(ui\.target\?\.kind === 'item-template'\) actions\.setPanel\('theme'\);/,
  );
  const list = src('svelte/PagesList.svelte');
  assert.match(list, /<span class="prow__soon">Coming soon<\/span>/);
  assert.match(list, /<button type="button" class="prow__open" disabled>/);
  // Theme has no folders
  assert.match(list, /const level = \$derived\(theme \? '' : ui\.pagesWin\.folder\);/);
});

test('Animations: Motion (timing, library) and the Page entrance; Site settings keeps the rest', () => {
  const anim = src('svelte/AnimationsPanel.svelte');
  assert.ok(anim.indexOf('<MotionSettings') < anim.indexOf('title="Page entrance"'));
  const settings = src('svelte/SettingsPanel.svelte');
  for (const title of ['Name & Details', 'SEO', 'Forms', 'Layout', 'Type', 'Photos'])
    assert.match(settings, new RegExp(`title="${title}"`), title);
  assert.match(settings, /<RedirectSettings \{live\} \/>/);
  assert.doesNotMatch(settings, /MotionSettings|Page entrance"|EntranceCurtain/);
  assert.match(src('svelte/MotionSettings.svelte'), /key="animations:motion"/);
});
