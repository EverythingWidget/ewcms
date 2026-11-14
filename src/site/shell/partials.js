import {
  html,
  esc,
  img,
  pad,
  coverOf,
  photosOf,
  ed,
  itemHref,
  firstPhotos,
  sizes,
} from '../helpers.js';
import { sourceFile } from '../files.js';
import { t } from '../strings.js';

/**
 * A widget's head: eyebrow (label) / title / glass CTA. at(key): the widget's editor marker for one
 * of its settings (see widgets/index.js).
 */
export const sectionHead = ({ at, eyebrow, title, href, cta }) => {
  return html`
  <header class="section__head">
    <span class="section__label label" data-anim="section.label"${at('eyebrow')}>${esc(eyebrow)}</span>
    <h2 class="section__title" data-anim="section.title"${at('title')}>${esc(title)}</h2>
    ${href ? html`<a class="btn glass section__cta" href="${esc(href)}"><span${at('cta')}>${esc(cta)}</span> <span aria-hidden="true">→</span></a>` : ''}
  </header>`;
};

/** Album card (People / Places index). Hovering cycles through the first photos. */
export const albumCard = (ctx, kind, album, { landscape = false, index = 0 } = {}) => {
  const at = (key, type) => ed(sourceFile(kind), ['items', index, key], type);
  const meta = [['role'], ['location'], ['year', 'number']].filter(([f]) => album[f]);
  const cover = coverOf(album);
  const first = [cover, ...photosOf(album).filter((p) => p !== cover)].filter(Boolean).slice(0, 4);
  const widths = landscape
    ? sizes('100vw', '50vw')
    : sizes('100vw', '(max-width: 1200px) 50vw, 40vw');
  return html` <a
    class="acard ${landscape ? 'acard--landscape' : ''}"
    href="${esc(itemHref(ctx, kind, album))}"
    data-anim-item
    data-card-cycle
  >
    <div class="acard__media">
      ${first.map((im, i) => img(ctx, im, { decorative: i > 0, sizes: widths, cls: i === 0 ? 'is-active' : '', ...(i === 0 ? firstPhotos(index) : {}) }))}
      <span class="acard__count">${pad(photosOf(album).length)}</span>
    </div>
    <div class="acard__info">
      <h2 class="acard__name" ${at('title')}>${esc(album.title)}</h2>
      <span class="acard__meta"
        >${meta.map(([f, type], i) => html`${i ? ' · ' : ''}<span${at(f, type)}>${esc(album[f])}</span>`)}</span
      >
      ${album.placeholder ? html`<span class="tag">${esc(t(ctx, 'tag.placeholder'))}</span>` : ''}
    </div>
  </a>`;
};
