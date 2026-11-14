// Browse and edit (ui.mode): the one source of what a preview click does (previewClicks), Edit
// / Done in the header (Done saves first), the footer's Desktop | Mobile, Sources, Media and
// undo / redo (edit only), and the pages list's active row (the page in the preview).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadUi } from '../scripts/load-ui.mjs';
import { entryShows } from '../src/editor/lib/page-tree.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('previewClicks comes from ui.mode only: browse is visitor, edit arranges or animates', async () => {
  const { ui, previewClicks } = await loadUi();
  assert.equal(ui.mode, 'browse', 'the editor opens in browse');
  for (const panel of ['pages', 'settings', 'preview']) {
    ui.panel = panel;
    for (const tab of [null, 'sections', 'element-motion']) {
      ui.pageTab = tab;
      ui.mode = 'browse';
      assert.equal(previewClicks(), 'visitor', `${panel} ${tab}`);
      ui.mode = 'edit';
      assert.equal(previewClicks(), tab === 'element-motion' ? 'animate' : 'arrange');
    }
  }
});

test('setMode: browse or edit only, and the preview is told what its clicks did before', async () => {
  const { ui, setMode, hooks } = await loadUi();
  const calls = [];
  hooks.clicks = (before) => calls.push([before, ui.mode]);
  ui.pageTab = 'element-motion';
  setMode('edit');
  setMode('edit'); // no change: no call
  setMode('arrange'); // not a mode
  setMode('browse');
  assert.deepEqual(calls, [
    ['visitor', 'edit'],
    ['animate', 'browse'],
  ]);
  assert.equal(ui.mode, 'browse');
});

