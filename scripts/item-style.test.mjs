// List step 9: item style (a template's "style", src/site/widgets/list/item-style.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as sass from 'sass';
import { loadContent } from './content.mjs';
import { checkContent } from '../src/site/validate.js';
import { cloneTemplate } from '../src/site/widgets/list/presets.js';
import {
  PRESET_STYLES,
  STYLE_KEYS,
  presetStyle,
  styleMarkup,
  styleProblems,
} from '../src/site/widgets/list/item-style.js';
import { STYLE_ROWS } from '../src/editor/lib/item-style-rows.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const T = 'templates/t-ab12.json';
const tpl = (style) => ({
  version: 1,
  kind: 'template',
  label: 'People card',
  basedOn: 'preset:card',
  ...(style === undefined ? {} : { style }),
  widgets: [
    { type: 'text', role: 'title', body: [{ style: 'heading', text: [{ property: 'title' }] }] },
  ],
});
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the keys and their values: sizes on the 4px grid, Fill / Fit, Border as a ring', () => {
  assert.deepEqual(Object.keys(STYLE_KEYS), [
    'photoRatio',
    'photoFit',
    'photoPlacement',
    'radius',
    'border',
    'shadow',
    'padding',
    'spacing',
    'background',
    'hoverBackground',
    'textOverPhoto',
    'hoverEffect',
    'titleSize',
    'textBody',
    'align',
  ]);
  assert.deepEqual(STYLE_KEYS.titleSize, ['s', 'm', 'l']);
  assert.deepEqual(STYLE_KEYS.photoPlacement, ['above', 'beside']);
  assert.deepEqual(STYLE_KEYS.textBody, ['lines', 'prose']);
  for (const k of ['radius', 'padding', 'spacing'])
    assert.ok(
      STYLE_KEYS[k].every((n) => n % 4 === 0),
      k,
    );
  assert.deepEqual(STYLE_KEYS.photoFit, ['fill', 'fit']);
  assert.deepEqual(STYLE_KEYS.border, ['none', 'line', 'strong', 'bottom']);
  assert.deepEqual(STYLE_KEYS.textOverPhoto, ['none', 'bottom']);
});

test('the validator: a valid style passes, a wrong key or value is named, "theme" is never a value', () => {
  assert.deepEqual(checkContent(T, tpl({ radius: 8, border: 'line', photoFit: 'fit' })), []);
  assert.deepEqual(checkContent(T, tpl({})), []);
  const msg = (s) => checkContent(T, tpl(s)).join('; ');
  assert.match(msg({ radius: 6 }), /style\.radius must be one of 0, 4, 8, 12, 16, 24/);
  assert.match(msg({ ring: 'line' }), /style\.ring is not an item style key/);
  assert.match(msg({ gap: 8 }), /style\.gap is not an item style key/);
  assert.match(msg({ photoFit: 'cover' }), /style\.photoFit must be one of "fill", "fit"/);
  assert.match(msg({ border: 'theme' }), /style\.border must be one of/);
  assert.match(msg('big'), /"style" must be an object/);
  assert.deepEqual(styleProblems(undefined), []);
});

test('markup: overrides as --item-* on the item, the rest as li--<style> classes', () => {
  const m = styleMarkup({
    photoRatio: '3/2',
    photoFit: 'fit',
    radius: 8,
    border: 'bottom',
    shadow: 'm',
    padding: 16,
    spacing: 4,
    background: 'surface',
    hoverBackground: 'surface-2',
    textOverPhoto: 'bottom',
    hoverEffect: 'lift',
    align: 'center',
  });
  assert.equal(
    m.vars,
    '--item-photo-ratio:3 / 2;--item-photo-fit:contain;--item-radius:8px;--item-border:inset 0 -1px 0 var(--line);--item-shadow:var(--item-shadow-m);--item-pad:16px;--item-gap:4px;--item-bg:var(--bg-2);--item-bg-hover:var(--solid-card)',
  );
  assert.deepEqual(m.cls, [
    'li--border-bottom',
    'li--over-bottom',
    'li--hover-lift',
    'li--align-center',
  ]);
  // nothing set: the theme's (no vars, no classes); a broken value is dropped
  assert.deepEqual(styleMarkup(undefined), { cls: [], vars: '' });
  assert.deepEqual(styleMarkup({ radius: 7, foo: 1 }), { cls: [], vars: '' });
  // border is an inset box-shadow, listed with the shadow (no layout shift)
  assert.match(styleMarkup({ border: 'line' }).vars, /--item-border:inset 0 0 0 1px var\(--line\)/);
});

