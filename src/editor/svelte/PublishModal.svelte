<!--
  Publish modal: what will be committed (every saved change in the site folder, grouped, plus
  the unsaved edits when "Save first" is ticked), a commit message, then commit + push through
  the data layer (src/editor/data/). Files Publish refuses (secrets, over 95 MB) are listed at
  the top and Publish is off. Shows the result or the error (a conflict with its files); a
  commit that wasn't pushed stays on this machine and can be pushed again. Mounted once in App.svelte, whose Publish buttons check the status first and then
  call openPublish() (modals.svelte.js).
-->
<script>
  import { closeOnBackdrop } from '../lib/modal.js';
  import { contentPath } from '../../render/files.js';
  import Button from './Button.svelte';
  import { tick } from 'svelte';
  import PubFiles from './PubFiles.svelte';
  import { ui } from './ui.svelte.js';
  import { toast } from './toasts.svelte.js';
  import { closeModal, modal } from './modals.svelte.js';
  import { dataLayer } from '../data/index.js';
  import { plural } from '../lib/format.js';
  import { defaultMessage, groupOfName } from '../lib/publish-list.js';

  // live: reactive store (live.svelte.js); actions: save({ quiet }), refreshStatus()
  let { live, actions } = $props();

  let dialog = $state();
  let textarea = $state();
  let pub = $state(null); // the data layer's status() when it opened
  let dirty = $state([]); // files with unsaved edits when it opened
  let edits = $state(0); // number of unsaved edits
  let saveFirst = $state(false);
  let message = $state('');
  let touched = false; // the user typed a message: don't replace it
  let phase = $state(''); // 'Saving…' | 'Publishing…' while busy
  let retry = $state(''); // button label after an error: 'Try again' | 'Retry push'
  let result = $state(null); // { ok: response } or { error }

  const branch = $derived(pub?.branch || 'main');
  // The files the commit will have: the content files' names, the other files, and the list
  // shown (saved files first, then the files with only unsaved edits).
  const others = $derived((pub?.files || []).filter((f) => !f.name));
  const blocked = $derived(pub?.blocked || []);
  const names = $derived(
    [
      ...new Set([
        ...(pub?.files || []).filter((f) => f.name).map((f) => f.name),
        ...(saveFirst ? dirty : []),
      ]),
    ].sort(),
  );
  const listed = $derived([
    ...(pub?.files || []).map((f) => ({
      ...f,
      note:
        saveFirst && dirty.includes(f.name)
          ? ` + ${plural(changes(f.name), 'unsaved change')}`
          : '',
    })),
    ...(saveFirst ? dirty : [])
      .filter((name) => !pub.files.some((p) => p.name === name))
      .map((name) => ({
        path: contentPath(name),
        name,
        group: groupOfName(name),
        status: 'modified',
        changes: changes(name),
        note: ' · unsaved, saved first',
      })),
  ]);
  const published = $derived(!!result?.ok);
  // files to commit (not only commits to push)
  const toCommit = $derived(names.length + others.length);
  const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const changes = (file) => live.store.changes(file).length;

  /** Shown (openPublish, after App.svelte refreshed ui.pub): what will be committed now. */
  async function onopen() {
    pub = $state.snapshot(ui.pub) || { files: [], ahead: 0 };
    dirty = live.store.dirtyFiles();
    edits = live.changes;
    saveFirst = dirty.length > 0;
    touched = false;
    retry = '';
    result = null;
    message = defaultMessage(names, others);
    await tick();
    textarea?.focus();
    textarea?.select();
  }

  function onSaveFirst() {
    if (!touched) message = defaultMessage(names, others);
  }

  async function publish() {
    if (blocked.length) return;
    if (toCommit && !message.trim()) return textarea.focus();
    result = null;
    ui.publishing = true;
    try {
      if (saveFirst && live.store.dirtyFiles().length) {
        phase = 'Saving…';
        if (!(await actions.save({ quiet: true })))
          throw new Error('Saving the unsaved edits failed, nothing was published.');
      }
      phase = 'Publishing…';
      const res = await dataLayer.publish(message.trim());
      result = { ok: res };
      toast(`Published ${res.short}`, {
        kind: 'ok',
        timeout: 0,
        link: { href: res.url, label: 'View commit' },
      });
      ui.status = `Published ${res.short} · ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      result = { error: err };
      if (err.kept) {
        // The commit exists locally: only the push is left.
        saveFirst = false;
        dirty = [];
        pub.files = [];
        pub.ahead = Math.max(1, pub.ahead || 0);
        retry = 'Retry push';
      } else retry = 'Try again';
      ui.status = err.kept ? `Commit ${err.short} not pushed` : 'Publish failed';
    } finally {
      phase = '';
      ui.publishing = false;
      await actions.refreshStatus();
    }
  }
</script>

<dialog
  class="modal__box publish-modal"
  aria-label="Publish to GitHub"
  bind:this={dialog}
  {@attach closeOnBackdrop}
  {@attach modal('publish', { onopen })}
>
  <h3 class="modal__title">Publish to GitHub</h3>
  {#if pub}
    <p class="hint">
      Commits the saved changes in the site folder in <b>one commit</b>, brings in new commits from
      GitHub, and runs <code>git push origin {branch}</code>. Files in
      <code>.gitignore</code> are left out.
    </p>
    {#if blocked.length && !published}
      <div class="pub-hint pub-blocked">
        <p>
          Not published: {blocked.length === 1 ? 'this file' : 'these files'} must not go to GitHub.
        </p>
        <ul class="list">
          {#each blocked as b (b.path)}<li><code>{b.path}</code> {b.reason}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if !published}
      {#if dirty.length}
        <label class="pub-save">
          <input type="checkbox" bind:checked={saveFirst} onchange={onSaveFirst} />
          Save my {plural(edits, 'unsaved edit')} first and include {edits === 1 ? 'it' : 'them'}
        </label>
      {/if}
      {#if toCommit}<PubFiles files={listed} />{/if}
      {#if pub.ahead}
        <p class="hint">
          Also pushes {plural(pub.ahead, 'earlier commit')} not on {pub.upstream ||
            `origin/${branch}`} yet:
        </p>
        <ul class="list commits">
          {#each pub.unpushed || [] as c (c.hash)}<li><code>{c.hash}</code> {c.subject}</li>{/each}
        </ul>
      {/if}
      {#if toCommit}
        <label class="tf">
          <span class="tf__label">Commit message</span>
          <textarea
            class="tf__input"
            bind:this={textarea}
            bind:value={message}
            oninput={() => (touched = true)}></textarea>
        </label>
      {/if}
    {/if}

    {#if result?.ok}
      {@const res = result.ok}
      <p class="pub-ok">
        <i class="fa-solid fa-check" aria-hidden="true"></i> Published
        <a href={res.url} target="_blank" rel="noopener">
          <code>{res.short}</code>
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        </a>
        to origin/{res.branch}
      </p>
      <p class="hint">
        <a href={res.url} target="_blank" rel="noopener" class="pub-url">{res.url}</a>
      </p>
      <p class="hint">
        {res.files?.length
          ? `Committed: ${res.files.join(', ')}`
          : 'Pushed the earlier commits; there were no new changes.'}
        {#if res.pulled}Brought in the new commits from GitHub first.{/if}
      </p>
    {:else if result?.error}
      {@const err = result.error}
      <p class="error">
        {err.kept ? `Commit ${err.short} is on your machine but not pushed.` : err.message}
      </p>
      {#if err.kept}
        <p class="hint">
          {sentence(err.error)}
          {err.conflicts?.length
            ? ''
            : 'The commit stays on your machine; Publish again to retry the push.'}
        </p>
      {/if}
      {#if err.conflicts?.length}
        <ul class="list commits">
          {#each err.conflicts as c (c)}<li><code>{c}</code></li>{/each}
        </ul>
      {/if}
      {#if err.hint}<p class="pub-hint">{err.hint}</p>{/if}
      {#if err.output}<pre class="pub-out">{err.output}</pre>{/if}
    {/if}
  {/if}

  <footer class="modal__actions">
    <Button onclick={() => closeModal('publish')}>
      {published ? 'Close' : 'Cancel'}
    </Button>
    {#if pub && !published}
      <Button
        variant="primary"
        disabled={!!phase || !!blocked.length || (!toCommit && !pub.ahead)}
        onclick={publish}
      >
        {phase || retry || (toCommit ? 'Publish' : `Push ${plural(pub.ahead, 'commit')}`)}
      </Button>
    {/if}
  </footer>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  .error {
    color: var(--c-error);
    margin: var(--space-2) 0 0;
  }

  .pub-save {
    @include row(var(--space-3));
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--amber-300-a08);
    box-shadow: inset 0 0 0 1px var(--amber-300-a25);
    cursor: pointer;

    input {
      accent-color: var(--c-warning);
    }
  }

  .commits {
    margin: -4px 0 var(--space-3);
    gap: var(--space-1);
    @include muted;

    code {
      color: var(--c-link);
    }
  }

  .pub-ok {
    font-size: var(--fs-lg);
    margin: var(--space-3) 0 var(--space-2);
    color: var(--c-success);

    a {
      color: inherit;
    }

    code {
      font-size: var(--fs-md);
      color: inherit;
    }
  }

  .pub-url {
    word-break: break-all;
  }

  .pub-hint {
    margin: var(--space-2) 0;
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--red-300-a08);
    box-shadow: inset 0 0 0 1px var(--red-300-a25);
  }

  .pub-blocked {
    margin: 0 0 var(--space-4);

    p {
      margin: 0 0 var(--space-2);
      color: var(--c-error);
    }

    code {
      color: var(--c-text);
    }
  }

  .pub-out {
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    max-height: 180px;
    overflow: auto;
    border-radius: var(--radius-lg);
    background: var(--black-a50);
    box-shadow: inset 0 0 0 1px var(--c-line);
    font-family: var(--f-mono);
    font-size: var(--fs-sm);
    font-weight: 400;
    line-height: 1.5;
    color: var(--c-error-strong);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
