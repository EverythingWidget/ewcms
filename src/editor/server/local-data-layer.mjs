/**
 * The local data layer: the editor's files on this machine's disk and their git repo. It loads
 * the editable content files, saves them (checked first), tells what changed since the last
 * commit and publishes it (commit + push). The dev server's /__editor/* routes
 * (editor-server.mjs) call it; the browser side is src/editor/data/local-data-layer.js, the
 * same interface:
 *
 *   load()           { mode, files: { [name]: data }, media, photos, r2 }
 *   save(files)      { status, body: { ok, written } | { error, problems } }
 *   status()         the git status of the site (site-git.mjs)
 *   publish(message) { status, body } (site-git.mjs)
 *
 * Only the local one exists for now (a hosted one would answer the same).
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatJSON } from '../lib/json-format.js';
import { loadSiteConfig } from '../../cli/site-config.mjs';
import {
  ANIMATIONS,
  PHOTOS,
  isContentFile,
  LANG_FILES,
  ROOT_FILES,
  itemsOf,
  schemaFile,
  schemaIdOf,
  sourceFile,
  sourceIdOf,
  FOLDERS,
} from '../../render/files.js';
import { checkItems, photoChecker, schemaOf } from '../../render/schemas.js';
import { r2Config } from '../../cli/r2.mjs';
import {
  loadContent,
  assertNoSettingsFolder,
  contentFilePath,
  templateFiles,
  readContentFile,
  walkJson,
  writeFileAtomic,
} from '../../cli/content.mjs';
import { checkContent } from '../../render/validate.js';
import { omitDefaults } from '../../render/defaults.js';
import { bindingProblems } from '../../render/layout/bindings.js';
import { motionProblems } from '../../render/layout/motion.js';
import { WIDGET_TYPES } from '../../widgets/index.js';
import { status, publish, GROUPS, MAX_FILE_BYTES, blockedReason } from './site-git.mjs';

export { status, publish, GROUPS, MAX_FILE_BYTES, blockedReason };

/** The site's content folder, absolute, and from the root with "/" (git paths, messages). */
export const contentDirOf = (root) => loadSiteConfig(root).contentDir;
export const contentRel = (root) => loadSiteConfig(root).contentRel;

/** A content file's path from the site's root with "/" ("content/header.json"): git paths. */
export const diskRel = (root, file) =>
  path.relative(root, contentFilePath(root, file)).split(path.sep).join('/');

/** Editable content files that exist on disk, e.g. "pages/index.json", "site.json" (content file names). */
export function editableFiles(root) {
  assertNoSettingsFolder(root);
  const files = [];
  for (const folder of FOLDERS) {
    for (const name of walkJson(path.join(contentDirOf(root), folder))) {
      const file = `${folder}/${name}`;
      // photos.json belongs to the upload, not to the editor's edits
      if (isContentFile(file) && file !== PHOTOS) files.push(file);
    }
  }
  for (const file of LANG_FILES)
    if (fs.existsSync(path.join(contentDirOf(root), file))) files.push(file);
  // photos.json belongs to the upload, not to the editor's edits
  for (const file of ROOT_FILES)
    if (file !== PHOTOS && fs.existsSync(contentFilePath(root, file))) files.push(file);
  files.push(...templateFiles(root));
  return new Set(files);
}

/**
 * Every editable file's data. Broken JSON throws, naming the file; wrong shapes don't (the
 * editor is where they get fixed, and Save checks them).
 */
export const readContentFiles = (root) =>
  Object.fromEntries(
    [...editableFiles(root)].map((f) => [f, readContentFile(root, f, { check: false })]),
  );

export const mediaFile = (root) => loadSiteConfig(root).manifest;
export const readMediaManifest = (root) =>
  fs.existsSync(mediaFile(root)) ? JSON.parse(fs.readFileSync(mediaFile(root), 'utf8')) : {};

/**
 * Local photos (.generated/media.json, src/cli/photos.mjs): { src, thumb, width, height,
 * sizes } per media/ file.
 */
export function readMedia(root) {
  return Object.fromEntries(
    Object.entries(readMediaManifest(root)).map(([k, m]) => [
      k,
      {
        src: m.src,
        thumb: m.srcset?.[0]?.url || m.src,
        width: m.width,
        height: m.height,
        sizes: m.srcset?.length || 1,
      },
    ]),
  );
}

