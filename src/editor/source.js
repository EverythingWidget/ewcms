/**
 * The dev server's editor calls besides the data layer (load, save, status and publish are in
 * src/editor/data/): drafts, preview renders, page, template and media ops, uploads.
 * The Vite plugin (src/cli/vite-plugin-static-site.mjs) serves /__editor/* to
 * localhost only. There is no editor in production builds.
 */
import { media } from './svelte/media.svelte.js';
import { json } from './data/http.js';

/**
 * This editor tab's draft session: its preview loads pages with ?draft=<session> and only those
 * render its unsaved edits (another tab, the site itself: the saved files). New per page load.
 */
export const session = crypto.randomUUID();

/** A preview URL (a path) with this tab's draft marker. */
export function withDraft(path) {
  const url = new URL(path, location.origin);
  url.searchParams.set('draft', session);
  return url.pathname + url.search + url.hash;
}

/**
 * The unsaved edits this tab's preview renders from (POST /__editor/draft, draftOp in
 * src/editor/server/editor-server.mjs): { "pages/index.json": data, ... }; {} after a save.
 */
export const draft = (files) =>
  json('/__editor/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, session }),
  });

/**
 * The HTML of sections `ids` of the preview's page, rendered from `data`, its file's edited
 * copy (POST /__editor/render, renderOp in src/editor/server/editor-server.mjs): { html: { id: html } }.
 */
export const render = ({ path, file, data, ids }) =>
  json('/__editor/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, file, data, ids, session }),
  });

/**
 * Add, rename or delete pages and folders in content/en/pages/ (POST /__editor/pages, see
 * pagesOp in src/editor/server/editor-server.mjs): { op: 'add', parent, name, title }, ...
 * Resolves to { id, created, removed } (content file names).
 */
export const pagesOp = (body) =>
  json('/__editor/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * A new item template (POST /__editor/templates, templatesOp in src/editor/server/editor-server.mjs):
 * { op: 'add', data } answers { id, file, data }; { op: 'delete', id } answers { removed }.
 */
export const templatesOp = (body) =>
  json('/__editor/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * The Media window's photo ops (POST /__editor/media, mediaOp in src/editor/server/editor-server.mjs):
 * { op: 'alt', key, alt } or { op: 'delete', key }. Takes the fresh photo lists it answers.
 */
export async function mediaOp(body) {
  const res = await json('/__editor/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  media.photos = res.photos;
  media.manifest = res.media;
  return res;
}

/**
 * Upload a photo (POST /__editor/upload), which the dev server resizes: to Cloudflare R2,
 * resolving to { key, photo }, or without the R2 keys to the site's media/ folder, resolving to
 * { key, local: true, media } (the fresh media/ list). key is the value to store in the content. onprogress(0..1)
 * follows the bytes going up (fetch can't, so XMLHttpRequest); at 1 the server is resizing.
 */
export function upload(file, onprogress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/__editor/upload');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onprogress?.(e.loaded / e.total);
    xhr.upload.onload = () => onprogress?.(1);
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status === 200 && data?.key) resolve(data);
      else reject(new Error(data?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: the dev server did not answer'));
    xhr.send(file);
  });
}
