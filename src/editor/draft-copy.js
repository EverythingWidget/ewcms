/**
 * A copy of the unsaved edits in localStorage, per site and file (a page, a source, the
 * header…), so a reload, a crash or a closed tab doesn't throw them away (F80). It is not a save:
 * nothing reaches content/ until Ctrl+S. On load the editor offers it back (Restore / Discard);
 * a save that leaves nothing unsaved, or Discard, clears it.
 *
 *   { t, page, files: { "<file>": { base: "<hash of the file it was made on>", ops: [diff] } } }
 *
 * A file changed on disk since (another hash) is not put back: its edits were made on another
 * version of it.
 */
import { diff, patch } from './lib/diff.js';

const PREFIX = 'ewcms:draft:';

/** The storage key of a site: its address and its name (several sites can share a port). */
export const draftKey = (origin, name) => `${PREFIX}${origin}:${name || ''}`;

/** A short hash of a file's content (which version the edits were made on). */
export function hashOf(data) {
  const s = JSON.stringify(data ?? null);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}:${h.toString(36)}`;
}

/**
 * Keep the store's unsaved edits under `key` (none: the copy goes). Returns the files kept.
 * `page`: the page the editor shows (said when it is offered back).
 */
export function writeDraft(store, storage, key, { now = Date.now(), page = '' } = {}) {
  const files = {};
  for (const f of store.dirtyFiles())
    files[f] = { base: hashOf(store.base[f]), ops: diff(store.base[f], store.current[f]) };
  const kept = Object.keys(files);
  try {
    if (kept.length) storage.setItem(key, JSON.stringify({ t: now, page, files }));
    else storage.removeItem(key);
  } catch {
    return []; // full or blocked: the browser's own prompt still asks before leaving
  }
  return kept;
}

/** The kept copy, or null. */
export function readDraft(storage, key) {
  try {
    const d = JSON.parse(storage.getItem(key) || 'null');
    return d && typeof d.files === 'object' && d.files && Object.keys(d.files).length ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    /* blocked */
  }
}

/**
 * Put a kept copy back on top of the loaded files, one undo step: { restored, skipped } (files
 * changed on disk since, or gone, are skipped).
 */
export function applyDraft(store, draft) {
  const restored = [];
  const skipped = [];
  store.batch(
    () => {
      for (const [f, entry] of Object.entries(draft?.files || {})) {
        const ok =
          f in store.current &&
          entry &&
          Array.isArray(entry.ops) &&
          entry.base === hashOf(store.base[f]);
        if (!ok) skipped.push(f);
        else if (store.set(f, '', patch(store.current[f], entry.ops), { structure: true }))
          restored.push(f);
      }
    },
    { source: 'restore' },
  );
  return { restored, skipped };
}
