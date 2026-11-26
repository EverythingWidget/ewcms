<!--
  A page section's settings (SectionsList.svelte's cards, and the widget view's top,
  WidgetInspector.svelte): its name (the whole row, its #anchor or what is wrong with it under
  it, right), then side by side its height (the phone's own in the phone preview, with its
  reset) and width as quiet icon buttons, Space above this section (a number of grid rows,
  the phone's own in the phone preview, with its reset), and a custom height's rows. One undo step per change.
    live, file, at (its index), sections (the page's, a fresh copy after every edit)
-->
<script>
  import InfoHelp from './InfoHelp.svelte';
  import Field from './Field.svelte';
  import SectionIcon from './SectionIcon.svelte';
  import { ui } from './ui.svelte.js';
  import { setPhoneHeight, setSection, setSectionRows } from '../layout-ops.js';
  import { THEME, templateIdOf } from '../../render/files.js';
  import {
    anchorOf,
    clampSpaceRows,
    hasOwnSectionSpace,
    hasOwnSectionSpacePhone,
    heightOf,
    phoneMinRowsOf,
    phoneHeightOf,
    phoneSectionSpaceOf,
    nameProblems,
    rowsOf,
    sectionSpaceOf,
  } from '../../render/layout/index.js';

  let { live, bridge = null, file, at, sections } = $props();
  const s = $derived(sections[at] || {});

  // [value, label (its tooltip and aria-label), the share of the screen its icon fills]
  const HEIGHTS = [
    ['custom', 'Custom: a number of rows (space below the widgets)', 'rows'],
    ['fit', 'Fit content: as tall as its widgets', 0],
    ['third', 'At least 1/3 of the screen', 1 / 3],
    ['half', 'At least 1/2 of the screen', 1 / 2],
    ['full', 'At least the full screen', 1],
  ];
  // [value, label (its tooltip and aria-label), its icon's band: inside the frame or edge to edge]
  const WIDTHS = [
    ['contained', 'Contained: inside the page margins', 'inside'],
    ['full', 'Full width: edge to edge', 'edge'],
  ];
  const widthOf = (s) => (s.width === 'full' ? 'full' : 'contained');

  const changed = (at, key) => live.changed(file, `/sections/${at}/${key}`);
  const set = (at, patch, key) => setSection(live.store, file, at, patch, key);
  // Height and Width: one picked of a group (only a change is written: one undo step)
  const pick = (at, key, value, now) => {
    if (value === now) return;
    if (key === 'phoneHeight') return setPhoneHeight(live.store, file, at, value);
    if (key !== 'height') return set(at, { [key]: value });
    // custom: its rows to start from (its last ones, or the rows it shows now: its content's
    // as the preview measured it, so an auto widget's real height counts); others: none
    const s = sections[at];
    // (its own phone rows go when the phone isn't custom then: setSection)
    set(at, {
      height: value,
      rows:
        value === 'custom' ? { min: s.rows?.min || shownRows(s, false) || rowsOf(s) } : undefined,
    });
  };
  // the rows a section shows in the preview now (rows.js's --frows: its own, or its content's
  // when that needs more), 0 when not shown
  const shownRows = (s, phone) => {
    if (!s?.id || phone !== phoneView) return 0;
    const el = bridge?.doc?.querySelector(`[data-sec="${CSS.escape(s.id)}"]`);
    return parseInt(el?.style.getPropertyValue('--frows'), 10) || 0;
  };
  // the phone preview shows and edits a custom height's own phone rows (phone.rows.min)
  const phoneView = $derived(ui.viewport === 'phone');
  const rowsShown = (s) =>
    ui.secRows?.id === s.id
      ? ui.secRows.rows
      : phoneView
        ? phoneMinRowsOf(s)
        : (s.rows?.min ?? rowsOf(s));
  // a custom height's rows, typed: one undo step per field edit
  const setMinRows = (at, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    setSectionRows(live.store, file, at, v, {
      phone: phoneView,
      key: `section:${file}#${at}/${phoneView ? 'phone/' : ''}rows/min`,
    });
  };
  // space above this section, in grid rows (F90). A template's section has no such key.
  // empty / reset: follow the site (desktop) or the desktop value (phone).
  const themeOf = () => live.get(THEME, '') || {};
  const pageSection = $derived(!templateIdOf(file));
  const spaceKey = $derived(phoneView ? 'sectionSpacePhone' : 'sectionSpace');
  const spaceOwn = (s) => (phoneView ? hasOwnSectionSpacePhone(s) : hasOwnSectionSpace(s));
  const spaceValue = (s) =>
    spaceOwn(s) ? (phoneView ? s.sectionSpacePhone : s.sectionSpace) : undefined;
  const spacePlaceholder = (s) =>
    String(phoneView ? phoneSectionSpaceOf(s, themeOf()) : sectionSpaceOf(s, themeOf()));
  const setSpace = (at, v) => {
    const n = v === undefined ? undefined : clampSpaceRows(v);
    if (v !== undefined && n === null) return;
    const s = sections[at];
    const now = phoneView ? s?.sectionSpacePhone : s?.sectionSpace;
    if (n === now || (n === undefined && now === undefined)) return;
    set(at, { [spaceKey]: n }, `section:${file}#${at}/${spaceKey}`);
  };
  // its name: empty removes it (no anchor)
  const setName = (at, name) =>
    set(at, { name: String(name ?? '').trim() ? name : undefined }, `section:${file}#${at}/name`);
  // what is wrong with each name (unique on the page, a letter first …), as the site checks it
  const problems = $derived(nameProblems(sections));
  const anchors = $derived(sections.map((s) => anchorOf(s.name)));
  const hintOf = (s, at) => {
    if (problems[at]) return `⚠ ${problems[at]}`;
    const a = anchors[at];
    // the first of two alike (the site flags the later one): flagged here too
    const twin = a ? anchors.findIndex((b, i) => i !== at && b === a) : -1;
    if (twin >= 0) return `⚠ #${a} is also section ${twin + 1}'s anchor`;
    return a ? `#${a}` : 'Optional: a #link to this section';
  };
</script>

<!-- a height's icon: the screen (a frame) and the share of it the section is at least (filled,
     from the top); fit: a bar hugged by two lines (as tall as its content) -->
<!-- a width's icon: the screen (a frame) and a band across its middle, narrower and centred
     (contained: inside the page margins) or from edge to edge (full width) -->
{#snippet widthIcon(band)}
  <SectionIcon kind="width" arg={band} />
{/snippet}

<!-- Height or Width: a field (.tf: the same label row as a Field) of quiet icon buttons, one
     picked. options: [value, label, its icon's argument] -->
{#snippet choices(at, key, title, options, now, icon, reset = null)}
  {@const id = `${sections[at].id}-${key}`}
  {@const ptr = key === 'phoneHeight' ? 'phone/height' : key}
  <div
    class={['tf', changed(at, ptr) && 'is-unsaved']}
    data-edit="{file}#/sections/{at}/{ptr}"
  >
    <span class="tf__label" {id}
      >{title}<InfoHelp label="About {title}"
        >{#if key === 'width'}<b>Width</b>: <b>contained</b> keeps the section inside the page
          margins, <b>full width</b> runs it from edge to edge.{:else}<b>Height</b>: how tall the
          section is: a number of rows, as tall as its content, or a third, half or all of the
          screen. Content is always centred.{/if}</InfoHelp
      >
      {#if reset}
        <!-- its own phone height: back to the desktop's -->
        <button
          type="button"
          class="hreset"
          title="Reset phone height (follow the desktop)"
          aria-label="Reset phone height"
          disabled={!reset.on}
          onclick={reset.run}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
        >
      {/if}</span
    >
    <div class="hset" role="radiogroup" aria-labelledby={id}>
      {#each options as [value, label, arg] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={now === value}
          aria-label={label}
          title={label}
          class={['hset__btn', now === value && 'is-active']}
          onclick={() => pick(at, key, value, now)}
        >
          {@render icon(arg)}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet heightIcon(share)}
  <SectionIcon kind="height" arg={share} />
{/snippet}

{#snippet spaceTip()}<b>Space above this section</b>: a number of grid rows of padding above
  this section (the section's own square cells). Empty: the site default (<b>Space between
  sections</b> in Theme). 0 means none. The first visible section of a page does not
  use it (it already starts under the header). The first footer section does.{/snippet}

<!-- Name (no label: its placeholder says it; its #anchor under it) the whole row; then Height
     and Width side by side, each column as wide as its buttons -->
<div class="fields">
  <Field
    edit="{file}#/sections/{at}/name"
    label="Name"
    bare
    placeholder="Name"
    value={s.name ?? ''}
    help={hintOf(s, at)}
    unsaved={changed(at, 'name')}
    onvalue={(name) => setName(at, name)}
  />
  <!-- Height (a minimum; its content always centred) and Width: icon buttons, one picked.
       A row of their own, columns sized to the button groups (five 40px and two), not the
       parent .fields' 1fr 1fr halves — those are ~170px in the 380px pop-up, and Height
       would overflow into Width. -->
  <div class="hw">
    {#if phoneView}
      <!-- the phone preview: its phone height (its own, else the desktop's) -->
      {@render choices(
        at,
        'phoneHeight',
        s.phone?.height ? 'Phone height' : 'Phone height (desktop)',
        HEIGHTS,
        phoneHeightOf(s),
        heightIcon,
        {
          on: !!s.phone?.height,
          run: () => setPhoneHeight(live.store, file, at, undefined),
        },
      )}
    {:else}
      {@render choices(at, 'height', 'Height', HEIGHTS, heightOf(s), heightIcon)}
    {/if}
    {@render choices(at, 'width', 'Width', WIDTHS, widthOf(s), widthIcon)}
  </div>
  {#if pageSection}
    <!-- space above this section: always on this row (no layout shift); empty uses the site
         default (placeholder). The first visible page section does not show this padding;
         the first footer section does. -->
    <Field
      edit="{file}#/sections/{at}/{spaceKey}"
      label="Space above this section"
      type="number"
      empty
      placeholder={spacePlaceholder(s)}
      value={spaceValue(s)}
      help={phoneView
        ? 'Rows of the grid above this section, on phones. Empty: same as desktop.'
        : 'Rows of the grid above this section. Empty uses the site default. The first section of a page starts under the header and does not use this.'}
      tip={spaceTip}
      unsaved={changed(at, spaceKey)}
      onvalue={(v) => setSpace(at, v)}
      reset={{
        on: spaceOwn(s),
        run: () => setSpace(at, undefined),
        title: phoneView
          ? 'Reset phone space (follow the desktop)'
          : 'Reset space (follow the site)',
        label: phoneView ? 'Reset phone space' : 'Reset space',
      }}
    />
  {/if}
  {#if (phoneView ? phoneHeightOf(s) : heightOf(s)) === 'custom'}
    <!-- custom: its rows (square cells, from the top; those below its last widget are empty
         space; on phones half as many) -->
    <Field
      edit="{file}#/sections/{at}/{phoneView ? 'phone/' : ''}rows/min"
      label={phoneView ? 'Phone rows' : 'Rows'}
      type="number"
      half
      value={rowsShown(s)}
      help={phoneView
        ? 'Phone only; unset: half the desktop rows'
        : 'Rows below the last widget are space (phones: their own, or half)'}
      unsaved={changed(at, phoneView ? 'phone/rows/min' : 'rows/min')}
      onvalue={(v) => setMinRows(at, v)}
    />
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the section settings, then the widgets
  // the name's #anchor hint at its right, under it
  .fields > :global(:first-child .tf__help) {
    text-align: right;
  }

  // Height and Width: one row, each column as wide as its buttons (200px and 80px), packed
  // to the start. The parent .fields grid is 1fr 1fr; those halves are too narrow for five
  // 40px buttons in the 380px pop-up (12px padding, 16px gap: ~170px a column).
  .hw {
    display: grid;
    grid-template-columns: max-content max-content;
    gap: var(--gap-fields);
    justify-content: start;
  }

  // a joined button group (v2): no padding or gaps, its buttons edge to edge (40px each,
  // the old 36 + its gap, on the 4px grid: the group 4px narrower), 32px tall like the inputs; the picked one in the accent on a
  // faint ground, a hovered one white on a 17% wash
  .hset {
    display: flex;
    height: var(--size-control);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--field-bg); // filled, as .seg (borderless: no ring)
    justify-self: start;
  }

  // the phone height's reset: a quiet icon in its label row
  .hreset {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: var(--space-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--c-text);
    }

    &:disabled {
      opacity: var(--o-disabled);
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    height: 100%;
    width: 40px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--text-quiet);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    &:hover {
      color: var(--text-strong);
      background: var(--field-hover);
    }

    &.is-active {
      background: var(--selected-bg);
      color: var(--selected-fg);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
</style>
