<!--
  Duplicate template / Edit template, under a Template picker (ListLead on a page List,
  TemplateWidgetFields for a List or Summary and details inside a template). Edit template
  opens it; Back returns here (the widget selected, this pop-up on the same tab:
  ui.originStack). Duplicate copies the one picked into a new template file
  (POST /__editor/templates, kept in the store at once) and points the List at it. That
  switch is saved at once when the file had no other unsaved edits; otherwise it stays an
  unsaved edit and the note under the row says "Saved as template t-…". The note line is
  always laid out: no shift.
-->
<script>
  import Button from './Button.svelte';
  import { ui } from './ui.svelte.js';
  import { cloneTemplate } from '../../widgets/list/presets.js';
  import { t } from '../../render/strings.js';
  import { templatesOp } from '../source.js';
  import { dataLayer } from '../data/index.js';
  import { toast } from './toasts.svelte.js';

  /** withFile: "page" or "template", the document the List (or details) is on, for the pending note. */
  let {
    live,
    file,
    templateId,
    setTemplate,
    source = '',
    custom = false,
    withFile = 'page',
    note = $bindable(''),
  } = $props();

  const isOwnTemplate = $derived(typeof templateId === 'string' && templateId.startsWith('t-'));
  const canDuplicate = $derived(!!templateId);
  let duplicating = $state(false);

  async function duplicate() {
    if (duplicating || !templateId) return;
    duplicating = true;
    note = '';
    const pending = live.store.dirtyFiles().includes(file);
    try {
      const ctx = live.content;
      const data = cloneTemplate(ctx, source, templateId, {
        custom,
        open: t(ctx, 'list.open'),
        sep: t(ctx, 'list.sep'),
      });
      const { version: _v, ...body } = data; // eslint-disable-line no-unused-vars
      const res = await templatesOp({ op: 'add', data: body });
      live.store.files({ [res.file]: res.data });
      setTemplate(res.id);
      live.store.seal();
      if (pending)
        note =
          withFile === 'template'
            ? `Saved as template ${res.id}: the switch is saved with the template`
            : `Saved as template ${res.id}: the List's switch is saved with the page`;
      else {
        const sent = { [file]: structuredClone(live.store.current[file]) };
        await dataLayer.save(sent);
        live.store.markSaved([file], sent);
        toast(`Template “${res.data.name}” added and used (content/templates/${res.id}.json)`);
      }
    } catch (err) {
      toast(err.message, { kind: 'error' });
    } finally {
      duplicating = false;
    }
  }
</script>

<div class="ta">
  <div class="ta__actions">
    <Button
      size="small"
      icon="clone"
      title="Copy this template into a new one of the site's (content/templates)"
      disabled={duplicating || !canDuplicate}
      onclick={duplicate}
      data-duplicate
      ><span class="ta__dup"
        ><span class={[isOwnTemplate && 'is-hidden']}>Duplicate</span><span
          class={[!isOwnTemplate && 'is-hidden']}>Duplicate template</span
        ></span
      ></Button
    >
    <!-- always laid out (no shift): hidden while a preset is picked, or none -->
    <span class={['ta__edit', !isOwnTemplate && 'is-hidden']} aria-hidden={!isOwnTemplate}>
      <Button
        size="small"
        icon="pen"
        title="Open this template in the template editor (Templates)"
        disabled={!isOwnTemplate}
        onclick={() => ui.openTemplate?.(templateId, { back: true })}
        data-edit-template>Edit template</Button
      >
    </span>
  </div>
  <p class={['ta__note', !note && 'is-hidden']} data-template-note aria-live="polite">
    {note || ' '}
  </p>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .ta {
    @include stack(var(--gap-rows));
    min-width: 0;
  }

  .ta__actions {
    @include row(var(--space-2));
    flex-wrap: wrap;
  }

  // both labels in one cell: the button keeps the longer one's width
  .ta__dup {
    display: inline-grid;

    > span {
      grid-area: 1 / 1;
    }
  }

  .ta__note {
    min-height: 16px;
    margin: 0;
    color: var(--c-text-muted);
  }

  .ta__dup .is-hidden,
  .ta__edit.is-hidden,
  .ta__note.is-hidden {
    visibility: hidden;
  }
</style>