export const readPhotos = (root) =>
  fs.existsSync(contentFilePath(root, PHOTOS)) ? readContentFile(root, PHOTOS).photos || {} : {};

// ---------------------------------------------------------------- save

/**
 * Problems of the sources among `files` (or whose schema is among them) against their
 * schema (src/render/schemas.js): the schema in `files`, else on disk, else inferred. Photos
 * must be in the media manifest or photos.json.
 */
function sourceProblems(root, files) {
  const names = Object.keys(files);
  const ids = new Set([...names.map(sourceIdOf), ...names.map(schemaIdOf)].filter(Boolean));
  const read = (file) =>
    file in files
      ? files[file]
      : fs.existsSync(contentFilePath(root, file))
        ? readContentFile(root, file, { check: false })
        : undefined;
  const photos = read(PHOTOS)?.photos || {};
  const photoExists = photoChecker(readMediaManifest(root), photos);
  return [...ids].flatMap((id) => {
    const list = itemsOf(read(sourceFile(id)));
    const schema = schemaOf(
      { sources: { [id]: list }, schemas: { [id]: read(schemaFile(id)) } },
      id,
    );
    return checkItems(list, schema, { photoExists }).map(
      (p) => `${contentRel(root)}/${sourceFile(id)}: ${p}`,
    );
  });
}

/**
 * Widgets of the saved pages whose animation isn't in the library (src/render/layout/motion.js):
 * an unknown animation id is a save error. A saved animations.json can break any page.
 */
function motionErrors(root, files) {
  const names = Object.keys(files);
  const content = loadContent(root, files);
  return motionProblems(content, { files: names.includes(ANIMATIONS) ? null : new Set(names) });
}

/**
 * Bindings of the saved pages that don't fit their sources' schemas (src/render/layout/bindings.js;
 * the 'error' level: an unknown source or property, a type that doesn't fit). A saved schema or
 * source can break any page's bindings, so then every page is checked.
 */
function bindingErrors(root, files) {
  const names = Object.keys(files);
  const all = names.some((n) => sourceIdOf(n) || schemaIdOf(n));
  const content = loadContent(root, files);
  return bindingProblems(content, {
    types: WIDGET_TYPES,
    files: all ? null : new Set(names),
  })
    .filter((p) => p.level === 'error')
    .map((p) => p.message);
}

/**
 * Save: write the editor's files ({ "pages/index.json": data, ... }) to content/. Only existing
 * editable files, and only when every one of them has the right shape (src/render/validate.js)
 * and every source fits its schema (sourceProblems): nothing is written otherwise. Each file is written atomically (temp file + rename).
 * Returns { status, body }.
 */
export function save(root, files, onWrite = () => {}) {
  const names = Object.keys(files && typeof files === 'object' ? files : {});
  const editable = editableFiles(root);
  const bad = names.filter((n) => !editable.has(n));
  if (!names.length || bad.length)
    return { status: 400, body: { error: `Not writable: ${bad.join(', ') || '(nothing)'}` } };
  for (const n of names) files[n] = omitDefaults(n, files[n]);
  const shape = names.flatMap((n) =>
    checkContent(n, files[n]).map((p) => `${diskRel(root, n)}: ${p}`),
  );
  const problems = shape.length
    ? shape
    : [...sourceProblems(root, files), ...bindingErrors(root, files), ...motionErrors(root, files)];
  if (problems.length)
    return { status: 400, body: { error: `Not saved. ${problems.join('; ')}`, problems } };
  // what it writes, by path: the dev server knows these changes are the editor's own however
  // late its watcher reports them (vite-plugin-static-site.mjs)
  const texts = new Map(names.map((n) => [contentFilePath(root, n), formatJSON(files[n])]));
  onWrite(texts);
  for (const [file, text] of texts) writeFileAtomic(file, text);
  return { status: 200, body: { ok: true, written: names } };
}

/**
 * The local data layer of the site at `root` (see the top). env: the R2_* variables (whether
 * uploads go to R2); onWrite(texts) runs right before Save writes (the dev server's watcher).
 */
export function createLocalDataLayer(root, { env = {}, onWrite = () => {} } = {}) {
  return {
    load: () => ({
      mode: 'dev',
      files: readContentFiles(root),
      media: readMedia(root),
      photos: readPhotos(root),
      r2: !r2Config(env).missing,
    }),
    save: (files) => save(root, files, onWrite),
    status: () => status(root),
    publish: (message) => publish(root, message),
  };
}
