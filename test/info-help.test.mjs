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
  assert.match(s, /@include surface\(var\(--c-help-note\)\);/);
  assert.doesNotMatch(s, /ih-bg|\bbg\b =/, 'no bg prop');
  assert.match(s, /width: 232px/);
  assert.match(s, /font: 400 var\(--fs-base\) \/ 18px var\(--f-mono\)/);
  assert.match(s, /border-radius: 8px/);
  assert.match(s, /popover="manual"/);
  assert.match(s, /e\.key !== 'Escape'/);
  assert.match(s, /'pointerdown', away/);
  assert.match(s, /const up = /, 'flips above near the bottom');
});

test('placed on Source, Height / Width and the Curtain', () => {
  const ws = src('WidgetSource.svelte');
  assert.match(ws, /<InfoHelp label="About Source"/);
  // a single-item widget's options: From URL, Item, None (All and Custom are the List's)
  assert.match(ws, /<b>Item<\/b>: one item you pick/);
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

test('names: Auto height in both places, Edit text on the widget, Pages > Templates', () => {
  assert.match(src('WidgetLayout.svelte'), /<\/i>\s*Auto height\s*<\/button>/);
  assert.match(src('WidgetToolbar.svelte'), /aria-label="Auto height"/);
  assert.match(src('WidgetToolbar.svelte'), /<span>Edit text<\/span>/);
  assert.match(src('ListLead.svelte'), /template editor \(Pages > Templates\)/);
  assert.doesNotMatch(src('App.svelte'), /people, places, projects/);
  assert.doesNotMatch(src('EntrancePageCurtain.svelte'), /Curtain for this page'/);
});
