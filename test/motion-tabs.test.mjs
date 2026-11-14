// Pages | Site Settings, a page's Sections | Motion | SEO, and the site's default animation timing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent } from '../src/site/validate.js';
import { DEFAULT_TIMING, defaultsProblems } from '../src/site/layout/motion.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const anims = JSON.parse(
  readFileSync(new URL('../templates/content/animations.json', import.meta.url)),
);
const esrc = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('defaults: duration, delay, ease, all optional', () => {
  assert.deepEqual(Object.keys(DEFAULT_TIMING), ['duration', 'delay', 'ease']);
  assert.deepEqual(defaultsProblems(undefined), []);
  assert.deepEqual(defaultsProblems({}), []);
  assert.deepEqual(defaultsProblems({ duration: 0.6, delay: 0, ease: 'power2.out' }), []);
  assert.equal(defaultsProblems({ duration: -1 }).length, 1);
  assert.equal(defaultsProblems({ duration: '0.6' }).length, 1);
  assert.equal(defaultsProblems({ ease: '' }).length, 1);
  assert.equal(defaultsProblems({ stagger: 0.1 }).length, 1);
  assert.equal(defaultsProblems([]).length, 1);
});

test('animations.json: with or without defaults it is valid', () => {
  assert.deepEqual(checkContent('animations.json', anims), []);
  const withDefaults = { ...anims, defaults: { duration: 0.6, delay: 0, ease: 'power2.out' } };
  assert.deepEqual(checkContent('animations.json', withDefaults), []);
  const bad = { ...anims, defaults: { duration: 'slow' } };
  assert.match(checkContent('animations.json', bad).join('\n'), /defaults\.duration/);
});

test("the engine starts every spec from the defaults (not the scroll types' ease)", () => {
  const e = read('client/anim/engine.js');
  assert.match(e, /merge\(defaultsFor\(animation\), animation, target, own, inline,/);
  assert.match(
    e,
    /merge\(defaultsFor\(animation\), animation, parse\(el\.dataset\.motionOptions\),/,
  );
  assert.match(e, /SCROLLED = new Set\(\['scroll', 'scrub-words', 'parallax'\]\)/);
});

test('top tabs Pages | Site Settings; page tabs Sections | Element motion | Page motion | SEO', () => {
  const app = read('editor/svelte/App.svelte');
  assert.match(app, /\['pages', 'Pages'\],\s*\['settings', 'Site Settings'\],\s*\];/);
  assert.doesNotMatch(app, /MotionPanel/);
  const c = read('editor/svelte/ContentPanel.svelte');
  assert.match(
    c,
    /\['sections', 'Sections'\],\s*\['element-motion', 'Element motion'\],\s*\['page-motion', 'Page motion'\],\s*\['seo', 'SEO'\],/,
  );
  assert.match(c, /shownTab === 'element-motion'\}\s*<MotionPanel /);
  assert.match(c, /shownTab === 'page-motion'\}\s*<PageMotionPanel /);
  assert.match(read('editor/svelte/PageHead.svelte'), /backLabel="Back to pages"/);
  assert.doesNotMatch(c, /transitions/);
  const m = read('editor/svelte/MotionPanel.svelte');
  assert.doesNotMatch(m, /AnimLibrary|Tabs/);
  assert.doesNotMatch(m, /<EntranceCard |<ScrollBackdropCard /);
  const pm = read('editor/svelte/PageMotionPanel.svelte');
  assert.match(pm, /<ScrollBackdropCard \{live\} \{file\} \/>\s*<EntranceCard /);
  assert.match(read('editor/svelte/SettingsPanel.svelte'), /<MotionSettings /);
  assert.match(read('editor/svelte/MotionSettings.svelte'), /<AnimLibrary /);
});

