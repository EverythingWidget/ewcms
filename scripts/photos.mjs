/**
 * Photo pipeline (optional, but on by default in `npm run dev` / `npm run build`).
 *
 *   media/<any>/<file>.jpg  ──►  public/media/<any>/<file>-<width>.webp   (responsive sizes)
 *                           ──►  .generated/media.json                    (manifest)
 *
 * The manifest stores, per source photo: intrinsic width/height, the generated
 * srcset, a tiny blurred placeholder (LQIP) and the dominant colour, which the
 * templates use for album accents when an album has no explicit `accent`.
 *
 * If `sharp` isn't installed, originals are copied as-is and the site still works
 * (no srcset / placeholders). Outputs are cached: unchanged photos are skipped.
 * Sizes, format and quality: scripts/photo-variants.mjs (shared with uploads to R2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMAT, loadSharp, makeVariants } from './photo-variants.mjs';
import { loadSiteConfig } from './site-config.mjs';

const EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : EXT.test(e.name)
              ? [path.join(dir, e.name)]
              : [],
        )
    : [];

/**
 * The site at `root` (default: the working folder): its media/ photos → public/media sizes and
 * the manifest (.generated/media.json). Returns { files, built }.
 */
export async function buildPhotos(root = process.cwd()) {
  const SITE = loadSiteConfig(root);
  const SRC = SITE.mediaDir;
  const OUT = SITE.publicMediaDir;
  const PUBLIC = SITE.publicDir;
  const MANIFEST = SITE.manifest;
  const sharp = await loadSharp();
  if (!sharp) console.warn('[photos] sharp not available: copying originals without resizing.');

  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const manifest = {};
  const files = walk(SRC);
  let built = 0;

  for (const file of files) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    const base = rel.replace(EXT, '');
    const mtime = fs.statSync(file).mtimeMs;
    const cached = prev[rel];
    const outputsExist =
      cached && cached.srcset.every((s) => fs.existsSync(path.join(PUBLIC, s.url)));
    if (
      cached &&
      cached.mtime === mtime &&
      cached.pipeline === (sharp ? 'sharp' : 'copy') &&
      outputsExist
    ) {
      manifest[rel] = cached;
      continue;
    }
    fs.mkdirSync(path.join(OUT, path.dirname(rel)), { recursive: true });

    if (!sharp) {
      const url = `${SITE.mediaUrl}/${rel}`;
      fs.copyFileSync(file, path.join(OUT, rel));
      manifest[rel] = {
        mtime,
        pipeline: 'copy',
        width: 0,
        height: 0,
        src: url,
        srcset: [{ url, w: 0 }],
        color: null,
        lqip: null,
      };
      continue;
    }

    const v = await makeVariants(sharp, file);
    const srcset = [];
    for (const { w, buffer } of v.sizes) {
      const url = `${SITE.mediaUrl}/${base}-${w}.${FORMAT.ext}`;
      fs.writeFileSync(path.join(PUBLIC, url), buffer);
      srcset.push({ url, w });
    }
    manifest[rel] = {
      mtime,
      pipeline: 'sharp',
      width: v.width,
      height: v.height,
      src: srcset[srcset.length - 1].url,
      srcset,
      color: v.color,
      lqip: v.lqip,
    };
    built++;
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(
    `[images] ${files.length} images, ${built} (re)built → public/media, manifest → .generated/media.json`,
  );
  return { files: files.length, built };
}

// run directly: node scripts/photos.mjs (the site: the working folder)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildPhotos();
