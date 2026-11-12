// A site with no pages yet: renderRoute must not crash (dev GET / was 500 at route.id).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRoutes, buildRoutes } from '../src/site/routes.js';
import { renderRoute, EMPTY_ROUTE } from '../src/site/render.js';

const empty = (site) => ({
  site,
  header: {},
  pages: {},
  sources: {},
  schemas: {},
  templates: {},
  animations: {},
  photos: {},
  redirects: [],
  footer: { kind: 'part', sections: [] },
  strings: {},
  media: {},
});

test('a site with no pages: no routes, renderRoute still returns a page (the empty placeholder)', () => {
  const content = empty({
    name: 'New',
    title: 'New',
    url: 'https://example.com',
    accent: '#cfc8b8',
    lang: 'en',
  });
  assert.equal(getRoutes(content).length, 0);
  assert.equal(buildRoutes(content).routes.length, 0);
  const out = renderRoute(undefined, content);
  assert.match(out.body, /id="main"/);
  assert.match(out.body, /view--page/);
  assert.equal(out.lang, 'en');
  assert.match(out.head, /<title>/);
  assert.equal(EMPTY_ROUTE.noindex, true);
});

test('a site with no pages and no site.json: still no crash', () => {
  const out = renderRoute(undefined, empty(undefined));
  assert.match(out.body, /id="main"/);
  assert.equal(out.lang, 'en');
});
