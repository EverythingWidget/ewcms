// Content-box placement (src/site/layout/place.js): a widget's content box Fit | Fill and its
// place in the widget; Text: one column, no Fit | Fill; Photo: object-fit / object-position.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { widgetClass, widgetVars } from '../src/site/layout/index.js';
import {
  alignOf,
  checkPlacement,
  fillOf,
  placeOfBox,
  placementOf,
  placesOf,
} from '../src/site/layout/place.js';

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
  assert.equal(placementOf('grid'), null);
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
  assert.equal(checkPlacement(w('grid', { place: 'center' })).length, 1);
});

test('stylesheet and the editor form', () => {
  const scss = readFileSync('src/client/styles/_layout.scss', 'utf8');
  assert.match(scss, /\.wgt--placed \{[^}]*place-items: var\(--pv, start\) var\(--ph, start\)/);
  assert.match(scss, /\.wgt--placed\.wgt--fill \{[^}]*place-items: stretch/);
  assert.match(scss, /\.wgt--place-v \{[^}]*justify-items: stretch/);
  const form = readFileSync('src/editor/svelte/WidgetLayout.svelte', 'utf8');
  assert.match(form, /\{#if placement\.box\}/);
  assert.match(form, /<Position/);
  assert.match(form, /axes=\{placement\.axes\}/);
  assert.match(form, /disabled=\{fill && !placement\.media\}/);
  assert.match(form, /\['fill', 'Fill'\]/);
});
