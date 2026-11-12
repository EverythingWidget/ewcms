/** Load all content files (+ the generated media manifest) into one object. Node only. */
import fs from 'node:fs';
import path from 'node:path';
import {
  FOLDERS,
  LANG_FILES,
  TEMPLATES,
  ROOT_FILES,
  contentFromFiles,
  isContentFile,
  isRootFile,
  templateIdOf,
} from '../src/site/files.js';
import { assertContent, parseContent } from '../src/site/validate.js';
import { setContentDir } from '../src/site/files.js';
import { loadSiteConfig } from './site-config.mjs';

const read = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

/**
 * One content file ("site.json"), parsed and (unless check is false) checked: a
 * mistake throws an error that names the file (and the line, for broken JSON).
 */
export function readContentFile(root, file, { check = true } = {}) {
  const data = parseContent(fs.readFileSync(contentFilePath(root, file), 'utf8'), file);
  if (check) assertContent(file, data);
  return data;
}

/**
 * A content file's path on disk: under the language folder (content/en), the shared files
 * ("site.json", ROOT_FILES) and the templates ("templates/t-….json") at the content root
 * next to it (content/site.json, content/templates/).
 */
export function contentFilePath(root, file) {
  const site = loadSiteConfig(root);
  return isRootFile(file) || templateIdOf(file)
    ? path.join(site.contentRootDir, file)
    : path.join(site.contentDir, file);
}

/**
 * The language folder's settings/ is from before the shared files moved to the content root:
 * an error that says where they go (no migration: move them).
 */
export function assertNoSettingsFolder(root) {
  const site = loadSiteConfig(root);
  const old = path.join(site.contentDir, 'settings');
  if (fs.existsSync(old))
    throw new Error(
      `${site.contentRel}/settings/ is no longer read: its files go to ${site.contentRootRel}/ ` +
        `(${ROOT_FILES.join(', ')}; nav.json is now header.json)`,
    );
}

/** The template files on disk ("templates/t-ab12.json"), sorted. */
export const templateFiles = (root) =>
  walkJson(loadSiteConfig(root).templatesDir)
    .map((n) => `${TEMPLATES}/${n}`)
    .filter((f) => templateIdOf(f));

/**
 * Write a file in one step: a temporary file next to it, then a rename over it, so a crash
 * never leaves half a file. The temporary name ends in .tmp (the dev server ignores those).
 */
export function writeFileAtomic(file, text) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

/**
 * JSON files under dir, recursively, as paths relative to it with "/" separators
 * ("people.json", "people/[person]/index.json"), sorted.
 */
export function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      out.push(...walkJson(path.join(dir, entry.name)).map((f) => `${entry.name}/${f}`));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(entry.name);
  }
  return out.sort();
}

/** Every content file as { "pages/index.json": data, "site.json": data, "pages/people/[person]/index.json": data, ... }. */
export function readContentDir(root) {
  const dir = loadSiteConfig(root).contentDir;
  assertNoSettingsFolder(root);
  const files = {};
  for (const folder of FOLDERS) {
    for (const name of walkJson(path.join(dir, folder))) {
      const file = `${folder}/${name}`;
      if (isContentFile(file)) files[file] = readContentFile(root, file);
    }
  }
  for (const file of LANG_FILES)
    if (fs.existsSync(path.join(dir, file))) files[file] = readContentFile(root, file);
  for (const file of ROOT_FILES)
    if (fs.existsSync(contentFilePath(root, file))) files[file] = readContentFile(root, file);
  for (const file of templateFiles(root)) files[file] = readContentFile(root, file);
  return files;
}

export function loadContent(root, drafts = {}) {
  const site = loadSiteConfig(root);
  setContentDir(site.contentRel);
  return {
    ...contentFromFiles({ ...readContentDir(root), ...drafts }),
    media: read(site.manifest, {}),
  };
}
