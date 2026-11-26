// The page's Sections tab holds its motion too (the Element motion tab merged into it): one tree
// of section cards and widget rows, each row with its animation and Replay, the selected widget's
// motion in its own card (the slim panel: WidgetMotion.svelte), its animated elements under it,
// the ones outside the widgets after Add section. The info button's popover has a tip (an opt-in
// of the shared Popover.svelte; the others stay as they were).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('Popover: the tip is opt-in; the 190px popovers stay as they were', () => {
  const pop = src('Popover.svelte');
  assert.match(pop, /width = 190,\s*min = 190,/);
  assert.match(pop, /tip = false,/);
  // the tip's classes and its place only with tip
  assert.match(pop, /class=\{\['pov', tip && 'has-tip', tip && pos\.above && 'is-above', cls\]\}/);
  assert.match(pop, /style:--arr=\{tip \? `\$\{pos\.arr\}px` : null\}/);
  // without it: the old 4px gap under the trigger
  assert.match(pop, /const gap = tip \? 1 \+ TIP : GAP;/);
  assert.match(
    pop,
    /const r = tip \? \(anchor\.querySelector\('i'\) \?\? anchor\)\.getBoundingClientRect\(\) : a;/,
  );
  // centred on the trigger, kept off the corners; the body 8px inside the panel
  assert.match(
    pop,
    /const arr = Math\.min\(Math\.max\(a\.left \+ a\.width \/ 2 - left - 3, 6\), w - 12\);/,
  );
  assert.match(pop, /const EDGE = 8;/);
  // one shape with the body: its surface and ring, the seam covered
  assert.match(
    pop,
    /\.pov\.has-tip::before \{[^}]*background: inherit;[^}]*box-shadow: -1px -1px 0 0 var\(--c-popover-ring\);[^}]*transform: rotate\(45deg\);/,
  );
  assert.match(pop, /\.pov\.has-tip::after \{[^}]*background: var\(--surface\);/);
  // the other popovers don't ask for it
  for (const f of ['EasePicker.svelte', 'Select.svelte'])
    if (existsSync(new URL(`../src/editor/svelte/${f}`, import.meta.url)))
      assert.doesNotMatch(src(f), /<Popover[^>]*\btip\b/, f);
});

test("the widget's motion: Animation and its info popover, no From/To, Target or switches", () => {
  const wm = src('WidgetMotion.svelte');
  // the info button: 32px, its room kept, disabled without an animation
  assert.match(
    wm,
    /<span class="anim-props" bind:this=\{propsAt\}>\s*<Button\s+size="small"\s+icon="circle-info"\s+iconOnly/,
  );
  assert.match(wm, /disabled=\{!known\}/);
  assert.match(wm, /\.anim-props \{[^}]*width: 32px;/);
  // its popover: 320px with the tip; the animation's name, then Property / Start / End
  assert.match(
    wm,
    /<Popover\s+open=\{propsOpen && known\}\s+anchor=\{propsAt\}\s+width=\{320\}\s+tip/,
  );
  assert.match(wm, /<span class="props-head">\{m\.animationName\}<\/span>/);
  assert.match(wm, /<th>Property<\/th>\s*<th>Start<\/th>\s*<th>End<\/th>/);
  assert.match(wm, /font-size: var\(--fs-2xs\)/);
  // no edit in the popover: the pen on the Animation label opens the library
  const popBody = wm.slice(wm.indexOf('<Popover'), wm.indexOf('</Popover>'));
  assert.doesNotMatch(popBody, /<Button|onlibrary/);
  assert.match(wm, /icon="pen-to-square"[\s\S]*?onclick=\{\(\) => onlibrary\(m\.animationName\)\}/);
  // gone: From / To, Target, the inherit / Custom switches, the summary under the select, Replay
  assert.doesNotMatch(
    wm,
    /From \(start state\)|To \(end state\)|>Target<|>Custom<|'Custom'|view="inherit"/,
  );
  assert.doesNotMatch(wm, />Replay<|replayOne/);
  assert.doesNotMatch(wm, /summary/);
});

