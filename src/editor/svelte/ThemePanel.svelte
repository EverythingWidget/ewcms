<!--
  Theme (ui.panel 'theme', an area: ../areas.js): under its head (Back to areas) the text
  styles' sizes (Type: site.json type, px, src/render/layout/type.js; the preview follows
  them as they are typed, and its Preview shows every style: the type specimen,
  render/layout/type-specimen.js, until Close preview or another area opens), Layout
  (contained width, space between sections: site.json layout, src/render/layout/contain.js
  and space.js; the preview follows as they are typed), then Fonts and styles (Coming soon).
  The Fonts and styles row is the pages list's (PagesList.svelte, area 'theme'). Values stay
  in site.json.
-->
<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Button from './Button.svelte';
  import Collapsible from './Collapsible.svelte';
  import AreaHead from './AreaHead.svelte';
  import PagesList from './PagesList.svelte';
  import { ui } from './ui.svelte.js';
  import { SITE } from '../../render/files.js';
  import { COLS } from '../../render/layout/grid.js';
  import { TYPE_KEYS, TYPE_SCALE, TYPE_VARS, typeVarList } from '../../render/layout/type.js';
  import { isTypeSpecimen } from '../../render/layout/type-specimen.js';
  import { LINE_STYLES } from '../../render/text.js';
  import { isObject } from '../../render/is.js';
  import {
    CONTAINED,
    CONTAINED_MIN,
    containedOf,
    containedWidth,
  } from '../../render/layout/contain.js';
  import {
    clampSpaceRows,
    spaceRows,
  } from '../../render/layout/space.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../preview-runtime.js);
  // actions: showSpecimen, setPanel (main.js)
  let { live, bridge, actions } = $props();

  function set(key, value) {
    live.store.set(SITE, `/${key}`, value, { key: `text:${SITE}#/${key}`, source: 'panel' });
  }

  // Type: [key, label] of a style's fields (site.json type, by style and key)
  const TYPE_FIELDS = [
    ['min', 'Min (px)'],
    ['max', 'Max (px)'],
    ['line', 'Line'],
  ];
  const typeVars = $derived.by(() => {
    return typeVarList(live.get(SITE, '') || {});
  });
  // the theme's sizes (the placeholders): the preview's own, read where site.json sets none
  let themeType = $state(structuredClone(TYPE_SCALE));
  // the preview's text follows the type as it is typed (the page's head has it after Save)
  $effect(() => {
    ui.previewVersion;
    const root = bridge.doc?.documentElement;
    if (!root) return;
    const set = new Map(typeVars);
    for (const name of TYPE_VARS) {
      if (set.has(name)) root.style.setProperty(name, set.get(name));
      else root.style.removeProperty(name);
    }
    const css = root.ownerDocument.defaultView.getComputedStyle(root);
    const next = untrack(() => structuredClone($state.snapshot(themeType)));
    for (const k of Object.keys(TYPE_SCALE))
      for (const [key, suffix] of TYPE_KEYS) {
        const name = `--type-${k}-${suffix}`;
        const v = parseFloat(css.getPropertyValue(name));
        if (!set.has(name) && Number.isFinite(v)) next[k][key] = v;
      }
    themeType = next;
  });
  const specimen = $derived(isTypeSpecimen(ui.path));

  /** A style's setting typed (undefined: cleared, the theme's); empty objects left out. */
  function setType(k, key, value) {
    if (value !== undefined && !(typeof value === 'number' && value > 0)) return;
    const own = live.get(SITE, '/type');
    const type = isObject(own) ? structuredClone($state.snapshot(own)) : {};
    const style = { ...(isObject(type[k]) ? type[k] : {}), [key]: value };
    if (value === undefined) delete style[key];
    if (Object.keys(style).length) type[k] = style;
    else delete type[k];
    live.store.set(SITE, '/type', Object.keys(type).length ? type : undefined, {
      key: `text:${SITE}#/type/${k}/${key}`,
      source: 'panel',
    });
  }
  // Layout: a contained section's columns (layout/contain.js), its width at common windows
  const contained = $derived.by(() => {
    return containedOf(live.get(SITE, '') || {});
  });
  const WINDOWS = [1280, 1366, 1440, 1536, 1920];
  // space between sections, in grid rows (F90). empty / 0 on desktop is unset (the default).
  // phone empty follows the desktop count; 0 is stored so it can override the desktop value.
  const siteSpace = $derived(spaceRows((live.get(SITE, '') || {}).layout?.sectionSpace));
  const siteSpacePhone = $derived(spaceRows((live.get(SITE, '') || {}).layout?.sectionSpacePhone));
  // the preview follows as it is typed (the page's head has it after Save)
  $effect(() => {
    ui.previewVersion;
    const root = bridge.doc?.documentElement;
    if (!root) return;
    root.style.setProperty('--contain', String(contained));
    const space = siteSpace ?? 0;
    if (space) root.style.setProperty('--section-space', String(space));
    else root.style.removeProperty('--section-space');
    if (siteSpacePhone !== null && siteSpacePhone !== undefined)
      root.style.setProperty('--section-space-phone', String(siteSpacePhone));
    else root.style.removeProperty('--section-space-phone');
  });
  function setContained(value) {
    if (!Number.isInteger(value) || value < CONTAINED_MIN || value > COLS) return;
    set('layout/containedCols', value);
  }
  function setSiteSpace(key, value, allowZero = false) {
    const n = value === undefined ? undefined : clampSpaceRows(value);
    if (value !== undefined && n === null) return;
    const stored = allowZero ? n : n || undefined; // desktop 0 is the default: leave it out
    set(`layout/${key}`, stored);
  }
