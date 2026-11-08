// The List's Carousel arrangement (src/site/widgets/list/carousel.js, carousel-client.js):
// markup and accessibility, keys only on focus, the deep link, credits, {back}, the checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { bindingProblems } from '../src/site/layout/bindings.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import {
  carouselOf,
  carouselProblems,
  slideRatioOf,
  withArrangement,
} from '../src/site/widgets/list/carousel.js';
import {
  carouselClient,
  carouselKey,
  showSlide,
  slideFromHash,
} from '../src/site/widgets/list/carousel-client.js';
import { creditText } from '../src/site/helpers.js';
import { sourcePage } from '../src/site/widgets/data.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const noor = base.sources.people[0];

// a person-page template: {back}, the title, the photos as a carousel beside the body
const personTpl = (inner = {}) => ({
  version: 1,
  kind: 'template',
  label: 'Person',
  source: 'people',
  link: false,
  photoFirst: false,
  widgets: [
    {
      type: 'button',
      role: 'back',
      label: [{ t: '← People' }],
      config: { link: [{ property: 'back' }] },
    },
    {
      type: 'sideBySide',
      role: 'row',
      config: { align: 'top', spacing: 24, phone: 'stack' },
      widgets: [
        {
          type: 'text',
          role: 'title',
          body: [{ style: 'heading', text: [{ property: 'title' }] }],
        },
        {
          type: 'list',
          role: 'photos',
          grow: true,
          source: { mode: 'property', property: 'photos' },
          config: { template: 'preset:photo', arrangement: 'carousel', ...inner },
        },
      ],
    },
  ],
});

let n = 0;
function render({
  config = {},
  tpl = null,
  source = { mode: 'item', from: 'people', id: noor.id },
} = {}) {
  const ctx0 = { ...base, templates: { ...base.templates, ...(tpl ? { 't-pers': tpl } : {}) } };
  const { routes } = buildRoutes(ctx0);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: `w-ca${String(++n).padStart(3, '0')}`, source };
  widget.config = { ...w.config, columns: '1', ...config };
  const ctx = { ...ctx0, route: page, routes, curtains: {} };
  const [html, seen] = warnings(() =>
    renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]),
  );
  const { document, window } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { el: document.querySelector('.wgt--list'), seen, document, window };
}
const photosCarousel = (config = {}) =>
  render({
    config: {
      template: 'preset:photo',
      properties: { photo: 'cover' },
      arrangement: 'carousel',
      ...config,
    },
    source: { mode: 'all', from: 'people' },
  });

test('accessibility: a labelled carousel region, "n of total" slides, others inert, buttons', () => {
  const { el } = photosCarousel({ thumbnails: 'numbers' });
  const car = el.querySelector('[data-carousel]');
  assert.equal(car.getAttribute('role'), 'region');
  assert.equal(car.getAttribute('aria-roledescription'), 'Carousel');
  assert.ok(car.getAttribute('aria-label'));
  assert.equal(car.getAttribute('tabindex'), '0');
  const slides = [...car.querySelectorAll('.car__slide')];
  assert.equal(slides.length, base.sources.people.length);
  slides.forEach((s, i) => {
    assert.equal(s.getAttribute('aria-label'), `${i + 1} of ${slides.length}`);
    assert.equal(s.getAttribute('aria-roledescription'), 'Slide');
    assert.equal(s.hasAttribute('inert'), i > 0);
  });
  for (const b of car.querySelectorAll('.car__arrow, .car__thumb'))
    assert.equal(b.tagName, 'BUTTON');
  const thumbs = [...car.querySelectorAll('.car__thumb')];
  assert.equal(thumbs[0].getAttribute('aria-current'), 'true');
  assert.ok(!thumbs[1].hasAttribute('aria-current'));
  assert.equal(car.querySelector('.car__counter').getAttribute('aria-live'), 'polite');
  assert.equal(el.querySelector('.list').getAttribute('data-arrangement'), 'carousel');
});

test('settings: counter, arrows, thumbnails none, the fixed slide ratio', () => {
  const { el } = photosCarousel({
    counter: false,
    arrows: false,
    thumbnails: 'none',
    slideRatio: '3/2',
  });
  assert.equal(el.querySelector('.car__counter'), null);
  assert.equal(el.querySelector('.car__arrow'), null);
  assert.equal(el.querySelector('.car__thumbs'), null);
  assert.match(el.querySelector('.car__stage').getAttribute('style'), /--car-ratio:3 \/ 2/);
  // auto: the tallest photo's ratio (the smallest width / height), so the box never moves
  const ctx = base;
  const items = noor.photos.map((photo) => ({ photo }));
  assert.match(slideRatioOf(ctx, 'auto', items), /^\d\.\d{4}$/);
  assert.deepEqual(carouselOf({}), {
    counter: true,
    thumbnails: 'photos',
    arrows: true,
    credit: true,
    slideRatio: 'auto',
    alsoGrid: false,
    deepLink: false,
  });
});

