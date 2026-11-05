import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WIDGET_TABS,
  WIDGET_TAB_KEY,
  autoPatch,
  boxLabels,
  layoutParts,
  scaleHint,
  scalePatch,
  sizePatch,
  widgetTabOf,
} from '../src/editor/widget-layout.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { placementOf } from '../src/site/layout/place.js';
import { hasFitWidth, hasScaleToFit } from '../src/site/layout/type.js';

test('the widget pop-up: Content | Layout, the last tab kept once for every widget', () => {
  assert.deepEqual(
    WIDGET_TABS.map(([t]) => t),
    ['content', 'layout'],
  );
  assert.equal(widgetTabOf({}), 'content');
  assert.equal(widgetTabOf(undefined), 'content');
  assert.equal(widgetTabOf({ [WIDGET_TAB_KEY]: 'layout' }), 'layout');
  assert.equal(widgetTabOf({ [WIDGET_TAB_KEY]: 'motion' }), 'content'); // unknown
  // kept in ui.sections (editor:ui, as the page tabs), not per widget
  const wi = readFileSync('src/editor/svelte/WidgetInspector.svelte', 'utf8');
  assert.match(wi, /widgetTabOf\(ui\.sections\)/);
  assert.match(wi, /ui\.sections\[WIDGET_TAB_KEY\] = v/);
  // both tabs in one cell: the taller one's height
  assert.match(wi, /grid-area: 1 \/ 1/);
});

test('each type: what its Layout tab shows (its definition)', () => {
  const want = {
    text: ['missing', 'size', 'layer', 'link', 'placement', 'scale'],
    button: ['missing', 'size', 'layer', 'link', 'box', 'placement'],
    photo: ['missing', 'size', 'layer', 'link', 'box', 'placement'],
    hero: ['missing', 'size', 'layer', 'link'],
    album: ['missing', 'size', 'layer', 'link'],
    albums: ['missing', 'size', 'layer', 'link'],
    grid: ['missing', 'size', 'layer', 'link'],
    panels: ['missing', 'size', 'layer', 'link'],
    projects: ['missing', 'size', 'layer', 'link'],
    form: ['missing', 'size', 'layer', 'link'],
    list: ['options', 'missing', 'size', 'layer', 'link'],
  };
  assert.deepEqual(Object.keys(WIDGET_TYPES).sort(), Object.keys(want).sort());
  for (const [type, parts] of Object.entries(want))
    assert.deepEqual(layoutParts(type), parts, type);
  // read from the definition, not the type's name
  assert.deepEqual(layoutParts({ type: 'mine', scaleToFit: true, size: false }), [
    'missing',
    'layer',
    'link',
    'scale',
  ]);
  assert.equal(hasFitWidth({ fitWidth: true }), true);
  assert.equal(hasFitWidth('text'), true);
  assert.equal(hasFitWidth('button'), false);
  assert.equal(hasScaleToFit('photo'), false);
});

test('Content box labels; one patch for each home of a setting', () => {
  assert.deepEqual(
    boxLabels(placementOf('photo')).map(([v, l]) => [v, l]),
    [
      ['fit', 'Contain'],
      ['fill', 'Cover'],
    ],
  );
  assert.deepEqual(
    boxLabels(placementOf('button')).map(([v, l]) => [v, l]),
    [
      ['fit', 'Fit'],
      ['fill', 'Fill'],
    ],
  );
  assert.deepEqual(autoPatch(true, 9), sizePatch('auto', { rows: 9 }));
  assert.deepEqual(autoPatch(false, 9), { size: 'rows', aspect: undefined, rows: 9 });
  assert.deepEqual(scalePatch(true), { scale: true });
  assert.deepEqual(scalePatch(false), { scale: undefined });
  assert.doesNotMatch(scaleHint(true) + scaleHint(false), /photo/);
  // the toolbar's shortcuts write through the same functions
  const tb = readFileSync('src/editor/svelte/WidgetToolbar.svelte', 'utf8');
  assert.match(tb, /autoPatch\(!auto, rows\)/);
  assert.match(tb, /scalePatch\(!isScaled\)/);
  assert.doesNotMatch(tb, /widget\?\.type === 'text'/);
});
