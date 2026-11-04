// Selection: one kind at a time (sections or widgets), the pop-up opening on a single pick,
// list clicks, the quiet restore after a save, and the ui helpers every caller goes through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { offscreen, popupStays } from '../src/editor/multi-select.js';
import { loadUi } from './load-ui.mjs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('pop-up: a single click only selects; one selected swaps it, none or several close it', async () => {
  const { ui, selectWidgets } = await loadUi();
  selectWidgets(['w-1']);
  ui.popup = true;
  selectWidgets(['w-2']);
  assert.equal(ui.popup, true, 'one selected: the pop-up swaps to it');
  selectWidgets(['w-1', 'w-2']);
  assert.equal(ui.popup, false, 'several: it closes');
  ui.popup = true;
  selectWidgets([]);
  assert.equal(ui.popup, false, 'none: it closes');
  assert.equal(popupStays(1), true);
  assert.equal(popupStays(0), false);
  assert.equal(popupStays(2), false);
  const ov = src('overlay.js');
  assert.match(ov, /addEventListener\('dblclick', ondblclick, true\)/, 'double click opens');
  assert.match(ov, /onopen\?\.\(id\)/);
  const main = src('main.js');
  // a selection box (or Ctrl+click) never opens the pop-up
  assert.match(main, /onselect\(ids\) \{\s*closePopup\(\);/);
  assert.match(src('svelte/ContentPanel.svelte'), /ui\.popup && groups\.find/);
});

test('list click selects in the preview, scrolled to only when out of view', () => {
  assert.equal(offscreen({ top: 10, bottom: 200 }, 600), false);
  assert.equal(offscreen({ top: -5, bottom: 200 }, 600), true);
  assert.equal(offscreen({ top: 500, bottom: 700 }, 600), true);
  const card = src('svelte/SectionCard.svelte');
  assert.match(card, /selectWidgets\(\[id\]\);\s*reveal\(id\);/);
});

test('selecting a section clears any widget selection and closes the pop-up; and back', async () => {
  const { ui, selectWidgets, selectSection } = await loadUi();
  selectWidgets(['w-1']);
  ui.popup = true;
  selectSection('s-2');
  assert.equal(ui.selSection, 's-2');
  assert.equal(ui.widget, null);
  assert.deepEqual([...ui.multi], []);
  assert.equal(ui.popup, false);
  selectWidgets(['w-1', 'w-2']);
  selectSection('s-1');
  assert.deepEqual([...ui.multi], []);
  selectWidgets(['w-3']);
  assert.equal(ui.selSection, null);
  assert.equal(ui.widget, 'w-3');
});