test('keys only when the carousel has focus: ← → Home End, G with alsoGrid', () => {
  assert.equal(carouselKey('ArrowRight', 0, 4), 1);
  assert.equal(carouselKey('ArrowLeft', 0, 4), 3);
  assert.equal(carouselKey('Home', 2, 4), 0);
  assert.equal(carouselKey('End', 0, 4), 3);
  assert.equal(carouselKey('g', 0, 4), null);
  assert.equal(carouselKey('g', 0, 4, { alsoGrid: true }), 'grid');
  assert.equal(carouselKey('ArrowRight', 0, 4, { mode: 'grid' }), null);
  const { el, document, window } = photosCarousel({ alsoGrid: true });
  globalThis.location = { hash: '', pathname: '/about/', search: '' };
  globalThis.history = { state: null, replaceState() {} };
  const car = el.querySelector('[data-carousel]');
  const stop = carouselClient(car);
  const key = (target, k) => {
    const e = new window.Event('keydown', { bubbles: true, cancelable: true });
    e.key = k;
    target.dispatchEvent(e);
  };
  // a key on the page (not in the carousel) moves nothing: the listener is on the carousel
  key(document.body, 'ArrowRight');
  assert.equal(car.dataset.index ?? '0', '0');
  key(car, 'ArrowRight');
  assert.equal(car.dataset.index, '1');
  assert.equal(car.querySelector('[data-car-current]').textContent, '02');
  assert.ok(car.querySelectorAll('.car__slide')[0].hasAttribute('inert'));
  assert.ok(!car.querySelectorAll('.car__slide')[1].hasAttribute('inert'));
  assert.equal(car.querySelectorAll('.car__thumb')[1].getAttribute('aria-current'), 'true');
  key(car, 'g');
  assert.equal(car.dataset.view, 'grid');
  assert.equal(car.querySelector('[data-car-grid]').hidden, false);
  key(car, 'G');
  assert.equal(car.dataset.view, 'carousel');
  stop();
});

test('deep link: #3 opens slide 3; moving writes the hash; one deep-linked List per page', () => {
  assert.equal(slideFromHash('#3', 4), 2);
  assert.equal(slideFromHash('#9', 4), null);
  assert.equal(slideFromHash('#noor', 4), null);
  const { el, window } = photosCarousel({ deepLink: true });
  const car = el.querySelector('[data-carousel]');
  assert.ok(car.hasAttribute('data-deep-link'));
  const written = [];
  globalThis.location = { hash: '#3', pathname: '/about/', search: '' };
  globalThis.history = { state: null, replaceState: (s, t, u) => written.push(u) };
  globalThis.window = window;
  const stop = carouselClient(car);
  assert.equal(car.dataset.index, '2');
  car.querySelector('[data-car-next]').dispatchEvent(new window.Event('click'));
  assert.deepEqual(written, ['#4']);
  stop();
  delete globalThis.window;
  // two deep-linked carousels on one page: refused
  const list = (id) => ({
    id,
    type: 'list',
    source: { mode: 'all', from: 'people' },
    config: { template: 'preset:photo', arrangement: 'carousel', deepLink: true },
  });
  const content = {
    ...base,
    pages: { x: { sections: [{ id: 's-aaaa', widgets: [list('w-aaaa'), list('w-bbbb')] }] } },
  };
  const out = bindingProblems(content, { types: WIDGET_TYPES });
  assert.ok(out.some((p) => /one List per page opens a slide/.test(p.message)));
});

test('credits: a photo item gets {credit} and {creditUrl} from photos.json; empty hides it', () => {
  const { el } = photosCarousel();
  const car = el.querySelector('[data-carousel]');
  const first = base.sources.people[0];
  const cr = base.photos[first.cover]?.credit;
  assert.ok(cr, 'the fixture photo has a credit');
  const slide = car.querySelector('.car__slide');
  const credit = car.querySelector('[data-car-credit]');
  assert.equal(credit.textContent, slide.dataset.credit);
  assert.equal(slide.dataset.credit, creditText(cr));
  assert.equal(credit.getAttribute('href'), cr.source);
  assert.equal(credit.getAttribute('target'), '_blank');
  // the client copies a slide's credit; no credit: the line is empty and out of the tab order
  slide.dataset.credit = '';
  slide.dataset.creditUrl = '';
  showSlide(car, 0);
  assert.equal(credit.textContent, '');
  assert.equal(credit.getAttribute('tabindex'), '-1');
  const { el: off } = photosCarousel({ credit: false });
  assert.equal(off.querySelector('[data-car-credit]'), null);
});