test('URL tabs are ui.panel: pages, settings, preview; clicks: arrange, animate, visitor', () => {
  const p = read('editor/svelte/persist.js');
  assert.match(p, /PANELS = \['pages', 'settings', 'preview'\]/);
  assert.match(p, /set\('tab', ui\.panel\)/);
  const u = read('editor/svelte/ui.svelte.js');
  assert.match(u, /if \(ui\.panel !== 'pages'\) return 'visitor';/);
  // Element motion animates; Page motion arranges (as Sections and SEO)
  assert.match(u, /ui\.pageTab === 'element-motion' \? 'animate' : 'arrange'/);
  assert.match(p, /PAGE_TABS = \['sections', 'element-motion', 'page-motion', 'seo'\]/);
  // the page tab is editor state (sessionStorage), never content
  assert.match(p, /sessionStorage\.setItem\(/);
  assert.match(
    read('editor/svelte/ContentPanel.svelte'),
    /ui\.sections\[`pagetab:\$\{file\}`\] = v;/,
  );
  for (const f of [
    'editor/main.js',
    'editor/bridge.js',
    'editor/overlay.js',
    'editor/svelte/App.svelte',
  ])
    assert.doesNotMatch(read(f), /ui\.mode\b|lastEdit|previewMode|'browse'/, f);
});

test('Motion shows the whole page; the widget pop-up has no Motion tab and stays on Motion', () => {
  const mp = esrc('svelte/MotionPanel.svelte');
  assert.doesNotMatch(mp, /picks/);
  assert.match(mp, /\{#if ui\.anim\?\.widget === widget\.id\}/);
  const wi = esrc('svelte/WidgetInspector.svelte');
  assert.match(wi, /tabs=\{WIDGET_TABS\}/);
  assert.doesNotMatch(wi, /WidgetMotion/);
  assert.doesNotMatch(esrc('svelte/ui.svelte.js'), /widgetTab/);
  const cp = esrc('svelte/ContentPanel.svelte');
  assert.doesNotMatch(cp, /widgetTab/);
  assert.match(cp, /if \(!\(ui\.popup && ui\.widget === group\.id\)\) openWidget\(group\.id\);/);
  assert.doesNotMatch(esrc('svelte/WidgetMotion.svelte'), /inspector's Motion tab/);
  assert.match(esrc('svelte/ContentPanel.svelte'), /\{#if popG && !ui\.pagesWin\.open\}/);
  assert.doesNotMatch(esrc('main.js'), /editMotion/);
});

test('+ Property: source counts are "Count of a source", not properties; the explorer highlights a property', () => {
  const bar = read('editor/svelte/WidgetToolbar.svelte');
  assert.match(bar, /'No source, so no properties'/);
  // both menus take their count groups from one place (../src/editor/property-groups.js)
  assert.match(bar, /countGroups\(/);
  assert.doesNotMatch(bar, /How many/);
  const field = read('editor/svelte/Field.svelte');
  assert.equal(field.match(/countGroups\(/g).length, 2);
  assert.doesNotMatch(field, /How many/);
  assert.match(read('editor/property-groups.js'), /SOURCE_COUNTS = 'Count of a source'/);
  // the Source Explorer: ui.explorer.property, &property= in the URL
  assert.match(
    read('editor/svelte/ui.svelte.js'),
    /explorer: \{ open: false, file: '', index: 0, property: '' \}/,
  );
  const persist = read('editor/svelte/persist.js');
  assert.match(persist, /property: q\.get\('property'\)/);
  assert.match(persist, /set\('property', /);
  assert.doesNotMatch(read('editor/svelte/SourcesModal.svelte'), /explorer\.field/);
});

test('PageHead: a square back button beside a two-line title, shared site-part lines', () => {
  const head = read('editor/svelte/PageHead.svelte');
  assert.match(head, /<BackHead backLabel="Back to pages"/);
  assert.match(
    read('editor/svelte/BackHead.svelte'),
    /icon="arrow-left" square label=\{backLabel\}/,
  );
  assert.match(head, /kind === 'item-template'\s*\? 'Templates'/);
  assert.match(head, /SITE_PARTS\.find/);
  assert.match(head, /padding: var\(--space-3\) var\(--space-3\) var\(--space-2\)/);
  const parts = read('editor/lib/site-parts.js');
  assert.match(parts, /The menu and its labels/);
  assert.match(parts, /Its sections and widgets/);
  const list = read('editor/svelte/PagesList.svelte');
  assert.match(list, /from '\.\.\/lib\/site-parts\.js'/);
  assert.doesNotMatch(list, /const SITE_PARTS/);
});
