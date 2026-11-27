import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../src/cli/content.mjs';
import { buildRoutes } from '../src/render/routes.js';
import { header, phoneMenu } from '../src/render/shell/header.js';
import { checkContent, contentWarnings } from '../src/render/validate.js';
import { setEditable } from '../src/render/helpers.js';
import { warnings } from '../scripts/test-layout.mjs';
import { SITE_A } from './fixtures/index.mjs';

const NAV = 'header.json';
const base = loadContent(SITE_A);
const ctxWith = (nav) => {
  const content = { ...base, header: nav };
  return { ...content, routes: buildRoutes(content).routes };
};

/** Console warnings while fn runs. */

test('header.json: the shipped menus are valid', () => {
  assert.deepEqual(checkContent(NAV, base.header), []);
});

test('header.json validation: links, nesting depth; no footer menu', () => {
  const problems = (nav) => checkContent(NAV, { version: 1, ...nav });
  assert.deepEqual(problems({ header: [{ label: 'A', page: 'pg-aaaa' }] }), []);
  assert.deepEqual(
    problems({ header: [{ label: 'A', item: { source: 'people', id: 'p-aaaa' } }] }),
    [],
  );
  assert.match(problems({ header: {} })[0], /"header" must be an array/);
  assert.match(problems({ header: [{ label: 'A' }] })[0], /one of "page".*"item".*"href"/);
  assert.match(problems({ header: [{ label: 'A', page: 'pg-aaaa', href: 'x' }] })[0], /one of/);
  assert.match(problems({ header: [{ label: 'A', page: '/about/' }] })[0], /a page id/);
  assert.match(problems({ header: [{ label: 'A', item: { source: 'people' } }] })[0], /"item"/);
  assert.match(problems({ header: [{ label: 'A', page: 'pg-aaaa', x: 1 }] })[0], /no "x"/);
  assert.match(problems({ header: [{ page: 'pg-aaaa' }] })[0], /needs a "label"/);
  const deep = {
    label: 'A',
    page: 'pg-aaaa',
    children: [{ label: 'B', page: 'pg-bbbb', children: [] }],
  };
  assert.match(problems({ header: [deep] })[0], /one level deep/);
  const both = { label: 'A', page: 'pg-aaaa', children: [], items: 'people' };
  assert.match(problems({ header: [both] })[0], /not both/);
  // a warning (old content still loads), not a problem
  assert.deepEqual(problems({ footer: [{ label: 'A', page: 'pg-aaaa' }] }), []);
  assert.match(contentWarnings().join(), /"footer" is gone: the footer is footer\.json/);
});

