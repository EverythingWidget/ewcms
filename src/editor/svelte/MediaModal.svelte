<!--
  Media window: every image the site can use, the ones uploaded to Cloudflare R2
  (content/en/settings/photos.json) and the ones in media/ (the media manifest). Like the
  Pages and Sources windows: the header with where it is, the images left (a grid, filtered
  by All / R2 / Local), the selected one right: a larger preview, its sizes, where the
  content uses it (click to go there) and its alt text, which belongs to the image.
  Upload (or drop files anywhere on the window) resizes and stores them in R2, a few at a
  time, each tile showing how far it is. Opened from an image field (openMedia, with `pick`)
  it offers "Use this image": the field gets the key, one undo step. Delete is only there for
  images nothing uses. Alt text, credit and Delete go straight to disk (source.mediaOp), like uploads.
  Where it is lives in ui.media (persist.js).
-->
<script>
  import { plural } from '../lib/format.js';
  import Button from './Button.svelte';
  import { tick, flushSync } from 'svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import Tabs from './Tabs.svelte';
  import { ui } from './ui.svelte.js';
  import {
    media,
    fallback,
    imageUrl,
    isR2,
    imageInfo,
    imageLine,
    thumbUrl,
  } from './media.svelte.js';
  import { labelFor } from './content-groups.js';
  import { splitEdit } from '../../site/helpers.js';
  import { imageUses } from '../lib/image-uses.js';
  import { appendImages } from '../lib/image-list.js';
  import { parse } from '../lib/pointer.js';
  import { mediaOp, upload } from '../source.js';
  import { toast } from './toasts.svelte.js';
  import { SITE, pageIdOf, sourceIdOf } from '../../site/files.js';
  import { pathOfId } from '../../site/routes.js';

  // live: reactive store (live.svelte.js); bridge: the preview; actions: setPanel, pickTarget
  let { live, bridge, actions } = $props();

  const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff';
  const FILTERS = [
    ['all', 'All'],
    ['r2', 'R2'],
    ['local', 'Local'],
  ];
  // without the R2 keys (media.r2), the window's own words: Upload saves to media/
  const HINTS = {
    all: 'Every image the site can use, in media/. Pick one to see where it is used and to edit its alt text. Drop images on this window to upload them.',
    local:
      "Local images are saved in your site's media/ folder and resized to WebP (480, 960, 1600 px) with their size and colour. Pick one to see where it is used and to edit its alt text.",
    r2: 'Images uploaded to Cloudflare R2 show here once it is set up. Images in media/ are under Local.',
  };
  const R2_HELP = 'https://github.com/EverythingWidget/ewcms#photos-on-cloudflare-r2';
  const uid = $props.id();
  let dialog = $state();
  let confirming = $state(false);
  let busy = $state(false);
  let dropping = $state(false);
  let alt = $state('');
  let credit = $state({ name: '', source: '' });
  // uploads in progress: { id, name, url, progress } (0..1 bytes sent, 1: resizing; null: waiting)
  let pending = $state([]);

  const key = $derived(ui.media.key);
  const keys = $derived(
    [...Object.keys(media.photos).filter(isR2), ...Object.keys(media.manifest).sort()].filter(
      (k) => (ui.media.filter === 'r2' ? isR2(k) : ui.media.filter === 'local' ? !isR2(k) : true),
    ),
  );
  const setUpR2 = $derived(!media.r2 && ui.media.filter === 'r2');
  const known = $derived(!!key && (isR2(key) || !!media.manifest[key]));
  // where the content (with unsaved edits) uses the selected image
  const uses = $derived.by(() => {
    live.version;
    return known ? imageUses(live.store.current, key) : [];
  });
  const pick = $derived(ui.media.pick ? splitEdit(ui.media.pick) : null);
  const current = $derived(pick ? live.get(pick.file, pick.ptr) : undefined);
  // an image list's Add image (openMedia multi): clicks toggle, in pick order; Add appends them
  const multi = $derived(ui.media.multi?.list ? ui.media.multi : null);
  let picked = $state([]);
  const n = $derived(picked.length);

  function toggle(k) {
    picked = picked.includes(k) ? picked.filter((p) => p !== k) : [...picked, k];
    select(picked.includes(k) ? k : (picked.at(-1) ?? ''));
  }

  function addPicked() {
    const { file, ptr } = splitEdit(multi.list);
    const list = appendImages(live.get(file, ptr), picked, multi);
    live.store.set(file, ptr, list, { source: 'panel', structure: true });
    close();
  }

  function select(next) {
    ui.media.key = next;
    confirming = false;
    alt = media.photos[next]?.alt || '';
    credit = { name: '', source: '', ...media.photos[next]?.credit };
  }

  /** Open the window (on its image); pick: see openMedia in media.svelte.js. */
  export function open() {
    picked = [];
    select(ui.media.key);
    flushSync();
    if (!dialog.open) dialog.showModal();
    ui.media.open = true;
    const tile = dialog.querySelector('.mtile.is-selected') || dialog.querySelector('.mtile');
    tile?.focus({ preventScroll: true });
    tile?.scrollIntoView({ block: 'nearest' });
  }

  const loaded = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).length > 0;
  });
  // openMedia() and a refresh (persist.js) set ui.media.open: open then, once loaded.
  $effect(() => {
    if (ui.media.open && loaded && !dialog.open) tick().then(open);
  });

  function close() {
    dialog.close();
  }

  // ---- upload: picked or dropped, two at a time
  function pickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.onchange = () => add([...input.files]);
    input.click();
  }

  let nextId = 0;
  function add(files) {
    const images = files.filter((f) => ACCEPT.split(',').includes(f.type));
    if (images.length < files.length)
      toast(
        `Skipped ${files.length - images.length} file(s): not a JPEG, PNG, WebP, AVIF, GIF or TIFF`,
        {
          kind: 'error',
        },
      );
    const jobs = images.map((file) => ({
      id: ++nextId,
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      progress: null,
    }));
    pending = [...jobs, ...pending];
    run();
  }

  let running = 0;
  async function run() {
    while (running < 2) {
      const job = pending.find((j) => j.progress === null);
      if (!job) return;
      running++;
      send(job).finally(() => {
        running--;
        run();
      });
    }
  }

  async function send(job) {
    const set = (p) =>
      (pending = pending.map((j) => (j.id === job.id ? { ...j, progress: p } : j)));
    set(0);
    try {
      const res = await upload(job.file, set);
      if (res.local) {
        // no R2 keys: saved in media/ and resized there; the fresh list has it
        media.manifest = res.media;
        URL.revokeObjectURL(job.url);
        if (ui.media.filter === 'r2') ui.media.filter = 'local';
      } else {
        media.photos[res.key] = { ...res.photo, ...media.photos[res.key] };
        media.blobs[res.key] = job.url;
        if (ui.media.filter === 'local') ui.media.filter = 'all';
      }
      select(res.key);
      const where = res.local ? 'media/' : 'R2';
      toast(res.existing ? `${job.name} is already in ${where}` : `Uploaded ${job.name}`, {
        kind: 'ok',
        note: res.key,
      });
    } catch (err) {
      URL.revokeObjectURL(job.url);
      toast(`${job.name}: ${err.message}`, { kind: 'error', timeout: 0 });
    } finally {
      pending = pending.filter((j) => j.id !== job.id);
    }
  }

  const drop = {
    ondragover(e) {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      dropping = true;
    },
    ondragleave(e) {
      if (e.target === dialog || !dialog.contains(e.relatedTarget)) dropping = false;
    },
    ondrop(e) {
      e.preventDefault();
      dropping = false;
      add([...e.dataTransfer.files]);
    },
  };

  // ---- the selected image
  async function saveAlt() {
    const text = alt.replace(/\s+/g, ' ').trim();
    if (text === (media.photos[key]?.alt || '')) return;
    try {
      await mediaOp({ op: 'alt', key, alt: text });
      toast(text ? 'Alt text saved' : 'Alt text removed', { kind: 'ok', note: key });
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 0 });
    }
  }

  async function saveCredit() {
    const was = media.photos[key]?.credit || {};
    const next = { ...was, name: credit.name.trim(), source: credit.source.trim() };
    if (next.name === (was.name || '') && next.source === (was.source || '')) return;
    try {
      await mediaOp({ op: 'credit', key, credit: next });
      toast(next.name ? 'Credit saved' : 'Credit removed', { kind: 'ok', note: key });
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 0 });
    }
  }

  async function remove() {
    busy = true;
    try {
      await mediaOp({ op: 'delete', key });
      toast(`Deleted ${imageInfo(key).name}`, { kind: 'ok', note: key });
      delete media.blobs[key];
      select('');
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 0 });
    } finally {
      busy = false;
    }
  }

  async function askDelete() {
    confirming = true;
    await tick();
    dialog.querySelector('.confirm button')?.focus();
  }

  function use() {
    live.store.set(pick.file, pick.ptr, key, { source: 'panel' });
    close();
  }

  /** A use as a row: "Noor Vermeer / image 4" in "people.json" */
  const where = (u) => ({
    name: labelFor(live.store, u).replace(
      /(?:images|images) \/ #?(\d+)(?: \/ src)?$/,
      (_, n) => `image ${Number(n) + 1}`,
    ),
    meta: u.file,
  });

  /** Go to a use: a list item in the Source Explorer, a page's field, a setting. */
  function go(u) {
    close();
    if (u.file === SITE) return actions.setPanel('settings');
    actions.setPanel('nav');
    const parts = parse(u.ptr);
    if (sourceIdOf(u.file)) {
      ui.explorer = {
        open: true,
        file: u.file,
        index: Number(parts[1]) || 0,
        field: parts.slice(2).join('.'),
      };
      return;
    }
    const id = pageIdOf(u.file);
    if (id === null) return;
    const path = pathOfId(id);
    const edit = `${u.file}#${u.ptr}`;
    const pickField = () => {
      const el = bridge.doc?.querySelector(`[data-edit="${CSS.escape(edit)}"]`);
      if (!el) return toast(`${where(u).name} is not shown on ${path}`, { kind: 'error' });
      bridge.focusEdit(edit);
      ui.selection = { edit }; // the Sections tab opens its group and scrolls to it
    };
    if (bridge.path() === path) return pickField();
    // another page: pick the field once the preview has loaded it (and set itself up)
    const shown = ui.previewVersion;
    actions.pickTarget(ui.pages.find((p) => p.path === path) || { kind: 'page', path, title: id });
    let tries = 0;
    const wait = () => {
      if (ui.previewVersion !== shown && bridge.api && bridge.path() === path)
        setTimeout(pickField, 200);
      else if (++tries < 50) setTimeout(wait, 100);
    };
    wait();
  }
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<dialog
  class={['modal__box', 'md-modal', dropping && 'is-drop']}
  aria-label="Media"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && close()}
  onclose={() => (ui.media.open = false)}
  {...drop}
