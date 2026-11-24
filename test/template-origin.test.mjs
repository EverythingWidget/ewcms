// Edit template's way back: the origin stack (push, pop, at most two), the page head's path back
// and the "Used in N lists" count (src/editor/lib/template-origin.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_ORIGINS,
  backLabelOf,
  listUses,
  originCrumbs,
  popOrigin,
  pushOrigin,
  usesLabel,
} from '../src/editor/lib/template-origin.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const people = {
  target: { kind: 'page', path: '/photography/people/', title: 'People' },
  title: 'People',
  widget: 'w-list',
  widgetTab: 'content',
  panelY: 120,
  popupY: 40,
  path: '/photography/people/',
};
const album = {
  target: { kind: 'item-template', id: 't-acrp', title: 'Album card (portrait)' },
  title: 'Album card (portrait)',
  widget: 'w-inner',
  path: '/__template/t-acrp/',
};

test('push and pop: one level, then nested, popped one level at a time', () => {
  let stack = pushOrigin([], people);
  assert.deepEqual(stack, [people]);
  stack = pushOrigin(stack, album);
  assert.deepEqual(stack, [people, album]);
  let out = popOrigin(stack);
  assert.equal(out.origin, album);
  assert.deepEqual(out.stack, [people]);
  out = popOrigin(out.stack);
  assert.equal(out.origin, people);
  assert.deepEqual(out.stack, []);
  // empty: nothing to go back to (Back goes to the pages list, as before)
  assert.deepEqual(popOrigin([]), { origin: null, stack: [] });
  assert.deepEqual(popOrigin(undefined), { origin: null, stack: [] });
});

test('push: a new array, at most two deep (the nested-list rule), no origin pushes nothing', () => {
  const before = [people];
  const after = pushOrigin(before, album);
  assert.notEqual(after, before);
  assert.deepEqual(before, [people]);
  assert.equal(MAX_ORIGINS, 2);
  const third = { ...album, title: 'Third' };
  assert.deepEqual(pushOrigin([people, album], third), [album, third]);
  assert.deepEqual(pushOrigin([people], null), [people]);
});

test('the path back: the origins only (never the template open), a template by its name now', () => {
  assert.deepEqual(
    originCrumbs([people]).map((c) => c.label),
    ['People'],
  );
  const names = { 't-acrp': 'Album card' };
  assert.deepEqual(
    originCrumbs([people, album], (id) => names[id]).map((c) => c.label),
    ['People', 'Album card'],
  );
  assert.deepEqual(originCrumbs([]), []);
  assert.equal(backLabelOf([people]), 'Back to People');
  assert.equal(backLabelOf([people, album]), 'Back to Album card (portrait)');
  // opened from Templates: back there
  assert.equal(backLabelOf([]), 'Back to templates');
});

test('Used in N lists: Lists on pages, the header, the footer and in templates; not other widgets', () => {
  const list = (template) => ({ type: 'list', config: { template } });
  const files = {
    'pages/index.json': { sections: [{ widgets: [list('t-acrp'), list('preset:card')] }] },
    'pages/photography/people/index.json': { sections: [{ widgets: [list('t-acrp')] }] },
    'footer.json': { sections: [{ widgets: [list('t-acrp')] }] },
    'header.json': { sections: [] },
    'templates/t-prow.json': {
      sections: [
        { widgets: [list('t-acrp'), { type: 'details', config: { template: 't-acrp' } }] },
      ],
    },
    'templates/t-acrp.json': { sections: [{ widgets: [{ type: 'text' }] }] },
    // not a document: a source never counts
    'sources/people.json': { items: [{ type: 'list', config: { template: 't-acrp' } }] },
  };
  assert.equal(listUses(files, 't-acrp'), 4);
  assert.equal(listUses(files, 't-none'), 0);
  assert.equal(listUses(files, ''), 0);
  assert.equal(usesLabel(0), 'Used in 0 lists');
  assert.equal(usesLabel(1), 'Used in 1 list');
  assert.equal(usesLabel(3), 'Used in 3 lists');
});