test('the person template: {back}, a carousel of the photos in a Side by side', () => {
  const t = personTpl({ alsoGrid: true });
  assert.deepEqual(checkContent('templates/t-pers.json', t), []);
  const { el, seen } = render({ config: { template: 't-pers' }, tpl: t });
  assert.deepEqual(seen, []);
  const back = el.querySelector('.li__back a');
  assert.ok(back, 'a back button');
  assert.equal(back.getAttribute('href'), sourcePage(base, 'people'));
  assert.ok(back.getAttribute('href'));
  const car = el.querySelector('.li__sbs [data-carousel]');
  assert.ok(car, 'the carousel inside the Side by side');
  assert.equal(car.querySelectorAll('.car__slide').length, noor.photos.length);
  assert.equal(car.querySelectorAll('.car__thumb img').length, noor.photos.length);
  assert.ok(car.querySelector('[data-car-grid] .list__items'));
});

test("an item's own back wins over {back}", () => {
  const t = personTpl();
  const people = base.sources.people.map((p, i) => (i ? p : { ...p, back: '/elsewhere/' }));
  const content = { ...base, sources: { ...base.sources, people } };
  const ctx0 = { ...content, templates: { ...content.templates, 't-pers': t } };
  const { routes } = buildRoutes(ctx0);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = {
    ...w,
    id: 'w-cab1',
    source: { mode: 'item', from: 'people', id: noor.id },
    config: { ...w.config, template: 't-pers' },
  };
  const [html] = warnings(() =>
    renderSections({ ...ctx0, route: page, routes, curtains: {} }, page, 'pages/t/index.json', [
      newSection(ids, [widget]),
    ]),
  );
  assert.match(html, /href="\/elsewhere\/"/);
});

test('checks: values, carousel keys refused with Grid, opens, nesting, thumbnails warning', () => {
  assert.deepEqual(carouselProblems({ arrangement: 'carousel', counter: false }), []);
  assert.match(carouselProblems({ arrangement: 'spin' }).join(), /"grid" or "carousel"/);
  assert.match(
    carouselProblems({ arrangement: 'carousel', thumbnails: 'big' }).join(),
    /thumbnails must be/,
  );
  assert.match(
    carouselProblems({ arrangement: 'grid', counter: true }).join(),
    /a Carousel setting/,
  );
  assert.match(carouselProblems({ counter: true }).join(), /a Carousel setting/);
  // Grid drops the carousel settings
  assert.deepEqual(withArrangement({ arrangement: 'carousel', counter: false, gap: 's' }, 'grid'), {
    arrangement: 'grid',
    gap: 's',
  });
  // an inner List takes them too
  assert.match(
    checkContent('templates/t-pers.json', personTpl({ slideRatio: '1/1' })).join(),
    /slideRatio must be/,
  );
  const list = (template, extra = {}) => ({
    id: 'w-aaaa',
    type: 'list',
    source: { mode: 'all', from: 'people' },
    config: { template, arrangement: 'carousel', ...extra },
  });
  const probs = (templates, w) =>
    bindingProblems(
      { ...base, templates, pages: { x: { sections: [{ id: 's-aaaa', widgets: [w] }] } } },
      { types: WIDGET_TYPES },
    ).map((p) => p.message);
  // a carousel inside a carousel
  assert.ok(
    probs({ 't-pers': personTpl() }, list('t-pers')).some((m) =>
      /no carousel inside a carousel/.test(m),
    ),
  );
  // a template that opens
  const opens = {
    ...personTpl(),
    opens: {},
    widgets: [{ type: 'text', body: [{ style: 'label', text: [{ property: 'title' }] }] }],
  };
  assert.ok(
    probs({ 't-open': opens }, list('t-open')).some((m) => /can't use items that open/.test(m)),
  );
  // thumbnails photos without a photo: a warning
  const noPhoto = {
    ...personTpl(),
    widgets: [{ type: 'text', body: [{ style: 'label', text: [{ property: 'title' }] }] }],
  };
  const out = bindingProblems(
    {
      ...base,
      templates: { 't-noph': noPhoto },
      pages: { x: { sections: [{ id: 's-aaaa', widgets: [list('t-noph')] }] } },
    },
    { types: WIDGET_TYPES },
  );
  assert.ok(out.some((p) => p.level === 'warn' && /thumbnails: "photos"/.test(p.message)));
});

test('the editor: Arrangement Grid / Carousel and the carousel rows, disabled with Grid', () => {
  const cfg = WIDGET_TYPES.list.config;
  const rows = cfg.filter((c) => c.disabledWhen);
  assert.deepEqual(
    rows.map((c) => c.label),
    [
      'Counter',
      'Thumbnails',
      'Arrows',
      'Credit',
      'Slide ratio',
      'Also as a grid',
      'Open slide from #n',
    ],
  );
  for (const r of rows) {
    assert.equal(r.disabledWhen({ arrangement: 'grid' }), true);
    assert.equal(r.disabledWhen({ arrangement: 'carousel' }), false);
  }
});
