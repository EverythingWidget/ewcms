// What a widget type declares instead of the editor or the renderer checking its name: a page's
// title (pageTitle), its list items' stored defaults (itemDefaults) and value checks (a
// setting's check), its Content-tab hint, its rows in an item template (inTemplate), its Add
// widget drawing, the Template editor's add rules (noNesting, onePerTemplate, clearsClickable)
// and the Layout tab's option defaults and writes (writeConfig). The places that used to check
// a built-in's name don't again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const { BUILTIN_WIDGETS, TEMPLATE_WIDGETS, widgetType } = await import('../src/widgets/index.js');
const { pageTitle } = await import('../src/render/routes.js');
const { storedDefaults, omitDefaults } = await import('../src/render/defaults.js');
const { checkContent } = await import('../src/render/validate.js');

// code without its comments (JS and Svelte markup)
const code = (src) =>
  src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const NAMES = [...BUILTIN_WIDGETS, ...TEMPLATE_WIDGETS].map((t) => t.type);
// a widget's type compared with a name, or a list of names its type is looked up in
const nameCheck = new RegExp(
  `(===|!==)\\s*'(${NAMES.join('|')})'|'(${NAMES.join('|')})'\\s*(===|!==)|\\[\\s*'(${NAMES.join('|')})'\\s*,[^\\]]*\\]\\s*\\.includes`,
);