test('render: the header and phone menu follow header.json', () => {
  const nav = {
    header: [
      {
        label: 'Work',
        page: 'pg-evsk',
        children: [{ label: 'Faces', page: 'pg-yzuw', items: 'people' }],
      },
      { label: 'Builds', page: 'pg-cwyg', all: 'Every build', items: 'projects' },
      { label: 'Shop', href: 'https://shop.example.com' },
      { label: 'Me', page: 'pg-lyos' },
      { label: 'Noor', item: { source: 'people', id: 'p-qw7b' } },
    ],
  };
  const ctx = ctxWith(nav);
  const h = header(ctx);
  assert.ok(h.indexOf('>Work<') < h.indexOf('>Builds<') && h.indexOf('>Shop<') < h.indexOf('>Me<'));
  assert.match(
    h,
    /aria-controls="dd-photography" data-dropdown-toggle data-nav-section="\/photography\/,\/photography\/people\/"/,
  );
  assert.match(
    h,
    /<a class="dropdown__head" href="\/photography\/people\/"><span>Faces<\/span> <sup>04<\/sup><\/a>/,
  );
  assert.match(h, /class="dd-link" href="\/photography\/people\/noor-vermeer\/"/); // items with pages: photo rows
  assert.match(h, /class="dd-link dd-link--text" href="\/projects\/#/); // without: their spot
  assert.match(h, /<a class="dropdown__all" href="\/projects\/"><span>Every build<\/span>/);
  assert.match(
    h,
    /<a class="nav__item" href="https:\/\/shop\.example\.com" target="_blank" rel="noopener"><span>Shop<\/span><\/a>/,
  );
  assert.match(
    h,
    /<a class="nav__item" href="\/about\/" data-nav="\/about\/"><span>Me<\/span><\/a>/,
  );
  // an item link: the item's page, computed from its id
  assert.match(
    h,
    /<a class="nav__item" href="\/photography\/people\/noor-vermeer\/" data-nav="\/photography\/people\/noor-vermeer\/"><span>Noor/,
  );
  const m = phoneMenu(ctx);
  assert.match(
    m,
    /<a class="mmenu__head" href="\/photography\/people\/"><span>Faces<\/span><\/a><a href="\/photography\/people\/noor-vermeer\/">/,
  );
  assert.match(m, /mmenu__sub--single/);
  assert.match(m, /<a class="mmenu__big" href="\/about\/" data-nav="\/about\/" data-mm-item>/);
});

test('render: a link to no page warns; labels are marked for the editor', () => {
  const ctx = ctxWith({ header: [{ label: 'Gone', page: 'pg-gone' }] });
  const [h, seen] = warnings(() => header(ctx));
  assert.match(h, /href="#"/);
  assert.match(seen.join('\n'), /"Gone" points at page "pg-gone", which is no page/);
  setEditable(true);
  try {
    assert.match(header(ctx), /data-edit="header\.json#\/header\/0\/label"/);
  } finally {
    setEditable(false);
  }
});

test('links: a page by id, an item by id, an href; made into URLs at build time', async () => {
  const { hrefOf, linkProblem } = await import('../src/render/hrefs.js');
  const ctx = ctxWith(base.header);
  assert.equal(hrefOf(ctx, { page: 'pg-lyos' }), '/about/');
  assert.equal(
    hrefOf(ctx, { item: { source: 'people', id: 'p-qw7b' } }),
    '/photography/people/noor-vermeer/',
  );
  assert.equal(hrefOf(ctx, { href: 'mailto:a@b.c' }), 'mailto:a@b.c');
  assert.equal(hrefOf(ctx, 'https://bound.example'), 'https://bound.example'); // a bound value
  assert.equal(hrefOf(ctx, undefined), '');
  const [miss, seen] = warnings(() => hrefOf(ctx, { item: { source: 'people', id: 'p-none' } }));
  assert.equal(miss, '#');
  assert.match(seen.join('\n'), /item "p-none" of "people", which isn't there/);
  assert.equal(linkProblem({ page: 'pg-aaaa' }), null);
  assert.match(linkProblem({ href: '/x/', page: 'pg-aaaa' }), /one of/);
  assert.match(linkProblem('/about/'), /a link/);
});

test('header.json validation: optional logo and CTA', () => {
  const problems = (nav) => checkContent(NAV, { version: 1, ...nav });
  assert.deepEqual(problems({ header: [{ label: 'A', page: 'pg-aaaa' }], logo: 'about/x100v.jpg' }), []);
  assert.deepEqual(
    problems({
      header: [{ label: 'A', page: 'pg-aaaa' }],
      cta: { show: true, label: 'Contact', page: 'pg-lyos' },
    }),
    [],
  );
  // a CTA with no link yet is fine (still being edited)
  assert.deepEqual(problems({ header: [], cta: { show: true, label: 'Hi' } }), []);
  assert.match(problems({ logo: 1 })[0], /"logo" must be a string/);
  assert.match(problems({ cta: 'x' })[0], /"cta" must be an object/);
  assert.match(problems({ cta: { show: 'yes' } })[0], /cta: "show" must be a boolean/);
  assert.match(problems({ cta: { page: 'pg-aaaa', href: '/' } })[0], /cta: one of/);
});

test('render: a logo replaces the site name; a CTA is at the end of the nav and the phone menu', () => {
  const plain = header(ctxWith(base.header));
  assert.match(plain, /<a class="header__logo" href="\/" aria-label="[^"]*">Eeliya Rasta<\/a>/);
  assert.doesNotMatch(plain, /nav__cta/);
  assert.doesNotMatch(phoneMenu(ctxWith(base.header)), /mmenu__cta/);

  const withLogo = ctxWith({ ...base.header, logo: 'about/x100v.jpg' });
  const logoHtml = header(withLogo);
  assert.match(logoHtml, /class="header__logo-img"/);
  assert.match(logoHtml, /src="\/media\/about\/x100v-1600\.webp"/);
  assert.doesNotMatch(logoHtml, /header__logo"[^>]*>Eeliya Rasta/);

  const off = ctxWith({ ...base.header, cta: { show: false, label: 'Contact', page: 'pg-lyos' } });
  assert.doesNotMatch(header(off), /nav__cta/);

  const noLabel = ctxWith({ ...base.header, cta: { show: true, page: 'pg-lyos' } });
  assert.doesNotMatch(header(noLabel), /nav__cta/);

  const on = ctxWith({ ...base.header, cta: { show: true, label: 'Contact', page: 'pg-lyos' } });
  assert.match(
    header(on),
    /<a class="btn glass nav__cta" href="\/about\/" data-nav="\/about\/"><span>Contact<\/span><\/a>/,
  );
  assert.match(
    phoneMenu(on),
    /<a class="btn glass mmenu__cta" href="\/about\/" data-nav="\/about\/"><span>Contact<\/span><\/a>/,
  );

  const noLink = ctxWith({ ...base.header, cta: { show: true, label: 'Hi' } });
  assert.match(header(noLink), /<a class="btn glass nav__cta" href="#"><span>Hi<\/span><\/a>/);
});
