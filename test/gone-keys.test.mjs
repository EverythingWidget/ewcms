// A removed or retired key is a warning, never a thrown error: old content still loads in the
// dev server and the editor (loadContent → assertContent), ewcms check lists it as a warning,
// and the renderer ignores the key (an item template's style.background: the fill is theme.json's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { warnings } from '../scripts/test-layout.mjs';
import { checkContentOf } from '../src/cli/cli.mjs';
import { loadContent } from '../src/cli/content.mjs';
import { assertContent, checkContent, contentWarnings } from '../src/render/validate.js';
import { buildRoutes } from '../src/render/routes.js';
import { newWidget, newSection, renderSections } from '../src/render/layout/index.js';
import { onGrid, template } from '../scripts/grid-helper.mjs';
import { SITE_A } from './fixtures/index.mjs';

const prow = (style) =>
  template({
    name: 'Project row',
    style,
    widgets: onGrid([
      { type: 'text', role: 'title', body: [{ style: 'heading', text: [{ property: 'title' }] }] },
    ]),
  });
const OLD = { border: 'bottom', background: 'transparent' };
const WARNING =
  /"style\.background" is gone: an item's fill \(on hover too\) is its template's Background in content\/theme\.json, "colorThemes\.<theme>\.templates\.t-prow\.background" \(left out or "transparent": no fill, the section shows through\)\. Remove "style\.background" \(it was "transparent"\)/;

test('assertContent: a template with style.background loads (a warning, no throw)', () => {
  assert.doesNotThrow(() => assertContent('templates/t-prow.json', prow(OLD)));
  assert.doesNotThrow(() =>
    assertContent('templates/t-prow.json', prow({ hoverBackground: 'surface', padding: 8 })),
  );
  assert.deepEqual(checkContent('templates/t-prow.json', prow(OLD)), []);
  assert.match(contentWarnings().join('\n'), WARNING);
  // a real problem still throws
  assert.throws(
    () => assertContent('templates/t-prow.json', prow({ border: 'thick' })),
    /style\.border must be one of/,
  );
});

const siteWithOldTemplate = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-gone-'));
  fs.cpSync(path.join(SITE_A, 'content'), path.join(root, 'content'), { recursive: true });
  fs.mkdirSync(path.join(root, 'content', 'templates'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'content', 'templates', 't-prow.json'),
    JSON.stringify(prow(OLD), null, 2),
  );
  return root;
};

test('the dev server and the editor: content with style.background loads; check lists a warning', async () => {
  const root = siteWithOldTemplate();
  // loadContent is what the dev server and the editor read content with (assertContent)
  const content = loadContent(root);
  assert.ok(content.templates['t-prow']);
  const found = [];
  assert.deepEqual(await checkContentOf(root, { warnings: found }), []);
  assert.ok(
    found.some((w) => /^content\/templates\/t-prow\.json: /.test(w) && WARNING.test(w)),
    found.join('\n'),
  );
});

test('the renderer ignores the gone keys: no inline fill, no grid style keys on a site template', () => {
  const content = loadContent(SITE_A);
  const tpl = prow({ ...OLD, hoverBackground: 'surface-2', padding: 24 });
  const c = { ...content, templates: { ...content.templates, 't-prow': tpl } };
  const { routes } = buildRoutes(c);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  w.config = { ...w.config, template: 't-prow' };
  const [html] = warnings(() =>
    renderSections({ ...c, route: page, routes, curtains: {} }, page, 'pages/x/index.json', [
      newSection(ids, [w]),
    ]),
  );
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const items = [...document.querySelectorAll('[data-list-item]')];
  assert.ok(items.length > 0);
  for (const li of items) {
    const style = li.getAttribute('style') || '';
    assert.doesNotMatch(style, /--item-bg|--item-pad/, style);
  }
  // its border still applies
  assert.match(items[0].getAttribute('style') || '', /--item-border:inset 0 -1px 0/);
});

// a section's own space above it (Space above this section) is gone: the site's
// layout.sectionSpace is the space between sections
test("a page section's sectionSpace / sectionSpacePhone: it loads, check warns, the render ignores it", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-gone-'));
  fs.cpSync(path.join(SITE_A, 'content'), path.join(root, 'content'), { recursive: true });
  const file = path.join(root, 'content', 'en', 'pages', 'about', 'index.json');
  const about = JSON.parse(fs.readFileSync(file, 'utf8'));
  about.sections[0] = { ...about.sections[0], sectionSpace: 8, sectionSpacePhone: 0 };
  fs.writeFileSync(file, JSON.stringify(about, null, 2));
  assert.doesNotThrow(() => assertContent('pages/about/index.json', about));
  const content = loadContent(root);
  const found = [];
  assert.deepEqual(await checkContentOf(root, { warnings: found }), []);
  const ours = found.filter((w) => w.includes('is gone: the space between sections'));
  assert.deepEqual(ours, [
    'content/en/pages/about/index.json: section 1: "sectionSpace" is gone: the space between sections is the site\'s, Space between sections in Theme › Layout ("layout.sectionSpace" in content/theme.json); for more above one section, leave empty rows above its widgets. Remove "sectionSpace" (it was 8)',
    'content/en/pages/about/index.json: section 1: "sectionSpacePhone" is gone: the space between sections is the site\'s, Space between sections in Theme › Layout ("layout.sectionSpacePhone" in content/theme.json); for more above one section, leave empty rows above its widgets. Remove "sectionSpacePhone" (it was 0)',
  ]);
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const [html] = warnings(() =>
    renderSections(
      { ...content, route: page, routes, curtains: {} },
      page,
      'pages/about/index.json',
      page.page?.sections || about.sections,
    ),
  );
  assert.match(html, /--rows:/);
  assert.doesNotMatch(html, /--sspace|--msspace/);
});
