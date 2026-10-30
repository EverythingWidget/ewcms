/**
 * Image URLs in the editor, resolved like the site does (mediaUrl in src/site/helpers.js):
 * a file in media/ from the media manifest, an R2 key from settings/site.json's mediaUrl
 * (the edited value, so a new URL shows at once), a full URL as is.
 * Both lists come with the content (source.js load()): the media/ manifest as { src, thumb }
 * per file, the R2 images as content/en/settings/photos.json ({ srcset: [{ key, w }], ... } per
 * key; an upload adds its own entry; alt texts of both kinds live there too).
 * The Media window (MediaModal.svelte) lists them all; openMedia() opens it.
 */
import { mediaUrl } from '../../site/helpers.js';
import { SITE } from '../../site/files.js';
import { ui } from './ui.svelte.js';

// blobs: { key: object URL } of images uploaded in this session, shown until R2 serves them;
// r2: are the R2 keys set (else Upload saves to media/)
export const media = $state({ manifest: {}, photos: {}, blobs: {}, r2: false });
let live = null;

/** main.js: the reactive store to read site.json from. */
export const connectMedia = (l) => (live = l);

/** Full-size URL of an image (`src` as stored in the content). */
export const imageUrl = (src) =>
  src
    ? mediaUrl({ media: media.manifest, site: { mediaUrl: live?.get(SITE, '/mediaUrl') } }, src)
    : '';

/** srcset of an R2 image ('' for others: media/ images keep the one they were rendered with). */
export const imageSrcset = (src) =>
  media.photos[src]?.srcset?.map((s) => `${imageUrl(s.key)} ${s.w}w`).join(', ') || '';

/** A small version for a field's thumbnail: the smallest size, else the image itself. */
export const thumbUrl = (src) =>
  media.manifest[src]?.thumb ||
  (media.photos[src]?.srcset ? imageUrl(media.photos[src].srcset[0].key) : imageUrl(src));

/** Is `key` an R2 image (in photos.json with its sizes)? */
export const isR2 = (key) => Array.isArray(media.photos[key]?.srcset);

/**
 * What the editor knows of an image: { name, size, sizes, storage } ('R2' | 'local' | '' when
 * it is in neither list), e.g. size "1600×2000".
 */
export function imageInfo(key) {
  const local = media.manifest[key];
  const r2 = isR2(key) ? media.photos[key] : null;
  const m = local || r2;
  return {
    name: String(key || '')
      .split('/')
      .pop(),
    size: m?.width ? `${m.width}×${m.height}` : '',
    sizes: local ? local.sizes || 1 : r2 ? r2.srcset.length : 0,
    storage: r2 ? 'R2' : local ? 'local' : '',
  };
}

/** "1600×2000 · 3 sizes · R2", or why there is nothing to say. */
export function imageLine(key) {
  const i = imageInfo(key);
  if (!i.storage) return /^https?:/.test(key) ? 'external URL' : 'not in media/ or R2';
  return [i.size, i.sizes > 1 ? `${i.sizes} sizes` : '', i.storage].filter(Boolean).join(' · ');
}

/**
 * An <img> attachment: when the image doesn't load (an upload before the Images address is
 * set), show the uploaded file itself if this session has it.
 */
export const fallback = (key) => (img) => {
  img.onerror = () => {
    const blob = media.blobs[key];
    if (blob && img.src !== blob) img.src = blob;
  };
};

/**
 * Open the Media window (MediaModal.svelte) on image `key`; with `pick` (a field's data-edit,
 * "file#/pointer") it offers "Use this image", which stores the key in that field. With `multi`
 * (an image list's Add image: { list: "file#/pointer" of the list, item: a new item, image: the
 * item's image key, "" when the item is the image itself }) clicks pick several images, in order,
 * and "Add N images" appends them (one undo step).
 */
export function openMedia({ key = '', pick = '', multi = null } = {}) {
  ui.media = { ...ui.media, open: true, key, pick: multi ? '' : pick, multi };
}
