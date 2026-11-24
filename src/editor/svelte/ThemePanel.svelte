<!--
  Theme (ui.panel 'theme', an area: ../areas.js): the theme's values, content/theme.json
  (src/render/theme.js). Under its head (Back to areas): Color, the brand color (theme.json
  color.brand, #rrggbb: --brand; a swatch at the hex field's start opens the native color
  picker; empty: the theme's tokens.scss --brand, read from the preview and shown greyed) and
  the color scheme (theme.json color.scheme: the color-scheme meta; empty: none), then
  Typography, the text styles' sizes
  (theme.json typography, px, src/render/layout/type.js; its Preview shows every style: the
  type specimen, render/layout/type-specimen.js, until Close preview or another area opens;
  fonts and text styles come here later), and Layout (contained width, space between sections:
  theme.json layout, src/render/layout/contain.js and space.js). The preview follows every
  value as it is typed (../theme-vars.js, from main.js).
-->
<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Button from './Button.svelte';
  import Collapsible from './Collapsible.svelte';
  import AreaHead from './AreaHead.svelte';
  import { ui } from './ui.svelte.js';
  import { THEME } from '../../render/files.js';
  import { COLS } from '../../render/layout/grid.js';
  import { TYPE_KEYS, TYPE_SCALE, typeOf } from '../../render/layout/type.js';
  import { isTypeSpecimen } from '../../render/layout/type-specimen.js';
  import { LINE_STYLES } from '../../render/text.js';
  import { isObject } from '../../render/is.js';
  import { brandOf, isScheme, isThemeColor, schemeOf, schemeValue } from '../../render/theme.js';
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

  const theme = () => live.get(THEME, '') || {};
  function set(key, value) {
    live.store.set(THEME, `/${key}`, value, { key: `text:${THEME}#/${key}`, source: 'panel' });
  }

  // Color: the brand color. brand: theme.json's (lowercase), '' when unset; themeBrand: the
  // theme's own (the preview's --brand where theme.json sets none), the placeholder
  const brand = $derived(brandOf(theme()) || '');
  let themeBrand = $state('');
  $effect(() => {
    ui.previewVersion;
    if (brand) return;
    const root = bridge.doc?.documentElement;
    if (!root) return;
    const v = root.ownerDocument.defaultView.getComputedStyle(root).getPropertyValue('--brand');
    themeBrand = v.trim().toLowerCase();
  });
  // what the swatch shows: theme.json's, else the theme's; the native picker needs #rrggbb
  const swatch = $derived(brand || themeBrand);
  const pickerValue = $derived(isThemeColor(swatch) ? swatch : '#000000');
  /** A brand color typed or picked: stored when it is #rrggbb, cleared when empty. */
  function setBrand(value) {
    const v = String(value ?? '').trim();
    if (v && !isThemeColor(v)) return;
    set('color/brand', v ? v.toLowerCase() : undefined);
  }

  // Color scheme: the color-scheme meta. Empty writes none. The usual values only.
  const SCHEME_OPTIONS = [
    ['dark', 'Dark'],
    ['light', 'Light'],
    ['light dark', 'Light dark'],
    ['dark light', 'Dark light'],
    ['normal', 'Normal'],
  ];
  const scheme = $derived(schemeOf(theme()) || '');
  function setScheme(value) {
    const v = schemeValue(value);
    if (v && !isScheme(v)) return;
    set('color/scheme', v || undefined);
  }

  // Typography: [key, label] of a style's fields (theme.json typography, by style and key)
  const TYPE_FIELDS = [
    ['min', 'Min (px)'],
    ['max', 'Max (px)'],
    ['line', 'Line'],
  ];
  // (as a string: an edit elsewhere in theme.json, a brand color dragged, doesn't wake the
  // placeholders below)
  const ownKey = $derived(JSON.stringify(typeOf(theme())));
  // the theme's sizes (the placeholders): the preview's own (tokens.scss), read where
  // theme.json sets none (main.js has put theme.json's on the preview: ../theme-vars.js)
  let themeType = $state(structuredClone(TYPE_SCALE));
  $effect(() => {
    ui.previewVersion;
    const mine = JSON.parse(ownKey);
    const root = bridge.doc?.documentElement;
    if (!root) return;
    const css = root.ownerDocument.defaultView.getComputedStyle(root);
    const next = untrack(() => structuredClone($state.snapshot(themeType)));
    for (const k of Object.keys(TYPE_SCALE))
      for (const [key, suffix] of TYPE_KEYS) {
        const v = parseFloat(css.getPropertyValue(`--type-${k}-${suffix}`));
        if (mine[k]?.[key] === undefined && Number.isFinite(v)) next[k][key] = v;
      }
    themeType = next;
  });
  const specimen = $derived(isTypeSpecimen(ui.path));

  /** A style's setting typed (undefined: cleared, the theme's); empty objects left out. */
  function setType(k, key, value) {
    if (value !== undefined && !(typeof value === 'number' && value > 0)) return;
    const stored = live.get(THEME, '/typography');
    const type = isObject(stored) ? structuredClone($state.snapshot(stored)) : {};
    const style = { ...(isObject(type[k]) ? type[k] : {}), [key]: value };
    if (value === undefined) delete style[key];
    if (Object.keys(style).length) type[k] = style;
    else delete type[k];
    live.store.set(THEME, '/typography', Object.keys(type).length ? type : undefined, {
      key: `text:${THEME}#/typography/${k}/${key}`,
      source: 'panel',
    });
  }
  // Layout: a contained section's columns (layout/contain.js), its width at common windows
  const contained = $derived.by(() => {
    return containedOf(theme());
  });
  const WINDOWS = [1280, 1366, 1440, 1536, 1920];
  // space between sections, in grid rows (F90). empty / 0 on desktop is unset (the default).
  // phone empty follows the desktop count; 0 is stored so it can override the desktop value.
  const siteSpace = $derived(spaceRows(theme().layout?.sectionSpace));
  const siteSpacePhone = $derived(spaceRows(theme().layout?.sectionSpacePhone));
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

  <Collapsible key="theme:color" title="Color">
    <p class="hint">
      The brand color: the header's glass, menus, buttons and links take it. Empty: the theme's
      (shown greyed).
    </p>
    <!-- leaving the hex field: it shows what is stored (a half-typed or picked value) -->
    <div
      class={['brand', !brand && 'is-unset']}
      style:--swatch={swatch || 'transparent'}
      onfocusout={(e) => {
        if (e.target.classList?.contains('tf__input')) e.target.value = brand;
      }}
    >
      <Field
        edit="{THEME}#/color/brand"
        label="Brand color"
        placeholder={themeBrand}
        value={brand}
        help="A hex color, #rrggbb. The swatch opens the color picker."
        reset={{
          on: !!brand,
          label: "Use the theme's brand color",
          title: themeBrand ? `Use the theme's (${themeBrand})` : "Use the theme's",
          run: () => setBrand(''),
        }}
        changed={live.changed(THEME, '/color/brand')}
        onvalue={setBrand}
      />
      <label class="brand__swatch" title="Pick a color">
        <input
          type="color"
          value={pickerValue}
          aria-label="Brand color: pick"
          oninput={(e) => setBrand(e.currentTarget.value)}
        />
      </label>
    </div>
    <Field
      edit="{THEME}#/color/scheme"
      label="Color scheme"
      type="select"
      options={SCHEME_OPTIONS}
      value={scheme}
      help="Tells the browser whether the page is light or dark (the color-scheme meta). Empty: none."
      reset={{
        on: !!scheme,
        label: 'Use no color-scheme meta',
        title: 'Use no color-scheme meta',
        run: () => setScheme(''),
      }}
      changed={live.changed(THEME, '/color/scheme')}
      onvalue={setScheme}
    />
  </Collapsible>

  <Collapsible key="theme:typography" title="Typography">
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
                edit="{THEME}#/typography/{k}/{key}"
                {label}
                type="number"
                empty
                placeholder={String(themeType[k][key])}
                value={live.get(THEME, `/typography/${k}/${key}`)}
                changed={live.changed(THEME, `/typography/${k}/${key}`)}
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
        edit="{THEME}#/layout/containedCols"
        label="Contained width (columns)"
        type="number"
        value={contained}
        changed={live.changed(THEME, '/layout/containedCols')}
        onvalue={setContained}
      />
      <Field
        edit="{THEME}#/layout/sectionSpace"
        label="Space between sections"
        type="number"
        half
        empty
        placeholder="0"
        value={siteSpace ?? undefined}
        help="Rows of the grid between sections. Empty or 0: none. The first section of a page starts under the header and does not use this."
        tip={spaceTip}
        changed={live.changed(THEME, '/layout/sectionSpace')}
        onvalue={(value) => setSiteSpace('sectionSpace', value)}
      />
      <Field
        edit="{THEME}#/layout/sectionSpacePhone"
        label="Space between sections (phone)"
        type="number"
        half
        empty
        placeholder={String(siteSpace ?? 0)}
        value={siteSpacePhone ?? undefined}
        help="On phones. Empty: the same number of rows as desktop."
        tip={spacePhoneTip}
        changed={live.changed(THEME, '/layout/sectionSpacePhone')}
        onvalue={(value) => setSiteSpace('sectionSpacePhone', value, true)}
      />
    </div>
    <ul class="widths" aria-label="Contained width at common window sizes">
      {#each WINDOWS as w (w)}
        <li><span>{w}</span><strong>{Math.round(containedWidth(w, contained))} px</strong></li>
      {/each}
    </ul>
  </Collapsible>
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // Color: the swatch sits in the hex field, at its start (the native picker under it)
  .brand {
    position: relative;

    :global(.tf__input) {
      padding-left: calc(var(--space-2) + 20px + var(--space-2));
      font-variant-numeric: tabular-nums;
    }
  }

  .brand__swatch {
    position: absolute;
    // under the label row (24px and its 8px margin), centred in the input's height
    top: calc(24px + var(--space-2) + (var(--size-control) - 20px) / 2);
    left: calc((var(--size-control) - 20px) / 2);
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--white) 24%, transparent);
    cursor: pointer;
    overflow: hidden;

    input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
  }

  .brand.is-unset .brand__swatch {
    opacity: 0.6;
  }

  // a style's name with its Min, Max and Line; more space between styles than under the name
  .styles {
    @include stack(var(--space-5));
  }

  // the name is a <p>: keep its default top margin on the first (Preview stays put),
  // drop it on the rest so the row gap is the space between styles
  .style-row + .style-row > .tf__label {
    margin-top: 0;
  }

  // Typography: a style's Min, Max and Line in one row
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