test('the panel card and the preview both select a section through selectSection', () => {
  assert.match(src('svelte/SectionsList.svelte'), /onselect=\{\(e\) => pick\(e, s\.id\)\}/);
  assert.match(
    src('svelte/SectionsList.svelte'),
    / {4}selectSection\(id\);\n {4}locate\(bridge, id\);/,
  );
  const ov = src('overlay.js');
  assert.match(ov, /if \(!b\.box && !b\.mod\) onsectionpick\(b\.sec\.dataset\.sec\)/);
  assert.match(src('main.js'), /onsectionpick\(id\) \{\s*selectSection\(id\);/);
});

test('sections or widgets: selecting one kind clears the other', async () => {
  const { ui, selectSections, selectWidgets } = await loadUi();
  selectWidgets(['w-1', 'w-2']);
  selectSections(['s-1', 's-2'], 's-1');
  assert.deepEqual(
    [ui.multi, ui.widget, ui.selSections, ui.selSection],
    [[], null, ['s-1', 's-2'], 's-1'],
  );
  selectWidgets(['w-1']);
  assert.deepEqual([ui.selSections, ui.selSection, ui.widget], [[], null, 'w-1']);
  selectSections(['s-3']);
  assert.deepEqual([ui.selSections, ui.selSection, ui.widget], [[], 's-3', null]);
});

test("a save's reload restores the selection quietly: no pop-up opens", async () => {
  const { ui, pickElement } = await loadUi();
  const el = { dataset: { edit: 'pages/index.json#/title' } };
  pickElement(el, 'text', { quiet: true });
  assert.deepEqual(ui.selection, { edit: 'pages/index.json#/title', quiet: true });
  assert.deepEqual(ui.picked, { el, kind: 'text' });
  pickElement(el, 'text');
  assert.deepEqual(ui.selection, { edit: 'pages/index.json#/title' });
  const b = src('bridge.js');
  assert.match(b, /emit\('pick', el, sel\.kind, \{ quiet: true \}\)/);
  assert.match(src('main.js'), /bridge\.on\('pick', pickElement\)/);
  assert.match(src('svelte/ContentPanel.svelte'), /if \(!edit \|\| quiet\) return;/);
});

test('the preview pick and hover live in ui only: the bridge reports them, keeps none', () => {
  const b = src('bridge.js');
  assert.doesNotMatch(b, /let (selected|hoverEl)\b/);
  assert.doesNotMatch(b, /\bselect\(el, kind|setHover\(/);
  assert.match(b, /emit\('hover', el\)/);
  const m = src('main.js');
  assert.doesNotMatch(m, /bridge\.(select|selected)\b|on\('select'/);
  assert.match(m, /bridge\.on\('hover', hoverElement\)/);
  assert.match(m, /bridge\.setClickMode\(clicks\);\s*clearPick\(\);/);
  const u = src('svelte/ui.svelte.js');
  for (const fn of ['pickElement', 'hoverElement', 'clearPick', 'clearSelection', 'pickAnim'])
    assert.match(u, new RegExp(`export function ${fn}\\(`));
});

test('Esc and the panels select through the ui helpers', async () => {
  const app = src('svelte/App.svelte');
  assert.match(app, /\|\| ui\.selSection\) deselect\(\);/);
  assert.doesNotMatch(app, /ui\.(selection|widget|section|selSection) = null/);
  const { ui, deselect, selectText } = await loadUi();
  Object.assign(ui, { widget: 'w-1', multi: ['w-1', 'w-2'], section: 's-1', selSection: 's-1' });
  Object.assign(ui, { selSections: ['s-1', 's-2'], link: 'w-2', anchor: 'w-1' });
  selectText('pages/index.json#/title');
  deselect();
  assert.deepEqual(
    [ui.selection, ui.widget, ui.multi, ui.section, ui.selSection, ui.selSections, ui.link],
    [null, null, [], null, null, [], null],
  );
  assert.equal(ui.anchor, 'w-1', 'the Shift-click anchor stays');
  assert.match(src('svelte/SectionsList.svelte'), /peekSection\(id, 'panel'\)/);
  const card = src('svelte/SectionCard.svelte');
  assert.doesNotMatch(card, /ui\.(anchor|hot) =/);
  assert.match(card, /setAnchor\(id\)/);
  const persist = src('svelte/persist.js');
  assert.doesNotMatch(persist, /ui\.selection =/);
  // visitor clicks: no pick, the text field still restored (quietly)
  assert.match(persist, /if \(el && !motion\) selectText\(edit, \{ quiet: true \}\);/);
  selectText('pages/index.json#/title', { quiet: true });
  assert.deepEqual(ui.selection, { edit: 'pages/index.json#/title', quiet: true });
});

test('the pop-up and section helpers: open, close, show, deselect sections, clear anim', async () => {
  const u = await loadUi();
  const { ui } = u;
  u.selectWidgets(['w-1']);
  u.openPopup();
  assert.equal(ui.popup, true);
  u.selectText('pages/index.json#/title');
  u.closeWidgetPopup();
  assert.deepEqual([ui.popup, ui.selection, ui.widget], [false, null, 'w-1'], 'the widget stays');
  u.openPopup();
  u.closePopup();
  assert.deepEqual([ui.popup, ui.widget], [false, 'w-1']);
  u.openSectionPopup('s-2');
  assert.deepEqual([ui.section, ui.selSection, ui.widget, ui.popup], ['s-2', 's-2', null, false]);
  u.closeSectionPopup();
  assert.deepEqual([ui.section, ui.selSection], [null, 's-2'], 'the section stays selected');
  u.selectSections(['s-1', 's-2']);
  u.deselectSections();
  assert.deepEqual([ui.selSection, ui.selSections], [null, []]);
  u.selectWidgets(['w-1', 'w-2']);
  u.showWidget('w-3', true);
  assert.deepEqual(
    [ui.widget, ui.popup, ui.multi],
    ['w-3', true, ['w-1', 'w-2']],
    'only those two',
  );
  u.showWidget(null, false);
  assert.deepEqual([ui.widget, ui.popup], [null, false]);
  ui.anim = { id: 'a' };
  u.clearAnim();
  assert.equal(ui.anim, null);
  u.setMod(true);
  assert.equal(ui.mod, true);
  u.setMod(false);
  assert.equal(ui.mod, false);
});

test('pick, hover and peek: the preview and panel sides kept apart', async () => {
  const u = await loadUi();
  const { ui } = u;
  const el = { dataset: { edit: 'f#/a' } };
  u.hoverElement(el);
  assert.deepEqual(ui.hoverEl, el);
  u.pickElement(el, 'text');
  u.clearPick();
  assert.deepEqual([ui.picked, ui.hoverEl, ui.selection], [null, null, null]);
  u.peekSection('s-1', 'panel');
  u.peekSection(null, 'preview');
  assert.deepEqual(ui.peek, { id: 's-1', from: 'panel' }, "the other side's leave keeps it");
  u.peekSection(null, 'panel');
  assert.equal(ui.peek, null);
  u.hotWidget('w-1', 'preview');
  u.hotWidget(null, 'panel');
  assert.deepEqual(ui.hot, { id: 'w-1', from: 'preview' });
  u.hotWidget(null, 'preview');
  assert.equal(ui.hot, null);
  u.selectWidgets(['w-1']);
  u.selectLink('w-1');
  u.pickElement(el, 'text');
  u.clearSelection();
  assert.deepEqual([ui.widget, ui.link, ui.selection, ui.picked], [null, null, null, null]);
});

test('selectAnim (a panel choice) and pickElement anim (a preview click) set the same state', async () => {
  const a = await loadUi();
  const b = await loadUi();
  a.ui.panel = b.ui.panel = 'nav';
  a.ui.pageTab = b.ui.pageTab = 'element-motion';
  const el = { dataset: { anim: 'a1' }, closest: () => ({ dataset: { widget: 'w-1' } }) };
  a.selectAnim(el);
  b.pickElement(el, 'anim');
  for (const k of ['picked', 'anim', 'widget', 'selection']) assert.deepEqual(a.ui[k], b.ui[k], k);
  assert.equal(a.ui.picked.kind, 'anim');
  assert.equal(a.ui.widget, 'w-1');
  assert.equal(a.ui.anim.id, 'a1');
  assert.match(src('svelte/MotionPanel.svelte'), /selectAnim\(el\)/);
});

test('no selection or hover field is written outside ui.svelte.js', () => {
  const fields =
    'picked|hoverEl|anim|selection|widget|multi|popup|section|selSections?|peek|hot|link|anchor|mod|secRows';
  const write = new RegExp(`\\bui\\.(${fields})\\s*=[^=]`);
  // every editor source file but ui.svelte.js itself
  const root = new URL('../src/editor/', import.meta.url);
  const files = readdirSync(root, { recursive: true })
    .map((f) => f.replaceAll('\\', '/'))
    .filter((f) => /\.(js|mjs|svelte)$/.test(f) && f !== 'svelte/ui.svelte.js');
  assert.ok(files.length > 11, 'scans the whole editor');
  // App.svelte keeps one on purpose: a widget opened anywhere drops the several selected
  const kept = /if \(ui\.widget && untrack\(\(\) => ui\.multi\.length\)\) ui\.multi = \[\];/;
  for (const f of files) assert.doesNotMatch(src(f).replace(kept, ''), write, f);
});