test('wired: Edit template pushes, Back pops, going elsewhere clears; the head shows both', () => {
  const main = read('src/editor/main.js');
  assert.match(main, /ui\.openTemplate = \(id, \{ back = false \} = \{\}\)/);
  assert.match(main, /back \? pushOrigin\(ui\.originStack, originHere\(\)\) : \[\]/);
  assert.match(main, /function returnToOrigin\(\)/);
  assert.match(main, /popOrigin\(ui\.originStack\)/);
  // cleared: another target, another panel, browse, a page that isn't a template's
  assert.match(
    main,
    /function pickTarget\(item, path\) \{\n {2}if \(!item\) return;\n {2}ui\.originStack = \[\];/,
  );
  assert.match(main, /if \(panel !== 'pages'\) ui\.originStack = \[\];/);
  assert.match(main, /function toBrowse\(\) \{\n {2}ui\.originStack = \[\];/);
  assert.match(main, /else if \(!templateOfPath\(path\)\) ui\.originStack = \[\];/);
  assert.match(read('src/editor/svelte/ui.svelte.js'), /originStack: \[\],/);
  const head = read('src/editor/svelte/PageHead.svelte');
  assert.match(head, /actions\.returnToOrigin\?\.\(\)\) \|\| list\(\)/);
  assert.match(
    head,
    /<BackHead \{backLabel\} backTitle=\{backLabel\} \{title\} \{uses\} onback=\{back\}>/,
  );
  assert.match(head, /aria-label="Where you came from"/);
  assert.match(head, /usesLabel\(listUses\(files, t\.id\)\)/);
  const bh = read('src/editor/svelte/BackHead.svelte');
  assert.match(bh, /<span class="bh__uses">\{uses\}<\/span>/);
  assert.match(bh, /\.bh__row \{[^}]*height: 20px;/);
});


test('a List inside a template gets Edit template; Back returns to that template', async () => {
  const { widgetType } = await import('../src/widgets/index.js');
  const field = (type, key) =>
    (widgetType(type).inTemplate?.fields || []).find((f) => f.key === key);
  assert.equal(field('list', 'config/template').editTemplate, true);
  assert.equal(field('details', 'config/template').editTemplate, true);
  const twf = read('src/editor/svelte/TemplateWidgetFields.svelte');
  assert.match(twf, /f\.editTemplate/);
  assert.match(twf, /<TemplateActions/);
  assert.match(twf, /withFile="template"/);
  const actions = read('src/editor/svelte/TemplateActions.svelte');
  assert.match(actions, /ui\.openTemplate\?\.\(templateId, \{ back: true \}\)/);
  // Back pops onto the template it was opened from, not Templates or the page above it
  const main = read('src/editor/main.js');
  assert.match(main, /target\.kind === 'item-template'/);
  assert.match(
    main,
    /ui\.pages\.find\(\s*\(i\) => i\.kind === 'item-template' && i\.id === target\.id\s*\)/,
  );
  assert.match(
    main,
    /t\.kind === 'item-template' \? store\.current\[templateFile\(t\.id\)\]\?\.name \|\| t\.title/,
  );
  // the subtitle is only the parent path (never the template open)
  assert.deepEqual(
    originCrumbs([people, album], (id) => ({ 't-acrp': 'Album card' })[id]).map((c) => c.label),
    ['People', 'Album card'],
  );
  assert.equal(backLabelOf([people, album]), 'Back to Album card (portrait)');
  assert.notEqual(backLabelOf([people, album]), 'Back to templates');
  assert.notEqual(backLabelOf([people, album]), 'Back to People');
});

test('the Columns control above the preview: no pill around the segment', () => {
  const cols = read('src/editor/svelte/TemplateCols.svelte');
  const block = cols.match(/\.ed-cols \{[^}]*\}/)[0];
  assert.doesNotMatch(block, /border-radius|background|box-shadow/);
  assert.match(block, /height: var\(--size-control\);/);
  assert.match(block, /padding: 0 var\(--space-3\);/);
});