>
  <ExplorerHead
    title="Media"
    icon="fa-images"
    sep="/"
    crumbs={[
      { label: 'media', onclick: () => select('') },
      ...(key ? [{ label: imageInfo(key).name }] : []),
    ]}
    onclose={close}
  />

  <nav class="md-list" aria-label="Images">
    <div class="row md-list__head">
      <Tabs
        class="md-filter"
        role="group"
        label="Show"
        tabs={FILTERS}
        value={ui.media.filter}
        onpick={(v) => (ui.media.filter = v)}
      />
      <Button
        size="small"
        icon="upload"
        title={media.r2
          ? 'Upload images to R2 (or drop them here)'
          : 'Upload images to media/ (or drop them here)'}
        onclick={pickFiles}
      >
        Upload
      </Button>
    </div>
    {#if setUpR2}
      <!-- R2 tab without the R2 keys: how to set it up; Upload saves to media/ meanwhile -->
      <div class="md-setup">
        <i class="fa-solid fa-cloud md-setup__icon" aria-hidden="true"></i>
        <b class="md-setup__title">R2 isn’t set up yet</b>
        <span>
          Images on Cloudflare R2 load from your own image domain. Add these keys to
          <code>.env.local</code> in your site, then restart <code>npm run dev</code>:
        </span>
        <span class="md-setup__keys">
          <code>R2_ACCOUNT_ID</code> <code>R2_ACCESS_KEY_ID</code>
          <code>R2_SECRET_ACCESS_KEY</code> <code>R2_BUCKET</code>
        </span>
        <span>Until then, Upload saves to <code>media/</code> (Local).</span>
        <a class="md-setup__link" href={R2_HELP} target="_blank" rel="noopener">
          How to set up R2 ›
        </a>
      </div>
    {/if}
    <ul class="md-grid">
      {#each pending as job (job.id)}
        <li class="mtile mtile--busy">
          <img src={job.url} alt="" />
          <span class="mtile__state">
            {job.progress === null
              ? 'Waiting…'
              : job.progress < 1
                ? `Uploading ${Math.round(job.progress * 100)}%`
                : 'Resizing…'}
          </span>
        </li>
      {/each}
      {#each keys as k (k)}
        <li>
          <button
            type="button"
            class={[
              'mtile',
              (multi ? picked.includes(k) : k === key) && 'is-selected',
              k === current && 'is-current',
            ]}
            title="{k} · {imageLine(k)}"
            aria-label={imageInfo(k).name}
            aria-current={!multi && k === key}
            aria-pressed={multi ? picked.includes(k) : undefined}
            onclick={() => (multi ? toggle(k) : select(k))}
          >
            <img src={thumbUrl(k)} alt="" loading="lazy" {@attach fallback(k)} />
            {#if multi && picked.includes(k)}
              <span class="mtile__num">{picked.indexOf(k) + 1}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    {#if !keys.length && !pending.length && !setUpR2}
      <p class="hint small">No images here yet: upload some, or drop them on this window.</p>
    {/if}
  </nav>

  <section class="md-detail">
    {#if key && known}
      {@const info = imageInfo(key)}
      <header class="md-detail__head">
        <h4 class="md-detail__title">{info.name}</h4>
        {#if pick}
          <Button
            variant="primary"
            size="small"
            icon="check"
            disabled={key === current}
            onclick={use}
          >
            Use this image
          </Button>
        {/if}
      </header>
      <img class="md-preview" src={imageUrl(key)} alt="" {@attach fallback(key)} />
      <p class="hint small">{imageLine(key)} · {key}</p>

      <label class="tf" for="{uid}-alt">
        <span class="tf__label">Alt text (what the image shows, for screen readers)</span>
        <textarea
          id="{uid}-alt"
          class="tf__input"
          placeholder="e.g. A woman in a white shirt on a balcony"
          bind:value={alt}
          onchange={saveAlt}></textarea>
      </label>
      <div class="md-credit">
        <label class="tf" for="{uid}-credit">
          <span class="tf__label">Credit (photographer)</span>
          <input
            id="{uid}-credit"
            class="tf__input"
            placeholder="empty: none"
            bind:value={credit.name}
            onchange={saveCredit}
          />
        </label>
        <label class="tf" for="{uid}-credit-src">
          <span class="tf__label">Credit link</span>
          <input
            id="{uid}-credit-src"
            class="tf__input"
            placeholder="https://…"
            bind:value={credit.source}
            onchange={saveCredit}
          />
        </label>
      </div>

      <div class="md-uses">
        <span class="tf__label"
          >{uses.length ? `Used in ${plural(uses.length, 'place')}` : 'Not used'}</span
        >
        <ul class="list">
          {#each uses as u (`${u.file}#${u.ptr}`)}
            {@const w = where(u)}
            <li>
              <ExplorerRow
                icon="fa-file-lines"
                enter
                name={w.name}
                meta={w.meta}
                onclick={() => go(u)}
              />
            </li>
          {/each}
        </ul>
      </div>

      {#if !uses.length}
        {#if confirming}
          <div class="confirm">
            Delete {info.name}{info.storage === 'R2'
              ? ' and all its sizes from R2'
              : ' from media/'}?
            <Button size="small" onclick={() => (confirming = false)}>Cancel</Button>
            <Button variant="danger" size="small" icon="trash" disabled={busy} onclick={remove}>
              Delete
            </Button>
          </div>
        {:else}
          <div class="row">
            <Button variant="danger" size="small" icon="trash" onclick={askDelete}>Delete</Button>
          </div>
        {/if}
      {/if}
    {:else if key}
      <p class="hint">{key} is not in media/ or R2 any more.</p>
    {:else}
      <p class="hint">
        {multi
          ? 'Pick the images to add, in order: each one you click gets its number. Click it again to leave it out.'
          : pick
            ? 'Pick an image on the left, or upload one, then Use this image.'
            : media.r2
              ? 'Every image the site can use: uploaded to R2, or in media/. Pick one to see where it is used and to edit its alt text. Drop images on this window to upload them.'
              : HINTS[ui.media.filter] || HINTS.all}
      </p>
    {/if}
  </section>

  {#if multi}
    <!-- a fixed height: the count left, the buttons right -->
    <footer class="md-foot">
      <span class="hint small">{n ? `${n} picked` : 'None picked'}</span>
      <Button size="small" onclick={close}>Cancel</Button>
      <Button variant="primary" size="small" icon="plus" disabled={!n} onclick={addPicked}>
        {n ? `Add ${plural(n, 'image')}` : 'Add images'}
      </Button>
    </footer>
  {/if}
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  // like the Pages and Sources windows: header on top, the images left, the selected one right
  dialog.md-modal {
    width: min(1040px, 92vw);
    height: min(720px, calc(100vh - 64px));
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(320px, 400px);
    grid-template-rows: auto minmax(0, 1fr) auto; // the last: the multi-pick footer
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }

    // files dragged over the window
    &.is-drop {
      box-shadow: inset 0 0 0 2px var(--c-accent);
    }
  }

  .md-list {
    overflow: auto;
    scrollbar-gutter: stable; // the R2 set-up note, short, must not move Upload
    padding: var(--space-4) var(--space-4) var(--space-5);
    border-right: 1px solid var(--c-line);
  }

  .md-list__head {
    justify-content: space-between;
    padding: 0 0 var(--space-3);
  }

  // the R2 tab without the R2 keys (setUpR2)
  .md-setup {
    @include stack(var(--space-3));
    align-items: flex-start;
    margin: var(--space-2) 0;
    padding: var(--space-6) var(--space-5);
    border-radius: var(--radius-md);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    background: color-mix(in srgb, var(--c-text) 4%, transparent);

    code {
      padding: 0 var(--space-1);
      border-radius: var(--radius-sm);
      color: var(--c-text);
      background: color-mix(in srgb, var(--c-text) 7%, transparent);
    }
  }

  .md-setup__icon {
    font-size: var(--fs-lg);
  }

  .md-setup__title {
    font-size: var(--fs-base);
    font-weight: 500;
    color: var(--c-text);
  }

  .md-setup__keys {
    line-height: var(--space-5);
  }

  .md-setup__link {
    color: var(--c-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .md-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--space-2);
  }

  .mtile {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    background: var(--c-control);
    box-shadow: inset 0 0 0 1px var(--c-line);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: filter 0.2s;
    }

    &:hover img {
      filter: brightness(1.15);
    }

    &.is-selected,
    &:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 2px var(--c-accent),
        0 0 0 4px color-mix(in srgb, var(--c-accent) 24%, transparent);
    }

    // the field's image now
    &.is-current::after {
      content: 'in use here';
      position: absolute;
      left: 4px;
      bottom: 4px;
      padding: 0 var(--space-2);
      border-radius: var(--radius-pill);
      font-size: var(--fs-xs);
      line-height: 16px;
      color: var(--c-on-light);
      background: var(--c-text);
    }
  }

  // the pick order (multi-pick): a solid accent badge, top left
  .mtile__num {
    position: absolute;
    left: 4px;
    top: 4px;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-pill);
    font-size: var(--fs-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--c-on-accent);
    background: var(--c-accent);
  }

  // the multi-pick footer: a fixed height, the count left, the buttons right
  .md-foot {
    grid-column: 1 / -1;
    @include row(var(--space-3));
    justify-content: flex-end;
    height: 56px;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--c-line);

    .hint {
      margin: 0 auto 0 0;
    }
  }

  // an upload: the file itself, dimmed, with how far it is
  .mtile--busy {
    cursor: default;

    img {
      filter: brightness(0.4);
    }
  }

  .mtile__state {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: var(--fs-sm);
    color: var(--c-text);
  }

  // one column as wide as the pane (minmax(0, 1fr): a long name, key or use never widens it;
  // they cut or wrap), scrolling up and down only; its head (the name and Use this image)
  // stays at the top while it scrolls, so the button is always there
  .md-detail {
    min-width: 0;
    overflow: hidden auto;
    padding: 0 var(--space-5) var(--space-5);
    @include stack(var(--space-3));
    grid-template-columns: minmax(0, 1fr);
    align-content: start;

    > :global(*) {
      min-width: 0;
    }

    .hint {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  .md-detail__head {
    @include row(var(--space-3));
    position: sticky;
    top: 0;
    z-index: 1;
    min-height: var(--size-control);
    padding-top: var(--space-4);
    padding-bottom: var(--space-2);
    background: var(--c-card); // the window's (.modal__box)

    :global(.btn) {
      flex: none;
    }
  }

  .md-detail__title {
    flex: 1;
    min-width: 0;
    margin: 0;
    @include ellipsis;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--c-text);
  }

  .md-preview {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: var(--c-surface);
  }

  .md-uses {
    display: grid;
  }

  .confirm {
    flex-wrap: wrap;
  }

  .md-credit {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
</style>