test('main.js: another panel than Pages browses; back in browse nothing stays selected', () => {
  const main = src('main.js');
  assert.match(main, /if \(panel !== 'pages' && ui\.mode !== 'browse'\) \{\s*ui\.mode = 'browse';/);
  assert.match(main, /hooks\.clicks = modeChanged;/);
  assert.match(main, /function toBrowse\(\) \{\s*closePopup\(\);\s*deselect\(\);\s*lockPart\(\);/);
  // an item template opened from a List: edit
  assert.match(main, /setPanel\('pages'\);\s*setMode\('edit'\);\s*pickTarget\(entry\);/);
  // the old flag is gone everywhere
  for (const f of [
    'svelte/ContentPanel.svelte',
    'svelte/PagesList.svelte',
    'svelte/PageHead.svelte',
  ])
    assert.doesNotMatch(src(f), /pagesWin\.open|open: (true|false), folder/, f);
});

test('header: status | Edit / Done (one 80px slot) | Publish; Done saves, then browses', () => {
  const app = src('svelte/App.svelte');
  const head = app.slice(app.indexOf('<header class="ed-head">'), app.indexOf('</header>'));
  assert.match(head, /class="ed-actions"/);
  assert.match(head, /class="ed-pending"/);
  assert.match(head, /data-edit-toggle/);
  assert.match(head, /\{editing \? 'Done' : 'Edit'\}/);
  assert.match(head, /variant="primary"/);
  // Publish: only when something is new (unsaved, saved not published, commits not pushed)
  assert.match(
    head,
    /disabled=\{ui\.publishing \|\| \(!unpublished\.length && !ahead && !live\.changes\)\}/,
  );
  assert.ok(head.indexOf('data-edit-toggle') < head.indexOf('variant="primary"'));
  assert.match(app, /\[data-edit-toggle\]\) \{\s*min-width: 80px;/);
  assert.match(
    app,
    /async function done\(\) \{\s*if \(await actions\.save\(\)\) setMode\('browse'\);/,
  );
  assert.match(
    app,
    /function edit\(\) \{\s*if \(ui\.panel !== 'pages'\) actions\.setPanel\('pages'\);\s*setMode\('edit'\);/,
  );
  // the old Save and Preview buttons are gone (Ctrl+S still saves, Ctrl+E still previews)
  assert.doesNotMatch(app, />\s*\{ui\.saving \? 'Saving…'/);
  assert.doesNotMatch(app, /icon="play"/);
  assert.match(app, /mod && k === 's'/);
});

test('footer: Desktop | Mobile (32px icon cells), Sources, Media; undo / redo only in edit, last', () => {
  const app = src('svelte/App.svelte');
  const foot = app.slice(app.indexOf('<footer class="ed-foot">'), app.indexOf('</footer>'));
  assert.match(app, /\['desktop', 'Desktop', 'desktop'\]/);
  assert.match(app, /\['phone', 'Mobile', 'mobile-screen-button'\]/);
  assert.match(foot, /class="seg ed-vp" role="radiogroup"/);
  assert.match(foot, /aria-checked=\{ui\.viewport === value\}/);
  const order = [
    'ed-vp',
    'label="Sources"',
    'label="Media"',
    'ed-foot__gap',
    '{#if editing}',
    'icon="rotate-left"',
    'icon="rotate-right"',
  ];
  const at = order.map((s) => foot.indexOf(s));
  assert.ok(
    at.every((n, i) => n > 0 && (i === 0 || n > at[i - 1])),
    at.join(' '),
  );
  assert.match(
    app,
    /\.ed-vp \.seg__btn \{[^}]*width: var\(--size-control\);[^}]*height: var\(--size-control\);/,
  );
  // the update pill moved here with the tools; its card floats above the footer
  assert.match(foot, /<UpdateNotice \/>/);
  assert.match(src('svelte/UpdateNotice.svelte'), /bottom: calc\(100% \+ var\(--space-1\)\);/);
});

test('pages list: no edit pens (their 24px slot kept), the page in the preview is the active row (A2)', () => {
  const list = src('svelte/PagesList.svelte');
  assert.doesNotMatch(list, /pen-to-square/);
  assert.match(list, /isActive\(r\) && 'is-active'/);
  assert.match(list, /sel === r\.id && 'is-sel'/);
  assert.match(
    list,
    /&\.is-active \{\s*background: color-mix\(\s*in srgb,\s*var\(--c-page-accent\) 9%,\s*color-mix\(in srgb, var\(--c-text\) 14%, var\(--c-page-card\)\)\s*\);/,
  );
  // browse: a click only selects and shows; a double click / Enter opens (edit)
  assert.match(list, /function open\(row\) \{\s*show\(row\);\s*setMode\('edit'\);/);
  assert.match(
    list,
    /function pick\(row\) \{\s*sel = row\.id;\s*if \(!row\.part \|\| row\.itemTemplate\) show\(row\);/,
  );
});

test('entryShows: the page entry the preview shows (a page, an item page, a template)', () => {
  assert.equal(entryShows({ kind: 'page', path: '/about/' }, '/about/'), true);
  assert.equal(entryShows({ kind: 'page', path: '/about/' }, '/'), false);
  const people = {
    kind: 'page',
    template: 'people/[person]',
    path: '/people/[person]',
    items: [{ path: '/people/noor/' }],
  };
  assert.equal(entryShows(people, '/people/noor/'), true);
  assert.equal(entryShows(people, '/people/'), false);
  assert.equal(
    entryShows({ kind: 'item-template', path: '/__template/t-x/' }, '/__template/t-x/'),
    true,
  );
  assert.equal(entryShows({ kind: 'part', id: 'header', path: '---' }, '---'), false);
  assert.equal(entryShows(undefined, '/'), false);
});

test('persist: the URL keeps browse (&pages=) or edit (tab=pages without it); other tabs browse', () => {
  const p = src('svelte/persist.js');
  assert.match(p, /state\.mode = 'browse';\s*state\.pagesWin = \{ folder:/);
  assert.match(p, /else if \(q\.get\('tab'\) === 'pages' \|\| state\.part\) state\.mode = 'edit';/);
  assert.match(p, /if \(state\.panel && state\.panel !== 'pages'\) state\.mode = 'browse';/);
  assert.match(p, /ui\.panel === 'pages' &&\s*ui\.mode === 'browse' &&/);
  assert.match(p, /mode: ui\.mode,/);
});
