/**
 * The template editor's preview (dev only): an item template (content/templates/t-….json)
 * rendered as one List of one sample item on a page of its own, at /__template/<id>/.
 * The sample: the first item of the source the template came from (its "source"), else a
 * hand-made sample item. Never built: the dev middleware alone serves it.
 */
import { isTemplateId } from '../../files.js';

export const TEMPLATE_PREVIEW = '/__template/';
/** The preview's address for template `id`. */
export const templatePreviewPath = (id) => `${TEMPLATE_PREVIEW}${id}/`;
/** The template id of a preview address, '' when it isn't one. */
export function templateOfPath(pathname = '') {
  const m = /^\/__template\/([^/]+)\/$/.exec(pathname);
  return m && isTemplateId(m[1]) ? m[1] : '';
}
/** The synthetic page's id (its file: pages/__template/index.json, never written). */
export const PREVIEW_PAGE = '__template';

/** The sample item's source: the template's own, when it has items; '' for a hand-made one. */
export function sampleSource(content, tpl) {
  const from = typeof tpl?.source === 'string' ? tpl.source : '';
  const list = from && content?.sources?.[from];
  return Array.isArray(list) && list.some((it) => typeof it?.id === 'string') ? from : '';
}

/** The hand-made sample item (no source to take one from). */
export const SAMPLE_ITEM = Object.freeze({ title: 'Sample item', photo: '', source: '', unit: '' });

/**
 * { route, content } for template `id`'s preview (content: a copy with the synthetic page
 * added), null when there is no such template.
 */
export function templatePreview(content, id) {
  const tpl = isTemplateId(id) && content?.templates?.[id];
  if (!tpl) return null;
  const from = sampleSource(content, tpl);
  const first = from && content.sources[from].find((it) => typeof it?.id === 'string');
  const list = {
    id: 'w-tplp',
    type: 'list',
    ...(from ? { source: { mode: 'item', from, id: first.id } } : {}),
    config: {
      template: id,
      columns: '1',
      ...(from ? {} : { handmade: true, items: [{ ...SAMPLE_ITEM }] }),
    },
  };
  const page = {
    id: 'pg-tplp',
    title: tpl.label || id,
    sections: [{ id: 's-tplp', widgets: [list] }],
  };
  const route = {
    path: templatePreviewPath(id),
    id: PREVIEW_PAGE,
    pid: 'pg-tplp',
    page: PREVIEW_PAGE,
    title: tpl.label || id,
    description: '',
    noindex: true,
  };
  return { route, content: { ...content, pages: { ...content.pages, [PREVIEW_PAGE]: page } } };
}
