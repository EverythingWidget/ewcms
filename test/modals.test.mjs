// The modals (src/editor/svelte/modals.svelte.js): every window that blocks what is behind it
// is a native <dialog> opened with showModal, mounted once in App.svelte and opened through
// state, on a stack (Media over Sources, Sources over the item modal; at most one of each).
// Runs the real module: a loader hook compiles the *.svelte.js runes modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { compileModule } from '${import.meta.resolve('svelte/compiler')}';
    export async function load(url, context, next) {
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);

const dir = new URL('../src/editor/svelte/', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');
const m = await import('../src/editor/svelte/modals.svelte.js');
const { ui } = await import('../src/editor/svelte/ui.svelte.js');

// a stand-in <dialog>: open, showModal, close (its close event comes later, as in a browser)
function fakeDialog(name, log) {
  const listeners = [];
  const d = {
    open: false,
    showModal() {
      if (d.open) throw new Error(`${name} is open already`);
      d.open = true;
      log.push(`show ${name}`);
    },
    close() {
      if (!d.open) return;
      d.open = false;
      log.push(`close ${name}`);
      queueMicrotask(() => listeners.forEach((f) => f()));
    },
    addEventListener: (type, f) => type === 'close' && listeners.push(f),
    removeEventListener: () => {},
  };
  return d;
}

test('the stack: pushed puts one on top, at most one of each; popped closes it and those above', () => {
  assert.deepEqual(m.pushed([], 'sources'), ['sources']);
  assert.deepEqual(m.pushed(['sources'], 'media'), ['sources', 'media']);
  // open already: the ones above it close, no second copy
  assert.deepEqual(m.pushed(['itemModal', 'sources', 'media'], 'sources'), [
    'itemModal',
    'sources',
  ]);
  assert.deepEqual(m.pushed(['media'], 'media'), ['media']);
  assert.deepEqual(m.popped(['sources', 'media'], 'media'), ['sources']);
  assert.deepEqual(m.popped(['itemModal', 'sources', 'media'], 'sources'), ['itemModal']);
  assert.deepEqual(m.popped(['sources'], 'media'), ['sources']);
});

test('openModal and closeModal: the top one closes first, one of each, parameters by name', () => {
  ui.modals = [];
  const store = { current: {}, set() {} };
  const onpick = () => {};
  m.openItemModal({ mode: 'item', value: null, store, onpick });
  m.openSources({ file: 'sources/people.json', index: 2 });
  assert.deepEqual(ui.modals, ['itemModal', 'sources']);
  assert.equal(m.topModal(), 'sources');
  assert.equal(m.isOpen('itemModal'), true);
  // the item modal's parameters are kept as given (the store is not made reactive)
  assert.equal(m.argsOf('itemModal').store, store);
  assert.equal(m.argsOf('itemModal').onpick, onpick);
  // Media's and Sources' are in ui (persist.js keeps them)
  assert.equal(ui.sources.file, 'sources/people.json');
  assert.equal(ui.sources.index, 2);
  m.openSources({ file: 'sources/places.json' }); // open already: stays one, on top
  assert.deepEqual(ui.modals, ['itemModal', 'sources']);
  assert.equal(ui.sources.file, 'sources/places.json');
  m.closeModal(); // the top one: back to the item modal
  assert.deepEqual(ui.modals, ['itemModal']);
  m.closeModal('itemModal');
  assert.deepEqual(ui.modals, []);
  m.closeModal(); // nothing open: nothing happens
  assert.deepEqual(ui.modals, []);
  assert.throws(() => m.openModal('publishDialog'), /Unknown modal/);
});

test('openMedia over Sources (a photo field in a source item) keeps Sources under it', async () => {
  const { openMedia } = await import('../src/editor/svelte/media.svelte.js');
  ui.modals = [];
  m.openSources({ file: 'sources/people.json', index: 0 });
  openMedia({ key: 'photos/a.webp', pick: 'sources/people.json#/0/photo' });
  assert.deepEqual(ui.modals, ['sources', 'media']);
  assert.equal(ui.media.key, 'photos/a.webp');
  assert.equal(ui.media.pick, 'sources/people.json#/0/photo');
  assert.equal('open' in ui.media, false); // the stack says what is open
  m.closeModal('media');
  assert.deepEqual(ui.modals, ['sources']);
  ui.modals = [];
});

test('arrange: dialogs shown in stack order, the one in front shown last, the rest closed', async () => {
  const log = [];
  const opened = [];
  const all = Object.fromEntries(
    ['sources', 'media', 'publish'].map((n) => [
      n,
      { dialog: fakeDialog(n, log), onopen: () => opened.push(n) },
    ]),
  );
  m.arrange(['sources'], all);
  m.arrange(['sources', 'media'], all);
  assert.deepEqual(log, ['show sources', 'show media']);
  // Media was shown first (a refresh), Sources goes under it: Media is shown again after it
  log.length = 0;
  m.arrange(['media'], all);
  assert.deepEqual(log, ['close sources']);
  log.length = 0;
  m.arrange(['sources', 'media'], all);
  assert.deepEqual(log, ['show sources', 'close media', 'show media']);
  await Promise.resolve();
  await new Promise((r) => setTimeout(r));
  // onopen once per opening, not when only shown again for the order
  assert.deepEqual(opened, ['sources', 'media', 'sources']);
  log.length = 0;
  m.arrange([], all);
  assert.deepEqual(log.sort(), ['close media', 'close sources']);
});

test('a dialog closed by itself (Esc, its backdrop) takes its name off the stack, the one below stays', async () => {
  const log = [];
  const sources = fakeDialog('sources', log);
  const media = fakeDialog('media', log);
  const off = [m.modal('sources')(sources), m.modal('media')(media)];
  ui.modals = [];
  m.openSources();
  m.openModal('media', { key: '', filter: 'all', pick: '', multi: null });
  m.syncModals();
  assert.deepEqual(log, ['show sources', 'show media']);
  media.close(); // Esc: the browser closes the dialog in front
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(ui.modals, ['sources']);
  m.syncModals();
  assert.equal(sources.open, true);
  // shown again for the order: its close event doesn't take it off
  m.openModal('media');
  ui.modals = ['media', 'sources'];
  m.syncModals();
  ui.modals = ['sources', 'media'];
  m.syncModals();
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(ui.modals, ['sources', 'media']);
  assert.equal(sources.open && media.open, true);
  ui.modals = [];
  m.syncModals();
  off.forEach((f) => f());
});

const MODALS = {
  publish: 'PublishModal',
  media: 'MediaModal',
  sources: 'SourcesModal',
  widgets: 'WidgetsModal',
  addPage: 'AddPageModal',
  itemModal: 'ItemModal',
  previewModal: 'PreviewModal',
};

test('each modal is mounted once, in App.svelte, and is a <dialog> on the stack', () => {
  assert.deepEqual(Object.keys(MODALS), m.MODALS);
  const app = read('App.svelte');
  const files = readdirSync(dir).filter((f) => f.endsWith('.svelte'));
  for (const [name, comp] of Object.entries(MODALS)) {
    const mounts = files.filter((f) => new RegExp(`<${comp}[\\s/>]`).test(read(f)));
    assert.deepEqual(mounts, ['App.svelte'], comp);
    assert.equal(app.match(new RegExp(`<${comp}[\\s/>]`, 'g')).length, 1, comp);
    const src = read(`${comp}.svelte`);
    assert.match(src, /<dialog/, comp);
    assert.match(src, new RegExp(`\\{@attach modal\\('${name}'`), comp);
    assert.doesNotMatch(src, /export (async )?function open\b/, comp); // opened through state
  }
  // showModal only in modals.svelte.js (its order is the stack's)
  for (const f of files) assert.doesNotMatch(read(f), /\.showModal\(/, f);
  // the item modal's field is its own component; Sources has no reopen workaround
  assert.doesNotMatch(read('SourceField.svelte'), /<dialog/);
  assert.doesNotMatch(read('SourcesModal.svelte'), /let after|then\?\.\(\)/);
});

test('names: PublishModal (no PublishDialog), add-page-modal (no apm)', () => {
  assert.equal(existsSync(new URL('PublishDialog.svelte', dir)), false);
  assert.equal(existsSync(new URL('ItemPicker.svelte', dir)), false);
  assert.equal(existsSync(new URL('PreviewPicker.svelte', dir)), false);
  const editor = new URL('../', dir);
  const all = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? all(new URL(`${e.name}/`, d)) : [new URL(e.name, d)],
    );
  for (const f of all(editor).filter((u) => /\.(svelte|js|scss)$/.test(u.pathname))) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /PublishDialog|publishDialog/, f.pathname);
    assert.doesNotMatch(
      src,
      /ItemPicker|PreviewPicker|openItemPicker|openPreviewPicker|\bitemPicker\b|\bpreviewPicker\b/,
      f.pathname,
    );
    assert.doesNotMatch(src, /\bapm\b|apm__/, f.pathname);
    assert.doesNotMatch(src, /ui\.explorer/, f.pathname);
    assert.doesNotMatch(src, /\b(md|src|as|ip|pp)-modal\b/, f.pathname);
  }
  assert.match(read('AddPageModal.svelte'), /class="modal__box add-page-modal"/);
  assert.match(read('PublishModal.svelte'), /class="modal__box publish-modal"/);
  assert.match(read('MediaModal.svelte'), /'media-modal'/);
  assert.match(read('SourcesModal.svelte'), /class="modal__box sources-modal"/);
  assert.match(read('WidgetsModal.svelte'), /class="modal__box widgets-modal"/);
  assert.match(read('ItemModal.svelte'), /class="modal__box item-modal"/);
  assert.match(read('PreviewModal.svelte'), /class="modal__box preview-modal"/);
});

test('Esc in the editor closes the modal in front only', () => {
  const app = read('App.svelte');
  assert.match(app, /if \(topModal\(\)\) \{\s*e\.preventDefault\(\);\s*closeModal\(\);/);
  assert.doesNotMatch(app, /querySelector\('dialog\[open\]'\)/);
});