</script>

{#snippet spaceTip()}<b>Space between sections</b>: a number of grid rows of padding above every
  section except the first visible one of a page (that one already starts under the header).
  The first footer section uses it too. Empty or 0: none, so existing pages stay as they are.
  A section can override this.{/snippet}

{#snippet spacePhoneTip()}<b>Space between sections (phone)</b>: the same setting below 760px.
  Empty: the same number of rows as desktop. 0 means none on phones, even when the desktop
  value is set.{/snippet}

<section class="ed-body" aria-label="Theme">
  <AreaHead id="theme" {actions} />

  <Collapsible key="theme:type" title="Type">
    <p class="hint">
      The usual size of each text style, in pixels: it grows with the window between Min and Max.
      When they are the same, the size is fixed. Empty: the theme's (shown greyed).
    </p>
    <div>
      <Button
        size="small"
        label={specimen ? 'Close preview' : 'Preview'}
        title={specimen ? 'Back to the page you were on' : 'Every text style on a page of its own'}
        aria-pressed={specimen}
        onclick={() => actions.showSpecimen(!specimen)}
      />
    </div>
    <div class="styles">
      {#each LINE_STYLES as [k, name, tag] (k)}
        <div class="style-row">
          <p class="tf__label">{name} · {tag.toUpperCase()}</p>
          <div class="scale">
            {#each TYPE_FIELDS as [key, label] (key)}
              <Field
                edit="{SITE}#/type/{k}/{key}"
                {label}
                type="number"
                empty
                placeholder={String(themeType[k][key])}
                value={live.get(SITE, `/type/${k}/${key}`)}
                changed={live.changed(SITE, `/type/${k}/${key}`)}
                onvalue={(value) => setType(k, key, value)}
              />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </Collapsible>

  <Collapsible key="theme:layout" title="Layout">
    <p class="hint">
      How wide a contained section is: columns of the {COLS}-column grid ({CONTAINED_MIN}–{COLS};
      {CONTAINED} by default), centred and never nearer the edges than the side margins. Its widgets keep
      their columns: they scale with it. Phones: the full width inside the margins.
    </p>
    <div class="fields">
      <Field
        edit="{SITE}#/layout/containedCols"
        label="Contained width (columns)"
        type="number"
        value={contained}
        changed={live.changed(SITE, '/layout/containedCols')}
        onvalue={setContained}
      />
      <Field
        edit="{SITE}#/layout/sectionSpace"
        label="Space between sections"
        type="number"
        half
        empty
        placeholder="0"
        value={siteSpace ?? undefined}
        help="Rows of the grid between sections. Empty or 0: none. The first section of a page starts under the header and does not use this."
        tip={spaceTip}
        changed={live.changed(SITE, '/layout/sectionSpace')}
        onvalue={(value) => setSiteSpace('sectionSpace', value)}
      />
      <Field
        edit="{SITE}#/layout/sectionSpacePhone"
        label="Space between sections (phone)"
        type="number"
        half
        empty
        placeholder={String(siteSpace ?? 0)}
        value={siteSpacePhone ?? undefined}
        help="On phones. Empty: the same number of rows as desktop."
        tip={spacePhoneTip}
        changed={live.changed(SITE, '/layout/sectionSpacePhone')}
        onvalue={(value) => setSiteSpace('sectionSpacePhone', value, true)}
      />
    </div>
    <ul class="widths" aria-label="Contained width at common window sizes">
      {#each WINDOWS as w (w)}
        <li><span>{w}</span><strong>{Math.round(containedWidth(w, contained))} px</strong></li>
      {/each}
    </ul>
  </Collapsible>

  <PagesList {live} {actions} area="theme" showHead={false} />
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // a style's name with its Min, Max and Line; more space between styles than under the name
  .styles {
    @include stack(var(--space-5));
  }

  // the name is a <p>: keep its default top margin on the first (Preview stays put),
  // drop it on the rest so the row gap is the space between styles
  .style-row + .style-row > .tf__label {
    margin-top: 0;
  }

  // Type: a style's Min, Max and Line in one row
  .scale {
    display: grid;
    // (minmax: a number input's default width can't widen a column)
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap-fields);
  }

  // the contained width at each window size: window | px
  .widths {
    @include stack(var(--space-1));
    margin: var(--space-3) 0 0;
    padding: 0;
    @include muted;
    list-style: none;

    li {
      display: flex;
      justify-content: space-between;
    }

    strong {
      color: var(--c-text);
      font-weight: 400;
    }
  }
</style>
