<!--
  Pages > Header, a site part (picked under Site parts at the top of the pages list, or by
  clicking the header in the preview): two tabs (Tabs.svelte, the open one in
  ui.sections.headertab; unknown: Menu). Menu is the nav of content/header.json
  (src/render/shell/header.js: the nav pill and the phone menu); each item is a border-only
  card (ListField cards). Elements holds the title (site.json name, the header's logo text),
  the logo and CTA button (header.json "logo" and "cta": show, label, a link), and the labels
  (strings.json "header": the menu and close buttons, the clock). (The footer is page-like:
  footer.json.) An item: its label, its link (a page of the site, or an external URL), and a
  dropdown: links one level deep, or the items of a source. Every change is one undo step;
  the preview renders the menu again.
-->
<script>
  import Collapsible from './Collapsible.svelte';
  import Field from './Field.svelte';
  import LinkField from './LinkField.svelte';
  import ListField from './ListField.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { HEADER, SITE, STRINGS } from '../../render/files.js';

  // live: reactive store (live.svelte.js); tab: 'menu' | 'elements' (ContentPanel)
  let { live, tab = 'menu' } = $props();

  const uid = $props.id();

  // the sources a dropdown can list
  const sources = $derived(live.sources);

  const listOf = () => {
    const list = live.get(HEADER, '/header');
    return Array.isArray(list) ? list : [];
  };

  /** Change the menu: fn gets a copy of the list to change; one undo step, the preview renders it. */
  function change(fn) {
    const list = structuredClone(listOf());
    fn(list);
    live.store.set(HEADER, '/header', list, { source: 'panel' });
  }

  /** The item at path (indexes: [i] or [i, j] for a dropdown link) in list. */
  const at = (list, path) => (path.length === 1 ? list[path[0]] : list[path[0]].children[path[1]]);
  /** The list holding the item at path. */
  const siblings = (list, path) => (path.length === 1 ? list : list[path[0]].children);
  const ptrOf = (path, key) =>
    `/header/${path[0]}${path.length > 1 ? `/children/${path[1]}` : ''}/${key}`;

  const move = (path, to) =>
    change((list) => {
      const sib = siblings(list, path);
      sib.splice(to, 0, ...sib.splice(path.at(-1), 1));
    });
  const remove = (path) => change((list) => siblings(list, path).splice(path.at(-1), 1));
  const add = (path) =>
    change((list) => {
      const home = ui.pages.find((p) => p.path === '/')?.pid;
      const item = { label: 'New link', ...(home ? { page: home } : { href: '/' }) };
      if (path.length) (list[path[0]].children ||= []).push(item);
      else list.push(item);
    });

  /** A menu item's link: { page } | { item } | { href } (src/render/hrefs.js), in place. */
  function setLink(path, link) {
    change((list) => {
      const item = at(list, path);
      delete item.page;
      delete item.item;
      delete item.href;
      Object.assign(item, link);
    });
  }

  /** A dropdown's list: '' none, else the source whose items it lists. */
  const setItems = (path, value) =>
    change((list) => {
      const item = at(list, path);
      if (value) item.items = value;
      else delete item.items;
    });

  /**
   * A label or URL as typed (one undo step while typing). A label the preview updates itself;
   * a URL renders the menu again (once the typing pauses, main.js pushDraft).
   */
  function setText(path, key, value) {
    const ptr = ptrOf(path, key);
    const structure = key === 'href';
    live.store.set(HEADER, ptr, value, {
      key: `text:${HEADER}#${ptr}`,
      source: 'panel',
      structure,
    });
  }

  const nameOf = (item) => item.label || '(no label)';

  const cta = $derived(live.get(HEADER, '/cta') || {});

  function setName(value) {
    live.store.set(SITE, '/name', value, { key: `text:${SITE}#/name`, source: 'panel' });
  }
  function setLogo(value) {
    live.store.set(HEADER, '/logo', value || undefined, { source: 'panel' });
  }
  function setCtaShow(on) {
    live.store.set(HEADER, '/cta/show', on, { source: 'panel' });
  }
  function setCtaLabel(value) {
    live.store.set(HEADER, '/cta/label', value, {
      key: `text:${HEADER}#/cta/label`,
      source: 'panel',
    });
  }
  function setCtaLink(link) {
    const next = { ...(live.get(HEADER, '/cta') || {}) };
    delete next.page;
    delete next.item;
    delete next.href;
    if (link) Object.assign(next, link);
    live.store.set(HEADER, '/cta', next, { source: 'panel' });
  }
</script>

<!-- a Select with its label, an unsaved dot after it -->
{#snippet select(id, label, value, options, unsaved, onchange)}
  <div class={['tf', unsaved && 'is-unsaved']}>
    <label class="tf__label" for={id}>{label}</label>
    <Select {id} {value} {options} placeholder="Pick…" {onchange} />
  </div>
{/snippet}

<!-- one menu item's fields (entry); path: [i] or [i, j]; header items get a dropdown (top level only links) -->
{#snippet fields(entry, path)}
  {@const id = `${uid}-${path.join('-')}`}
  {@const ptr = (key) => ptrOf(path, key)}
  <Field
    edit="{HEADER}#{ptr('label')}"
    label="Label"
    value={entry.label}
    unsaved={live.changed(HEADER, ptr('label'))}
    onvalue={(v) => setText(path, 'label', v)}
  />
  <LinkField
    {live}
    edit="{HEADER}#{ptr('page')}"
    value={entry}
    unsaved={['page', 'item', 'href'].some((k) => live.changed(HEADER, ptr(k)))}
    onvalue={(link) => setLink(path, link)}
  />
  {#if !entry.children?.length}
    {@render select(
      `${id}-items`,
      path.length === 1 ? 'Dropdown: the items of' : 'Lists the items of',
      entry.items ?? '',
      [{ value: '', label: 'None' }, ...sources.map((s) => ({ value: s, label: `${s}.json` }))],
      live.changed(HEADER, ptr('items')),
      (v) => setItems(path, v),
    )}
  {/if}
  {#if path.length === 1 && (entry.items || entry.children?.length)}
    <Field
      edit="{HEADER}#{ptr('all')}"
      label="Link to the page at the end of the dropdown (empty: none)"
      value={entry.all ?? ''}
      unsaved={live.changed(HEADER, ptr('all'))}
      onvalue={(v) => setText(path, 'all', v)}
    />
  {/if}
  {#if path.length === 1 && !entry.items}
    <ListField
      label="Dropdown links"
      items={entry.children || []}
      name={nameOf}
      addLabel="Add dropdown link"
      cards
      onmove={(from, to) => move([path[0], from], to)}
      onremove={(j) => remove([path[0], j])}
      onadd={() => add(path)}
    >
      {#snippet item(child, j)}{@render fields(child, [path[0], j])}{/snippet}
    </ListField>
  {/if}
{/snippet}

<!-- the header's labels (strings.json "header"): one undo step while typing each -->
{#snippet label(key, title, fallback)}
  <Field
    edit="{STRINGS}#/header/{key}"
    label={title}
    placeholder={fallback}
    value={live.get(STRINGS, `/header/${key}`)}
    unsaved={live.changed(STRINGS, `/header/${key}`)}
    onvalue={(v) =>
      live.store.set(STRINGS, `/header/${key}`, v || undefined, {
        source: 'panel',
        key: `strings:header/${key}`,
      })}
  />
{/snippet}

{#snippet titleTip()}<b>Title</b>: the site name, used as the header's logo text when there is no
  logo image. Also in Site settings › Name &amp; Details.{/snippet}
{#snippet logoTip()}<b>Logo</b>: an optional image in the header. When set, it replaces the title
  text.{/snippet}

{#if tab === 'menu'}
  <p class="hint">The nav at the top and the phone menu. An item can open a dropdown.</p>
  <div class="fields">
    <ListField
      items={listOf()}
      name={nameOf}
      addLabel="Add link"
      cards
      onmove={(from, to) => move([from], to)}
      onremove={(i) => remove([i])}
      onadd={() => add([])}
    >
      {#snippet item(it, i)}{@render fields(it, [i])}{/snippet}
    </ListField>
  </div>
{:else}
  <p class="hint">The site name, logo and a button in the menu.</p>
  <Collapsible key="header:title" title="Title">
    <div class="fields">
      <Field
        edit="{SITE}#/name"
        label="Title"
        tip={titleTip}
        value={live.get(SITE, '/name')}
        unsaved={live.changed(SITE, '/name')}
        onvalue={setName}
      />
    </div>
  </Collapsible>
  <Collapsible key="header:logo" title="Logo">
    <div class="fields">
      <Field
        edit="{HEADER}#/logo"
        label="Logo"
        type="photo"
        tip={logoTip}
        value={live.get(HEADER, '/logo')}
        unsaved={live.changed(HEADER, '/logo')}
        onvalue={setLogo}
      />
    </div>
  </Collapsible>
  <Collapsible key="header:cta" title="CTA button">
    {#snippet bar()}
      <input
        type="checkbox"
        class="switch"
        role="switch"
        aria-label="Show the CTA button"
        title="Shown at the end of the menu"
        checked={!!cta.show}
        onchange={(e) => setCtaShow(e.currentTarget.checked)}
      />
    {/snippet}
    <div class="fields">
      <Field
        edit="{HEADER}#/cta/label"
        label="Label"
        placeholder="e.g. Contact"
        value={cta.label ?? ''}
        unsaved={live.changed(HEADER, '/cta/label')}
        onvalue={setCtaLabel}
      />
      <LinkField
        {live}
        edit="{HEADER}#/cta/link"
        value={cta}
        empty="None"
        unsaved={['page', 'item', 'href'].some((k) => live.changed(HEADER, `/cta/${k}`))}
        onvalue={setCtaLink}
      />
    </div>
  </Collapsible>
  <Collapsible key="header:labels" title="Labels">
    <div class="fields">
      {@render label('menu', 'Menu button (phones)', 'Menu')}
      {@render label('close', 'Close button (phones)', 'Close')}
      {@render label('clock', 'Clock label', '')}
    </div>
  </Collapsible>
{/if}
