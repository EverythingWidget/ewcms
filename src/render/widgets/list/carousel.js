/**
 * The List's Carousel arrangement (step 11): config.arrangement "carousel" shows its items one
 * at a time in a fixed slide box, with a counter, thumbnails, arrows and the slide's credit.
 *
 *   "config": { "arrangement": "carousel", "counter": true, "thumbnails": "photos",
 *               "arrows": true, "credit": true, "slideRatio": "auto", "alsoGrid": true,
 *               "deepLink": true }
 *
 * counter     true (default) | false   "01 / 08", announced (aria-live polite)
 * thumbnails  "photos" (default) | "numbers" | "none"   a strip of buttons to each slide
 * arrows      true (default) | false   previous / next buttons on the slide box
 * credit      true (default) | false   the slide's {credit} under the box ({creditUrl} its link)
 * slideRatio  "auto" (default: the tallest slide's photo, so the box never changes height) |
 *             "4/5" | "3/2" | "16/9"; each photo fits in it
 * alsoGrid    false (default) | true   a Carousel / Grid switch (the grid: columns, gap)
 * deepLink    false (default) | true   "#3" in the page URL opens slide 3; moving updates it
 *
 * Keys (./client.js) only while the carousel has focus: ← → one slide, Home / End, G the grid.
 * Swipe and the wheel (one step per gesture) too. Slides that aren't shown are inert; reduced
 * motion: no fade. The grid and the carousel are both rendered: switching moves nothing else.
 */
import { esc, img, pad, ratio } from '../../helpers.js';
import { isObject } from '../../is.js';

export const CAROUSEL = {
  counter: [true, false],
  thumbnails: ['photos', 'numbers', 'none'],
  arrows: [true, false],
  credit: [true, false],
  slideRatio: ['auto', '4/5', '3/2', '16/9'],
  alsoGrid: [false, true],
  deepLink: [false, true],
};
export const CAROUSEL_KEYS = Object.keys(CAROUSEL);
export const ARRANGEMENTS = ['grid', 'carousel'];

/** The carousel settings of a List's config, each its value or its default. */
export function carouselOf(config) {
  const c = isObject(config) ? config : {};
  return Object.fromEntries(
    CAROUSEL_KEYS.map((k) => [k, CAROUSEL[k].includes(c[k]) ? c[k] : CAROUSEL[k][0]]),
  );
}

/** Problems with a List's arrangement and carousel settings (at: "config"). */
export function carouselProblems(config, at = 'config') {
  const out = [];
  const c = isObject(config) ? config : {};
  if (
    c.arrangement !== undefined &&
    c.arrangement !== 'rows' &&
    !ARRANGEMENTS.includes(c.arrangement)
  )
    out.push(`${at}.arrangement must be "grid" or "carousel"`);
  for (const k of CAROUSEL_KEYS) {
    if (c[k] === undefined) continue;
    if (!CAROUSEL[k].includes(c[k]))
      out.push(`${at}.${k} must be ${CAROUSEL[k].map((v) => JSON.stringify(v)).join(' or ')}`);
    else if (c.arrangement !== 'carousel')
      out.push(`${at}.${k}: a Carousel setting (its "arrangement" is not "carousel")`);
  }
  return out;
}

/** The slide box's ratio: a fixed one, or the tallest of the items' photos (width / height). */
export function slideRatioOf(ctx, setting, items) {
  if (setting !== 'auto') return setting.replace('/', ' / ');
  const rs = items
    .map((it) => (typeof it?.photo === 'string' ? ratio(ctx, it.photo) : 0))
    .filter((r) => r > 0);
  return rs.length ? Math.min(...rs).toFixed(4) : '4 / 5';
}

/**
 * The carousel's markup: `slides` each item's rendered markup, `items` the items (their
 * {photo}, {credit}, {creditUrl}), `grid` the same items as the grid ('' without alsoGrid).
 */
export function carouselHtml(ctx, { id, label, slides, items, grid, set, t }) {
  const n = slides.length;
  const ratioCss = slideRatioOf(ctx, set.slideRatio, items);
  const credit = (it) => String(it?.credit ?? '');
  const creditUrl = (it) => String(it?.creditUrl ?? '');
  const slide = (html, i) =>
    `<div class="car__slide${i ? '' : ' is-active'}" id="${id}-s${i + 1}" role="group" aria-roledescription="${esc(t('carousel.slide'))}" aria-label="${esc(t('carousel.of', { n: i + 1, total: n }))}" data-slide="${i}" data-credit="${esc(credit(items[i]))}" data-credit-url="${esc(creditUrl(items[i]))}"${i ? ' inert' : ''}>${html}</div>`;
  const arrows = set.arrows
    ? `<button class="car__arrow car__arrow--prev glass" type="button" data-car-prev aria-controls="${id}-stage" aria-label="${esc(t('carousel.prev'))}">←</button><button class="car__arrow car__arrow--next glass" type="button" data-car-next aria-controls="${id}-stage" aria-label="${esc(t('carousel.next'))}">→</button>`
    : '';
  const counter = set.counter
    ? `<div class="car__counter" aria-live="polite" aria-atomic="true"><span class="car__current" data-car-current>01</span><span class="car__sep">/</span><span>${pad(n)}</span></div>`
    : '';
  const first = items[0];
  const creditLine = set.credit
    ? `<a class="car__credit label muted" data-car-credit href="${esc(creditUrl(first) || '#')}"${creditUrl(first) ? ' target="_blank" rel="noopener"' : ' aria-hidden="true" tabindex="-1"'}>${esc(credit(first))}</a>`
    : '';
  const thumbs =
    set.thumbnails === 'none'
      ? ''
      : `<ol class="car__thumbs car__thumbs--${set.thumbnails}" data-car-thumbs>${items
          .map((it, i) => {
            const im =
              set.thumbnails === 'photos' && typeof it?.photo === 'string'
                ? img(ctx, it.photo, { decorative: true, sizes: '64px' })
                : '';
            return `<li><button class="car__thumb${i ? '' : ' is-active'}" type="button" data-goto="${i}" aria-controls="${id}-s${i + 1}" aria-label="${esc(t('carousel.show', { n: i + 1 }))}"${i ? '' : ' aria-current="true"'}><span class="car__num">${pad(i + 1)}</span>${im}</button></li>`;
          })
          .join('')}</ol>`;
  const views = grid
    ? `<div class="car__views glass" role="group" aria-label="${esc(t('carousel.view'))}"><button type="button" class="is-active" aria-pressed="true" data-car-view="carousel">${esc(t('carousel.carousel'))}</button><button type="button" aria-pressed="false" data-car-view="grid">${esc(t('carousel.grid'))}</button></div>`
    : '';
  return (
    `<div class="car" data-carousel data-view="carousel" data-count="${n}"${set.deepLink ? ' data-deep-link' : ''} tabindex="0" role="region" aria-roledescription="${esc(t('carousel.carousel'))}" aria-label="${esc(label)}">` +
    `<div class="car__stage" id="${id}-stage" style="--car-ratio:${ratioCss}" data-car-stage>${slides.map(slide).join('')}${arrows}</div>` +
    `<div class="car__bar">${counter}${creditLine}${thumbs}${views}</div>` +
    (grid ? `<div class="car__grid" data-car-grid hidden>${grid}</div>` : '') +
    `</div>`
  );
}

/** A List's config with Arrangement `value`: Grid drops the carousel settings (refused with it). */
export function withArrangement(config, value) {
  const next = { ...(isObject(config) ? config : {}), arrangement: value };
  if (value !== 'carousel') for (const k of CAROUSEL_KEYS) delete next[k];
  return next;
}
