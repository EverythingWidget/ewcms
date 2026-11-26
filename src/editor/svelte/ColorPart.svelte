<!--
  Theme › Color (ThemePanel.svelte's Color part): content/theme.json's palette, its 5 color themes
  and the site color theme (src/render/colors.js; the data and edits: ../lib/color-themes.js).
    Palette        a card of 5 slots, each the hex field with its swatch (the native picker);
                   reset: back to the engine's (or color.brand's slot 4)
    Color themes   a card each (Lightest … Darkest), closed, its bar a fixed-size preview chip; open:
                   its 11 roles (labels: ROLES), each a row of field-style swatches on a 7-column
                   grid (all the same size): the 5 palette slots, Transparent on fills and a custom colour (the shared 190px
                   popover, kept inside the panel: the hex field); the picked one a 2px inner ring.
                   Button: Color / Glass / Transparent (.seg) on a row of its own, its swatches under it,
                   greyed out and disabled for Glass and Transparent (kept: the row's height never changes).
                   The 7 text styles, a row each right after Text (TEXT_STYLE_ROWS: no group), in
                   a theme and in a template's sub-roles (a template picked under Templates), greyed
                   while they follow ("follows Text"). A role that isn't the engine's default, or a sub-role set:
                   the accent dot in its row's left padding (as Motion's "has its own values", no
                   shift); a theme with any: the dot on its card. Its smart colours, read only, at
                   the bottom (worked out by the preview, the rule on hover)
    Site color theme  the select (empty: Darkest)
  Every pick is one undo step (a typed or dragged colour coalesces); theme.json is IN_PLACE, so
  the preview's #color-themes and theme-vars are rewritten as it changes (../theme-vars.js), no
  reload and no render job.
