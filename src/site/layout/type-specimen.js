/**
 * Site Settings › Type's Preview (dev only): the type scale on a page of its own, at /__type/.
 * One full-width section of one Text widget per style (src/site/text.js LINE_STYLES), each the
 * width of the grid, following the one before 4 rows down, its text the style's name and tag
 * ("Heading · H2"). Made here from the content, never a file: the dev middleware alone serves
 * it, the build never does.
 */
import { LINE_STYLES } from '../text.js';

export const TYPE_SPECIMEN = '/__type/';
/** Is `pathname` the type specimen's address? */
export const isTypeSpecimen = (pathname = '') => pathname === TYPE_SPECIMEN;
/** The synthetic page's id (its file: pages/__type/index.json, never written). */
export const SPECIMEN_PAGE = '__type';

/** The specimen page: { sections } with one Text widget per style. */
export function specimenPage() {
  const widgets = LINE_STYLES.map(([style, label, tag], i) => ({
    id: `w-${style}`,
    type: 'text',
    body: [{ style, text: [{ t: `${label} · ${tag.toUpperCase()}` }] }],
    layout: {
      base:
        i === 0
          ? { col: 1, span: 120, row: 1 }
          : { col: 1, span: 120, link: { to: `w-${LINE_STYLES[i - 1][0]}`, gap: 4 } },
    },
  }));
  return { id: 'pg-type', sections: [{ id: 's-type', width: 'full', widgets }] };
}

/** { route, content } for the specimen (content: a copy with the synthetic page added). */
export function typeSpecimen(content) {
  const route = {
    path: TYPE_SPECIMEN,
    id: SPECIMEN_PAGE,
    pid: 'pg-type',
    page: SPECIMEN_PAGE,
    title: 'Type',
    description: '',
    noindex: true,
  };
  const pages = { ...content?.pages, [SPECIMEN_PAGE]: specimenPage() };
  return { route, content: { ...content, pages } };
}
