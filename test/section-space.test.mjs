// Space between sections, in grid rows (F90): site-wide only, theme.json layout.sectionSpace /
// layout.sectionSpacePhone (Theme › Layout). A section's own sectionSpace / sectionSpacePhone
// is gone: a warning, ignored by the renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent, contentWarnings } from '../src/render/validate.js';
import { checkLayout, layoutVars } from '../src/render/layout/contain.js';
import * as layout from '../src/render/layout/index.js';

const { clampSpaceRows, sectionVars, siteSectionSpaceOf, siteSectionSpacePhoneOf } = layout;
const F = 'pages/test/index.json';
const page = (sections) => ({ version: 1, kind: 'page', id: 'pg-t090', sections });
const sec = (more = {}) => ({ id: 's-aaaa', widgets: [], ...more });

test('unset is 0: a site without sectionSpace adds no space', () => {
  assert.equal(siteSectionSpaceOf({}), 0);
  assert.equal(siteSectionSpaceOf({ layout: { containedCols: 96 } }), 0);
  assert.equal(siteSectionSpacePhoneOf({}), 0);
  assert.equal(layoutVars({}), '');
});

test('the site default: the same for every section', () => {
  const site = { layout: { sectionSpace: 8, sectionSpacePhone: 12 } };
  assert.equal(siteSectionSpaceOf(site), 8);
  assert.equal(siteSectionSpacePhoneOf(site), 12);
  assert.equal(layoutVars(site), '--section-space: 8; --section-space-phone: 12');
});

test("on phones, an unset phone value uses the same row count as the desktop's", () => {
  const site = { layout: { sectionSpace: 8 } };
  assert.equal(siteSectionSpacePhoneOf(site), 8);
  assert.equal(layoutVars(site), '--section-space: 8');
  assert.equal(
    layoutVars({ layout: { sectionSpace: 8, sectionSpacePhone: 0 } }),
    '--section-space: 8; --section-space-phone: 0',
  );
});

test('layout.sectionSpace is a whole number of rows from 0 to 999', () => {
  assert.deepEqual(checkLayout({ sectionSpace: 8, sectionSpacePhone: 0 }), []);
  assert.ok(checkLayout({ sectionSpace: -1 }).some((m) => m.includes('"layout.sectionSpace"')));
  assert.ok(checkLayout({ gap: 1 }).some((m) => m.includes('"layout.gap"')));
  assert.equal(clampSpaceRows(8.4), 8);
  assert.equal(clampSpaceRows(-3), 0);
  assert.equal(clampSpaceRows(2000), 999);
  assert.equal(clampSpaceRows(undefined), null);
});

test("a section's own sectionSpace / sectionSpacePhone is gone: a warning, never a problem", () => {
  assert.deepEqual(checkContent(F, page([sec()])), []);
  assert.deepEqual(contentWarnings(), []);
  assert.deepEqual(checkContent(F, page([sec({ sectionSpace: 8 })])), []);
  assert.deepEqual(contentWarnings(), [
    'section 1: "sectionSpace" is gone: the space between sections is the site\'s, Space between sections in Theme › Layout ("layout.sectionSpace" in content/theme.json); for more above one section, leave empty rows above its widgets. Remove "sectionSpace" (it was 8)',
  ]);
  // any value, even one that was never valid: still only a warning (the key is ignored)
  assert.deepEqual(checkContent(F, page([sec(), sec({ id: 's-bbbb', sectionSpace: -1, sectionSpacePhone: 0 })])), []);
  assert.deepEqual(
    contentWarnings().map((w) => w.split(' is gone')[0]),
    ['section 2: "sectionSpace"', 'section 2: "sectionSpacePhone"'],
  );
});

test('the renderer ignores a section\'s sectionSpace: no --sspace / --msspace, nothing else changes', () => {
  assert.equal(sectionVars(sec()), '--rows:1;--mrows:1');
  for (const more of [{ sectionSpace: 8 }, { sectionSpace: 0 }, { sectionSpacePhone: 4 }])
    assert.equal(sectionVars(sec(more)), sectionVars(sec()));
  // the per-section helpers are gone too
  for (const name of ['sectionSpaceOf', 'phoneSectionSpaceOf', 'hasOwnSectionSpace', 'hasOwnSectionSpacePhone'])
    assert.equal(layout[name], undefined, name);
});

test('the first visible page section keeps --nav-h; later sections and the footer use the site space', () => {
  const css = readFileSync(new URL('../src/client/styles/_layout.scss', import.meta.url), 'utf8');
  assert.match(css, /padding-top: calc\(var\(--section-space, 0\) \* var\(--cell\)\);/);
  assert.match(
    css,
    /padding-top: calc\(var\(--section-space-phone, var\(--section-space, 0\)\) \* var\(--cell\)\);/,
  );
  assert.doesNotMatch(css, /--sspace|--msspace/);
  assert.match(
    css,
    /\[data-router-view\] > \.sec:nth-child\(1 of :not\(\[hidden\]\)\) \{\s*padding-top: var\(--nav-h\);/,
  );
  // two of these (desktop context and the phone breakpoint)
  assert.equal(
    [
      ...css.matchAll(
        /\[data-router-view\] > \.sec:nth-child\(1 of :not\(\[hidden\]\)\) \{\s*padding-top: var\(--nav-h\);/g,
      ),
    ].length,
    2,
  );
  // the footer is not under [data-router-view], so its first section keeps the space
  assert.doesNotMatch(css, /data-footer.*padding-top: var\(--nav-h\)/s);
  assert.doesNotMatch(css, /\.site-footer[^{]*padding-top: var\(--nav-h\)/);
});

test('the editor: Theme › Layout keeps the site fields; the section popup has no space field', () => {
  const read = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');
  const site = read('ThemePanel.svelte');
  const section = read('SectionSettings.svelte');
  assert.match(site, /label="Space between sections"/);
  assert.match(site, /label="Space between sections \(phone\)"/);
  assert.match(site, /layout\/sectionSpace/);
  assert.match(site, /layout\/sectionSpacePhone/);
  assert.doesNotMatch(site, /A section can override/);
  assert.doesNotMatch(section, /Space above this section|sectionSpace|SectionSpace/);
  assert.doesNotMatch(read('SectionPopup.svelte'), /Space above this section/);
  const ops = readFileSync(new URL('../src/editor/layout-ops.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ops, /sectionSpace/);
});
