<script>
  /**
   * About (an area that opens a window: ../areas.js): ewcms for this site, a window like Media
   * and Sources (ExplorerHead, the same box). On top, the update (dev only,
   * update.svelte.js): the versions, the changelog, Later / Update; then installing,
   * restarting (the dev server comes back by itself, and so does this editor: Vite reloads
   * it), done or the error. Else Up to date, no buttons. Under it what ewcms is, its site and
   * the engine this site pins (package.json). openAbout() (modals.svelte.js).
   */
  import ExplorerHead from './ExplorerHead.svelte';
  import { closeModal, modal } from './modals.svelte.js';
  import { finishUpdate, later, startUpdate, upd, updating } from './update.svelte.js';

  let dialog = $state();
  const info = $derived(upd.info);
  const phase = $derived(upd.phase);
  const job = $derived(upd.job);
  const changes = $derived(phase === 'done' ? job.changes || [] : info?.changes || []);
  const offer = $derived(phase === 'offer' && !!info?.available);
  const close = () => closeModal('about');
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<dialog
  class="modal__box about-modal"
  aria-label="About"
  bind:this={dialog}
  {@attach modal('about')}
  onclick={(e) => e.target === dialog && close()}
>
  <ExplorerHead title="About" icon="fa-circle-info" crumbs={[{ label: 'ewcms' }]} onclose={close} />

  <div class="about-body">
    <section class="upd" aria-label="Update" aria-live="polite">
      {#if offer}
        <p class="upd__kicker">Update available</p>
        <p class="upd__title">{info.current} → {info.latest}</p>
        <p class="upd__muted">this site · latest tag</p>
      {:else if phase === 'installing'}
        <p class="upd__kicker">Updating…</p>
        <p class="upd__muted">npm install ewcms@{job.to.replace(/^v/, '')}</p>
      {:else if phase === 'restarting'}
        <p class="upd__kicker">Restarting dev server…</p>
        <p class="upd__muted">editor reconnects automatically</p>
      {:else if phase === 'done'}
        <p class="upd__kicker">Updated to {job.to}</p>
        <p class="upd__muted">package.json + lockfile changed — commit when ready</p>
      {:else if phase === 'error'}
        <p class="upd__kicker is-error">Update failed</p>
        <p class="upd__muted">still on {job.from} · nothing changed</p>
      {:else if info?.latest === 'unknown'}
        <p class="upd__kicker is-quiet">Can't check for updates</p>
        <p class="upd__title">{info.current}</p>
        <p class="upd__muted">offline, or GitHub didn't answer</p>
      {:else}
        <p class="upd__kicker is-quiet">Up to date</p>
        <p class="upd__title">{info?.current || 'ewcms'}</p>
        <p class="upd__muted">
          {info?.pin ? 'this site · the latest tag' : 'a linked engine: no updates'}
        </p>
      {/if}

      {#if updating()}
        <div
          class="upd__bar"
          role="progressbar"
          aria-valuenow={upd.pct}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span style:width="{upd.pct}%"></span>
        </div>
      {/if}

      {#if offer || phase === 'done'}
        {#if changes.length}
          <ul class="upd__list">
            {#each changes as c (c.ref + c.text)}
              <li><span class="upd__ref">{c.ref}</span>{c.text}</li>
            {/each}
          </ul>
        {/if}
      {:else if (updating() || phase === 'error') && job.log}
        <pre class="upd__log">{job.log}</pre>
      {/if}

      {#if offer}
        <div class="upd__btns">
          <button type="button" onclick={later}>Later</button>
          <button type="button" class="is-primary" onclick={startUpdate}>Update</button>
        </div>
      {:else if phase === 'done'}
        <div class="upd__btns">
          <button type="button" class="is-primary" onclick={finishUpdate}>Done</button>
        </div>
      {:else if phase === 'error'}
        <div class="upd__btns">
          <button type="button" onclick={() => navigator.clipboard?.writeText(job.log)}
            >Copy log</button
          >
          <button type="button" class="is-primary" onclick={startUpdate}>Retry</button>
        </div>
      {/if}
    </section>

    <dl class="about-info">
      <dt>ewcms</dt>
      <dd>The editor and builder of this site</dd>
      <dt>Website</dt>
      <dd><a href="https://ewcms.org" target="_blank" rel="noreferrer">ewcms.org</a></dd>
      <dt>This site's engine</dt>
      <dd>{info?.pin || 'not pinned in package.json'}</dd>
    </dl>
  </div>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  // like the Media and Sources windows: header on top, the body under it (520px wide)
  dialog.about-modal {
    width: min(520px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  .about-body {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5) var(--space-5);
    overflow: auto;
  }

  // the update (was the footer's update card): a field-toned box
  .upd {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--field-bg);
    font-size: var(--fs-base);

    p {
      margin: 0;
    }
  }

  .upd__kicker {
    color: var(--c-widget-accent);
    font-size: var(--fs-sm);

    &.is-quiet {
      color: var(--text-quiet);
    }

    &.is-error {
      color: var(--c-error);
    }
  }

  .upd__title {
    color: var(--c-text-strong);
    font-size: var(--fs-md);
  }

  .upd__muted {
    color: var(--text-quiet);
    font-size: var(--fs-sm);
  }

  .upd__bar {
    height: 4px;
    margin-top: var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--field-bg);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--c-widget-accent);
      transition: width 0.6s ease;
    }
  }

  .upd__list,
  .upd__log {
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--field-bg);
    font-size: var(--fs-sm);
  }

  .upd__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;

    li {
      display: flex;
      gap: var(--space-3);
      min-width: 0;
    }
  }

  .upd__ref {
    flex: none;
    width: 52px;
    color: var(--c-widget-accent);
  }

  .upd__log {
    color: var(--text-quiet);
    font-family: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .upd__btns {
    display: flex;
    gap: var(--space-1);
    margin-top: var(--space-3);

    button {
      flex: 1;
      height: 32px;
      border: 0;
      border-radius: var(--radius-sm);
      background: var(--field-bg);
      color: var(--text-quiet);
      font: inherit;
      font-size: var(--fs-sm);
      text-transform: uppercase;
      cursor: pointer;

      &:hover {
        background: var(--field-hover);
        color: var(--c-text-strong);
      }

      &.is-primary {
        background: var(--c-text);
        color: var(--black);

        &:hover {
          background: var(--c-text-strong);
        }
      }

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  // what ewcms is: name / value pairs
  .about-info {
    display: grid;
    grid-template-columns: 128px minmax(0, 1fr);
    gap: var(--space-2) var(--space-3);
    margin: 0;
    font-size: var(--fs-sm);
    line-height: 16px;

    dt {
      color: var(--text-quiet);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    a {
      color: var(--c-link);
    }
  }
</style>
