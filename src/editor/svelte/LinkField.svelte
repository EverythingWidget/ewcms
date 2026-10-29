<!--
  A link (src/site/hrefs.js): one Select of where it goes, a page of the site (by its id), a
  source item's page (by the item's id), a field of the widget's item (binds, a { bind }) or an
  external link (a URL), with the URL's input under it; the dropdown searchable. value: the link ({ page } | { item } | { href }
  | { bind }); onvalue(next) gets the next one (undefined: no link, when `empty` is set).
  Used by widget settings and list fields (GroupFields.svelte) and the header's menu (HeaderPart).
-->
<script>
  import { isBinding } from '../../site/layout/bindings.js';
  import Field from './Field.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { itemName, schemaFor } from './source-items.js';
  import { sourceFile, sourceIds } from '../../site/files.js';
  import { linkKind } from '../../site/hrefs.js';

  let {
    live,
    edit,
    label = 'Link',
    value,
    changed = false,
    binds = null,
    empty = '',
    inline = false,
    onvalue,
    onfocus,
  } = $props();
  const uid = $props.id();
  const SEARCH = 'Search pages and items…';

  const bound = $derived(isBinding(value));
  const kind = $derived(bound ? 'bind' : linkKind(value));
  const key = $derived(
    kind === 'page'
      ? `page:${value.page}`
      : kind === 'item'
        ? `item:${value.item?.source}:${value.item?.id}`
        : kind === 'bind'
          ? `bind:${value.bind}`
          : kind === 'href'
            ? 'href'
            : '',
  );

  const pages = $derived(
    ui.pages.filter((p) => p.kind === 'page' && !p.items && p.pid && p.path !== '/404/'),
  );
  const items = $derived.by(() => {
    live.version;
    return sourceIds(live.store.current).flatMap((source) => {
      const list = live.get(sourceFile(source), '/items');
      const schema = schemaFor(live.store, sourceFile(source));
      return (Array.isArray(list) ? list : [])
        .filter((it) => it?.id)
        .map((it) => ({
          value: `item:${source}:${it.id}`,
          label: itemName(it, schema),
          hint: `${source}.json`,
        }));
    });
  });
  // pinned at the top: No link (when it may be empty) and External link; then the search
  // field (Select's search) and the groups under it: Pages, Items, this item's fields
  const options = $derived.by(() => {
    const out = [
      {
        group: '',
        pinned: true,
        options: [
          ...(empty ? [{ value: '', label: inline ? label : empty }] : []),
          { value: 'href', label: 'External link' },
        ],
      },
      {
        group: 'Pages',
        options: pages.map((p) => ({ value: `page:${p.pid}`, label: p.title, hint: p.path })),
      },
      { group: 'Items', options: items },
      {
        group: 'This item',
        options: (binds || []).map((b) => ({
          value: `bind:${b.value}`,
          label: `This item's ${b.label}`,
          hint: 'from the item',
        })),
      },
    ];
    // a link to something that isn't there (any more) stays, marked
    if (key && !out.some((g) => g.options.some((o) => o.value === key)))
      out.push({ group: 'Missing', options: [{ value: key, label: `${key} (missing)` }] });
    return out.filter((g) => g.pinned || g.options.length);
  });

  function pick(v) {
    if (!v) return onvalue(undefined);
    const [k, a, b] = v.split(':');
    if (k === 'page') onvalue({ page: a });
    else if (k === 'item') onvalue({ item: { source: a, id: b } });
    else if (k === 'bind') onvalue({ bind: a });
    else onvalue({ href: kind === 'href' ? value.href : 'https://' });
  }
</script>

<div class={['tf', changed && 'is-changed']} data-edit={edit}>
  {#if inline}
    <!-- under its photo (a photo list's row): no label above; the dropdown names it -->
    <Select
      id={uid}
      value={key}
      {options}
      placeholder={label}
      aria-label={label}
      search={SEARCH}
      onchange={pick}
    />
  {:else}
    <label class="tf__label" for={uid}>{label}</label>
    <Select id={uid} value={key} {options} placeholder="Pick…" search={SEARCH} onchange={pick} />
  {/if}
</div>
{#if kind === 'href'}
  <Field
    label="URL (https://…, mailto:… or #anchor)"
    value={value.href}
    {changed}
    {onfocus}
    onvalue={(v) => onvalue({ href: v.trim() })}
  />
{/if}
