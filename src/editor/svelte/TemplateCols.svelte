<!--
  The template editor's preview columns (preview.columns: 1–6, 1 left out): a compact
  pill in a reserved row above the preview frame (App.svelte), never in Settings. Preview
  only: the item as wide as in a List of this many columns (never a List's own).
-->
<script>
  import Field from './Field.svelte';
  import { ui } from './ui.svelte.js';
  import { templateFile } from '../../site/files.js';
  import {
    previewColumns,
    previewWithColumns,
    templateOfPath,
  } from '../../site/widgets/list/template-preview.js';

  let { live } = $props();

  const COLUMNS = ['1', '2', '3', '4', '5', '6'].map((n) => [n, n]);
  const id = $derived(templateOfPath(ui.path || ''));
  const file = $derived(id ? templateFile(id) : '');
  const tpl = $derived.by(() => {
    live.version;
    return file ? live.current(file) || null : null;
  });
  const setColumns = (v) => {
    if (!file) return;
    live.store.set(file, '/preview', previewWithColumns(tpl?.preview, Number(v)), {
      source: 'panel',
      structure: true,
    });
  };
</script>

{#if id && tpl}
  <div class="ed-cols">
    <span class="ed-cols__label">Columns</span>
    <Field
      edit={`${file}#/preview/columns`}
      label="Columns"
      type="seg"
      bare
      value={String(previewColumns(tpl))}
      options={COLUMNS}
      changed={live.changed(file, '/preview/columns')}
      onvalue={setColumns}
    />
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .ed-cols {
    @include row(var(--space-2));
    height: var(--size-control);
    max-width: 100%;
    padding: 0 var(--space-3);
    border-radius: 999px;
    background: var(--c-surface);
    box-shadow:
      0 0 0 1px var(--c-fill-active),
      0 8px 24px -8px var(--c-scrim);
    color: var(--c-text-muted);
  }

  .ed-cols__label {
    flex: none;
    font-size: var(--fs-sm);
    line-height: 16px;
    white-space: nowrap;
  }

  .ed-cols :global(.tf) {
    flex: 1;
    min-width: 168px;
    margin: 0;
  }
</style>
