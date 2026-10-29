<script>
  /**
   * The update notice (dev only, scripts/update.mjs): a quiet "Update available" pill in the
   * header when GitHub has a newer ewcms tag than the site's package.json; its card: the
   * versions, the changelog, Later / Update; then installing, restarting (the dev server comes
   * back by itself, and so does this editor: Vite reloads it), done or the error. The pill sits
   * in the header's gap and the card floats over the panel: nothing moves.
   */
  import { onMount } from 'svelte';

  const KEY = 'ewcms-update';
  let info = $state(null); // GET /__editor/update
  let open = $state(false);
  let phase = $state('offer'); // offer | installing | restarting | done | error
  let job = $state({ log: '', from: '', to: '' });
  let pct = $state(0);
  let timer;

  const api = async (url, opts) => {
    const res = await fetch(`/__editor${url}`, { cache: 'no-store', ...opts });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  };

  onMount(() => {
    const pending = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    api('/update')
      .then((data) => {
        info = data;
        if (pending && pending.boot !== data.boot) {
          // the restarted dev server: the update is done
          job = pending;
          phase = 'done';
          open = true;
          pct = 100;
          sessionStorage.removeItem(KEY);
        } else if (pending) follow(pending.boot);
      })
      .catch(() => {});
    return () => clearTimeout(timer);
  });

  const visible = $derived(info?.available || phase !== 'offer');

  function progress(at) {
    if (phase === 'installing') pct = Math.round(85 * (1 - Math.exp(-(Date.now() - at) / 15000)));
    else if (phase === 'restarting') pct = 90;
  }

  // the job's progress; across the restart: until another dev server answers
  function follow(boot, at = Date.now()) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const s = await api('/update/status');
        if (s.boot !== boot) {
          job = { ...job, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') };
          sessionStorage.removeItem(KEY);
          phase = 'done';
          pct = 100;
          return;
        }
        job = { ...job, log: s.log, from: s.from || job.from, to: s.to || job.to };
        if (s.state === 'error') {
          phase = 'error';
          sessionStorage.removeItem(KEY);
          return;
        }
        if (s.state === 'installing' || s.state === 'restarting') phase = s.state;
      } catch {
        if (phase === 'restarting') job = { ...job, log: 'waiting for the dev server…' };
      }
      progress(at);
      follow(boot, at);
    }, 700);
  }

  async function update() {
    const to = info.latest;
    job = { log: '', from: info.current, to, changes: info.changes, boot: info.boot };
    phase = 'installing';
    pct = 0;
    sessionStorage.setItem(KEY, JSON.stringify(job));
    try {
      const s = await api('/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      job = { ...job, log: s.log };
      if (s.state === 'error') {
        phase = 'error';
        sessionStorage.removeItem(KEY);
        return;
      }
      follow(info.boot);
    } catch (err) {
      job = { ...job, log: err.message };
      phase = 'error';
      sessionStorage.removeItem(KEY);
    }
  }

  function finish() {
    open = false;
    phase = 'offer';
    info = { ...info, available: false };
  }

  const changes = $derived(phase === 'done' ? job.changes || [] : info?.changes || []);
</script>

{#if visible}
  <button
    class="upd-pill"
    type="button"
    aria-expanded={open}
    aria-haspopup="dialog"
    onclick={() => (open = !open)}
  >
    <span class="upd-pill__dot" aria-hidden="true"></span>Update available
  </button>
{/if}

{#if visible && open}
  <div class="upd-card" role="dialog" aria-label="Update ewcms">
    {#if phase === 'offer'}
      <p class="upd-card__kicker">Update available</p>
      <p class="upd-card__title">{info.current} → {info.latest}</p>
      <p class="upd-card__muted">this site · latest tag</p>
    {:else if phase === 'installing'}
      <p class="upd-card__kicker">Updating…</p>
      <p class="upd-card__muted">npm install ewcms@{job.to.replace(/^v/, '')}</p>
    {:else if phase === 'restarting'}
      <p class="upd-card__kicker">Restarting dev server…</p>
      <p class="upd-card__muted">editor reconnects automatically</p>
    {:else if phase === 'done'}
      <p class="upd-card__kicker">Updated to {job.to}</p>
      <p class="upd-card__muted">package.json + lockfile changed — commit when ready</p>
    {:else}
      <p class="upd-card__kicker upd-card__kicker--error">Update failed</p>
      <p class="upd-card__muted">still on {job.from} · nothing changed</p>
    {/if}

    {#if phase === 'installing' || phase === 'restarting'}
      <div
        class="upd-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span style:width="{pct}%"></span>
      </div>
    {/if}

    {#if phase === 'offer' || phase === 'done'}
      {#if changes.length}
        <ul class="upd-list">
          {#each changes as c (c.ref + c.text)}
            <li><span class="upd-list__ref">{c.ref}</span>{c.text}</li>
          {/each}
        </ul>
      {/if}
    {:else if job.log}
      <pre class="upd-log">{job.log}</pre>
    {/if}

    {#if phase === 'offer'}
      <div class="upd-btns">
        <button type="button" onclick={() => (open = false)}>Later</button>
        <button type="button" class="is-primary" onclick={update}>Update</button>
      </div>
    {:else if phase === 'done'}
      <div class="upd-btns">
        <button type="button" class="is-primary" onclick={finish}>Done</button>
      </div>
    {:else if phase === 'error'}
      <div class="upd-btns">
        <button type="button" onclick={() => navigator.clipboard?.writeText(job.log)}
          >Copy log</button
        >
        <button type="button" class="is-primary" onclick={update}>Retry</button>
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .upd-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 24px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-pill);
    // the widget card's tones (a surface of its own: _mixins.scss surface()) in the header
    @include surface(var(--c-widget-card));
    background: var(--field-bg);
    color: var(--c-widget-accent);
    font: inherit;
    font-size: var(--fs-sm);
    white-space: nowrap;
    cursor: pointer;

    &:hover,
    &[aria-expanded='true'] {
      background: var(--field-hover);
      color: var(--c-text-strong);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .upd-pill__dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-round);
    background: var(--c-widget-accent);
  }

  // floats over the panel under the header (.ed-head is its anchor): no layout moves
  .upd-card {
    position: absolute;
    top: 48px;
    left: var(--space-3);
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: min(calc(100% - 24px), 320px);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    @include surface(var(--c-widget-card));
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    color: var(--c-text);
    font-size: var(--fs-base);
  }

  .upd-card p {
    margin: 0;
  }

  .upd-card__kicker {
    color: var(--c-widget-accent);
    font-size: var(--fs-sm);

    &--error {
      color: var(--c-error);
    }
  }

  .upd-card__title {
    color: var(--c-text-strong);
    font-size: var(--fs-md);
  }

  .upd-card__muted {
    color: var(--text-quiet);
    font-size: var(--fs-sm);
  }

  .upd-bar {
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

  .upd-list,
  .upd-log {
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--field-bg);
    font-size: var(--fs-sm);
  }

  .upd-list {
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

  .upd-list__ref {
    flex: none;
    width: 52px;
    color: var(--c-widget-accent);
  }

  .upd-log {
    color: var(--text-quiet);
    font-family: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .upd-btns {
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
</style>
