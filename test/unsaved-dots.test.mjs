// The editor's markers: the yellow dot means unsaved (every field, after its label); a value of
// its own (not the default) is the reset arrow, never a dot; neither moves anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const svelte = (n) => read(`src/editor/svelte/${n}.svelte`);
const scss = read('src/editor/styles/editor.scss');

test('the dot is unsaved: yellow (the top bar\'s), the prop and class named unsaved', () => {
  assert.match(read('src/editor/styles/_mixins.scss'), /@mixin unsaved-dot \{[^}]*background: var\(--c-warning\);/);
  assert.match(svelte('App'), /\.ed-pending__dot \{\s*background: var\(--c-warning\)/);
  for (const n of ['Field', 'Collapsible', 'LinkField', 'SourceField', 'ExplorerRow', 'SectionCard'])
    assert.match(svelte(n), /^\s+unsaved = (false|undefined),$/m, n);
  const dir = new URL('../src/editor/svelte/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svelte'))) {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /\bchanged=\{|is-changed|changed-dot/, f);
  }
  assert.doesNotMatch(scss, /is-changed|--size-changed/);
});

test('a field\'s dot: after its label and (i), its room always kept, the row\'s end items after it', () => {
  assert.match(scss, /\.tf__label::after,[^{]*\{\s*@include unsaved-dot;\s*content: '';\s*order: 1;\s*visibility: hidden;/);
  assert.match(scss, /\.tf__label > \*,\s*\.pane__head > \* \{\s*order: 2;/);
  assert.match(scss, /\.tf__label > :is\(\.ih, \.tf__name, [^)]*\)[^{]*\{\s*order: 0;/);
  assert.match(scss, /\.tf\.is-unsaved > \.tf__label::after,[^{]*\{\s*visibility: visible;/);
  // a card's: after its title, kept too
  const col = svelte('Collapsible');
  assert.match(col, /<span class="collapsible__title">\{title\}<\/span>/);
  assert.match(col, /\.collapsible__title::after \{[^}]*visibility: hidden;/);
  assert.match(col, /\.collapsible\.is-unsaved > \.collapsible__bar \.collapsible__title::after \{\s*visibility: visible;/);
});

test('a value of its own is the reset arrow: Motion\'s elements and Theme › Color\'s cards get one, no dot', () => {
  const motion = svelte('MotionElements');
  // an unsaved change to an element's own values: the yellow dot after its id, its room kept
  assert.match(motion, /base && live\.changed\(file, layerPtr\(null, \{ id \}, 'element', base\)\) && 'is-unsaved'/);
  assert.match(motion, /\.elist__id::after \{\s*@include unsaved-dot;[^}]*visibility: hidden;/);
  assert.match(motion, /&\.is-unsaved \.elist__id::after \{\s*visibility: visible;/);
  assert.match(motion, /\{#if base && elementOf\(el, id\)\}\s*<button\s+type="button"\s+class="elist__reset"/);
  assert.match(motion, /live\.store\.remove\(file, layerPtr\(null, \{ id \}, 'element', base\)/);
  // its slot at the row's end is always kept
  assert.match(motion, /&\.has-reset \{\s*padding-right: calc\(var\(--space-3\) \+ 16px \+ var\(--space-2\)\);/);
  const color = svelte('ColorPart');
  assert.match(color, /\.ctheme__reset \{[^}]*width: 16px;/);
  assert.match(color, /live\.store\.set\(THEME, `\/colorThemes\/\$\{name\}`, undefined/);
});

test('small fixes: palette slots are full rows, section cards have no second line, the backdrop card says On/Off', () => {
  const color = svelte('ColorPart');
  const palette = color.slice(color.indexOf('key="theme-color:palette"'), color.indexOf('</Collapsible>', color.indexOf('key="theme-color:palette"')));
  assert.doesNotMatch(palette, /\bhalf\b/);
  assert.doesNotMatch(color, /\.fields > \.hexf/);
  // the widgets' motion is in the section cards (no second card per section)
  assert.doesNotMatch(svelte('SectionsList'), /title="Section \{s\.at \+ 1\}"/);
  const backdrop = svelte('ScrollBackdropCard');
  assert.match(backdrop, /name=\{backdrop\}/);
  assert.match(backdrop, /'On' : 'Off'/);
});