test('presets are style values; Duplicate writes them out; a template copy keeps its own', () => {
  assert.deepEqual(Object.keys(PRESET_STYLES), [
    'preset:card',
    'preset:plain',
    'preset:panel',
    'preset:row',
  ]);
  for (const [id, s] of Object.entries(PRESET_STYLES)) assert.deepEqual(styleProblems(s), [], id);
  assert.equal(PRESET_STYLES['preset:row'].border, 'bottom'); // Row's divider
  // every preset sets its title size, photo placement and text body: nothing beyond style
  for (const s of Object.values(PRESET_STYLES))
    assert.ok(s.titleSize && s.photoPlacement && s.textBody);
  assert.equal(PRESET_STYLES['preset:row'].photoPlacement, 'beside');
  assert.equal(PRESET_STYLES['preset:plain'].textBody, 'prose');
  const m = styleMarkup({ titleSize: 'l', photoPlacement: 'beside', textBody: 'prose' });
  assert.deepEqual(m.cls, ['li--beside', 'li--prose']);
  assert.equal(m.vars, '--li-title-size:clamp(30px, 4.4vw, 76px)');
  // the look data is gone: presets are style values only
  assert.doesNotMatch(read('src/site/widgets/list/presets.js'), /\blook:|shapeOf/);
  assert.equal(PRESET_STYLES['preset:panel'].textOverPhoto, 'bottom');
  const card = cloneTemplate(base, 'people', 'preset:card');
  assert.deepEqual(card.style, presetStyle('preset:card'));
  assert.deepEqual(checkContent(T, card), []);
  const again = cloneTemplate(
    { ...base, templates: { 't-ab12': tpl({ radius: 8 }) } },
    '',
    't-ab12',
  );
  assert.deepEqual(again.style, { radius: 8 });
});

test('no preset-only CSS: the List stylesheet names no preset', () => {
  const scss = read('src/site/widgets/list/style.scss');
  assert.doesNotMatch(scss, /\.li--(card|plain|panel|row)\b/);
  assert.doesNotMatch(scss, /^\s*border:/m); // borders are inset box-shadow rings
  const css = sass.compileString(scss.replace(/@use[^;]+;/, '$bp-md: 900px; $bp-sm: 760px;')).css;
  assert.match(css, /box-shadow: var\(--item-border\), var\(--item-shadow\)/);
});

test('the Style tab: Theme first and never saved, the agreed labels, Space between items', () => {
  const labels = Object.fromEntries(STYLE_ROWS.map((r) => [r.key, r.label]));
  assert.equal(labels.border, 'Border');
  assert.equal(labels.spacing, 'Space between widgets');
  assert.equal(labels.textOverPhoto, 'Text over photo');
  assert.equal(labels.hoverEffect, 'Hover effect');
  assert.equal(labels.titleSize, 'Title size');
  assert.equal(labels.photoPlacement, 'Photo placement');
  assert.equal(labels.textBody, 'Text body');
  const fit = STYLE_ROWS.find((r) => r.key === 'photoFit');
  assert.deepEqual(fit.options, [
    ['', 'Theme'],
    ['fill', 'Fill'],
    ['fit', 'Fit'],
  ]);
  for (const r of STYLE_ROWS) {
    assert.deepEqual(r.options[0], ['', 'Theme'], r.key);
    assert.equal(r.parse(''), undefined, r.key);
  }
  assert.equal(STYLE_ROWS.find((r) => r.key === 'radius').parse('8'), 8);
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  assert.match(panel, /\['style', 'Style'\]/);
  assert.match(panel, /if \(v === undefined\) delete next\[key\]/);
  assert.equal(WIDGET_TYPES.list.config.find((c) => c.key === 'gap').label, 'Space between items');
});
