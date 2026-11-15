/**
 * Toasts: short messages at the bottom left (Toasts.svelte shows them).
 *   toast('Save failed: …', { kind: 'error', timeout: 0 })
 *   toast('Saved', { kind: 'ok', files: ['pages/index.json'], note: '(draft, not published)' })
 * kind: 'info' | 'ok' | 'error'. timeout: ms until it goes away, 0 = stays until dismissed.
 * files are shown as content/<file>; link: { href, label } opens in a new tab; action:
 * { label, run } a button that runs it and closes the toast (undoToast: Undo).
 */
import { MOD } from '../lib/format.js';

export const toasts = $state([]);
let ids = 0;

export function toast(
  text,
  { kind = 'info', timeout = 5000, files = [], note = '', link = null, action = null } = {},
) {
  const id = ++ids;
  toasts.push({ id, text, kind, files, note, link, action });
  if (timeout) setTimeout(() => dismiss(id), timeout);
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

/**
 * "<text> · Undo" after a delete (F10): its Undo takes back that step only, while it is still
 * the last one (after another edit it just closes; MOD+Z still walks back).
 */
export function undoToast(store, text) {
  const step = store.lastStep();
  if (!step) return;
  toast(text, {
    note: `(${MOD}+Z)`,
    timeout: 8000,
    action: { label: 'Undo', run: () => store.lastStep() === step && store.undo() },
  });
}