test('the places that checked a widget name ask its declaration instead', () => {
  assert.deepEqual(NAMES, ['text', 'photo', 'button', 'form', 'hero', 'list', 'details']);
  // no widget name compared at all
  for (const f of [
    'src/editor/svelte/WidgetInspector.svelte',
    'src/editor/svelte/WidgetsModal.svelte',
    'src/render/routes.js',
    'src/render/defaults.js',
    'src/editor/layout-ops.js',
    'src/editor/svelte/TemplatePanel.svelte',
    'src/editor/svelte/WidgetLayout.svelte',
  ])
    assert.doesNotMatch(code(read(f)), nameCheck, f);
  // the Template editor's rows, the Hero photos' phone check in validate.js
  const twf = code(read('src/editor/svelte/TemplateWidgetFields.svelte'));
  assert.doesNotMatch(twf, nameCheck, 'TemplateWidgetFields.svelte');
  assert.match(twf, /widgetType\(w\.type\)\?\.inTemplate\?\.missing/);
  assert.match(twf, /widgetType\(w\.type\)\?\.inTemplate\?\.join/);
  assert.match(twf, /inTemplate\?\.fields/);
  const validate = code(read('src/render/validate.js'));
  assert.doesNotMatch(validate, /'hero'/);
  assert.doesNotMatch(validate, /\.phone`/);
  assert.doesNotMatch(code(read('src/render/defaults.js')), /hero/i);
});

test("a page's title: its first widget whose type gives one (a Text's first title line)", () => {
  const title = (text) => ({ id: 'w-aaaa', type: 'text', body: [{ style: 'title', text }] });
  assert.equal(typeof widgetType('text').pageTitle, 'function');
  const page = (...widgets) => ({ sections: [{ id: 's-aaaa', widgets }] });
  assert.equal(pageTitle(page(title([{ t: 'About' }]))), 'About');
  assert.equal(
    pageTitle(page({ id: 'w-bbbb', type: 'hero', title: 'X' }, title([{ t: 'Second' }]))),
    'Second',
  );
  // a Text without a title line: the next one's
  const plain = { id: 'w-cccc', type: 'text', body: [{ style: 'paragraph', text: [{ t: 'p' }] }] };
  assert.equal(pageTitle(page(plain, title([{ t: 'Next' }]))), 'Next');
  assert.equal(pageTitle(page(plain)), undefined);
});

test("the Hero's photos: stored defaults and the phone check, declared on the setting", () => {
  const photos = widgetType('hero').settings.find((f) => f.key === 'photos');
  assert.deepEqual(photos.itemDefaults, { name: 'photo', values: { layer: 'back' } });
  assert.equal(typeof photos.check, 'function');
  const data = (ps) => ({
    version: 1,
    kind: 'page',
    id: 'pg-aaaa',
    sections: [{ id: 's-aaaa', widgets: [{ id: 'w-aaaa', type: 'hero', title: 'x', photos: ps }] }],
  });
  const F = 'pages/index.json';
  assert.deepEqual(storedDefaults(F, data([{ src: 'a.jpg', layer: 'back' }])), [
    'section 1, widget 1 photo 1: "layer" is the default ("back"): leave it out',
  ]);
  assert.deepEqual(
    omitDefaults(F, data([{ src: 'a.jpg', layer: 'back' }])).sections[0].widgets[0].photos,
    [{ src: 'a.jpg' }],
  );
  const problems = checkContent(
    F,
    data([
      { src: 'a.jpg', phone: { x: '1' } },
      { src: 'b', phone: 5 },
    ]),
  );
  assert.ok(
    problems.includes('section 1, widget 1 (Hero): "photos.0.phone.x" must be a number'),
    problems.join('\n'),
  );
  assert.ok(
    problems.includes(
      'section 1, widget 1 (Hero): "photos.1.phone" must be null (hidden on phones) or { x?, y?, w? }',
    ),
  );
});

test('the editor: a hint, the item-template rows and a drawing, each declared', () => {
  assert.match(widgetType('text').hint, /^Type the text in the preview/);
  for (const t of NAMES.filter((n) => n !== 'text')) assert.equal(widgetType(t).hint, undefined, t);
  const offers = Object.fromEntries(
    NAMES.map((n) => {
      const it = widgetType(n).inTemplate;
      return [
        n,
        it
          ? {
              missing: !!it.missing,
              join: !!it.join,
              fields: (it.fields || []).map((f) => (f.type === 'match' ? 'match' : f.key)),
            }
          : null,
      ];
    }),
  );
  assert.deepEqual(offers, {
    text: { missing: true, join: true, fields: [] },
    photo: { missing: true, join: false, fields: ['src'] },
    button: { missing: true, join: false, fields: ['label', 'itemLink', 'config/link'] },
    form: null,
    hero: null,
    list: {
      missing: false,
      join: false,
      fields: ['source/mode', 'source/property', 'source/from', 'match', 'config/template'],
    },
    details: {
      missing: false,
      join: false,
      fields: [
        'config/template',
        'config/several',
        'config/icon',
        'config/screenReaderName',
        'config/open',
      ],
    },
  });
  // the same labels and stored values as the rows they replaced
  const field = (type, key) =>
    widgetType(type).inTemplate.fields.find((f) =>
      key === 'match' ? f.type === 'match' : f.key === key,
    );
  assert.equal(field('photo', 'src').label, 'Photo');
  assert.equal(field('button', 'itemLink').value({ itemLink: true }), true);
  assert.equal(field('button', 'itemLink').write(false), undefined);
  assert.deepEqual(field('button', 'config/link').write('url'), [{ t: 'url' }]);
  assert.equal(field('button', 'config/link').write(''), undefined);
  assert.equal(field('list', 'source/mode').value({ source: { mode: 'item' } }), 'all');
  assert.equal(field('list', 'source/mode').replace, 'source');
  assert.equal(field('list', 'match').between, 'is this item’s');
  assert.equal(field('details', 'config/open').value({ config: { open: 'first' } }), true);
  assert.equal(field('details', 'config/open').write(false), undefined);
  assert.equal(field('details', 'config/open').write(true), 'first');
  assert.deepEqual(field('details', 'config/screenReaderName').write('title'), [
    { property: 'title' },
  ]);
  // every built-in has a drawing for its sketch
  for (const t of NAMES) {
    const d = widgetType(t).drawing;
    assert.ok(Array.isArray(d) && d.length, t);
    for (const s of d) assert.ok(typeof s === 'string' || Number.isInteger(s.grid), t);
  }
  assert.match(
    read('src/editor/svelte/WidgetsModal.svelte'),
    /widgetType\(name\)\?\.drawing \?\? PLAIN/,
  );
});

test('the widget format documents the keys', () => {
  const doc = read('src/widgets/index.js').split('*/')[0];
  for (const key of [
    'pageTitle(widget)',
    'itemDefaults:',
    'check(value):',
    'hint ',
    'inTemplate ',
    'drawing ',
    'noNesting ',
    'onePerTemplate ',
    'clearsClickable ',
    'writeConfig(',
  ])
    assert.ok(doc.includes(key), key);
});

test('the template editor and Layout tab ask the type, not its name', async () => {
  assert.equal(widgetType('list').noNesting, true);
  assert.equal(widgetType('details').noNesting, true);
  assert.equal(widgetType('details').onePerTemplate, true);
  assert.equal(widgetType('details').clearsClickable, true);
  for (const t of NAMES.filter((n) => n !== 'list' && n !== 'details')) {
    assert.equal(widgetType(t).noNesting, undefined, t);
    assert.equal(widgetType(t).onePerTemplate, undefined, t);
    assert.equal(widgetType(t).clearsClickable, undefined, t);
  }
  assert.equal(widgetType('list').onePerTemplate, undefined);
  assert.equal(widgetType('list').clearsClickable, undefined);
  const panel = code(read('src/editor/svelte/TemplatePanel.svelte'));
  assert.match(panel, /clearsClickable/);
  assert.match(panel, /noNesting/);
  assert.match(panel, /onePerTemplate/);
  const { CAROUSEL, withArrangement } = await import('../src/widgets/list/carousel.js');
  const cfg = (key) => widgetType('list').config.find((c) => c.key === key);
  for (const key of Object.keys(CAROUSEL)) assert.equal(cfg(key).default, CAROUSEL[key][0], key);
  assert.equal(cfg('arrangement').writeConfig, withArrangement);
  const wl = code(read('src/editor/svelte/WidgetLayout.svelte'));
  assert.match(wl, /c\.writeConfig/);
  assert.doesNotMatch(wl, /CAROUSEL|withArrangement/);
});
