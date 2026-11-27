// Sections (page and footer), the header and the phone menu pick a color theme (colour plan
// step 2): class ct-<name>, validated; a section that picks one paints its background edge to edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadContent } from '../src/cli/content.mjs';
import { buildRoutes } from '../src/render/routes.js';
import { renderSections, sectionClass } from '../src/render/layout/index.js';
import { header, phoneMenu } from '../src/render/shell/header.js';
import { footer } from '../src/render/shell/footer.js';
import { checkContent } from '../src/render/validate.js';
import { THEME_NAMES } from '../src/render/colors.js';
import { warnings } from '../scripts/test-layout.mjs';
import { SITE_A } from './fixtures/index.mjs';

const base = loadContent(SITE_A);
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ctxWith = (more) => {
  const content = { ...base, ...more };
  return { ...content, routes: buildRoutes(content).routes, curtains: {} };
};
const page = (section) => ({ version: 1, kind: 'page', id: 'pg-ctpk', sections: [{ id: 's-ctpk', widgets: [], ...section }] });

test('a section\'s colorTheme is its class ct-<name>; none or an unknown one: no class', () => {
  for (const name of THEME_NAMES) assert.equal(sectionClass({ colorTheme: name }), `sec ct-${name}`);
  assert.equal(sectionClass({ width: 'full', colorTheme: 'dark' }), 'sec sec--full ct-dark');
  assert.equal(sectionClass({}), 'sec');
  assert.equal(sectionClass({ colorTheme: 'blue' }), 'sec');
  const ctx = ctxWith({});
  const route = ctx.routes[0];
  const [html] = warnings(() =>
    renderSections(ctx, route, 'pages/x/index.json', [{ id: 's-ctp1', colorTheme: 'light', widgets: [] }]),
  );
  assert.match(html, /<section class="sec ct-light"/);
});

test('validated: a section (page or footer) and header.json name a known color theme', () => {
  assert.deepEqual(checkContent('pages/x/index.json', page({ colorTheme: 'accent' })), []);
  assert.deepEqual(checkContent('pages/x/index.json', page({ colorTheme: 'blue' })), [
    'section 1: "colorTheme" must be a color theme: "lightest", "light", "accent", "dark", "darkest", not "blue"',
  ]);
  assert.match(
    checkContent('footer.json', { version: 1, kind: 'footer', sections: [{ id: 's-ctf1', colorTheme: 'x', widgets: [] }] }).join('\n'),
    /"colorTheme" must be a color theme/,
  );
  assert.deepEqual(checkContent('header.json', { ...base.header, colorTheme: 'darkest' }), []);
  assert.deepEqual(checkContent('header.json', { ...base.header, colorTheme: 'Dark' }), [
    '"colorTheme" must be a color theme: "lightest", "light", "accent", "dark", "darkest", not "Dark"',
  ]);
});

test('the header and the phone menu carry header.json\'s color theme; left out, the site\'s (none)', () => {
  const on = ctxWith({ header: { ...base.header, colorTheme: 'dark' } });
  assert.match(header(on), /<header class="header ct-dark" data-header>/);
  assert.match(phoneMenu(on), /<div class="mmenu ct-dark" id="phone-menu"/);
  const off = ctxWith({});
  assert.match(header(off), /<header class="header" data-header>/);
  assert.match(phoneMenu(off), /<div class="mmenu" id="phone-menu"/);
});

test('footer sections pick one like page sections', () => {
  const ctx = ctxWith({ footer: { version: 1, kind: 'footer', sections: [{ id: 's-ctf2', colorTheme: 'lightest', widgets: [] }] } });
  const [html] = warnings(() => footer(ctx, ctx.routes[0]));
  assert.match(html, /<section class="sec ct-lightest"/);
});

test('a section with a theme paints its background edge to edge (the section box is full width)', () => {
  const css = read('src/client/styles/_layout.scss');
  assert.match(css, /\.sec\[class\*=' ct-'\] \{\s*background-color: var\(--color-background\);\s*color: var\(--color-text\);/);
  // the contained width is the section's padding, not its box
  assert.match(css, /\.sec \{[\s\S]*?padding: 0 var\(--cpad\);/);
});
