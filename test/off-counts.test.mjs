// Off counts nowhere in the published output: a widget switched off (config.enabled false), or
// one in a section that is off, gives the page no title (<title>, the curtain) and, as a
// [param] page's main widget, builds no item pages (src/render/routes.js, layout/source.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paramPage } from '../scripts/test-layout.mjs';
import { buildRoutes, pageTitle } from '../src/render/routes.js';
import { mainProblem } from '../src/render/layout/source.js';
import { contentFromFiles } from '../src/render/files.js';
import { isOff } from '../src/render/layout/ids.js';

const title = (id, t, more = {}) => ({
  id,
  type: 'text',
  body: [{ style: 'title', text: [{ t }] }],
  ...more,
});
const off = { config: { enabled: false } };

test('isOff: the widget switched off, or its section', () => {
  assert.equal(isOff({}, {}), false);
  assert.equal(isOff({ config: { enabled: true } }, { enabled: true }), false);
  assert.equal(isOff(off, {}), true);
  assert.equal(isOff({}, { enabled: false }), true);
});

test("pageTitle: an off widget, or one in an off section, doesn't name the page", () => {
  const page = (...sections) => ({ sections });
  assert.equal(
    pageTitle(
      page({ id: 's-aaaa', widgets: [title('w-aaaa', 'Hidden', off), title('w-bbbb', 'Shown')] }),
    ),
    'Shown',
  );
  assert.equal(
    pageTitle(
      page(
        { id: 's-aaaa', enabled: false, widgets: [title('w-aaaa', 'Hidden')] },
        { id: 's-bbbb', widgets: [title('w-bbbb', 'Shown')] },
      ),
    ),
    'Shown',
  );
  assert.equal(
    pageTitle(page({ id: 's-aaaa', widgets: [title('w-aaaa', 'Hidden', off)] })),
    undefined,
  );
});

test('the built route: <title> and the curtain skip an off Text', () => {
  const c = contentFromFiles({
    'site.json': { name: 'S', title: 'S' },
    'pages/about/index.json': {
      sections: [
        {
          id: 's-aaaa',
          widgets: [title('w-aaaa', 'Draft name', off), title('w-bbbb', 'About us')],
        },
      ],
    },
  });
  const r = buildRoutes(c).routes.find((x) => x.id === 'about');
  assert.match(r.title, /About us/);
  assert.doesNotMatch(r.title, /Draft name/);
  assert.doesNotMatch(JSON.stringify(r.curtain ?? ''), /Draft name/);
});

const site = (mutate) => {
  const page = paramPage('people/[person]', 'people');
  mutate?.(page);
  return contentFromFiles({
    'site.json': { name: 'S', title: 'S' },
    'pages/people/index.json': { title: 'People' },
    'pages/people/[person]/index.json': page,
    'sources/people.json': {
      version: 1,
      items: [
        { id: 'p-noor', slug: 'noor', name: 'Noor' },
        { id: 'p-daan', slug: 'daan', name: 'Daan' },
      ],
    },
  });
};
const people = (c, opts) => buildRoutes(c, opts).routes.filter((r) => r.id === 'people/[person]');

test('a [param] page whose main widget is off (or its section) builds no item pages', () => {
  assert.deepEqual(
    people(site()).map((r) => r.path),
    ['/people/noor/', '/people/daan/'],
  );
  const offWidget = site((p) => (p.sections[0].widgets[0].config.enabled = false));
  const offSection = site((p) => (p.sections[0].enabled = false));
  for (const c of [offWidget, offSection]) {
    assert.equal(mainProblem(c, 'people/[person]').kind, 'off');
    assert.deepEqual(people(c), []);
    const { warnings } = buildRoutes(c);
    assert.ok(
      warnings.some((w) => /No pages are built: the main widget is off/.test(w)),
      warnings.join('\n'),
    );
    // the editor still gets its pages to edit on, unbuilt (noindex), as today
    const ed = people(c, { unbuilt: true });
    assert.deepEqual(
      ed.map((r) => [r.path, r.unbuilt]),
      [
        ['/people/noor/', true],
        ['/people/daan/', true],
      ],
    );
  }
});
