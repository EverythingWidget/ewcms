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
