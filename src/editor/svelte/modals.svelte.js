/**
 * The modals: every window that blocks what is behind it, a native <dialog> opened with
 * showModal (popovers, Popover.svelte, are not modals). Each is mounted once, in App.svelte,
 * and opened through state: open<Name>(params) puts its name on the stack, ui.modals, and its
 * parameters under its name: in ui for Media and Sources (plain data persist.js keeps across a
 * refresh, edited while open), else in argsOf(name) (kept as given: callbacks, the store):
 *
 *   publish        PublishModal.svelte     openPublish()
 *   media          MediaModal.svelte       openMedia({ key, pick, multi })   (media.svelte.js)
 *   sources        SourcesModal.svelte     openSources({ file, index, edit })
 *   widgets        WidgetsModal.svelte     openWidgets({ at, types, onpick })
 *   addPage        AddPageModal.svelte     openAddPage({ level })
 *   itemModal      ItemModal.svelte        openItemModal({ mode, value, ..., onpick, onsource })
 *   previewModal   PreviewModal.svelte     openPreviewModal({ id, onpick })
 *   saveFailed     SaveFailedModal.svelte  openSaveFailed({ message, files })
 *   unsavedEdits   UnsavedEditsModal.svelte  openUnsavedEdits({ t, page, files, onrestore, ondiscard })
 *
 * The stack is the open modals, bottom first. The top one is in front; closing it shows the one
 * below again, as it was (Media opened from a photo field in Sources, Sources opened from a
 * row of the item modal). At most one of each: opening one that is open already closes the
 * ones above it, closing one closes the ones above it too. Esc and the backdrop close the top
 * one only (the browser sends them to the dialog in front).
 *
 * The dialogs follow the stack (syncModals, an effect in App.svelte): showModal's order is the
 * top layer's order, so a dialog shown before one that goes below it is shown again after it.
 * A dialog closed by itself (Esc, its backdrop, its Close button) takes its name off the stack.
 * persist.js keeps Media and Sources open across a refresh.
 */
import { tick, untrack } from 'svelte';
import { ui } from './ui.svelte.js';

export const MODALS = [
  'publish',
  'media',
  'sources',
  'widgets',
  'addPage',
  'itemModal',
  'previewModal',
  'saveFailed',
  'unsavedEdits',
];

/** The stack with `name` on top: when it is open already, the ones above it close. */
export function pushed(stack, name) {
  const at = stack.indexOf(name);
  return at < 0 ? [...stack, name] : stack.slice(0, at + 1);
}

/** The stack without `name` and the ones above it (opened from it). */
export function popped(stack, name) {
  const at = stack.indexOf(name);
  return at < 0 ? stack : stack.slice(0, at);
}

/** Is modal `name` open (anywhere in the stack)? */
export const isOpen = (name) => ui.modals.includes(name);

/** The modal in front, or null. */
export const topModal = () => ui.modals.at(-1) ?? null;

// the parameters of the modals not in ui, as given (not made deeply reactive)
const IN_UI = ['media', 'sources'];
let args = $state.raw({});

/** The parameters modal `name` was opened with (not Media's and Sources': ui.media, ui.sources). */
export const argsOf = (name) => args[name] ?? null;

/** Open modal `name` on top, with its parameters (undefined: keep them). */
export function openModal(name, params) {
  if (!MODALS.includes(name)) throw new Error(`Unknown modal: ${name}`);
  if (params !== undefined) {
    if (IN_UI.includes(name)) ui[name] = params;
    else args = { ...args, [name]: params };
  }
  ui.modals = pushed(ui.modals, name);
}

/** Close modal `name` (the top one by default) and the ones above it. */
export function closeModal(name = topModal()) {
  if (name) ui.modals = popped(ui.modals, name);
}

export const openPublish = () => openModal('publish');

/** Sources on file `file` ('' = the list of files), item `index`, field `edit`. */
export const openSources = ({ file = '', index = 0, edit = null } = {}) =>
  openModal('sources', { file, index, property: '', edit });

/** Add widget to section `at`: onpick(type, at). */
export const openWidgets = ({ at = 0, types = [], onpick }) =>
  openModal('widgets', { at, types, onpick });

/** Add page in folder `level` ('' = the top); `linked`: In the menu at the start. */
export const openAddPage = ({ level = '', linked = true } = {}) =>
  openModal('addPage', { level, linked });

/** The item selector of a source field (its props: SourceField.svelte; at, id: where it opens). */
export const openItemModal = (params) =>
  openModal('itemModal', { at: undefined, id: '', ...params });

/** The item selector of a [param] page's Preview line: page `id`, onpick(path). */
export const openPreviewModal = ({ id, onpick }) => openModal('previewModal', { id, onpick });

/** A save that failed (F80): `message`, the `files` not saved. */
export const openSaveFailed = ({ message, files = [] }) =>
  openModal('saveFailed', { message, files });

/** Unsaved edits kept from an earlier visit (draft-copy.js, F80): Restore or Discard. */
export const openUnsavedEdits = ({ t, page = '', files = [], onrestore, ondiscard }) =>
  openModal('unsavedEdits', { t, page, files, onrestore, ondiscard });

// ---- the dialogs

/** { name: { dialog, onopen, ready } } of the mounted modals */
const dialogs = {};
let mounted = $state(0); // bumped when one mounts or goes, for syncModals

/**
 * The modal's <dialog>: {@attach modal('media', { onopen, ready })}. onopen(dialog): after it is
 * shown (not when only shown again for the order); ready(): may it show yet (its content
 * loaded; until then it and the ones above it wait).
 */
export function modal(name, { onopen = null, ready = null } = {}) {
  return (dialog) => {
    dialogs[name] = { dialog, onopen, ready };
    const onclose = () => !dialog.open && closeModal(name); // closed by itself
    dialog.addEventListener('close', onclose);
    const bump = () => untrack(() => mounted++); // (the attachment's effect doesn't read it)
    bump();
    return () => {
      dialog.removeEventListener('close', onclose);
      if (dialogs[name]?.dialog === dialog) delete dialogs[name];
      bump();
    };
  };
}

/** Show the dialogs of the stack, close the others (App.svelte, in an $effect). */
export function syncModals() {
  mounted;
  const shown = [];
  for (const name of ui.modals) {
    const d = dialogs[name];
    if (!d || (d.ready && !d.ready())) break;
    shown.push(name);
  }
  untrack(() => arrange(shown, dialogs));
}

/**
 * Show modals `names` in that order (bottom first) and close every other one of `dialogs`. One
 * open already stays as it is, unless one below it had to be shown: then it is shown again,
 * so it stays in front.
 */
export function arrange(names, all) {
  for (const [name, { dialog }] of Object.entries(all))
    if (!names.includes(name) && dialog.open) dialog.close();
  let again = false;
  for (const name of names) {
    const { dialog, onopen } = all[name];
    if (dialog.open && !again) continue;
    const fresh = !dialog.open;
    if (!fresh) dialog.close();
    dialog.showModal();
    again = true;
    if (fresh && onopen) tick().then(() => dialog.open && onopen(dialog));
  }
}
