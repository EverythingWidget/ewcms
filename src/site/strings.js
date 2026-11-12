/**
 * UI text of the public site: the core's English defaults, under the site's own
 * strings.json (content folder). A site sets only what it changes; a missing key falls back
 * to these. Placeholders in braces ("Show photo {n}") are filled by t().
 *
 *   t(ctx, 'album.prev')               "Previous photo"
 *   t(ctx, 'album.show', { n: 3 })     "Show photo 3"
 *
 * Widget content (titles, buttons a widget's settings hold) is not here: it is the page's.
 */
import { isObject } from './is.js';

export const CORE_STRINGS = Object.freeze({
  page: { skip: 'Skip to content' },
  header: {
    menu: 'Menu',
    close: 'Close',
    clock: '',
    home: '{name}, home',
    main: 'Main',
    phone: 'Phone',
  },
  tag: { placeholder: 'Placeholder' },
  hero: { scroll: 'Scroll' },
  album: {
    photos: '{title} photos',
    slide: '{n} of {total}',
    prev: 'Previous photo',
    next: 'Next photo',
    show: 'Show photo {n}',
    open: 'Open photo {n}',
    view: 'View mode',
    slider: 'Slider',
    grid: 'Grid',
  },
  // the List's Carousel arrangement (widgets/list/carousel.js)
  carousel: {
    carousel: 'Carousel',
    slide: 'Slide',
    of: '{n} of {total}',
    prev: 'Previous slide',
    next: 'Next slide',
    show: 'Show slide {n}',
    view: 'View mode',
    grid: 'Grid',
  },
  projects: { visit: 'Visit' },
  list: { empty: 'Nothing here yet.', open: 'View', seeAll: 'See all', sep: ' · ' },
  // the editor's hint and tag on a widget whose every property is empty (./layout/missing.js)
  widget: {
    noValue: 'No value for {names}',
    needs: 'Needs {names}',
    hidden: 'Hidden on the page',
    empty: 'Empty on the page',
  },
  form: {
    honeypot: 'Leave this empty',
    submit: 'Send',
    sent: 'Sent.',
    error: 'Not sent. Please try again.',
    required: 'Please fill this in.',
    invalid: 'Please enter a valid email address.',
  },
});

/** The site's strings.json over the core defaults (one level of groups, like strings.json). */
export function stringsOf(own = {}) {
  const out = {};
  for (const [group, values] of Object.entries(CORE_STRINGS)) out[group] = { ...values };
  for (const [group, values] of Object.entries(isObject(own) ? own : {}))
    if (isObject(values)) out[group] = { ...out[group], ...values };
  return out;
}

const fill = (s, vars) =>
  vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : String(s);

/** A string by "group.key" from ctx.strings (else the core default), placeholders filled. */
export function t(ctx, key, vars) {
  const [group, name] = key.split('.');
  const own = ctx?.strings?.[group]?.[name];
  return fill(own ?? CORE_STRINGS[group]?.[name] ?? key, vars);
}
