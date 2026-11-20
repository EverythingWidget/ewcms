/**
 * The page menu's entries (ui.pages): what the pages list, the page head and Pages' edit pick
 * from. Pure: the content files and the site's routes (live.routes) in, the entries out, so the
 * editor (main.js updatePages) and the mock kit (sandbox/kit/state.js) build the same list.
 */
import { isTemplate, pageFile, pageIdOf, templateFile, templateIdOf } from '../../render/files.js';
import { pageSourceOf } from '../../render/layout/source.js';
import { templateSection } from '../../render/routes.js';
import { templatePreviewPath } from '../../widgets/list/template-preview.js';

/**
 * Page entries, grouped by folder: "/people/" holds the people page and the pages in its
 * folder. A [param] template is one entry ({ template, items }) for all its item pages.
 */
export function pageEntries(files, routes) {
  const ids = Object.keys(files).map(pageIdOf).filter(Boolean);
  const folders = new Set(ids.map((id) => id.slice(0, Math.max(0, id.lastIndexOf('/')))));
  const groupOf = (id) => {
    const folder = folders.has(id) ? id : id.slice(0, Math.max(0, id.lastIndexOf('/')));
    return folder ? `/${folder}/` : 'Pages';
  };
  const entries = [];
  const templates = new Map();
  const template = (id, section) => {
    if (!templates.has(id)) {
      const entry = {
        kind: 'page',
        template: id,
        path: `/${id}`,
        // "People item"; a source without a section title: its [param] ("[person]")
        title: section ? `${section} item` : id.slice(id.lastIndexOf('/') + 1),
        group: groupOf(id),
        items: [],
      };
      templates.set(id, entry);
      entries.push(entry);
    }
    return templates.get(id);
  };
  for (const r of routes) {
    if (r.template) template(r.id, r.section).items.push({ path: r.path, title: r.name });
    else
      entries.push({
        kind: 'page',
        path: r.path,
        title: r.title.split('|')[0].trim(),
        pid: r.pid,
        group: groupOf(r.id),
      });
  }
  // a template whose source has no items yet has no pages, but is still a page to pick
  for (const id of ids)
    if (isTemplate(id)) {
      const folder = id.slice(0, id.lastIndexOf('/')); // "people"
      const source = pageSourceOf(files[pageFile(id)]);
      template(id, templateSection(files[pageFile(folder)], source));
    }
  return entries;
}

/** The item templates (content/templates/t-….json): { kind: 'item-template', id, title, path }. */
export function templateEntries(files) {
  return Object.keys(files)
    .map((f) => templateIdOf(f))
    .filter(Boolean)
    .sort()
    .map((id) => ({
      kind: 'item-template',
      id,
      title: files[templateFile(id)]?.name || id,
      path: templatePreviewPath(id),
    }));
}

/** ui.pages: the site parts (Header, Footer), the item templates, then every page (404 too). */
export const pageMenu = (files, routes) => [
  { kind: 'part', id: 'header', title: 'Header', path: '---' },
  { kind: 'part', id: 'footer', title: 'Footer', path: '---' },
  ...templateEntries(files),
  ...pageEntries(files, routes),
];
