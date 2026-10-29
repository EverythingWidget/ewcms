// The shared popover (Popover.svelte): portalled, fixed, centred 4px under its trigger, 8px inside
// the popup; Aspect's ratios and the Position picker (Position.svelte) use it
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const pov = read('src/editor/svelte/Popover.svelte');
const pos = read('src/editor/svelte/Position.svelte');
const wl = read('src/editor/svelte/WidgetLayout.svelte');
const field = read('src/editor/svelte/Field.svelte');
const tokens = read('src/editor/styles/_tokens.scss');

test('popover: portalled, fixed, centred and clamped, its look', () => {
  assert.match(pov, /document\.body\.appendChild\(node\)/);
  assert.match(pov, /position: fixed/);
  assert.match(pov, /const GAP = 4;/);
  assert.match(pov, /const EDGE = 8;/);
  assert.match(pov, /a\.left \+ a\.width \/ 2 - w \/ 2/);
  assert.match(pov, /width = 190/);
  assert.match(pov, /width === 'anchor'/);
  assert.match(pov, /@include surface\(var\(--c-surface\), \$quiet: 38%\)/);
  assert.match(pov, /background: var\(--surface\)/);
  assert.match(pov, /0 0 0 1px var\(--c-popover-ring\)/);
  assert.match(pov, /0 12px 32px var\(--c-popover-shadow\)/);
  assert.match(pov, /padding: var\(--space-2\)/);
  assert.match(pov, /border-radius: var\(--radius-md\)/);
  assert.match(pov, /'Escape'/);
  assert.match(pov, /addEventListener\('scroll', follow, true\)/);
  assert.match(tokens, /--c-popover-ring: #262626;/);
  // its controls' fills and quiet text: the surface's roles (7%, 35%), no own overrides
  assert.doesNotMatch(tokens, /--c-popover-(fill|dim)/);
  assert.doesNotMatch(pov, /:global\(\.seg|:global\(input/);
  assert.doesNotMatch(pov + pos, /accent|cyan|green/);
});

test('aspect ratios in the popover, three a row', () => {
  assert.match(wl, /<Popover/);
  assert.match(wl, /Ratio \(width:height\)/);
  assert.match(wl, /repeat\(3, 1fr\)/);
  assert.doesNotMatch(wl, /position: absolute/);
});

test('position picker: a button and a popover grid, axes; a spot field uses it', () => {
  assert.match(pos, /axes = 'both'/);
  assert.match(pos, /axes === 'v' \? 1 : 3/);
  assert.match(pos, /axes === 'h' \? 1 : 3/);
  assert.match(pos, /<Popover/);
  assert.match(pos, /open = false;/);
  assert.match(field, /<Position /);
  assert.doesNotMatch(field, /class="spot"/);
});

test('surfaces: one mixin derives the role colours, solid, from --surface', () => {
  const mix = read('src/editor/styles/_mixins.scss');
  const s = mix.match(/@mixin surface\([\s\S]*?\n\}/)[0];
  for (const [role, n] of [
    ['field-bg', 7],
    ['field-tile', 12],
    ['field-hover', 23],
    ['focus-line', 60],
  ])
    assert.match(
      s,
      new RegExp(`--${role}: color-mix\\(in srgb, var\\(--white\\) ${n}%, var\\(--surface\\)\\);`),
    );
  assert.match(
    s,
    /--text-quiet: color-mix\(in srgb, var\(--white\) #\{\$quiet\}, var\(--surface\)\);/,
  );
  assert.match(s, /\$quiet: 35%/);
  assert.match(read('src/editor/svelte/Popover.svelte'), /\$quiet: 38%/);
  assert.match(s, /--focus-ring: inset 0 0 0 1px var\(--focus-line\);/);
  for (const f of ['WidgetPopup', 'SectionPopup', 'Popover'])
    assert.match(read(`src/editor/svelte/${f}.svelte`), /@include surface\(/, f);
  // the per-pop-up colour overrides and their tokens are gone
  assert.doesNotMatch(tokens, /--on-card-|--c-pop-|--c-sec-pop-|--c-popover-(fill|dim)/);
  const src = ['WidgetPopup', 'SectionPopup', 'Popover', 'Position', 'UpdateNotice']
    .map((f) => read(`src/editor/svelte/${f}.svelte`))
    .join('\n');
  assert.doesNotMatch(src, /on-card-|c-pop-|c-sec-pop-|c-popover-(fill|dim)|c-focus-ring/);
});

test('focus: one whitish 1px inset ring, no accent glow; the label whitish while typing', () => {
  assert.match(tokens, /--focus-line: color-mix\(in srgb, var\(--white\) 60%, var\(--c-bg\)\);/);
  assert.match(tokens, /--focus-ring: inset 0 0 0 1px var\(--focus-line\);/);
  const mix = read('src/editor/styles/_mixins.scss');
  assert.match(mix, /@mixin focus-ring \{\s*outline: none;\s*box-shadow: var\(--focus-ring\);/);
  const ed = read('src/editor/styles/editor.scss');
  assert.match(
    ed,
    /\.tf:focus-within > \.tf__label \{\s*color: var\(--text-strong, var\(--c-text\)\);/,
  );
  assert.doesNotMatch(ed, /0 0 0 4px color-mix\(in srgb, var\(--c-accent\)/);
});
