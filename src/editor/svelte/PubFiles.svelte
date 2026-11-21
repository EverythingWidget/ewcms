<!--
  The files to publish (the Publish window), grouped as the data layer's status gives them
  (content, sources, templates, theme, media, other) with a count per group. Per file: its
  git status letter (A new, M modified, D deleted), path, then the number of changes for
  content files, +/- lines for text files or the size for binary ones, and an optional note.
  files: [{ path, name?, group?, status, changes?, added?, removed?, bytes?, note? }]
-->
<script>
  import { plural } from '../lib/format.js';
  import { formatBytes, groupFiles } from '../lib/publish-list.js';

  let { files } = $props();

  const LETTERS = { new: 'A', deleted: 'D' };
  const groups = $derived(groupFiles(files));
</script>

<div class="files">
  {#each groups as g (g.group)}
    <p class="pgroup">{g.label} <span class="muted">· {plural(g.files.length, 'file')}</span></p>
    <ul class="list">
      {#each g.files as f (f.path)}
        <li class="pfile">
          <span class={['pfile__st', `is-${f.status}`]}>{LETTERS[f.status] || 'M'}</span>
          <code>{f.path}</code>
          {#if f.name || f.note}
            <span class="muted">· {plural(f.changes || 1, 'change')}{f.note || ''}</span>
          {:else if f.status === 'deleted'}
            <span class="muted">· deleted</span>
          {/if}
          {#if f.bytes !== undefined}
            <span class="pfile__stat muted">{formatBytes(f.bytes)}</span>
          {:else if f.added !== undefined}
            <span class="pfile__stat"
              ><span class="add">+{f.added}</span> <span class="del">−{f.removed}</span></span
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/each}
</div>

<style lang="scss">
  .files {
    margin-bottom: var(--space-4);
  }

  .pgroup {
    margin: var(--space-3) 0 var(--space-1);
    font-weight: 500;

    &:first-child {
      margin-top: 0;
    }
  }

  // Publish modal
  .pfile {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 var(--space-2);

    code {
      color: var(--c-text);
      overflow-wrap: anywhere;
    }
  }

  .pfile__st {
    width: 16px;
    flex: none;
    font-weight: 500;
    color: var(--c-warning);

    &.is-new {
      color: var(--c-success);
    }

    &.is-deleted {
      color: var(--c-error);
    }
  }

  .pfile__stat {
    margin-left: auto;
    font-size: var(--fs-sm);

    .add {
      color: var(--c-success);
    }

    .del {
      color: var(--c-error);
    }
  }
</style>
