// Feature 3: When a value is missing + Also needs (src/site/layout/missing.js) in templates
// and on pages; a button hides on an empty link or label; false is empty for hiding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onGrid } from './grid-helper.mjs';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { bindingProblems } from '../src/site/layout/bindings.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { goneOf, missingState } from '../src/site/layout/missing.js';
import { needsFrom, needsValue, TEMPLATE_MISSING } from '../src/editor/lib/item-template.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const P = (k) => [{ property: k }];
const items = [
  {
    id: 'p-aaaa',
    slug: 'a',
    title: 'Both',
    url: 'https://x.y/',
    linkLabel: 'x.y',
    placeholder: true,
  },
  { id: 'p-bbbb', slug: 'b', title: 'Url only', url: 'https://z.y/', placeholder: false },
  { id: 'p-cccc', slug: 'c', title: 'Neither' },
];
const visit = { type: 'button', role: 'visit', label: P('linkLabel'), config: { link: P('url') } };
const tag = {
  type: 'text',
  role: 'tag',
  body: [{ style: 'label', text: [{ t: 'Placeholder' }] }],
  config: { needs: ['placeholder'] },
};
const title = { type: 'text', role: 'title', body: [{ style: 'heading', text: P('title') }] };
const tpl = (widgets) => ({
  version: 1,
  kind: 'template',
  label: 'Row',
  source: 'projects',
  link: false,
  widgets: onGrid(widgets),
});

function render(t, listConfig = {}) {
  const ctx0 = {
    ...base,
    sources: { ...base.sources, projects: items },
    templates: { 't-need': t },
  };
  const { routes } = buildRoutes(ctx0);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = {
    ...w,
    id: 'w-need',
    source: { mode: 'all', from: 'projects' },
    config: { ...w.config, template: 't-need', columns: '1', ...listConfig },
  };
  const [html, seen] = warnings(() =>
    renderSections({ ...ctx0, route: page, routes, curtains: {} }, page, 'pages/t/index.json', [
      newSection(ids, [widget]),
    ]),
  );
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { items: [...document.querySelectorAll('.li')], seen };
}
const shown = (lis, role) => lis.map((li) => !!li.querySelector(`.li__${role}`));

test('the Visit button: shown only with both {url} and {linkLabel}', () => {
  const t = tpl([title, visit]);
  assert.deepEqual(checkContent('templates/t-need.json', t), []);
  const { items: lis, seen } = render(t);
  assert.deepEqual(shown(lis, 'visit'), [true, false, false]);
  assert.equal(lis[0].querySelector('.li__visit a').getAttribute('href'), 'https://x.y/');
  assert.ok(seen.some((m) => /have no \{linkLabel\}/.test(m)));
  // a fixed label: hidden without its {url} (never a button to "/")
  const fixed = render(tpl([title, { ...visit, label: 'Visit' }])).items;
  assert.deepEqual(shown(fixed, 'visit'), [true, true, false]);
});

test('Also needs: the Placeholder tag on placeholder items only (false is empty for hiding)', () => {
  const t = tpl([title, tag]);
  assert.deepEqual(checkContent('templates/t-need.json', t), []);
  const { items: lis } = render(t);
  assert.deepEqual(shown(lis, 'tag'), [true, false, false]);
  // Show empty keeps it
  const keep = render(tpl([title, { ...tag, config: { ...tag.config, missing: 'show' } }])).items;
  assert.deepEqual(shown(keep, 'tag'), [true, true, true]);
  // the List's Show empty: As the List follows it
  assert.deepEqual(shown(render(t, { missing: 'show' }).items, 'tag'), [true, true, true]);
});

test('the editor preview: dimmed, same size, with "Needs {placeholder}" / "No value for {url}"', () => {
  const ctx = { ...base };
  const scope = { item: items[1], keys: new Set(), sources: {} };
  const a = missingState(ctx, tag, WIDGET_TYPES.text, scope, { hide: true, edit: true });
  assert.equal(a.skip, false);
  assert.match(a.attr, /data-no-value="Needs \{placeholder\}"/);
  assert.match(a.attr, /data-missing-tag="Hidden on the page"/);
  const b = missingState(
    ctx,
    visit,
    WIDGET_TYPES.button,
    { ...scope, item: items[2] },
    { edit: true },
  );
  assert.match(b.attr, /No value for \{linkLabel\}, \{url\}/);
  assert.equal(goneOf(tag, WIDGET_TYPES.text, { item: items[0] }).all, false);
});

