/**
 * Upload without R2 (POST /__editor/upload when the R2_* keys are missing): the photo is saved in
 * the site's media/ folder, then the local image step runs at once (scripts/images.mjs: rotated
 * upright, metadata stripped, WebP 480/960/1600, blurred placeholder, accent colour), so the
 * photo shows right away. With the R2 keys set, uploads go to R2 as before (scripts/r2.mjs).
 * Answers { status, body } like uploadPhoto: body.key is the photo's media/ path (the value to
 * store in the content), body.local is true.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { IMAGE_TYPES } from './r2.mjs';
import { buildImages } from './images.mjs';
import { loadSiteConfig } from './site-config.mjs';
import { slugify } from '../src/site/helpers.js';

const EXTS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
};

/** "Noor Vermeer 01.JPG" -> "noor-vermeer-01.jpg"; a different photo by that name gets "-<hash>". */
export function localName(dir, name, type, body) {
  const ext = EXTS[type] || 'jpg';
  const base = slugify(String(name || '').replace(/\.[a-z0-9]+$/i, '')).slice(0, 60) || 'photo';
  const plain = `${base}.${ext}`;
  const file = path.join(dir, plain);
  if (!fs.existsSync(file) || fs.readFileSync(file).equals(body)) return plain;
  return `${base}-${createHash('sha256').update(body).digest('hex').slice(0, 10)}.${ext}`;
}

// one image step at a time: two uploads at once must not write the manifest together
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

/** Save one uploaded image in media/ and build its sizes. build: the image step (tests swap it). */
export async function uploadLocal(root, { name, type, body }, { build = buildImages } = {}) {
  if (!IMAGE_TYPES.has(type))
    return {
      status: 415,
      body: {
        error: `Not an image type the site takes (${type || 'unknown'}): JPEG, PNG, WebP, AVIF, GIF or TIFF`,
      },
    };
  if (!body.length) return { status: 400, body: { error: 'Empty file' } };
  const dir = loadSiteConfig(root).mediaDir;
  fs.mkdirSync(dir, { recursive: true });
  const key = localName(dir, name, type, body);
  const file = path.join(dir, key);
  const existing = fs.existsSync(file);
  if (!existing) fs.writeFileSync(file, body);
  try {
    await serial(() => build(root));
  } catch (err) {
    if (!existing) fs.rmSync(file, { force: true });
    return {
      status: 415,
      body: { error: `Could not read ${name || 'the file'} as an image (${err.message})` },
    };
  }
  return { status: 200, body: { ok: true, key, local: true, existing } };
}
