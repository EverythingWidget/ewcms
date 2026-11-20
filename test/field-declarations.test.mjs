// The editor updates a widget in the preview in place only as its fields declare (the widget
// format, src/widgets/index.js: a setting's blank / live.after, a config entry's live); the
// patch code itself names no widget (src/editor/widget-fields.js, layout-sync.js patchTexts,
// preview-runtime.js writeText).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const { BUILTIN_WIDGETS, widgetType } = await import('../src/widgets/index.js');

// code without its comments
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
/** The source from `start` to the end of the body it opens (after its parameters; braces balanced). */
function block(src, start) {
  const at = src.indexOf(start);
  assert.ok(at >= 0, `found: ${start}`);
  let depth = 0;
  for (let i = src.indexOf(') {', at) + 2; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(`unbalanced: ${start}`);
}

// the built-ins whose names aren't also a field's or [data-edit]'s type ('text', 'photo')
const NAMES = BUILTIN_WIDGETS.map((w) => w.type).filter((t) => t !== 'text' && t !== 'photo');

test('the patch code names no widget type (nor its classes or modules)', () => {
  assert.deepEqual(NAMES.sort(), ['button', 'form', 'hero', 'list']);
  const layoutSync = read('src/editor/layout-sync.js');
  const runtime = read('src/editor/preview-runtime.js');
  const parts = {
    'widget-fields.js': read('src/editor/widget-fields.js'),
    'layout-sync.js patch': layoutSync.slice(
      layoutSync.indexOf("// A widget's own keys that aren't texts"),
      layoutSync.indexOf(block(layoutSync, 'export function patchTexts')) +
        block(layoutSync, 'export function patchTexts').length,
    ),
    'preview-runtime.js writeText': block(runtime, 'function writeText('),
  };
  for (const [name, src] of Object.entries(parts)) {
    assert.ok(src.length > 200, name);
    for (const type of NAMES)
      assert.doesNotMatch(code(src), new RegExp(`\\b${type}`, 'i'), `${name}: ${type}`);
  }
  // nor imports a widget's module
  for (const f of ['layout-sync.js', 'preview-runtime.js', 'widget-fields.js'])
    assert.doesNotMatch(read(`src/editor/${f}`), /from '\.\.\/widgets\/(?!index\.js')/, f);
});

test("the built-ins declare what was the editor's list: kept blanks, a CSS variable, a class", () => {
  const setting = (type, key) => widgetType(type).settings.find((f) => f.key === key);
  const config = (type, key) => widgetType(type).config.find((c) => c.key === key);
  for (const key of ['title', 'eyebrow', 'body']) assert.equal(setting('hero', key).blank, 'keep');
  assert.equal(setting('button', 'label').blank, 'keep');
  assert.equal(typeof setting('hero', 'title').live.after, 'function');
  // a Form shows defaults or leaves its texts out when emptied: rendered
  for (const f of widgetType('form').settings) assert.equal(f.blank, undefined, f.key);
  const gap = config('list', 'gap').live;
  assert.deepEqual([gap.on, gap.var], ['.list__items--grid', '--list-gap']);
  assert.equal(gap.value({ gap: 0 }), null);
  assert.equal(gap.value({ gap: 3 }), 3);
  assert.deepEqual(
    { ...config('button', 'textOverflow').live },
    { on: '.buttonwidget', class: 'buttonwidget--wrap', when: 'wrap' },
  );
});

test('the widget format documents the field keys (custom widgets use them)', () => {
  const doc = read('src/widgets/index.js').split('*/')[0];
  assert.match(doc, /blank: 'keep'/);
  assert.match(doc, /live: \{ after\(el, value\) \}/);
  assert.match(doc, /\{ on, var \}/);
  assert.match(doc, /\{ on, class, when \}/);
});