-->
<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Collapsible from './Collapsible.svelte';
  import Popover from './Popover.svelte';
  import { ui } from './ui.svelte.js';
  import { THEME } from '../../render/files.js';
  import {
    DEFAULT_COLOR_THEME,
    PALETTE_SIZE,
    ROLES,
    SMART,
    TEMPLATE_ROLES,
    THEMES,
    colorThemeClass,
  } from '../../render/colors.js';
  import { templatePickerGroups, PRESETS } from '../../widgets/list/presets.js';
  import {
    buttonModeValue,
    customCount,
    defaultPaletteOf,
    isCustomSlot,
    isHexColor,
    longHex,
    paletteEdit,
    paletteShown,
    previewOf,
    roleEdit,
    roleRow,
    rolePointer,
    siteColorThemeOf,
    siteThemeEdit,
    swatchOf,
    TEXT_STYLE_ROWS,
    themeLabel,
  } from '../lib/color-themes.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../preview-runtime.js)
  let { live, bridge } = $props();

  const theme = () => live.get(THEME, '') || {};
  const opts = (ptr) => ({ key: `color:${THEME}#${ptr}`, source: 'panel' });

  // ---- the palette
  const palette = $derived(paletteShown(theme()));
  const defaults = $derived(defaultPaletteOf(theme()));
  function setSlot(i, hex) {
    const v = paletteEdit(theme(), i, hex);
    if (v !== null) live.store.set(THEME, '/palette', v, opts(`/palette/${i}`));
  }

  // ---- roles
  function pick(spec, value) {
    const edit = roleEdit(theme(), spec, value);
    if (edit) live.store.set(THEME, edit.ptr, edit.value, opts(edit.ptr));
  }
  const SLOTS = Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1);
  const BUTTON_CHOICES = [
    ['color', 'Color'],
    ['glass', 'Glass'],
    ['transparent', 'Transparent'],
  ];

  // the custom colour popover: the row it is open for ({ spec, anchor })
  let custom = $state(null);
  const customRow = $derived(custom ? roleRow(theme(), custom.spec) : null);
  const customHex = $derived(customRow && isHexColor(customRow.shown) ? longHex(customRow.shown) : '');
  const customSwatch = $derived(customRow ? swatchOf(theme(), customRow.shown) : '');
  function openCustom(spec, e) {
    const anchor = e.currentTarget;
    custom = custom?.anchor === anchor ? null : { spec, anchor };
  }

  // ---- the Templates fold: remembered in ui.sections
  const foldKey = (name, what) => `theme-color:${name}:${what}`;
  const isOpen = (name, what) => !!ui.sections[foldKey(name, what)];
  const toggle = (name, what) => (ui.sections[foldKey(name, what)] = !isOpen(name, what));

  // the template a theme's Templates fold shows (per theme; the first preset at first)
  let templateOf = $state({});
  const templateOptions = $derived.by(() => {
    const own = Object.entries(live.content?.templates || {})
      .map(([id, tpl]) => ({ value: id, label: tpl?.name || id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return templatePickerGroups(own);
  });
  const templateFor = (name) => templateOf[name] || PRESETS[0].id;

  // ---- the site color theme
  const site = $derived(siteColorThemeOf(theme()));
  const THEME_OPTIONS = THEMES.map(([name, label]) => [name, label]);

  // ---- smart colours: worked out by the preview (its color-themes style), per theme
  let smart = $state({});
  const themeKey = $derived(JSON.stringify([theme().palette, theme().colorThemes, theme().colorTheme]));
  $effect(() => {
    themeKey;
    ui.previewVersion;
    const doc = bridge.doc;
    if (!doc?.body) return;
    untrack(() => {
      const box = doc.createElement('div');
      box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;inset:0 auto auto 0';
      for (const [name] of THEMES) {
        const el = doc.createElement('div');
        el.className = colorThemeClass(name);
        for (const s of SMART) {
          const dot = doc.createElement('i');
          dot.style.background = `var(${s.var})`;
          el.append(dot);
        }
        box.append(el);
      }
      doc.body.append(box);
      const win = doc.defaultView;
      const out = {};
      [...box.children].forEach((el, t) => {
        out[THEMES[t][0]] = [...el.children].map((dot) => win.getComputedStyle(dot).backgroundColor);
      });
      box.remove();
      smart = out;
    });
  });
</script>

<!-- a role or sub-role: its label row (the follows note, a reset), then its picker -->
{#snippet roleRowView(spec)}
  {@const row = roleRow(theme(), spec)}
  {@const ptr = rolePointer(spec)}
  {@const following = !!row.follows && !row.custom}
  {@const swatches = !row.glass || row.mode === 'color'}
  {@const hex = isHexColor(row.shown)}
  <div
    class={['crole', row.custom && 'is-changed', following && 'is-following']}
    data-edit="{THEME}#{ptr}"
    title={row.custom ? (row.follows ? 'Its own color' : 'Its own color (not the default)') : undefined}
  >
    <span class="tf__label">
      <span class="crole__name">{row.label}</span>
      {#if row.follows}<span class="crole__follows">{following ? `follows ${row.follows}` : ''}</span>{/if}
      {#if row.custom}
        <button
          type="button"
          class="crole__reset"
          title={row.follows ? `Follow ${row.follows} again` : 'Use the default'}
          aria-label={row.follows ? `${row.label}: follow ${row.follows} again` : `${row.label}: use the default`}
          onclick={() => pick(spec, undefined)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
        >
      {/if}
    </span>
    {#if row.glass}
      <div class="crole__ctl">
        <div class="seg crole__mode" role="radiogroup" aria-label="{row.label}: fill">
          {#each BUTTON_CHOICES as [mode, text] (mode)}
            <button
              type="button"
              role="radio"
              aria-checked={row.mode === mode}
              class={['seg__btn', row.mode === mode && 'is-active']}
              onclick={() => pick(spec, buttonModeValue(theme(), spec, mode))}>{text}</button
            >
          {/each}
        </div>
      </div>
    {/if}
    <div
      class={['swatches', !swatches && 'is-off']}
      role="radiogroup"
      aria-label="{row.label}: color"
      aria-disabled={!swatches || undefined}
      inert={!swatches || undefined}
    >
      {#each SLOTS as slot (slot)}
        <button
          type="button"
          role="radio"
          class="swatch"
          aria-checked={swatches && row.shown === slot}
          style:--swatch={palette[slot - 1]}
          title="Slot {slot} · {palette[slot - 1]}"
          aria-label="Slot {slot}"
          onclick={() => pick(spec, slot)}
        ></button>
      {/each}
      {#if row.transparent && !row.glass}
        <button
          type="button"
          role="radio"
          class="swatch swatch--transparent"
          aria-checked={row.shown === 'transparent'}
          title="Transparent: no fill"
          aria-label="Transparent"
          onclick={() => pick(spec, 'transparent')}><i class="fa-solid fa-ban" aria-hidden="true"></i></button
        >
      {/if}
      <button
        type="button"
        class={['swatch', 'swatch--custom', swatches && hex && 'is-set']}
        aria-haspopup="dialog"
        aria-expanded={!!custom && rolePointer(custom.spec) === ptr}
        style:--swatch={swatches && hex ? longHex(row.shown) : null}
        title={hex ? `Custom · ${longHex(row.shown)}` : 'A custom color'}
        aria-label={hex ? `Custom color, picked: ${longHex(row.shown)}` : 'Custom color'}
        onclick={(e) => openCustom(spec, e)}><i class="fa-solid fa-eyedropper" aria-hidden="true"></i></button
      >
    </div>
  </div>
{/snippet}

<!-- a fold: caret + its name (the curtain's Advanced), its rows under it while open -->
{#snippet fold(name, what, text, children)}
  {@const open = isOpen(name, what)}
  <div class="cfold">
    <button
      type="button"
      class="cfold__toggle"
      aria-expanded={open}
      onclick={() => toggle(name, what)}
    >
      <i class="fa-solid fa-chevron-right cfold__caret" aria-hidden="true"></i>
      {text}
    </button>
    {#if open}<div class="cfold__body">{@render children()}</div>{/if}
  </div>
{/snippet}

<!-- a color theme's preview: its Background, "Aa" in Title, a Text line and an Accent dot -->
{#snippet chip(name)}
  {@const p = previewOf(theme(), name)}
  <span
    class={['cchip', !p.background && 'is-transparent']}
    style:--bg={p.background || 'transparent'}
    style:--fg={p.title || 'currentColor'}
    style:--tx={p.text || 'currentColor'}
    style:--ac={p.accent || 'currentColor'}
    aria-hidden="true"
  >
    <b>Aa</b><span class="cchip__line"></span><span class="cchip__dot"></span>
  </span>
{/snippet}

<div class="part">
  <p class="hint">
    The site's 5 colors and the 5 color themes that give them jobs. A section, the header and the
    footer use one; the rest of the page uses the site's. A dot marks a role that isn't the
    default.
  </p>

  <Collapsible key="theme-color:palette" title="Palette">
    <div class="fields">
      {#each SLOTS as slot, i (slot)}
        <div
          class="hexf"
          style:--swatch={palette[i]}
          onfocusout={(e) => {
            if (e.target.classList?.contains('tf__input')) e.target.value = palette[i];
          }}
        >
          <Field
            edit="{THEME}#/palette/{i}"
            label="Slot {slot}{slot === 1 ? ' · background end' : ''}"
            half
            value={palette[i]}
            reset={{
              on: isCustomSlot(theme(), i),
              label: `Slot ${slot}: use the default`,
              title: `Use the default (${defaults[i]})`,
              run: () => setSlot(i, undefined),
            }}
            onvalue={(v) => isHexColor(v) && setSlot(i, v)}
          />
          <label class="hexf__swatch" title="Pick a color">
            <input
              type="color"
              value={palette[i]}
              aria-label="Slot {slot}: pick"
              oninput={(e) => setSlot(i, e.currentTarget.value)}
            />
          </label>
        </div>
      {/each}
    </div>
  </Collapsible>

  {#each THEMES as [name, label] (name)}
    <Collapsible
      key="theme-color:{name}"
      title={label}
      name={name === site ? 'Site color theme' : ''}
      open={false}
      changed={customCount(theme(), name) > 0}
      class="ctheme"
    >
      {#snippet bar()}{@render chip(name)}{/snippet}
      <div class="croles" data-color-theme={name}>
        {#each ROLES as r (r.key)}
          {@render roleRowView({ theme: name, key: r.key })}
          {#if r.key === 'text'}
            {#each TEXT_STYLE_ROWS as textStyle (textStyle)}
              {@render roleRowView({ theme: name, textStyle })}
            {/each}
          {/if}
        {/each}
        {#snippet templates()}
          {@const id = templateFor(name)}
          <Field
            edit="{THEME}#/colorThemes/{name}/templates"
            label="Template"
            type="select"
            options={templateOptions}
            value={id}
            onvalue={(v) => (templateOf = { ...templateOf, [name]: v })}
          />
          {#each TEMPLATE_ROLES as key (key)}
            {@render roleRowView({ theme: name, key, template: id })}
            {#if key === 'text'}
              {#each TEXT_STYLE_ROWS as textStyle (textStyle)}
                {@render roleRowView({ theme: name, textStyle, template: id })}
              {/each}
            {/if}
          {/each}
        {/snippet}
        {@render fold(name, 'templates', 'Templates', templates)}
        <div class="csmart" aria-label="Smart colors (worked out, read only)">
          <span class="tf__label">Smart colors</span>
          <div class="csmart__row">
            {#each SMART as s, i (s.name)}
              <span
                class="csmart__dot"
                style:--swatch={smart[name]?.[i] || 'transparent'}
                title="{s.name}: {s.rule}"
              ></span>
            {/each}
          </div>
        </div>
      </div>
    </Collapsible>
  {/each}

  <Field
    edit="{THEME}#/colorTheme"
    label="Site color theme"
    type="select"
    options={THEME_OPTIONS}
    value={site}
    help="The page, the header and every section that picks none. {themeLabel(DEFAULT_COLOR_THEME)} by default."
    reset={{
      on: site !== DEFAULT_COLOR_THEME,
      label: `Use ${themeLabel(DEFAULT_COLOR_THEME)}`,
      title: `Use ${themeLabel(DEFAULT_COLOR_THEME)}`,
      run: () => live.store.set(THEME, '/colorTheme', undefined, opts('/colorTheme')),
    }}
    onvalue={(v) => live.store.set(THEME, '/colorTheme', siteThemeEdit(v), opts('/colorTheme'))}
  />
</div>

<Popover
  open={!!custom}
  anchor={custom?.anchor}
  label="Custom color"
  onclose={() => (custom = null)}
>
  <p class="pov__head">Custom color</p>
  {#if custom}
    <div
      class="hexf"
      style:--swatch={customSwatch || 'transparent'}
      onfocusout={(e) => {
        if (e.target.classList?.contains('tf__input')) e.target.value = customHex;
      }}
    >
      <Field
        edit="{THEME}#{rolePointer(custom.spec)}"
        label="Hex"
        placeholder="#rrggbb"
        value={customHex}
        onvalue={(v) => isHexColor(v) && pick(custom.spec, v)}
      />
      <label class="hexf__swatch" title="Pick a color">
        <input
          type="color"
          value={customHex || customSwatch || '#000000'}
          aria-label="Custom color: pick"
          oninput={(e) => pick(custom.spec, e.currentTarget.value)}
        />
      </label>
    </div>
  {/if}
</Popover>

<style lang="scss">
  @use '../styles/mixins' as *;

  .part {
    @include stack(var(--space-3));
  }

  .part > .hint {
    margin-bottom: 0;
  }

  // a colour field: the swatch sits in the hex field, at its start (the native picker under it),
  // as Theme › Color's Brand color did
  .hexf {
    position: relative;
    min-width: 0;

    :global(.tf__input) {
      padding-left: calc(var(--space-2) + 20px + var(--space-2));
      font-variant-numeric: tabular-nums;
    }
  }

  .hexf__swatch {
    position: absolute;
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

  // the palette's half fields: the swatch field shares the grid's column
  .fields > .hexf {
    grid-column: auto;
  }

  // a theme's preview chip: fixed size in the card's bar (20px tall, as the bar's controls)
  .cchip {
    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
    box-sizing: border-box;
    width: 64px;
    height: 20px;
    margin-left: auto;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--white) 24%, transparent);
    font-size: var(--fs-sm);
    line-height: 20px;
    letter-spacing: 0;
    text-transform: none;

    &.is-transparent {
      box-shadow: inset 0 0 0 1px var(--c-line);
      outline: 1px dashed var(--c-text-faint);
      outline-offset: -1px;
    }

    b {
      color: var(--fg);
      font-weight: 500;
    }
  }

  .cchip__line {
    flex: 1;
    height: 1px;
    background: var(--tx);
    opacity: 0.7;
  }

  .cchip__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-round);
    background: var(--ac);
  }

  // the roles: a row each; the left padding holds the "own value" dot (editor.scss .crole)
  .croles {
    @include stack(var(--space-2));
  }

  .crole {
    position: relative;
    padding-left: var(--space-3);

    .tf__label {
      margin-bottom: var(--space-1);
    }
  }

  .crole__name {
    flex: none;
  }

  // what an empty sub-role follows: quiet, after its name; the row greyed (undimmed on hover)
  .crole__follows {
    @include ellipsis;
    min-width: 0;
    color: var(--c-text-faint);
    text-transform: none;
    letter-spacing: 0;
  }

  .crole.is-following .swatches {
    opacity: var(--o-disabled);
    transition: opacity 0.2s;
  }

  .crole.is-following:hover .swatches,
  .crole.is-following:focus-within .swatches {
    opacity: 1;
  }

  // a quiet reset at the end of the 24px label row (as a field's)
  .crole__reset {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 16px;
    height: 16px;
    margin-left: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    cursor: pointer;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  // Button's Color / Glass / Transparent: the editor's .seg, full width, on a row of its own
  .crole__ctl {
    display: flex;
    height: var(--size-control);
    margin-bottom: var(--space-1);
  }

  .crole__mode {
    flex: 1;
  }

  // the swatches: field-style (.tf__input's radius and background), one control tall, on a
  // 7-column grid so every box is the same size (5 slots, Transparent on fills, custom; a row
  // without Transparent leaves the 7th empty); kept and greyed out (disabled) while Button
  // isn't Color, so the row never changes height
  .swatches {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-1);
    height: var(--size-control);

    &.is-off {
      opacity: var(--o-disabled);
    }
  }

  .swatch {
    display: grid;
    place-items: center;
    min-width: 0;
    height: var(--size-control);
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--swatch, var(--field-bg));
    box-shadow: inset 0 0 0 1px var(--c-line);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    transition: box-shadow 0.2s;
    cursor: pointer;

    &:hover {
      color: var(--c-text);
    }

    // a colour: the swatch edge (.hexf__swatch's), so a slot the card's colour still shows
    &[style*='--swatch'] {
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--white) 24%, transparent);
    }

    // the picked one: the field focus colour as a 2px inner ring, a 1px gap inside it (nothing moves)
    &[aria-checked='true'],
    &.swatch--custom.is-set {
      box-shadow:
        inset 0 0 0 2px var(--focus-line),
        inset 0 0 0 3px var(--c-surface);
    }

    &:focus-visible {
      outline: 1px solid var(--focus-line);
      outline-offset: 2px;
    }
  }

  // the custom one picked: its colour, the eyedropper on a small plate
  .swatch--custom.is-set i {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--c-surface) 70%, transparent);
    color: var(--c-text);
  }

  // the theme's Templates fold: the curtain's Advanced
  .cfold__toggle {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    font: inherit;
    @include muted;
    line-height: 16px;
    letter-spacing: 0.04em;
    text-align: left;
    cursor: pointer;
    user-select: none;

    &[aria-expanded='true'] {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .cfold__caret {
    width: 1em;
    margin-right: var(--space-1);
    color: var(--c-text-faint);
    font-size: 0.95em;
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 90deg;
    }
  }

  .cfold__body {
    @include stack(var(--space-2));
    padding: 0 0 var(--space-2) var(--space-3);
  }

  // the smart colours: small dashed swatches, read only (the rule on hover)
  .csmart {
    padding: var(--space-2) 0 0 var(--space-3);
  }

  .csmart__row {
    display: flex;
    gap: var(--space-1);
  }

  .csmart__dot {
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    background: var(--swatch);
    outline: 1px dashed var(--c-text-faint);
    outline-offset: 1px;
  }
</style>
