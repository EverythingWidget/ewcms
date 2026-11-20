// Typing never renders (layout-sync.js patchTexts, preview-runtime.js patchText): what a typed
// value is patched into the preview as is what the dev server renders for it. Each case renders
// a page (renderOp) with the value before, patches the edit in, and compares it with the page
// rendered with the value after. What the patch can't show the same way still renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { compileModule } from '${import.meta.resolve('svelte/compiler')}';
    export async function load(url, context, next) {
      if (url.endsWith('?raw')) {
        const text = await readFile(fileURLToPath(url.slice(0, -4)), 'utf8');
        return { format: 'module', source: 'export default ' + JSON.stringify(text), shortCircuit: true };
      }
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);
const { parseHTML } = await import('linkedom');
globalThis.window ??= globalThis;
globalThis.CSS ??= { escape: (s) => String(s) };
const { renderOp } = await import('../src/editor/server/editor-server.mjs');
const render = await import('../src/render/render.js');
const { markRendered, patchTexts, syncLayout } = await import('../src/editor/layout-sync.js');
const { createStore } = await import('../src/editor/store.js');
const { createBridge } = await import('../src/editor/preview-runtime.js');
const { SITE_A } = await import('./fixtures/index.mjs');

const F = 'pages/index.json';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const base = JSON.parse(read('test/fixtures/site-a/content/en/pages/index.json'));

const widgets = () => [
  { id: 'w-hero', type: 'hero', title: 'Noor', eyebrow: 'Photographer', body: 'One\nTwo' },
  { id: 'w-bttn', type: 'button', label: 'Go', config: { link: { href: '/about/' } } },
  {
    id: 'w-form',
    type: 'form',
    title: 'Write',
    body: 'Hi',
    submit: 'Send it',
    fields: [{ name: 'email', label: 'Email', type: 'email' }],
  },
  { id: 'w-list', type: 'list', source: { mode: 'all', from: 'people' }, config: { gap: 2 } },
];
const page = (w = widgets()) => ({ ...base, sections: [{ id: 's-tst1', widgets: w }] });

/** The section rendered from `data` as the dev server sends it. */
function rendered(data) {
  const r = renderOp(render, SITE_A, {}, { path: '/', file: F, data, ids: ['s-tst1'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.html['s-tst1'];
}

/** A preview of the page as rendered, its store, and set(ptr, value): the edit's patch result. */
function preview() {
  const { document } = parseHTML(
    `<main data-router-view data-page-file="${F}">${rendered(page())}</main>`,
  );
  const view = document.querySelector('main');
  const store = createStore();
  store.load({ [F]: page() });
  // the editor's bridge reads the store (a setting's inPlace.after: widget-fields.js settingAt)
  const bridge = createBridge({ store, labelFor: () => '' });
  markRendered(document, store, view);
  let edits = null;
  store.on((e) => (edits = e.edits));
  let layouts = 0;
  const set = (ptr, v) => {
    store.set(F, `/sections/0/widgets/${ptr}`, v, { source: 'panel', key: `text:${ptr}` });
    return patchTexts(view, store, edits, bridge.patchText, { layout: () => layouts++ });
  };
  const stale = () => [...syncLayout(document, store, { structure: true, root: view })];
  return { document, view, store, set, stale, layouts: () => layouts };
}
const widgetHtml = (html, id) =>
  parseHTML(`<main>${html}</main>`).document.querySelector(`[data-widget="${id}"]`).outerHTML;
// (a style written by the DOM: "--x:1", by the render: "--x: 1")
const norm = (h) =>
  h
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .replace(/(--[\w-]+): /g, '$1:')
    .trim();

/** Typed `steps` into widget j's `key`: each patched, the widget as the render writes it. */
function typing(j, key, steps) {
  const p = preview();
  for (const v of steps) {
    assert.equal(p.set(`${j}/${key}`, v), true, `${key} = ${JSON.stringify(v)}: patched`);
    assert.deepEqual(p.stale(), [], 'nothing left to render');
    const id = p.store.current[F].sections[0].widgets[j].id;
    assert.equal(
      norm(p.view.querySelector(`[data-widget="${id}"]`).outerHTML),
      norm(widgetHtml(rendered(p.store.current[F]), id)),
      `${key} = ${JSON.stringify(v)}: as rendered`,
    );
  }
  return p;
}

test("the hero's name (words) is patched: its words and its longest word (--hero-word)", () => {
  typing(0, 'title', ['Noor V', 'Noor Visser', 'Noor Visserman-de Jong', 'N']);
});

test('an emptied text is patched where the widget keeps its element (hero, button)', () => {
  typing(0, 'eyebrow', ['Photo', '', 'P', 'Photos']);
  typing(0, 'body', ['One', '', 'A\nB']);
  typing(0, 'title', ['', 'Eve']);
  typing(1, 'label', ['', 'G', 'Go on']);
});

test('a List gap typed is patched (--list-gap, left out at 0), the rows flowed again', () => {
  const p = typing(3, 'config/gap', [3, 0, 1]);
  assert.equal(p.layouts(), 3);
});

test("a Button's Text Wrap/Clip is patched (its declared class, buttonwidget--wrap)", () => {
  // Clip is its default, left out of the file (undefined)
  const p = typing(1, 'config/textOverflow', ['wrap', undefined, 'wrap', 'clip']);
  assert.equal(p.layouts(), 4);
});

test("what the render shows differently when emptied still renders: a Form's texts", () => {
  for (const key of ['title', 'body', 'submit', 'fields/0/label']) {
    const p = preview();
    // typed: patched (the element is there)
    assert.equal(p.set(`2/${key}`, 'Typed'), true, key);
    // emptied: a Form leaves it out or shows a default (its field's name, "Send")
    assert.equal(p.set(`2/${key}`, ''), false, `${key} emptied`);
    assert.deepEqual(p.stale(), ['s-tst1']);
  }
  // and the render does differ from the element emptied
  const html = rendered(
    page(widgets().map((w) => (w.type === 'form' ? { ...w, title: '', submit: '' } : w))),
  );
  assert.doesNotMatch(html, /formwidget__title/);
  assert.match(widgetHtml(html, 'w-form'), /cform__text[^>]*>[^<]+</);
});

test('typing in main.js: the patch first (a CSS variable: the rows again), no full text scan', () => {
  const main = read('src/editor/main.js');
  assert.match(main, /patchTexts\(root, store, edits, bridge\.patchText, \{ layout: relayout \}\)/);
  assert.match(
    main,
    /function relayout\(\) \{\s*bridge\.api\?\.reflow\?\.\(\);\s*bridge\.api\?\.refresh\?\.\(\);/,
  );
  assert.match(main, /if \(patched\) bridge\.applyCurtain\(\);\s*else\s*bridge\.applyTexts\(/);
});

test('a patched edit: syncSections is skipped (no section key compared, nothing rendered)', () => {
  const main = read('src/editor/main.js');
  assert.match(
    main,
    /\{ layout: relayout \}\)\);\s*(\/\/[^\n]*\n\s*)*if \(!patched\)\s*for \(const root of roots\)\s*if \(files\.includes\(root\.dataset\.pageFile\)\)\s*(\/\/[^\n]*\n\s*)*syncSections\(\{ structure: !typed \}, root\);/,
  );
  // what the skipped syncSections would have found: nothing stale (the patch marked it rendered)
  const p = preview();
  assert.equal(p.set('0/title', 'Eve Noor'), true);
  assert.deepEqual(p.stale(), []);
});
