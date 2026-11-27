// The widget toolbar: its buttons and order, collapsing by the preview width, its menus, drags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const bar = readFileSync(
  new URL('../src/editor/svelte/WidgetToolbar.svelte', import.meta.url),
  'utf8',
);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('one widget selected: the section toolbar has its actions and a gear; rows have none', () => {
  const st = src('svelte/SectionToolbar.svelte');
  for (const s of [
    'location-crosshairs',
    'copy',
    'angles-down',
    'angles-up',
    'trash',
    'onclick={openPopup}',
  ])
    assert.ok(st.includes(s), s);
  const row = src('svelte/WidgetRow.svelte');
  // the row's one button is Replay (its motion, a page's Sections tab): no row actions
  assert.doesNotMatch(row, /onduplicate|ondelete|onshow/);
  assert.equal((row.match(/<Button/g) || []).length, 1);
  assert.match(row, /<Button\s+size="small"\s+icon="play"\s+iconOnly\s+label="Replay"/);
});

test('one widget: toolbar order add, gear, locate, eye, copy, trash; layers only for several', () => {
  const st = src('svelte/SectionToolbar.svelte');
  const body = st.slice(st.indexOf('{#if group}'), st.indexOf('{:else if addOnly}'));
  const icons = [...body.matchAll(/icon=(?:"([a-z-]+)"|\{allOff \? 'eye-slash' : '(eye)'\})/g)].map(
    (m) => m[2] || m[1],
  );
  assert.deepEqual(icons, [
    'plus',
    'gear',
    'location-crosshairs',
    'eye',
    'copy',
    'angles-down',
    'angles-up',
    'trash',
  ]);
  assert.match(body, /\{#if !one\}\s*<Button\s+size="small"\s+icon="angles-down"/);
});

test('one section: its name in its own casing, then + gear ↑ ↓ trash ⋯ (the + where a widget has it)', () => {
  const st = src('svelte/SectionToolbar.svelte');
  const body = st.slice(
    st.indexOf('{:else if s}'),
    st.indexOf('{:else}', st.indexOf('{:else if s}')),
  );
  const icons = [...body.matchAll(/icon="([a-z-]+)"/g)].map((m) => m[1]);
  // six buttons, + first: as one widget's six (plus, gear, locate, eye, copy, trash), so the +
  // sits in the same place when the selection switches
  assert.deepEqual(icons, ['plus', 'gear', 'arrow-up', 'arrow-down', 'trash', 'ellipsis']);
  assert.match(
    body,
    /^\{:else if s\}\s*<p class="stb__name" \{title\}>\{title\}<\/p>\s*<span class="stb__gap"><\/span>/,
  );
  assert.match(
    body,
    /<Button\s+size="small"\s+icon="plus"\s+iconOnly\s+label="Add widget to \{title\}"\s+title="Add widget to this section"\s+aria-haspopup="dialog"\s+disabled=\{!on\}\s+onclick=\{\(\) => onadd\(at\)\}/,
  );
  // no + Add widget text button there (a template's addOnly keeps its own)
  assert.doesNotMatch(body, /stb__add|>Add widget/);
  // its display name: the typed name, else "Section N"
  assert.match(
    st,
    /const title = \$derived\(\(s && typeof s\.name === 'string' && s\.name\.trim\(\)\) \|\| `Section \$\{at \+ 1\}`\);/,
  );
  // .stb__name keeps its casing; .stb__count (a widget's PHOTO) stays uppercase
  const css = (cls) => st.slice(st.indexOf(`.${cls} {`), st.indexOf('}', st.indexOf(`.${cls} {`)));
  assert.doesNotMatch(css('stb__name'), /text-transform/);
  assert.match(css('stb__name'), /color: var\(--c-widget-accent\);/);
  assert.match(css('stb__count'), /text-transform: uppercase;/);
});

test("a section card's title in its own casing; its bar's size, colour and tracking stay", () => {
  const card = src('svelte/SectionCard.svelte');
  assert.match(
    card,
    /:global\(\.collapsible\[data-section\^='s-'\] > \.collapsible__bar\) \{\s*text-transform: none;\s*\}/,
  );
  const col = src('svelte/Collapsible.svelte');
  const bar = col.slice(
    col.indexOf('.collapsible__bar {'),
    col.indexOf('> :global(*)', col.indexOf('.collapsible__bar {')),
  );
  for (const d of [
    'font-size: var(--fs-base);',
    'letter-spacing: 0.1em;',
    'color: var(--c-text-dim);',
    'text-transform: uppercase;',
  ])
    assert.ok(bar.includes(d), d); // other cards (Motion, SEO …) keep their uppercase titles
});

test('the marks go into … by the frame width only', () => {
  const s = src('svelte/WidgetToolbar.svelte');
  assert.match(s, /const room = box\.frameRight - box\.frameLeft - 16;/);
  assert.doesNotMatch(s, /Math\.max\(box\.w, 280\)/);
});

test('every widget gets the toolbar: divider (text only), Auto, its size', () => {
  const s = src('svelte/WidgetToolbar.svelte');
  assert.match(s, /const shown = \$derived\(!!\(where && widget && pos\)\)/);
  assert.match(s, /\{#if hasText\}<span class="btb__div"/);
  assert.match(s, /fa-solid fa-up-down/);
  assert.match(s, /class="btb__size"/);
  assert.match(s, /width: 16ch;/);
});

test('the toolbar stays mounted while a widget is dragged', () => {
  assert.match(bar, /const shown = \$derived\(!!\(where && widget && pos\)\);/);
  assert.match(bar, /if \(drag !== dragging\) dragging = drag;/);
});

test('while resizing the bar is see-through for the pointer', () => {
  assert.match(bar, /dragging && 'is-dragging'/);
  assert.match(bar, /&\.is-dragging \{\s*pointer-events: none;\s*\}/);
});

test("a press on a widget's body hides the toolbar in place; a resize keeps it", () => {
  assert.match(bar, /getAttribute\('data-flow-hold'\)/);
  assert.match(bar, /hold === 'move'/);
  assert.match(bar, /if \(move !== moving\) moving = move;/);
  assert.match(bar, /moving && 'is-moving'/);
  assert.match(bar, /&\.is-moving \{\s*visibility: hidden;\s*pointer-events: none;\s*\}/);
  assert.doesNotMatch(bar, /&\.is-moving \{[^}]*display:\s*none/);
});

test('a pick in the Style dropdown closes it (G4)', () => {
  const fn = bar.slice(bar.indexOf('function pickStyle'), bar.indexOf('\n  // the lines selected'));
  assert.match(fn, /open = null/);
  // same-widget edits still do not close menus: only a new widget id does
  assert.match(bar, /const whereId = \$derived\(where\?\.id\)/);
});

test('the text toolbar menu: out of the flow, over the bar when there is no room under it', () => {
  const bar = read('src/editor/svelte/WidgetToolbar.svelte');
  assert.match(bar, /popUp = need > below && above > below/);
  assert.match(bar, /Math\.min\(stage\.bottom, innerHeight\)/);
  assert.match(bar, /\.btb__pop \{[^}]*position: absolute;/);
});

test('the widget pop-up: a 1px white ring at 50% in front of a deep drop shadow (its own token)', () => {
  const tokens = readFileSync(
    new URL('../src/editor/styles/_tokens.scss', import.meta.url),
    'utf8',
  );
  const pop = readFileSync(
    new URL('../src/editor/svelte/WidgetPopup.svelte', import.meta.url),
    'utf8',
  );
  const sec = readFileSync(
    new URL('../src/editor/svelte/SectionPopup.svelte', import.meta.url),
    'utf8',
  );
  assert.match(
    tokens.replace(/\s+/g, ' '),
    /--shadow-pop-widget: 0 0 0 1px var\(--white-a50\), 0 2px 4px var\(--black-a50\), 0 16px 40px var\(--black-a65\), 0 40px 96px var\(--black-a80\);/,
  );
  assert.match(tokens, /--white-a50: rgb\(255 255 255 \/ 0\.5\);/);
  assert.match(pop, /\.wpop \{[^}]*box-shadow: var\(--shadow-pop-widget\);/);
  // only the widget pop-up: the section pop-up keeps the shared pop shadow
  assert.match(sec, /box-shadow: var\(--shadow-pop\);/);
});
