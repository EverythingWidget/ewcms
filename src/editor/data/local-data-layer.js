/**
 * The site's data layer in the browser: load, save, status and publish. The local one talks to
 * the dev server (`npm run dev`), whose /__editor/* routes serve localhost only and call the
 * same data layer on the server (src/editor/server/local-data-layer.mjs). There is no editor in
 * production builds.
 *
 *   load()           → { mode, files: { [name]: data }, media, photos, r2, from }
 *   save(files)      → { ok, written: [name] }                     (files: { name: data })
 *   status()         → { branch, upstream, ahead, unpushed, files: [...] }
 *   publish(message) → { ok, hash, short, url, branch, files, ... }
 *
 * A failed call throws an Error carrying the server's answer ({ error, hint, ... }).
 */
import { json, post } from './http.js';

export function createLocalDataLayer() {
  return {
    async load() {
      let dev;
      try {
        dev = await json('/__editor/content');
      } catch (err) {
        // The dev server answered with its own error (e.g. broken JSON in a content file): show it.
        if (err.error) throw err;
        throw new Error(`The editor only works with the dev server (npm run dev). ${err.message}`, {
          cause: err,
        });
      }
      return { ...dev, mode: 'dev', from: 'local files' };
    },
    save: (files) => post('/__editor/save', { files }),
    /** Saved-but-unpublished changes (git status of the site). */
    status: () => json('/__editor/status'),
    /** Commit the changes in one commit and push it. */
    publish: (message) => post('/__editor/publish', { message }),
  };
}
