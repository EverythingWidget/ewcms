// The editor's areas (src/editor/areas.js, AreaList.svelte): one list, the single place each
// part of the site opens from; no top tabs, no Sources / Media in the footer; the areas not
// built yet disabled ("Coming soon"); Theme holds the item templates, Animations the timing,
// the library and the page entrance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  AREAS,
  COMING_SOON,
  EDIT_PANEL,
  MOVED_OUT,
  PANEL_ALIASES,
  PANELS,
  TEMPLATES_PANEL,
  areaOf,
  opensIn,
  panelOf,
  sectionKeyOf,
} from '../src/editor/areas.js';
import { loadUi } from '../scripts/load-ui.mjs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('the areas, in order: Pages, Media, Sources, Theme, Animations, Site settings, History', () => {
  assert.deepEqual(
    AREAS.map((a) => a.label),
    ['Pages', 'Media', 'Sources', 'Theme', 'Animations', 'Site settings', 'History', 'About'],
  );
  // where each opens: the side panel, a window over the editor, or nothing yet
  assert.deepEqual(Object.fromEntries(AREAS.map((a) => [a.id, opensIn(a)])), {
    pages: 'panel',
    media: 'window',
    sources: 'window',
    theme: 'panel',
    animations: 'panel',
    'site-settings': 'panel',
    history: null,
    about: 'window',
  });
  assert.deepEqual(Object.fromEntries(AREAS.map((a) => [a.id, a.status])), {
    pages: 'ready',
    media: 'ready',
    sources: 'ready',
    theme: 'ready',
    animations: 'ready',
    'site-settings': 'ready',
    history: 'soon',
    about: 'ready',
  });
  // ui.panel's values: the list, then the side panel's areas (one name each: id = state value)
  assert.deepEqual(PANELS, ['areas', 'pages', 'theme', 'animations', 'site-settings']);
  assert.ok(PANELS.includes(EDIT_PANEL) && PANELS.includes(TEMPLATES_PANEL));
  assert.equal(areaOf('site-settings').label, 'Site settings');
  // an old 'settings' (a link, a session) is site-settings
  assert.equal(panelOf('settings'), 'site-settings');
  // the one table of old names: section keys and what moved out follow it
  assert.equal(sectionKeyOf('settings:seo'), 'site-settings:seo');
  assert.equal(sectionKeyOf('site-settings:seo'), 'site-settings:seo');
  assert.equal(sectionKeyOf('animations:entrance'), 'animations:entrance');
  assert.equal(sectionKeyOf('settings'), 'settings');
  for (const old of Object.keys(MOVED_OUT)) assert.ok(PANEL_ALIASES[old], old);
  assert.equal(panelOf('pages'), 'pages');
  assert.equal(areaOf('nope'), undefined);
});

test('a record is the whole area: id, label, icon, subtitle, status, what it opens', () => {
  for (const a of AREAS) {
    assert.deepEqual(
      Object.keys(a).filter((k) => !['parts', 'highlight'].includes(k)),
      ['id', 'label', 'icon', 'subtitle', 'status', 'opens'],
      a.id,
    );
    for (const p of a.parts ?? []) {
      assert.deepEqual(Object.keys(p), ['id', 'label', 'subtitle', 'status'], `${a.id} ${p.id}`);
      assert.ok(['ready', 'soon'].includes(p.status), p.id);
    }
    assert.match(a.id, /^[a-z][a-z-]*$/);
    assert.ok(['ready', 'soon'].includes(a.status), a.id);
    // a ready area opens something; a panel or a window is a function (loaded on demand)
    if (a.status === 'ready') assert.ok(opensIn(a), a.id);
    if (a.opens) assert.equal(typeof (a.opens.panel || a.opens.window), 'function', a.id);
  }
  assert.equal(new Set(AREAS.map((a) => a.id)).size, AREAS.length);
  // the panels' components: one each, named in the record
  const file = src('areas.js');
  for (const c of ['ContentPanel', 'ThemePanel', 'AnimationsPanel', 'SiteSettingsPanel'])
    assert.match(file, new RegExp(`import\\('\\./svelte/${c}\\.svelte'\\)`), c);
});

test("each area's second line says what it holds, counted", () => {
  const n = { pages: 5, photos: 35, sources: 3, items: 10, templates: 7 };
  const s = (id) => areaOf(id).subtitle(n);
  assert.equal(s('pages'), 'Site parts and 5 pages');
  assert.equal(s('media'), '35 photos');
  assert.equal(s('sources'), '3 sources, 10 items');
  assert.equal(s('theme'), '7 templates');
  assert.equal(areaOf('theme').subtitle({ templates: 1 }), '1 template');
  assert.equal(areaOf('media').subtitle({}), '0 photos');
  for (const a of AREAS) assert.ok(a.subtitle(n), a.id);
});

