// Space between sections, in grid rows (F90): site.json layout.sectionSpace /
// layout.sectionSpacePhone and a section's sectionSpace / sectionSpacePhone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent } from '../src/render/validate.js';
import { checkLayout, layoutVars } from '../src/render/layout/contain.js';
import {
  clampSpaceRows,
  hasOwnSectionSpace,
  phoneSectionSpaceOf,
  sectionSpaceOf,
  sectionVars,
  siteSectionSpaceOf,
  siteSectionSpacePhoneOf,
} from '../src/render/layout/index.js';

const F = 'pages/test/index.json';
const page = (sections) => ({ version: 1, kind: 'page', id: 'pg-t090', sections });
const sec = (more = {}) => ({ id: 's-aaaa', widgets: [], ...more });

test('unset is 0: a site or section without sectionSpace adds no space', () => {
  assert.equal(siteSectionSpaceOf({}), 0);
  assert.equal(siteSectionSpaceOf({ layout: { containedCols: 96 } }), 0);
  assert.equal(siteSectionSpacePhoneOf({}), 0);
  assert.equal(sectionSpaceOf(sec(), {}), 0);
  assert.equal(phoneSectionSpaceOf(sec(), {}), 0);
  assert.equal(hasOwnSectionSpace(sec()), false);
  assert.doesNotMatch(sectionVars(sec()), /--sspace|--msspace/);
  assert.equal(layoutVars({}), '');
});

test("a site default applies until a section sets its own (0 is an override)", () => {
  const site = { layout: { sectionSpace: 8, sectionSpacePhone: 12 } };
  assert.equal(siteSectionSpaceOf(site), 8);
  assert.equal(siteSectionSpacePhoneOf(site), 12);
  assert.equal(sectionSpaceOf(sec(), site), 8);
  assert.equal(phoneSectionSpaceOf(sec(), site), 12);
  assert.equal(sectionSpaceOf(sec({ sectionSpace: 0 }), site), 0);
  assert.equal(phoneSectionSpaceOf(sec({ sectionSpace: 0 }), site), 0);
  assert.equal(phoneSectionSpaceOf(sec({ sectionSpace: 0, sectionSpacePhone: 4 }), site), 4);
  // a desktop override without a phone value: the same row count, not the site's phone value
  assert.equal(phoneSectionSpaceOf(sec({ sectionSpace: 8 }), site), 8);
});

test("on phones, an unset phone value uses the same row count as the desktop's", () => {
  const site = { layout: { sectionSpace: 8 } };
  assert.equal(siteSectionSpacePhoneOf(site), 8);
  assert.equal(phoneSectionSpaceOf(sec(), site), 8);
  assert.equal(phoneSectionSpaceOf(sec({ sectionSpacePhone: 0 }), site), 0);
  assert.equal(layoutVars(site), '--section-space: 8');
  assert.equal(
    layoutVars({ layout: { sectionSpace: 8, sectionSpacePhone: 0 } }),
    '--section-space: 8; --section-space-phone: 0',
  );
});

test('a section writes --sspace / --msspace only for its own value, including 0', () => {
  assert.equal(sectionVars(sec()), '--rows:1;--mrows:1');
  assert.match(sectionVars(sec({ sectionSpace: 8 })), /;--sspace:8$/);
  assert.match(sectionVars(sec({ sectionSpace: 0 })), /;--sspace:0$/);
  assert.match(sectionVars(sec({ sectionSpacePhone: 4 })), /;--msspace:4$/);
  assert.match(sectionVars(sec({ sectionSpace: 8, sectionSpacePhone: 0 })), /;--sspace:8;--msspace:0$/);
  assert.doesNotMatch(sectionVars(sec({ sectionSpace: 8 })), /--msspace/);
});

test('sectionSpace is a whole number of rows from 0 to 999', () => {
  const of = (more) => checkContent(F, page([sec(more)]));
  assert.deepEqual(of({ sectionSpace: 8 }), []);
  assert.deepEqual(of({ sectionSpace: 0, sectionSpacePhone: 0 }), []);
  assert.deepEqual(of({ sectionSpace: -1 }), [
    'section 1: "sectionSpace" must be a whole number of rows from 0 to 999',
  ]);
  assert.deepEqual(of({ sectionSpace: 8.5 }), [
    'section 1: "sectionSpace" must be a whole number of rows from 0 to 999',
  ]);
  assert.deepEqual(of({ sectionSpacePhone: 1000 }), [
    'section 1: "sectionSpacePhone" must be a whole number of rows from 0 to 999',
  ]);
  assert.deepEqual(checkLayout({ sectionSpace: 8 }), []);
  assert.ok(checkLayout({ gap: 1 }).some((m) => m.includes('"layout.gap"')));
  assert.equal(clampSpaceRows(8.4), 8);
  assert.equal(clampSpaceRows(-3), 0);
  assert.equal(clampSpaceRows(2000), 999);
  assert.equal(clampSpaceRows(undefined), null);
});

test('the first visible page section keeps --nav-h; later sections and the footer use the space', () => {
  const css = readFileSync(new URL('../src/client/styles/_layout.scss', import.meta.url), 'utf8');
  assert.match(
    css,
    /padding-top: calc\(var\(--sspace, var\(--section-space, 0\)\) \* var\(--cell\)\);/,
  );
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
  assert.match(css, /--section-space-phone/);
  // the footer is not under [data-router-view], so its first section keeps the space
  assert.doesNotMatch(css, /data-footer.*padding-top: var\(--nav-h\)/s);
  assert.doesNotMatch(css, /\.site-footer[^{]*padding-top: var\(--nav-h\)/);
});

test('the editor labels: Theme › Layout and the section popup; the keys are sectionSpace', () => {
  const site = readFileSync(
    new URL('../src/editor/svelte/ThemePanel.svelte', import.meta.url),
    'utf8',
  );
  const section = readFileSync(
    new URL('../src/editor/svelte/SectionSettings.svelte', import.meta.url),
    'utf8',
  );
  assert.match(site, /label="Space between sections"/);
  assert.match(site, /label="Space between sections \(phone\)"/);
  assert.match(site, /layout\/sectionSpace/);
  assert.match(site, /layout\/sectionSpacePhone/);
  assert.match(section, /label="Space above this section"/);
  assert.match(section, /<b>Space between\s*sections<\/b> in Theme/);
  assert.match(section, /sectionSpacePhone/);
  assert.match(section, /Reset space \(follow the site\)/);
  assert.doesNotMatch(site, /spaceAbove/);
  assert.doesNotMatch(section, /spaceAbove/);
  assert.doesNotMatch(site, /label="[^"]*[Gg]ap/);
  assert.doesNotMatch(section, /label="[^"]*[Gg]ap/);
});
