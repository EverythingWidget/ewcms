<!--
  A widget's source, first in its Content tab (WidgetInspector.svelte; src/site/layout/source.js):
    Source       Item / All (a list widget) · From URL · None · Custom (a List: the old Hand-made
                 mode), one segmented row; From URL only on a [param] page (greyed elsewhere, its
                 tooltip says why). The Source label sits in the parent when provided (ListLead).
    the item     Item: the item selector (ItemPicker.svelte, an item); All and From URL: its
                 source (the same selector, a list)
    Match the address
                 From URL: a row per param of the page's address, [ where | [person] | = | property ▾ ]:
                 the source property it must equal (default: the property of the same name, else
                 slug),
                 or Any (no rule: not filtered; not on the main widget, the menu says why). A
                 property the source doesn't have: the row in red and a note under the rows
    what it shows  one line: how many items match (the properties show the first)
    Main widget   on a [param] page: a switch, on: this widget decides which pages exist (the
                 page's "main"; turning it on makes it From URL), its hint how many are built
  Stored as the widget's "source" ({ mode, from, id | where }), every change one undo step that
  renders the widget again. ui.focusParam (the page head's warning) focuses a param's row.
-->
<script>
  import InfoHelp from './InfoHelp.svelte';
  import { tick } from 'svelte';
  import ItemPicker from './ItemPicker.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { schemaFor, itemName } from './source-items.js';
  import { plural } from '../lib/format.js';
  import { isTemplate, pageIdOf, paramsOf, sourceFile } from '../../site/files.js';
  import { mainProblem, sourceOf, urlSource } from '../../site/layout/source.js';
  import { isPropertyPart, isParts, partText } from '../../site/layout/parts.js';
  import { defaultProperty, hasProperty, ruleOf, SLUG } from '../../site/query.js';
  import { MATCH_TYPES } from '../../site/property-types.js';

  // g: the widget's group; base: its pointer; list: a list widget (All instead of Item); shown:
  // what it shows on the page in the preview (widgetItems)
  let { g, live, base, list = false, shown, sourceIds, onsource, handmade = false, oncustom = null } = $props();

  const NO_PARAMS = 'This page’s address has no params to match';
  const ANY_WHY =
    'Not on the main widget: it decides which pages exist, so each address must match real items (no match shows the 404 page). A param it ignores would make the same page under many addresses.';
  // what a URL part can be compared with: one value, not photos, long texts or lists
  const MATCHABLE = [...MATCH_TYPES, 'select']; // and a widget's select field
  const ANY = ''; // the Select's value for Any (no rule)

  const pageId = $derived(pageIdOf(g.file) || '');
  const params = $derived(isTemplate(pageId) ? paramsOf(pageId) : []);
  // (read on its own: the store changes a value in place, so the widget stays the same object)
  const source = $derived.by(() => {
    live.version;
    const v = live.get(g.file, `${base}/source`);
    return sourceOf({ source: v }) ? structuredClone(v) : null;
  });
  const mode = $derived(handmade ? 'custom' : (source?.mode ?? 'none'));
  const MODES = $derived([
    ['url', 'From URL'],
    list ? ['all', 'All'] : ['item', 'Item'],
    ['none', 'None'],
    ...(oncustom ? [['custom', 'Custom']] : []),
  ]);
  const schema = $derived.by(() => {
    live.version;
    return source ? schemaFor(live.store, sourceFile(source.from)) : null;
  });
  const itemsOf = (id) => {
    live.version;
    const items = live.get(sourceFile(id), '/items');
    return Array.isArray(items) ? items : [];
  };
  const nameOf = (id, it) => itemName(it, schemaFor(live.store, sourceFile(id)));

  // ---- the main widget
  const mainId = $derived.by(() => {
    live.version;
    return live.get(g.file, '/main');
  });
  const isMain = $derived(params.length > 0 && mainId === g.id);
  const problem = $derived(isMain ? mainProblem(live.content, pageId) : null);
  const built = $derived(
    isMain && !problem ? live.routes.filter((r) => r.id === pageId && !r.unbuilt).length : 0,
  );
  const mainHint = $derived.by(() => {
    if (isMain && problem) return { text: problem.message, warn: true };
    if (isMain) {
      const how =
        list || params.length > 1 ? 'A page if at least one item matches' : 'A page per item';
      return { text: `${how} · ${plural(built, 'page')} built`, warn: false };
    }
    return mainId
      ? { text: 'Off: the page’s main widget is another one', warn: false }
      : { text: 'Off: no widget is the main widget, so no pages are built', warn: true };
  });

  // ---- writing it
  const set = (next) =>
    live.store.set(g.file, `${base}/source`, next ?? undefined, {
      source: 'panel',
      structure: true,
    });
  const firstFrom = () =>
    source?.from || sourceIds.find((id) => itemsOf(id).length) || sourceIds[0] || '';
  const clearHandmade = () =>
    live.store.set(g.file, `${base}/config/handmade`, undefined, {
      key: `config:${g.file}${base}/config/handmade`,
      source: 'panel',
      structure: true,
    });
  function pickMode(m) {
    if (m === mode) return;
    if (m === 'custom') {
      oncustom?.();
      return;
    }
    const apply = () => {
      const from = firstFrom();
      if (m === 'none') return toNone();
      if (m === 'all') return set({ mode: 'all', from });
      if (m === 'url') return set(urlSource(live.content, from, params));
      // Item: the one it shows now, else the source's first
      const it = shown?.item ?? itemsOf(from).find((i) => typeof i?.id === 'string');
      if (it) set({ mode: 'item', from, id: it.id });
    };
    // leaving Custom: clear handmade with the source mode, one undo step
    if (handmade) live.store.batch(() => (clearHandmade(), apply()), { source: 'panel' });
    else apply();
  }
  /**
   * None: the widget's own texts. A setting that showed the item's value keeps it as its own text
   * (a text: what it showed; anything else: its default), one undo step.
   */
  function toNone() {
    const sources = live.content?.sources || {};
    const keys = new Set((schema?.properties || []).map((f) => f.key));
    const scope = { item: shown?.item, keys, sources };
    // a property part: what it showed, as text; a source's name ({people}) needs no item: kept
    const own = (v, key) => {
      if (isParts(v)) {
        const parts = v.map((p) =>
          isPropertyPart(p) && !Array.isArray(sources[p.property])
            ? { ...(p.marks ? { marks: p.marks } : {}), t: partText(p, scope) }
            : p,
        );
        if (key === 'text') return parts.filter((p) => !('t' in p) || p.t);
        return parts.some(isPropertyPart) ? parts : parts.map((p) => p.t).join('');
      }
      if (Array.isArray(v)) return v.map((x) => own(x));
      if (v && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, own(x, k)]));
      return v;
    };
    const widget = live.get(g.file, base) || {};
    live.store.batch(
      () => {
        set(undefined);
        for (const [k, v] of Object.entries(widget))
          if (k !== 'source' && JSON.stringify(v).includes('"property"'))
            live.store.set(g.file, `${base}/${k}`, own(structuredClone(v)), {
              source: 'panel',
              structure: true,
            });
      },
      { source: 'panel' },
    );
  }
  /** The rule of `param` set to `property` (ANY: no rule), the others kept, in address order. */
  function setRule(param, property) {
    const rules = params
      .map((p) =>
        p === param ? (property === ANY ? null : { param, property }) : ruleOf(source.where, p),
      )
      .filter(Boolean);
    set({ ...source, where: { op: 'and', rules } });
  }
  function setMain(on) {
    live.store.batch(
      () => {
        if (on && mode !== 'url') set(urlSource(live.content, firstFrom(), params));
        live.store.set(g.file, '/main', on ? g.id : undefined, {
          source: 'panel',
          structure: true,
        });
      },
      { source: 'panel' },
    );
  }

  // ---- the param rows
  const properties = $derived([
    SLUG,
    ...(schema?.properties || [])
      .filter((f) => !f.list && MATCHABLE.includes(f.type ?? 'text'))
      .map((f) => f.key)
      .filter((k) => k !== SLUG),
  ]);
  const rows = $derived(
    mode !== 'url'
      ? []
      : params.map((p) => {
          const rule = ruleOf(source.where, p);
          const missing = !!rule && !hasProperty(schema, rule.property);
          const own = properties.map((f) => ({
            value: f,
            label: f,
            hint: f === p ? 'same name' : f === SLUG ? 'default' : '',
          }));
          if (missing)
            own.push({ value: rule.property, label: rule.property, hint: 'not in this source' });
          return {
            param: p,
            property: rule?.property ?? ANY,
            missing,
            how: !rule
              ? ''
              : rule.property === defaultProperty(p, schema)
                ? rule.property === p
                  ? 'same name'
                  : 'default'
                : '',
            options: [
              { group: 'Match the property', options: own },
              {
                group: '',
                options: [
                  {
                    value: ANY,
                    label: 'Any',
                    hint: isMain ? '' : 'not filtered',
                    disabled: isMain,
                    note: isMain ? ANY_WHY : '',
                  },
                ],
              },
            ],
          };
        }),
  );
  const missing = $derived(rows.find((r) => r.missing));
  const unused = $derived(rows.filter((r) => r.property === ANY).map((r) => `[${r.param}]`));

  // ---- what it shows
  const showsLine = $derived.by(() => {
    if (handmade || !source) return null;
    const n = shown?.items.length ?? 0;
    const first = shown?.item;
    if (!n)
      return {
        text: mode === 'item' ? 'The item is missing from its source' : 'No item matches this page',
        miss: true,
      };
    if (n === 1 && first) return { text: `1 item: ${nameOf(source.from, first)}`, miss: false };
    const extra = unused.length ? ` (${unused.join(', ')} not used)` : '';
    const match = mode === 'all' ? `${n} items` : `${n} items match${extra}`;
    return { text: list ? match : `${match} · the properties show the first`, miss: false };
  });

  // the page head's warning: this widget's row of that param, in view and focused
  let el = $state();
  $effect(() => {
    const at = ui.focusParam;
    if (!at || at.widget !== g.id || !el) return;
    ui.focusParam = null;
    tick().then(() => {
      const row = at.param && el.querySelector(`[data-param="${CSS.escape(at.param)}"]`);
      const target = row?.querySelector('.sel') || el.querySelector('.seg__btn.is-active');
      (row || el).scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
  });
</script>

<div class="bs" bind:this={el}>
  <div class={['tf', oncustom && 'is-seg-only']}>
    {#if !oncustom}
      <span class="tf__label"
        >Source<InfoHelp label="About Source"
          ><b>Source</b>: where this widget gets its items, a list from Sources. <b>All</b> shows
          every item, <b>From URL</b> only the item of the page you are on, <b>Custom</b> items you
          add by hand.</InfoHelp
        ></span
      >
    {/if}
    <div class="seg" role="radiogroup" aria-label="Source">
      {#each MODES as [m, label] (m)}
        {@const off = m === 'url' && !params.length}
        <button
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-disabled={off || undefined}
          title={off ? NO_PARAMS : undefined}
          class={['seg__btn', mode === m && 'is-active', off && 'is-off']}
          onclick={() => !off && pickMode(m)}>{label}</button
        >
      {/each}
    </div>
  </div>

  {#if !handmade && mode === 'item'}
    <ItemPicker
      store={live.store}
      value={{ source: source.from, id: source.id }}
      changed={live.changed(g.file, `${base}/source`)}
      {sourceIds}
      {onsource}
      {itemsOf}
      {nameOf}
      onpick={(v) => set(v ? { mode: 'item', from: v.source, id: v.id } : undefined)}
    />
  {:else if !handmade && source}
    <ItemPicker
      store={live.store}
      mode="source"
      value={source.from}
      changed={live.changed(g.file, `${base}/source/from`)}
      none={null}
      {sourceIds}
      {onsource}
      {itemsOf}
      onpick={(id) => id && set({ ...source, from: id })}
    />
  {/if}

  {#if rows.length}
    <p class="bs__title">Match the address</p>
    <div class="bs__rules">
      {#each rows as r, i (r.param)}
        <div class="bs__rule" data-param={r.param}>
          <span class="bs__and">{i ? 'and' : 'where'}</span>
          <span class="bs__param">[{r.param}]</span>
          <span class="bs__eq">=</span>
          <div
            class={['bs__property', r.property !== ANY && 'is-param', r.missing && 'is-missing']}
          >
            <Select
              aria-label="The property [{r.param}] matches"
              value={r.property}
              options={r.options}
              onchange={(v) => setRule(r.param, v)}
            >
              {#snippet selected(o)}
                {o.value === ANY ? 'Any (not filtered)' : o.label}{#if r.missing}<span
                    class="bs__how is-err">· not in this source</span
                  >{:else if r.how}<span class="bs__how">· {r.how}</span>{/if}
              {/snippet}
            </Select>
          </div>
        </div>
      {/each}
    </div>
    {#if missing}
      <p class="bs__note" role="alert">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <span
          >[{missing.param}] matches “{missing.property}”, which this source doesn’t have. Pick a
          property, or another source. It saves as it is; {isMain
            ? 'no pages are built'
            : 'no item matches'} until then.</span
        >
      </p>
    {/if}
  {/if}

  {#if showsLine}
    <p class={['bs__shows', showsLine.miss && 'is-miss']}>
      <i
        class={['fa-solid', showsLine.miss ? 'fa-triangle-exclamation' : 'fa-eye']}
        aria-hidden="true"
      ></i>
      <span>{showsLine.text}</span>
    </p>
  {/if}

  {#if params.length}
    <hr class="bs__line" />
    <label class="tf">
      <span class="tf__label">
        <span class="bs__main"><i class="fa-solid fa-star" aria-hidden="true"></i>Main widget</span>
        <input
          type="checkbox"
          class="switch"
          role="switch"
          title="The main widget decides which pages this page builds"
          checked={isMain}
          onchange={(e) => setMain(e.currentTarget.checked)}
        />
      </span>
    </label>
    <p class={['hint small bs__hint', mainHint.warn && 'is-warn']}>{mainHint.text}</p>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // a whole row of the fields grid, its parts 12px apart
  .bs {
    @include stack(var(--space-3));
    grid-column: 1 / -1;

    .tf__label {
      margin-bottom: var(--space-2);
    }

    .tf.is-seg-only .tf__label {
      margin-bottom: 0;
    }
  }

  // a mode that can't be used on this page
  .seg__btn.is-off {
    opacity: var(--o-disabled);
    cursor: not-allowed;
  }

  .bs__title {
    @include muted;
    margin: 0;
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .bs__rules {
    @include stack(var(--space-1));
  }

  // [ where | [person] | = | property ▾ ]: 32px
  .bs__rule {
    @include row(var(--space-2));
    height: var(--size-control);
  }

  .bs__and {
    @include muted;
    flex: none;
    width: 40px;
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  // the param: the widget accent, as in the page head's path
  .bs__param {
    flex: none;
    min-width: 72px;
    color: var(--c-widget-accent);
  }

  .bs__eq {
    @include muted;
    flex: none;
  }

  .bs__property {
    flex: 1;
    min-width: 0;
    color: var(--c-text-muted);

    &.is-param {
      color: var(--c-widget-accent);
    }

    &.is-missing {
      color: var(--c-error);

      :global(.sel) {
        box-shadow: inset 0 0 0 1px var(--c-error);
      }
    }
  }

  .bs__how {
    @include muted;
    margin-left: var(--space-1);
    font-size: var(--fs-xs);

    &.is-err {
      color: var(--c-error);
    }
  }

  // the error under the rows
  .bs__note {
    @include row(var(--space-2));
    align-items: flex-start;
    margin: 0;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--c-error) 10%, transparent);
    color: var(--c-error);
    font-size: var(--fs-sm);
    line-height: 16px;

    i {
      flex: none;
      line-height: 16px;
      font-size: var(--fs-2xs);
    }
  }

  // what it shows: one muted line; nothing: the notice colour
  .bs__shows {
    @include row(var(--space-2));
    @include muted;
    color: var(--text-quiet);
    margin: 0;
    font-size: var(--fs-sm);

    span {
      @include ellipsis;
    }

    i {
      flex: none;
      font-size: var(--fs-2xs);
    }

    &.is-miss {
      color: var(--c-notice);
    }
  }

  .bs__line {
    width: 100%;
    margin: 0;
    border: 0;
    border-top: 1px solid var(--c-line);
  }

  .bs__main {
    @include row(var(--space-2));
    color: var(--c-text);

    i {
      color: var(--c-widget-accent);
      font-size: var(--fs-2xs);
    }
  }

  .bs__hint {
    margin: calc(-1 * var(--space-2)) 0 0;

    &.is-warn {
      color: var(--c-notice);
    }
  }
</style>