test('no switch on area ids or panel values: App and AreaList follow the record', () => {
  const app = src('svelte/App.svelte');
  const list = src('svelte/AreaList.svelte');
  const ids = AREAS.map((a) => a.id).join('|');
  for (const [name, text] of [
    ['App.svelte', app],
    ['AreaList.svelte', list],
  ]) {
    // no ui.panel === 'x' / area.id === 'x', no area id as a string literal
    assert.doesNotMatch(text, /(ui\.panel|area\.id|\.id)\s*[!=]==?\s*'/, name);
    assert.doesNotMatch(text, new RegExp(`'(${ids})'`), name);
    // no panel component imported by name: the records name them
    assert.doesNotMatch(
      text,
      /import (ContentPanel|ThemePanel|AnimationsPanel|SiteSettingsPanel) /,
      name,
    );
    assert.doesNotMatch(text, /openSources|openMedia/, name);
  }
  assert.match(app, /\{@const Panel = panels\[area\.id\]\}/);
  assert.match(list, /if \(opensIn\(area\) === 'panel'\) actions\.setPanel\(area\.id\);/);
  assert.match(list, /else area\.opens\?\.window\?\.\(\);/);
  assert.match(list, /\{area\.subtitle\(counts\)\}/);
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

test('AreaList: a card per area (20px icon in a 36px column), Coming soon disabled', () => {
  const list = src('svelte/AreaList.svelte');
  assert.match(
    list,
    /\{#each rows as area \(area\.id\)\}<li>\{@render card\(area\)\}<\/li>\{\/each\}/,
  );
  assert.match(list, /disabled=\{soon\}/);
  assert.match(list, /\{#if soon\}\s*<SoonTag \/>/);
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
    "opensIn(area) === 'panel'",
    '<Panel {live} {bridge} {actions} />',
    '{:else}',
    '<AreaList',
  ];
  const at = order.map((s) => area.indexOf(s));
  assert.ok(
    at.every((n, i) => n >= 0 && (i === 0 || n > at[i - 1])),
    at.join(' '),
  );
  // an area comes in from the right, the list comes back from the left
  assert.match(app, /const back = next === 'areas' \|\|/);
});

test('the windows (a record that opens one): half-width cards under the list, two a row, no ›', () => {
  const list = src('svelte/AreaList.svelte');
  // the record decides: opensIn, no ids
  assert.match(list, /const rows = AREAS\.filter\(\(a\) => opensIn\(a\) !== 'window'\);/);
  assert.match(list, /const windows = AREAS\.filter\(\(a\) => opensIn\(a\) === 'window'\);/);
  assert.match(list, /<ul class="areas-win">\s*\{#each windows as area \(area\.id\)\}/);
  // the same card as a row (its icon column, label, subtitle), without the ›
  assert.match(list, /\{:else if !win\}\s*<span class="arow__go">/);
  // 2 a row, 8px apart, 12px under the list
  assert.match(
    list,
    /\.areas-win \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\s*gap: var\(--space-2\);\s*margin: var\(--space-3\) 0 0;/,
  );
  assert.deepEqual(
    AREAS.filter((a) => opensIn(a) === 'window').map((a) => a.id),
    ['media', 'sources', 'about'],
  );
});

test("About: ewcms's version, or the update to it, highlighted (its record)", () => {
  const about = areaOf('about');
  assert.equal(about.subtitle({}), 'ewcms');
  const none = { current: 'v0.9.0', latest: 'v0.9.0', available: false };
  assert.equal(about.subtitle({ update: none }), 'ewcms v0.9.0');
  assert.equal(about.highlight({ update: none }), false);
  const offer = { current: 'v0.9.0', latest: 'v0.10.0', available: true, highlighted: true };
  assert.equal(about.subtitle({ update: offer }), 'Update to v0.10.0');
  assert.equal(about.highlight({ update: offer }), true);
  // Later: still offered, not highlighted
  assert.equal(about.highlight({ update: { ...offer, highlighted: false } }), false);
  assert.match(src('areas.js'), /openAbout\(\)/);
  // the card: its record's highlight, the old pill's teal; same fill and size
  const list = src('svelte/AreaList.svelte');
  assert.match(list, /area\.highlight\?\.\(counts\) && 'is-update'/);
  assert.match(list, /update: \{ \.\.\.upd\.info, highlighted: highlighted\(\) \}/);
  assert.match(
    list,
    /&\.is-update \{\s*box-shadow: inset 0 0 0 1px var\(--c-widget-line-hover\);\s*&:hover \{\s*box-shadow: inset 0 0 0 1px var\(--c-widget-accent\);/,
  );
  // highlighted: an offer not put off with Later, an update running or failed
  const u = src('svelte/update.svelte.js');
  assert.match(
    u,
    /\(!!upd\.info\?\.available && !upd\.later && upd\.phase === 'offer'\) \|\|\s*updating\(\) \|\|\s*upd\.phase === 'error'/,
  );
  assert.match(u, /export function later\(\) \{\s*upd\.later = true;\s*closeModal\('about'\);/);
});

test('the About window: the update (offer, installing, restarting, done, error) or Up to date, then ewcms', () => {
  const m = src('svelte/AboutModal.svelte');
  // Media's and Sources' window: ExplorerHead, the box with no padding, header + body
  assert.match(m, /<ExplorerHead title="About" icon="fa-circle-info"/);
  assert.match(m, /dialog\.about-modal \{\s*width: min\(520px, calc\(100vw - 32px\)\);/);
  assert.match(m, /grid-template-rows: auto minmax\(0, 1fr\);\s*padding: 0;/);
  for (const s of [
    'Update available',
    '{info.current} → {info.latest}',
    'this site · latest tag',
    'Updating…',
    'Restarting dev server…',
    'Updated to {job.to}',
    'Update failed',
    'Up to date',
    'The editor and builder of this site',
    'https://ewcms.org',
    "This site's engine",
    '{info?.engine',
  ])
    assert.ok(m.includes(s), s);
  // Later / Update only on an offer; Up to date has no buttons
  assert.match(
    m,
    /\{#if offer\}\s*<div class="upd__btns">\s*<button type="button" onclick=\{later\}>Later<\/button>\s*<button type="button" class="is-primary" onclick=\{startUpdate\}>Update<\/button>/,
  );
  assert.equal(m.match(/class="upd__btns"/g).length, 3); // offer, done, error
});

test('Coming soon: one pattern, from the status; the words in one place', () => {
  assert.equal(COMING_SOON, 'Coming soon');
  assert.match(src('svelte/SoonTag.svelte'), /<span class="soon">\{COMING_SOON\}<\/span>/);
  // the rows' look: the soon-row mixin, in the list and in Theme
  assert.match(src('styles/_mixins.scss'), /@mixin soon-row\(\$faint\)/);
  assert.match(src('svelte/AreaList.svelte'), /@include soon-row\('\.arow__lead, \.arow__name'\);/);
  assert.match(src('svelte/PagesList.svelte'), /@include soon-row\('\.prow__title'\);/);
  // no copy of the words or of the style elsewhere in the editor's markup
  for (const f of readdirSync(new URL('../src/editor/svelte/', import.meta.url))) {
    if (!f.endsWith('.svelte')) continue;
    const s = src(`svelte/${f}`).replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(s, />\s*Coming soon\s*</, f);
    assert.doesNotMatch(s, /__soon\b/, f);
  }
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
  assert.match(
    src('svelte/SiteSettingsPanel.svelte'),
    /<AreaHead id="site-settings" \{actions\} \/>/,
  );
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
    /if \(ui\.target\?\.kind === 'item-template'\) actions\.setPanel\(TEMPLATES_PANEL\);/,
  );
  const list = src('svelte/PagesList.svelte');
  // Fonts and styles: Theme's record's part, status 'soon' (type stays in Site settings)
  assert.deepEqual(areaOf('theme').parts, [
    { id: 'fonts-styles', label: 'Fonts and styles', subtitle: "The theme's look", status: 'soon' },
  ]);
  assert.match(list, /const parts = \$derived\(areaOf\(area\)\?\.parts \?\? \[\]\);/);
  assert.match(list, /<button type="button" class="prow__open" disabled=\{soon\}>/);
  assert.match(list, /\{#if soon\}<SoonTag \/>\{\/if\}/);
  assert.doesNotMatch(list, /Fonts and styles<|The theme's look</);
  // Theme has no folders
  assert.match(list, /const level = \$derived\(theme \? '' : ui\.pagesWin\.folder\);/);
});

test('Animations: Motion (timing, library) and the Page entrance; Site settings keeps the rest', () => {
  const anim = src('svelte/AnimationsPanel.svelte');
  assert.ok(anim.indexOf('<MotionSettings') < anim.indexOf('title="Page entrance"'));
  const settings = src('svelte/SiteSettingsPanel.svelte');
  for (const title of ['Name & Details', 'SEO', 'Forms', 'Layout', 'Type', 'Photos'])
    assert.match(settings, new RegExp(`title="${title}"`), title);
  assert.match(settings, /<RedirectSettings \{live\} \/>/);
  assert.doesNotMatch(settings, /MotionSettings|Page entrance"|EntranceCurtain/);
  assert.match(src('svelte/MotionSettings.svelte'), /key="animations:motion"/);
});
