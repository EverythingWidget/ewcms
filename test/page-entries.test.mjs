import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRoutes } from '../src/render/routes.js';
import { contentFromFiles } from '../src/render/files.js';
import { pageEntries, pageMenu, templateEntries } from '../src/editor/lib/page-entries.js';

const page = (id, title) => ({ version: 1, kind: 'page', id, meta: { title }, sections: [] });
const FILES = {
  'site.json': { version: 1, name: 'Site', title: 'Site' },
  'header.json': { version: 1, header: [{ label: 'About', page: 'pg-ab' }] },
  'footer.json': { version: 1 },
  'pages/index.json': page('pg-ho', 'Home'),
  'pages/about/index.json': page('pg-ab', 'About'),
  'pages/about/team/index.json': page('pg-tm', 'Team'),
  'templates/t-bbbb.json': { name: 'Card B' },
  'templates/t-aaaa.json': { name: 'Card A' },
};
const routes = getRoutes(contentFromFiles(FILES), { unbuilt: true });

test('pageEntries: every page, grouped by its folder', () => {
  const byPath = Object.fromEntries(pageEntries(FILES, routes).map((e) => [e.path, e]));
  assert.equal(byPath['/'].group, 'Pages');
  assert.equal(byPath['/about/'].group, '/about/');
  assert.equal(byPath['/about/team/'].group, '/about/');
  assert.equal(byPath['/about/'].pid, 'pg-ab');
});

test('templateEntries: the item templates, sorted by id', () => {
  assert.deepEqual(
    templateEntries(FILES).map((t) => [t.kind, t.id, t.title]),
    [
      ['item-template', 't-aaaa', 'Card A'],
      ['item-template', 't-bbbb', 'Card B'],
    ],
  );
});

test('pageMenu: Header and Footer, then the templates, then the pages', () => {
  const menu = pageMenu(FILES, routes);
  assert.deepEqual(
    menu.slice(0, 4).map((e) => e.id || e.path),
    ['header', 'footer', 't-aaaa', 't-bbbb'],
  );
  assert.equal(menu.filter((e) => e.kind === 'page').length, pageEntries(FILES, routes).length);
});
