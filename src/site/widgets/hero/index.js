/**
 * The built-in Hero widget (hero): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, lines, words, firstImages, sizes } from '../../helpers.js';
import { t } from '../../strings.js';
import { hrefOf } from '../../hrefs.js';

const heroImage = (ctx, widget, p, i) => {
  // phone: its own x / y / w over the desktop's (partly or all); null: hidden on phones
  const mobile = p.phone !== null;
  const ph = { x: p.x, y: p.y, w: p.w, ...(p.phone || {}) };
  const style = `--x:${p.x}%;--y:${p.y}%;--w:${p.w}vw;${mobile ? `--mx:${ph.x}%;--my:${ph.y}%;--mw:${ph.w}vw;` : ''}`;
  if (!p.src) return '';
  return html` <a
    class="scatter scatter--${p.layer === 'front' ? 'front' : 'back'}${mobile ? '' : ' scatter--desktop'}"
    href="${esc(hrefOf(ctx, p.link, 'a hero image'))}"
    style="${style}"
    data-depth="${p.depth}"
    aria-label="${esc(p.label)}"
  >
    <span class="scatter__drift"
      ><span class="scatter__frame">
        ${img(ctx, p.src, { decorative: true, sizes: sizes(`${mobile ? ph.w : 30}vw`, `${p.w}vw`), ...firstImages(i), attrs: widget.ed(['images', i, 'src'], 'image') })}
      </span></span
    >
  </a>`;
};

/**
 * Characters in the name's longest word: the theme caps the name's size by it (hero__title in
 * theme-default/styles/_home.scss), so a long name wraps between words and its longest word
 * still fits the screen.
 */
export const longestWord = (text) =>
  Math.max(
    1,
    ...String(text ?? '')
      .trim()
      .split(/\s+/)
      .map((w) => [...w].length),
  );

/** The Hero's looks (style): the first image beside the name or behind it, or all scattered. */
export const HERO_STYLES = [
  ['beside', 'Image beside'],
  ['behind', 'Image behind'],
  ['scattered', 'Scattered'],
];
const styleOf = (s) => (HERO_STYLES.some(([v]) => v === s.style) ? s.style : 'scattered');

// beside / behind: the first image with a file, one big image (no scatter, no drift)
const leadImage = (ctx, widget, images, look) => {
  const i = images.findIndex((p) => p?.src);
  if (i < 0) return '';
  return html`<div class="hero__image">
    ${img(ctx, images[i].src, { decorative: true, sizes: look === 'beside' ? '50vw' : '100vw', ...firstImages(0), attrs: widget.ed(['images', i, 'src'], 'image') })}
  </div>`;
};

/**
 * The big name with images (style: beside | behind | scattered, see HERO_STYLES; scattered when
 * unset) (images: [{ src, link, label, x, y, w, phone?: { x?, y?, w? } | null, depth?, layer? }]). */
export const hero = {
  type: 'hero',
  label: 'Hero',
  icon: 'star',
  line: 'Your name with an image beside or behind it, or images scattered around',
  sketch: 'hero',
  fields: [
    { key: 'style', label: 'Style', type: 'seg', options: HERO_STYLES, unset: 'scattered' },
    { key: 'title', label: 'Name', type: 'words', width: 'half' },
    { key: 'eyebrow', label: 'Eyebrow', width: 'half' },
    { key: 'body', label: 'Subline', type: 'multiline' },
    {
      key: 'images',
      label: 'Images',
      list: { src: 'image', link: { type: 'link', label: 'Link' } },
      // a new image: in the middle, behind the name (x / y / w in % of the hero; see heroImage)
      item: { src: '', x: 40, y: 30, w: 16, depth: 1 },
    },
  ],
  // added from the editor: the section's whole width and about a screen under the menu (68 rows
  // of 12px at 1440px wide, the viewport's 900px less the header), not the usual 40 × 6
  added: { span: 'all', rows: 68 },
  defaults: { style: 'scattered', title: 'Your name', eyebrow: '', body: '', images: [] },
  render: (s, ctx, widget) => {
    const look = styleOf(s);
    return html` <div class="hero hero--${look}" data-hero>
      ${
        look === 'scattered'
          ? html`<div class="hero__images" data-anim="hero.images">
            ${(s.images || []).map((p, i) => heroImage(ctx, widget, p, i))}
          </div>`
          : leadImage(ctx, widget, s.images || [], look)
      }
      <h1
        class="hero__title"
        data-anim="hero.title"
        style="--hero-word: ${longestWord(s.title ?? ctx.site.name)}"
      >
        <span class="hero__name" ${widget.ed('title', 'words')}
          >${words(s.title ?? ctx.site.name)}</span
        >
      </h1>
      <div class="hero__meta" data-anim="hero.meta">
        <span class="label" ${widget.ed('eyebrow')}>${esc(s.eyebrow)}</span>
        <span class="hero__scroll label" aria-hidden="true"><i></i>${esc(t(ctx, 'hero.scroll'))}</span>
        <p class="hero__subline" ${widget.ed('body', 'multiline')}>${lines(s.body)}</p>
      </div>
    </div>`;
  },
};

export default hero;
