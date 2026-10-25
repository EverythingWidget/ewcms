/**
 * Unsaved edits kept over a reload the editor didn't ask for: the dev server's own full reload
 * (Vite's "vite:beforeFullReload": the engine's code changed, an npm install, a config edit).
 * Content saves never reload the editor (scripts/vite-plugin-static-site.mjs; main.js applies
 * saved and changed content itself). Before such a reload the edits (as changes on their files,
 * lib/diff.js) go to sessionStorage, and the page leaves without the "Reload site?" prompt; the
 * editor's boot puts them back on top of the files it loads, as unsaved edits.
 */
import { diff, patch } from './lib/diff.js';

export const KEY = 'ewcms:unsaved';
const FRESH = 60_000; // a stash older than that is from another visit: dropped

let leaving = false;
/** The page is reloading for the dev server, the edits kept: no beforeunload prompt. */
export const keptForReload = () => leaving;

/** Keep the store's unsaved edits in `storage`; true when there were some. */
export function keepUnsaved(store, storage, now = Date.now()) {
  const files = {};
  for (const f of store.dirtyFiles()) files[f] = diff(store.base[f], store.current[f]);
  if (!Object.keys(files).length) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ t: now, files }));
  } catch {
    return false; // full or blocked: the browser's prompt still asks
  }
  leaving = true;
  return true;
}

/**
 * Put kept edits back on top of the files just loaded (store.load ran); the files they touch,
 * [] when none. One undo step undoes them all.
 */
export function restoreUnsaved(store, storage, now = Date.now()) {
  let kept = null;
  try {
    kept = JSON.parse(storage.getItem(KEY) || 'null');
    storage.removeItem(KEY);
  } catch {
    return [];
  }
  if (!kept || typeof kept.files !== 'object' || !(now - kept.t < FRESH)) return [];
  const touched = [];
  store.batch(
    () => {
      for (const [f, ops] of Object.entries(kept.files)) {
        if (!(f in store.current) || !Array.isArray(ops)) continue;
        if (store.set(f, '', patch(store.current[f], ops))) touched.push(f);
      }
    },
    { source: 'restore' },
  );
  return touched;
}
