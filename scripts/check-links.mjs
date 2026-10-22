/**
 * Link checker for the built site: every internal link (href and src starting with "/")
 * in dist/**\/*.html must point at a file in dist/ ("/people/x/" -> dist/people/x/index.html).
 * Run after a build: `ewcms check --links` (or `node scripts/check-links.mjs [dist]`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from './site-config.mjs';

const htmlFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });

/** The internal links of the build in `dist`: { count, pages, broken: ["file: attr=url"] }. */
export function checkLinks(dist) {
  dist = path.resolve(dist);
  if (!fs.existsSync(dist)) throw new Error(`No ${dist}: build the site first.`);
  /** The dist file a site URL serves, or null. */
  const target = (url) => {
    let pathname = decodeURIComponent(url.split(/[?#]/)[0]);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(dist, pathname);
    if (!file.startsWith(dist)) return null;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    const index = path.join(file, 'index.html'); // "/people" serves /people/index.html
    return fs.existsSync(index) ? index : null;
  };
  const broken = [];
  let count = 0;
  const pages = htmlFiles(dist);
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [, attr, url] of html.matchAll(/\s(href|src)="(\/[^"]*)"/g)) {
      if (url.startsWith('//')) continue; // protocol-relative: external
      count++;
      const decoded = url.replace(/&amp;/g, '&');
      if (!target(decoded))
        broken.push(`${path.relative(dist, file).split(path.sep).join('/')}: ${attr}="${url}"`);
    }
  }
  return { count, pages: pages.length, broken };
}

// run directly: node scripts/check-links.mjs [dist] (default: the working folder's site's outDir)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { count, pages, broken } = checkLinks(
    process.argv[2] || loadSiteConfig(process.cwd()).outDir,
  );
  if (broken.length) {
    console.error(`${broken.length} broken internal links:\n  ${broken.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`links ok: ${count} internal links in ${pages} pages`);
}
