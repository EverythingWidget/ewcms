// Content-box placement (src/render/layout/place.js): a widget's content box Fit | Fill and its
// place in the widget; Text: one column, no Fit | Fill; Photo: object-fit / object-position.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { widgetClass, widgetVars } from '../src/render/layout/index.js';
import {
  alignOf,
  checkPlacement,
  fillOf,
  placeOfBox,
  placementOf,
  placesOf,
} from '../src/render/layout/place.js';

const w = (type, extra = {}) => ({
  id: 'w-1',
  type,
  layout: { base: { col: 1, span: 10, row: 1 } },
  ...extra,
});

test('placement per type: button 3 x 3 with Fit | Fill, text one column, photo media', () => {
  assert.deepEqual(placementOf('button'), {
    axes: 'both',
    box: true,
    fill: false,
    place: 'left top',
    media: false,
  });
  const t = placementOf('text');
  assert.equal(t.axes, 'v');
  assert.equal(t.box, false);
  assert.deepEqual(
    placesOf(t).map(([v]) => v),
    ['top', 'center', 'bottom'],
  );
  assert.equal(placementOf('photo').media, true);
  assert.equal(placementOf('list'), null);
});

test('defaults render as before: no class, no variables', () => {
  for (const type of ['button', 'text', 'photo']) {
    assert.doesNotMatch(widgetClass(w(type)), /placed|fill/);
    assert.doesNotMatch(widgetVars(w(type)), /--ph|--pv|--fit|--pos/);
  }
});

test('button: Fit placed by --ph / --pv, Fill stretched', () => {
  const fit = w('button', { place: 'right bottom' });
  assert.match(widgetClass(fit), / wgt--placed$/);
  assert.match(widgetVars(fit), /;--ph:end;--pv:end;/);
  const fill = w('button', { box: 'fill' });
  assert.equal(fillOf(fill), true);
  assert.match(widgetClass(fill), / wgt--placed wgt--fill$/);
  assert.match(widgetVars(w('button', { place: 'center' })), /;--ph:center;--pv:center;/);
});

test('text: vertical only, never Fill', () => {
  const t = w('text', { place: 'bottom' });
  assert.match(widgetClass(t), / wgt--placed wgt--place-v$/);
  assert.match(widgetVars(t), /;--pv:end;/);
  assert.doesNotMatch(widgetVars(t), /--ph/);
  assert.equal(fillOf(w('text', { box: 'fill' })), false);
  assert.equal(placeOfBox(w('text', { place: 'left top' })), 'top');
});

test('photo: Fill cover, Fit contain, the place its object-position', () => {
  assert.match(
    widgetVars(w('photo', { box: 'fit', place: 'left top' })),
    /;--fit:contain;--pos:left top/,
  );
  assert.match(
    widgetVars(w('photo', { place: 'right center' })),
    /;--fit:cover;--pos:right center/,
  );
  assert.doesNotMatch(widgetClass(w('photo', { box: 'fit' })), /placed/);
});

test('align and checks', () => {
  assert.deepEqual(alignOf('left bottom'), { h: 'start', v: 'end' });
  assert.deepEqual(alignOf('center'), { h: 'center', v: 'center' });
  assert.deepEqual(checkPlacement(w('button', { box: 'fill', place: 'center' })), []);
  assert.equal(checkPlacement(w('button', { box: 'hug' })).length, 1);
  assert.equal(checkPlacement(w('text', { box: 'fill' })).length, 1);
  assert.equal(checkPlacement(w('text', { place: 'left top' })).length, 1);
  assert.equal(checkPlacement(w('list', { place: 'center' })).length, 1);
});

test('stylesheet and the editor form', () => {
  const scss = readFileSync('src/client/styles/_layout.scss', 'utf8');
  assert.match(scss, /\.wgt--placed \{[^}]*place-items: var\(--pv, start\) var\(--ph, start\)/);
  assert.match(scss, /\.wgt--placed\.wgt--fill \{[^}]*place-items: stretch/);
  assert.match(scss, /\.wgt--place-v \{[^}]*justify-items: stretch/);
  const form = readFileSync('src/editor/svelte/WidgetLayout.svelte', 'utf8');
  assert.match(form, /\{:else if part === 'box'\}/);
  assert.match(form, /<Position/);
  assert.match(form, /axes=\{placement\.axes\}/);
  assert.match(form, /disabled=\{fill && !placement\.media\}/);
  assert.match(form, /boxLabels\(placement\)/);
});

test('a button can be smaller than its label: the pill clips, nowrap kept', () => {
  const scss = readFileSync('src/client/styles/_layout.scss', 'utf8');
  const i = scss.indexOf('.buttonwidget {');
  assert.ok(i >= 0, '.buttonwidget rule');
  const block = scss.slice(i, scss.indexOf('.wgt--fill > .buttonwidget', i));
  for (const bit of [
    'min-width: 0',
    'min-height: 0',
    'max-width: 100%',
    'max-height: 100%',
    'overflow: hidden',
  ])
    assert.ok(block.includes(bit), bit);
  const glass = readFileSync('src/client/styles/_glass.scss', 'utf8');
  const btn = glass.slice(glass.indexOf('\n.btn {'), glass.indexOf('\n  &:hover'));
  assert.match(btn, /white-space: nowrap/);
  assert.doesNotMatch(btn, /text-overflow:/);
});

test('Button Text: Wrap | Clip in the Layout tab; Wrap a class, Clip (unset) as before', async () => {
  const { button } = await import('../src/widgets/button/index.js');
  const { layoutOptions } = await import('../src/editor/widget-layout.js');
  const { checkContent } = await import('../src/render/validate.js');
  const opt = button.config.find((c) => c.key === 'textOverflow');
  assert.deepEqual(
    { label: opt.label, type: opt.type, tab: opt.tab, default: opt.default, options: opt.options },
    {
      label: 'Text',
      type: 'seg',
      tab: 'layout',
      default: 'clip',
      options: [
        ['wrap', 'Wrap'],
        ['clip', 'Clip'],
      ],
    },
  );
  assert.deepEqual(
    layoutOptions('button').map((c) => c.key),
    ['textOverflow'],
  );
  const ctx = { routes: [], sources: {} };
  const html = (config) => button.render({ label: 'Go', config }, ctx, { ed: () => '' });
  assert.match(html({ textOverflow: 'wrap' }), /class="buttonwidget buttonwidget--wrap"/);
  for (const config of [{}, { textOverflow: 'clip' }])
    assert.match(html(config), /class="buttonwidget"/);
  // only its two values pass the content check
  const { newWidget, newSection } = await import('../src/render/layout/index.js');
  const ids = new Set();
  const w = newWidget('button', ids);
  const page = (v) => ({
    version: 1,
    kind: 'page',
    id: 'pg-bt01',
    sections: [newSection(ids, [{ ...w, config: { ...w.config, textOverflow: v } }])],
  });
  for (const v of ['wrap', 'clip'])
    assert.deepEqual(checkContent('pages/x/index.json', page(v)), []);
  assert.match(
    checkContent('pages/x/index.json', page('ellipsis')).join('; '),
    /config\.textOverflow.*one of wrap, clip/,
  );
  const scss = readFileSync('src/client/styles/_layout.scss', 'utf8');
  const wrap = scss.slice(scss.indexOf('.buttonwidget--wrap > .btn {'));
  assert.match(wrap, /^\.buttonwidget--wrap > \.btn \{\s*white-space: normal;/);
});