test('pages: Also needs on a page widget', () => {
  const ctx = { ...base };
  const w = {
    type: 'text',
    body: [{ style: 'label', text: [{ t: 'Hi' }] }],
    config: { needs: ['flag'] },
  };
  assert.equal(goneOf(w, WIDGET_TYPES.text, { item: { flag: false } }).all, true);
  assert.equal(goneOf(w, WIDGET_TYPES.text, { item: { flag: 'yes' } }).all, false);
  assert.equal(missingState(ctx, w, WIDGET_TYPES.text, { item: {} }, { edit: false }).skip, true);
});

test('validator: missing, needs, toggle / Side by side, the href bug', () => {
  const p = (w) => checkContent('templates/t-need.json', tpl([title, w])).join(' | ');
  assert.match(
    p({ ...tag, config: { missing: 'never' } }),
    /config.missing must be "hide" or "show"/,
  );
  assert.match(
    p({ ...tag, config: { needs: 'placeholder' } }),
    /config.needs must be a list of property names/,
  );
  assert.match(p({ ...tag, config: { needs: ['a b'] } }), /config.needs must be a list/);
  assert.match(
    p({ type: 'button', label: 'Visit', config: { link: { href: P('url') } } }),
    /a property goes in the link itself: write "link": \[\{ "property": "url" \}\]/,
  );
  assert.match(
    p({ type: 'sideBySide', config: { needs: ['x'] }, widgets: [title, title] }),
    /Side by side is gone: place its widgets next to each other on the template's grid/,
  );
  // a page widget
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-need',
    sections: [
      {
        id: 's-need',
        widgets: [{ id: 'w-nedd', type: 'text', body: [], config: { needs: [1] } }],
      },
    ],
  };
  assert.ok(checkContent('pages/x/index.json', page).some((m) => /config.needs/.test(m)));
});

test('warning: a summary that can be empty', () => {
  const dw = (icon) => ({ type: 'details', config: { template: 't-more', icon } });
  const opens = (summary) => ({ ...tpl(summary), link: false });
  const warn = (t) =>
    bindingProblems({ ...base, templates: { 't-need': t } }, { types: WIDGET_TYPES }).filter((x) =>
      /summary can be empty/.test(x.message),
    );
  assert.equal(warn(opens([title, dw('none')])).length, 1);
  assert.equal(warn(opens([title, dw('none')]))[0].level, 'warning');
  assert.equal(warn(opens([title, dw('plus')])).length, 0); // the +/× keeps it
  assert.equal(warn(opens([{ ...title, config: { missing: 'show' } }, dw('none')])).length, 0);
});

test('editor: As the List, Also needs as chips and back; the rows in the template editor', () => {
  assert.deepEqual(TEMPLATE_MISSING[0], ['', 'As the List']);
  assert.deepEqual(needsValue(['a', 'b']), [{ property: 'a' }, { t: ' ' }, { property: 'b' }]);
  assert.deepEqual(needsFrom([{ property: 'a' }, { t: ' x ' }, { property: 'a' }]), ['a']);
  assert.equal(needsFrom('typed'), undefined);
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  for (const l of [
    'When a value is missing',
    'Also needs',
    'Hidden when one of these is empty, too',
  ])
    assert.ok(panel.includes(l), l);
  assert.ok(read('src/editor/svelte/GroupFields.svelte').includes('Also needs'));
});

test('a text line with no property shows its text in the chips box (was empty)', async () => {
  const { parseHTML: ph } = await import('linkedom');
  const { renderParts } = await import('../src/editor/lib/parts-input.js');
  const { document } = ph('<div id="x"></div>');
  const el = document.getElementById('x');
  renderParts(el, [{ t: 'Placeholder' }], new Set());
  assert.equal(el.textContent, 'Placeholder');
});

test('the editor: the Hidden tag sits inside the dimmed widget, clipped to its box (no overlap)', () => {
  const css = read('src/editor/bridge.js');
  const rule = css.slice(
    css.indexOf('[data-no-value]::before {'),
    css.indexOf('}', css.indexOf('[data-no-value]::before {')),
  );
  assert.match(css, /\[data-no-value\] \{ position: relative; overflow: clip; \}/);
  assert.match(rule, /top: 0; left: 0/);
  assert.match(rule, /max-width: 100%; max-height: 100%/);
  assert.doesNotMatch(css, /calc\(100% \+/); // nothing below the box any more
  assert.doesNotMatch(css, /\[data-no-value\]::after/);
});
