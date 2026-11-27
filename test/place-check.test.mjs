// One place check for every widget (src/render/validate.js placeProblems): a page's, a
// template's and a details widget's layout, size, aspect, layer, box, place, scale and
// config.enabled are refused alike, so a bad box in a template no longer passes the check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent } from '../src/render/validate.js';
import { template } from '../scripts/grid-helper.mjs';

const at = { layout: { base: { col: 1, span: 60, row: 1 } } };
const text = (more = {}) => ({
  id: 'w-txt1',
  type: 'text',
  body: [{ style: 'paragraph', text: [{ t: 'Hi' }] }],
  ...at,
  ...more,
});
const photo = (more = {}) => ({ id: 'w-pho1', type: 'photo', src: 'a.jpg', ...at, ...more });
const page = (w) => ({
  version: 1,
  kind: 'page',
  id: 'pg-abcd',
  sections: [{ id: 's-abcd', widgets: [w] }],
});
const tpl = (w) => template({ name: 'T', clickable: false, widgets: [w] });
const onPage = (w) => checkContent('pages/index.json', page(w)).map((p) => p.replace(/^.*?: /, ''));
const inTemplate = (w) =>
  checkContent('templates/t-test.json', tpl(w)).map((p) => p.replace(/^.*?: /, ''));

const BAD = [
  [photo({ box: 'stretch' }), '"box" must be fit or fill'],
  [text({ box: 'fill' }), '"box": this widget has no Fit / Fill'],
  [photo({ place: 'nowhere' }), /^"place" must be one of /],
  [photo({ scale: true }), /^"scale" is for text widgets/],
  [text({ scale: 'yes' }), '"scale" must be true (or left out: off)'],
  [text({ size: 'tall' }), /^"size" must be /],
  [text({ size: 'aspect' }), '"aspect" must be a ratio like "4:5"'],
  [text({ layer: 1.5 }), '"layer" must be a whole number'],
  [text({ z: 2 }), '"z" is "layer" now (its Layer)'],
  [text({ config: { enabled: 'no' } }), '"config.enabled" must be true or false'],
];

test('a page widget and a template widget get the same place problems', () => {
  for (const [w, want] of BAD) {
    const page = onPage(w);
    const t = inTemplate(w);
    const has = (list) => list.some((p) => (want instanceof RegExp ? want.test(p) : p === want));
    assert.ok(has(page), `page ${JSON.stringify(w)}: ${page.join(' | ')}`);
    assert.ok(has(t), `template ${JSON.stringify(w)}: ${t.join(' | ')}`);
  }
  // the good ones pass in both
  for (const w of [photo({ box: 'fill', place: 'center' }), text({ scale: true, layer: 2 })]) {
    assert.deepEqual(onPage(w), []);
    assert.deepEqual(inTemplate(w), []);
  }
});

test('the details widget uses the same check', () => {
  const dw = (more) => ({
    id: 'w-dets',
    type: 'details',
    config: { template: 't-pmor' },
    ...at,
    ...more,
  });
  assert.deepEqual(inTemplate(dw({})), []);
  assert.ok(inTemplate(dw({ size: 'aspect' })).includes('"aspect" must be a ratio like "4:5"'));
  assert.ok(inTemplate(dw({ layer: 'top' })).includes('"layer" must be a whole number'));
});

test('one placeProblems, called by the page, template and details paths', () => {
  const v = readFileSync(new URL('../src/render/validate.js', import.meta.url), 'utf8');
  // declared once, called by the three paths
  assert.equal(v.match(/\.\.\.placeProblems\(/g).length, 3);
  assert.equal(v.match(/function placeProblems\(/g).length, 1);
  assert.equal(v.match(/checkPlacement\(/g).length, 1);
  assert.equal(v.match(/checkScale\(/g).length, 1);
  assert.doesNotMatch(v, /\$\{at\}\.size must be|\$\{at\}\.aspect must be|\$\{at\}\.layer must be/);
});