test('timing: its own values and Customize timing; the reset arrow, dimmed inherited values', () => {
  const wm = src('WidgetMotion.svelte');
  // only what the widget sets, the rest behind the link (kept open or closed)
  assert.match(wm, /const timingOpen = \$derived\(!!ui\.sections\['motion:timing'\]\);/);
  assert.match(wm, /return timingOpen \|\| own\(def\);/);
  assert.match(wm, /Customize timing/);
  // each field's own rule (Scroll start, Scrub: On scroll; Scroll end: scrubbing), Stagger with
  // several elements only (or its own value)
  assert.match(wm, /if \(def\.when && !def\.when\(m\.spec\)\) return false;/);
  assert.match(
    wm,
    /if \(def\.path\?\.\[0\] === 'stagger' && !several && !own\(def\)\) return false;/,
  );
  // own: bright with the reset arrow; inherited: dimmed, still editable; the yellow dot: unsaved
  assert.match(wm, /view=\{mine \? 'edit' : 'dim'\}/);
  assert.match(wm, /class=\{\['mf__reset', mine && 'is-on'\]\}/);
  assert.match(wm, /<div class=\{\['mf', unsavedOf\(def\) && 'is-unsaved'\]\}>/);
  assert.doesNotMatch(wm, /cyan|--c-accent-2/);
  const mf = src('MotionField.svelte');
  assert.match(mf, /inert=\{view === 'inherit'\}/);
  assert.match(
    mf,
    /\(view === 'inherit' \|\| view === 'dim'\) && 'is-inherited'|view !== 'edit' && 'is-inherited'/,
  );
  // the Scroll field: after Scroll start and Scrub, only with them; always bright, no reset or dot
  assert.match(
    wm,
    /shown\.some\(\(def\) => \['start', 'scrub'\]\.includes\(def\.path\?\.at\(-1\)\)\)/,
  );
  const scroll = wm.slice(
    wm.indexOf('{#if scrolls}'),
    wm.indexOf('{/if}', wm.indexOf('{#if scrolls}')),
  );
  assert.doesNotMatch(scroll, /mf__reset|is-unsaved|is-inherited/);
  assert.match(scroll, /bridge\.scrubTo\(el, progress \/ 100\)/);
});

