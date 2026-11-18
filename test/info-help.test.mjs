// InfoHelp (i) beside settings: Source, section Height / Width, Curtain, and the v0.8 audit's
// tips (grid, Size, links, Desktop / Phone, Template, Role, When a value is missing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('InfoHelp: 16px circle, 11px icon, the surface roles, a 232px note of its own surface', () => {
  const s = src('InfoHelp.svelte');
  assert.match(s, /width: 16px;\s*height: 16px;/);
  assert.match(s, /font-size: var\(--fs-sm\)/); // 11px
  assert.match(s, /color: var\(--text-quiet\);/);
  assert.match(s, /color: var\(--text-strong\);\s*background: var\(--field-hover\);/);
  assert.doesNotMatch(s, /ih-bg|\bbg\b =/, 'no bg prop');
  assert.match(s, /width: 232px/);
  assert.match(s, /font: 400 var\(--fs-base\) \/ 18px var\(--f-mono\)/);
  assert.match(s, /border-radius: 8px/);
  assert.match(s, /popover="manual"/);
  assert.match(s, /e\.key !== 'Escape'/);
  assert.match(s, /'pointerdown', away/);
  assert.match(s, /const up = /, 'flips above near the bottom');
});

test("the help note: a slate-blue surface, a 1px ring (also on the arrow), the pop-ups' shadow", () => {
  const t = readFileSync(new URL('../src/editor/styles/_tokens.scss', import.meta.url), 'utf8');
  assert.match(t, /--c-help-note: #16202e;/);
  assert.match(t, /--c-help-note-ring: #26324a;/);
  assert.match(t, /--c-text: var\(--sand-50\);/);
  assert.match(t, /--sand-50: #f2efe9;/);
  const s = src('InfoHelp.svelte');
  assert.match(s, /@include surface\(var\(--c-help-note\)\);/);
  assert.match(s, /box-shadow:\s*0 0 0 1px var\(--c-help-note-ring\),\s*var\(--shadow-pop\);/);
  assert.match(s, /box-shadow: -1px -1px 0 0 var\(--c-help-note-ring\);/);
  assert.match(s, /box-shadow: 1px 1px 0 0 var\(--c-help-note-ring\);/);
  assert.match(s, /:global\(b\) \{\s*color: var\(--text-strong\);/);
  assert.doesNotMatch(s, /border: 1px|border: solid/);
});

test('placed on Source, Height / Width and the Curtain', () => {
  const ws = src('WidgetSource.svelte');
  assert.match(ws, /<InfoHelp label="About Source"/);
  // a single-item widget's options: From URL, Item, None (All and Custom are the List's)
  assert.match(ws, /<b>Item<\/b>: one entry you pick/);
  assert.doesNotMatch(ws, /<b>All<\/b>|<b>Custom<\/b>/);
  // Layer's (v0.1.50): gone, its buttons' tooltips say it; the link line has one
  assert.doesNotMatch(src('WidgetLayout.svelte'), /label="About Layer"/);
  const ss = src('SectionSettings.svelte');
  assert.match(ss, /<InfoHelp label="About \{title\}"/);
  assert.match(ss, /<b>Width<\/b>/);
  assert.match(
    src('EntrancePageCurtain.svelte'),
    /<b>Curtain<\/b>: a panel that covers the screen/,
  );
});

test('the audit tips: each in an existing row, with its label', () => {
  const lead = src('ListLead.svelte');
  assert.match(lead, /<InfoHelp label="About Source"[\s\S]*<b>All<\/b>[\s\S]*<b>Custom<\/b>/);
  assert.match(lead, /\{#snippet tip\(\)\}A <b>List<\/b> shows one copy of its template/);
  assert.match(lead, /<b>Template<\/b>: how each item looks/);
  assert.match(
    src('WidgetToolbar.svelte'),
    /<InfoHelp label="About the grid"[\s\S]*120 columns wide on Desktop, 60 on Phone/,
  );
  assert.match(src('WidgetToolbar.svelte'), /<InfoHelp label="About Size"/);
  assert.match(
    src('WidgetLayout.svelte'),
    /Free \(not linked\)\{\/if\}<InfoHelp\s+label="About links"/,
  );
  assert.match(src('App.svelte'), /<InfoHelp label="About Desktop and Phone"/);
  assert.match(src('TemplateWidgetFields.svelte'), /<b>Role<\/b>: this widget's name/);
  assert.match(src('TemplateWidgetFields.svelte'), /<b>Inherit<\/b>/);
  assert.match(src('GroupFields.svelte'), /\{#snippet tip\(\)\}<b>When a value is missing<\/b>/);
  // Field: the tip in its label row, after the label
  assert.match(
    src('Field.svelte'),
    /\{#if tip\}<InfoHelp\s+label="About \{label\}">\{@render tip\(\)\}/,
  );
});

test('G19: the grid tip says Shift+Arrow pushes the linked widgets below', () => {
  const tb = src('WidgetToolbar.svelte');
  assert.match(tb, /<b>Shift\+Arrow<\/b> also pushes the linked widgets below/);
});