test('a widget row: its animation tag, the 16px chevron room, Replay; its motion in its card', () => {
  const row = src('WidgetRow.svelte');
  assert.match(row, /<span class="brow__anim">\{motion\.animation \|\| 'none'\}<\/span>/);
  // the chevron's room on every row, the chevron only with animated elements
  assert.match(row, /<span class="brow__disclosure">\s*\{#if motion\.elements\}/);
  assert.match(row, /\.brow__disclosure \{[^}]*width: 16px;/);
  // Replay: 32px, its room kept, disabled without an animation
  assert.match(row, /disabled=\{!motion\.animation\}\s*onclick=\{motion\.onreplay\}/);
  assert.match(row, /\.brow__play \{[^}]*width: 32px;[^}]*height: 32px;/);
  // the card: its 48px row, then its body (opening and closing animated); the ring goes round
  // the whole card; the element list under it, animated too
  assert.match(
    row,
    /<div class="brow__head">[\s\S]*<\/div>\s*\{#if body\}\s*<div class="brow__body" transition:grow>\{@render body\(\)\}<\/div>\s*\{\/if\}\s*<\/div>\s*\{#if after\}\s*<div class="brow__after" transition:grow>\{@render after\(\)\}<\/div>\s*\{\/if\}/,
  );
  assert.match(row, /\.brow__head \{[^}]*min-height: 48px;/);
  assert.match(row, /&\.is-open \{\s*box-shadow: inset 0 0 0 1px var\(--c-widget-accent\);/);
  // still a drag row (list-drag: [data-row]); the pop-up finds its row (.brow[data-widget-row])
  assert.match(row, /<li\s+class=\{\['witem'[\s\S]*?data-row/);
  assert.match(row, /class=\{\[\s*'brow',[\s\S]*?\]\}\s*data-widget-row=\{widget\?\.id\}/);
  const sc = src('SectionCard.svelte');
  assert.match(sc, /onreplay: \(\) => w\?\.el && motion\.bridge\.replayOne\(w\.el\)/);
  assert.match(sc, /after=\{mo\?\.expanded && mo\.elements \? elements : undefined\}/);
  assert.match(sc, /expanded: !!ui\.sections\[elsKey\(widget\.id\)\]/);
  // the template editor's cards have no motion
  assert.doesNotMatch(src('TemplatePanel.svelte'), /motion=\{/);
});

test('animated elements: under their widget, each with its motion editor; the fixed ones last', () => {
  const me = src('MotionElements.svelte');
  assert.match(me, /onclick=\{\(\) => open\(el\)\}/);
  assert.match(
    me,
    /\{#if ui\.anim && ui\.anim\.el === el\}\s*\{#key ui\.anim\}[\s\S]*<AnimEditor /,
  );
  assert.match(me, /\.elist--nested \{\s*margin: var\(--space-1\) 0 0 40px;/);
  const sl = src('SectionsList.svelte');
  assert.match(
    sl,
    /const outside = \$derived\(items\.filter\(\(it\) => !it\.el\.closest\('\[data-widget\]'\)\)\);/,
  );
  // after Add section
  assert.ok(
    sl.indexOf('Add section') < sl.indexOf('title="Outside the widgets" name="Fixed elements"'),
  );
  // the editor's back button closes it (no preview pick any more)
  const ae = src('AnimEditor.svelte');
  assert.match(ae, /onclick=\{clearAnim\}>Elements<\/Button>/);
  assert.doesNotMatch(ae, /pickElement/);
  assert.equal(
    existsSync(new URL('../src/editor/svelte/MotionPanel.svelte', import.meta.url)),
    false,
  );
  // the element's motion closes outside the Sections tab and in browse
  const main = readFileSync(new URL('../src/editor/main.js', import.meta.url), 'utf8');
  assert.match(main, /if \(clicks !== 'arrange' \|\| ui\.pageTab !== 'sections'\) clearAnim\(\);/);
});

test("a widget card's motion: 4px under its row, 12px at the sides and below", () => {
  assert.match(
    src('WidgetMotion.svelte'),
    /\.wmotion \{[^}]*padding: var\(--space-1\) var\(--space-3\) var\(--space-3\);/,
  );
});

test("opening and closing a widget card and its element list: the Collapsible's speed and ease", async () => {
  const g = src('../lib/grow.js');
  assert.match(g, /export const OPEN = \{ duration: 0\.25, ease: 'power2\.out' \};/);
  assert.match(g, /import \{ cubicOut \} from 'svelte\/easing';/); // power2.out's curve
  assert.match(src('Collapsible.svelte'), /gsap\.fromTo\([\s\S]{0,200}\.\.\.OPEN,/);
  assert.doesNotMatch(src('Collapsible.svelte'), /duration: 0\.25/);
  // only its own height moves (a flow-root body: its margins inside, measured whole)
  assert.match(src('WidgetRow.svelte'), /import \{ grow \} from '\.\.\/lib\/grow\.js';/);
  assert.match(src('WidgetRow.svelte'), /\.brow__body,\s*\.brow__after \{[^}]*display: flow-root;/);
  const realMatch = globalThis.matchMedia;
  try {
    const { grow, OPEN } = await import('../src/editor/lib/grow.js');
    const { cubicOut } = await import('svelte/easing');
    globalThis.matchMedia = () => ({ matches: false });
    const t = grow({ offsetHeight: 120 });
    assert.equal(t.duration, OPEN.duration * 1000);
    assert.equal(t.easing, cubicOut);
    assert.equal(t.css(0.5), 'height: 60px; overflow: hidden;');
    assert.equal(t.css(1), 'height: 120px; overflow: hidden;');
    // reduced motion: no animation
    globalThis.matchMedia = () => ({ matches: true });
    assert.deepEqual(grow({ offsetHeight: 120 }), { duration: 0 });
  } finally {
    globalThis.matchMedia = realMatch;
  }
});

test('the old Element motion click mode is gone: arrange and visitor clicks only', () => {
  const dir = new URL('../src/editor/', import.meta.url);
  const files = readdirSync(dir, { recursive: true }).filter((f) => /\.(js|svelte)$/.test(f));
  for (const f of files) {
    const s = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(s, /__ed-animate|\bpickAnim\b|\bselectAnim\b|MOTION_PICK/, f);
    assert.doesNotMatch(s, /clicks\(\) === 'animate'|=== 'animate'/, f);
  }
  assert.doesNotMatch(src('ui.svelte.js'), /export function choose\(/);
  const kit = readFileSync(new URL('../sandbox/kit/Panel.svelte', import.meta.url), 'utf8');
  assert.doesNotMatch(kit, /\['element-motion'/);
  assert.match(kit, /\['sections', 'Sections'\],\s*\['page-motion', 'Page motion'\],/);
  assert.match(kit, /tab === 'element-motion' \? 'sections' : tab/);
});
