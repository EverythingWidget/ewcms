<!--
  Theme (ui.panel 'theme', an area: ../areas.js): the theme's values, content/theme.json
  (src/render/theme.js). Its head (Back to areas) and three cards (Color, Typography, Layout);
  a click opens that part on its own screen (← back to Theme, ui.themePart). Color: the palette,
  the color themes and the site color theme (ColorPart.svelte; theme.json palette, colorThemes,
  colorTheme: src/render/colors.js).
  Typography: the text styles' sizes and fonts (theme.json typography, px and family,
  src/render/layout/type.js; its Preview, full width at the top, shows every style: the type
  specimen, render/layout/type-specimen.js, until Close preview, Back to Theme, or another area
  opens). Layout: contained width and space between sections (theme.json layout,
  src/render/layout/contain.js and space.js). The preview follows every value as it is typed
  (../theme-vars.js, from main.js).
-->
<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Button from './Button.svelte';
  import AreaCard from './AreaCard.svelte';
  import AreaHead from './AreaHead.svelte';
  import BackHead from './BackHead.svelte';
  import ColorPart from './ColorPart.svelte';
  import { ui } from './ui.svelte.js';
  import { THEME } from '../../render/files.js';
  import { COLS } from '../../render/layout/grid.js';
  import {
    TYPE_FONT_OF,
    TYPE_KEYS,
    TYPE_RESERVED,
    TYPE_SCALE,
    typeOf,
  } from '../../render/layout/type.js';
  import editorConfig from 'virtual:editor-config';
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

  // the part open: '' the card list, else Color, Typography or Layout (ui.themePart, kept)
  const THEME_PARTS = [
    { id: 'color', icon: 'droplet', name: 'Color', sub: 'Palette and color themes' },
    { id: 'typography', icon: 'font', name: 'Typography', sub: 'Fonts and text styles' },
    { id: 'layout', icon: 'table-columns', name: 'Layout', sub: 'Contained width and section space' },
  ];
  const part = $derived(THEME_PARTS.some((p) => p.id === ui.themePart) ? ui.themePart : '');
  const partInfo = $derived(THEME_PARTS.find((p) => p.id === part));
  function showPart(id) {
    ui.themePart = id;
    queueMicrotask(() => document.querySelector('.ed-body')?.scrollTo(0, 0));
  }
  function backToTheme() {
    if (part === 'typography') actions.showSpecimen(false);
    ui.themePart = '';
    queueMicrotask(() => document.querySelector('.ed-body')?.scrollTo(0, 0));
  }

  const theme = () => live.get(THEME, '') || {};
  function set(key, value) {
    live.store.set(THEME, `/${key}`, value, { key: `text:${THEME}#/${key}`, source: 'panel' });
  }

  // Typography: [key, label] of a style's fields (theme.json typography, by style and key)
  const TYPE_FIELDS = [
    ['min', 'Min (px)'],
    ['max', 'Max (px)'],
    ['line', 'Line'],
  ];
  // (as a string: an edit elsewhere in theme.json, a color dragged, doesn't wake the
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

  // typography fonts: the theme's list (theme/meta.json, editor-config); empty, the selects
  // stay in the layout with no options
  const fontOptions = (editorConfig.fonts || []).map((f) => [f.family, f.family]);
  const FONT_ROLE_LABEL = { display: 'Display font', body: 'Body font' };
  const firstFamily = (stack) =>
    (stack || '')
      .split(',')[0]
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
  // the theme's current stacks (tokens.scss, or typography.fonts once theme-vars has written them)
  let themeStacks = $state({ display: '', body: '' });
  $effect(() => {
    ui.previewVersion;
    const root = bridge.doc?.documentElement;
    if (!root) return;
    const css = root.ownerDocument.defaultView.getComputedStyle(root);
    themeStacks = {
      display: css.getPropertyValue('--f-display').trim(),
      body: css.getPropertyValue('--f-body').trim(),
    };
  });
  const roleFontName = (role) => firstFamily(themeStacks[role]);
  const rolePlaceholder = (role) =>
    fontOptions.length ? roleFontName(role) : 'None listed in the theme';
  const styleFontPlaceholder = (k) => {
    const role = TYPE_FONT_OF[k];
    const label = FONT_ROLE_LABEL[role] || 'Font';
    const name = roleFontName(role);
    if (!fontOptions.length) return 'None listed in the theme';
    return name ? `${label} (${name})` : label;
  };
  /** typography.fonts.display / body (undefined: cleared, the theme's stack). */
  function setFontRole(role, value) {
    if (!TYPE_RESERVED.fonts.includes(role)) return;
    const v = typeof value === 'string' ? value.trim() : '';
    const stored = live.get(THEME, '/typography');
    const type = isObject(stored) ? structuredClone($state.snapshot(stored)) : {};
    const fonts = { ...(isObject(type.fonts) ? type.fonts : {}) };
    if (v) fonts[role] = v;
    else delete fonts[role];
    if (Object.keys(fonts).length) type.fonts = fonts;
    else delete type.fonts;
    live.store.set(THEME, '/typography', Object.keys(type).length ? type : undefined, {
      key: `text:${THEME}#/typography/fonts/${role}`,
      source: 'panel',
    });
  }


  /** A style's setting typed (undefined: cleared, the theme's); empty objects left out. */
  function setType(k, key, value) {
    if (key === 'font') {
      const v = typeof value === 'string' ? value.trim() : '';
      value = v || undefined;
    } else if (value !== undefined && !(typeof value === 'number' && value > 0)) return;
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
  {#if !part}
    <AreaHead id="theme" {actions} />
    <ul class="areas">
      {#each THEME_PARTS as s (s.id)}
        <li>
          <AreaCard
            icon={s.icon}
            name={s.name}
            sub={s.sub}
            go
            data-theme-part={s.id}
            onclick={() => showPart(s.id)}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <div class="ah">
      <BackHead
        backLabel="Back to Theme"
        backTitle="Back to Theme"
        title={partInfo.name}
        onback={backToTheme}
      >
        <span class="ah__to">Theme</span>
      </BackHead>
    </div>

    {#if part === 'color'}
      <ColorPart {live} {bridge} />
    {:else if part === 'typography'}
      <div class="part">
        <p class="hint">
          The usual size of each text style, in pixels: it grows with the window between Min and Max.
          When they are the same, the size is fixed. Empty: the theme's (shown greyed). Font: empty
          uses the Display or Body font (the theme's, shown greyed).
        </p>
        <div class="preview">
          <Button
            size="small"
            label={specimen ? 'Close preview' : 'Preview'}
            title={specimen ? 'Back to the page you were on' : 'Every text style on a page of its own'}
            aria-pressed={specimen}
            onclick={() => actions.showSpecimen(!specimen)}
          />
        </div>
        <div class="fields">
          {#each TYPE_RESERVED.fonts as role (role)}
            <Field
              edit="{THEME}#/typography/fonts/{role}"
              label={FONT_ROLE_LABEL[role]}
              type="select"
              options={fontOptions}
              placeholder={rolePlaceholder(role)}
              disabled={!fontOptions.length}
              value={live.get(THEME, `/typography/fonts/${role}`)}
              unsaved={live.changed(THEME, `/typography/fonts/${role}`)}
              reset={{
                on: !!live.get(THEME, `/typography/fonts/${role}`),
                label: `Use the theme's ${FONT_ROLE_LABEL[role].toLowerCase()}`,
                title: roleFontName(role)
                  ? `Use the theme's (${roleFontName(role)})`
                  : "Use the theme's",
                run: () => setFontRole(role, ''),
              }}
              onvalue={(value) => setFontRole(role, value)}
            />
          {/each}
        </div>
        <div class="styles">
          {#each LINE_STYLES as [k, name, tag] (k)}
            <div class="style-row">
              <p class="style-name">{name} · {tag.toUpperCase()}</p>
              <div class="scale">
                {#each TYPE_FIELDS as [key, label] (key)}
                  <Field
                    edit="{THEME}#/typography/{k}/{key}"
                    {label}
                    type="number"
                    empty
                    placeholder={String(themeType[k][key])}
                    value={live.get(THEME, `/typography/${k}/${key}`)}
                    unsaved={live.changed(THEME, `/typography/${k}/${key}`)}
                    reset={{
                      on: live.get(THEME, `/typography/${k}/${key}`) != null,
                      label: "Use the theme's",
                      title: `Use the theme's (${themeType[k][key]})`,
                      run: () => setType(k, key, undefined),
                    }}
                    onvalue={(value) => setType(k, key, value)}
                  />
                {/each}
              </div>
              <div class="style-font">
                <Field
                  edit="{THEME}#/typography/{k}/font"
                  label="Font"
                  type="select"
                  options={fontOptions}
                  placeholder={styleFontPlaceholder(k)}
                  disabled={!fontOptions.length}
                  value={live.get(THEME, `/typography/${k}/font`)}
                  unsaved={live.changed(THEME, `/typography/${k}/font`)}
                  reset={{
                    on: !!live.get(THEME, `/typography/${k}/font`),
                    label: 'Use the default font for this style',
                    title: styleFontPlaceholder(k),
                    run: () => setType(k, 'font', undefined),
                  }}
                  onvalue={(value) => setType(k, 'font', value)}
                />
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if part === 'layout'}
      <div class="part">
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
            unsaved={live.changed(THEME, '/layout/containedCols')}
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
            unsaved={live.changed(THEME, '/layout/sectionSpace')}
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
            unsaved={live.changed(THEME, '/layout/sectionSpacePhone')}
            onvalue={(value) => setSiteSpace('sectionSpacePhone', value, true)}
          />
        </div>
        <ul class="widths" aria-label="Contained width at common window sizes">
          {#each WINDOWS as w (w)}
            <li><span>{w}</span><strong>{Math.round(containedWidth(w, contained))} px</strong></li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the same stack as the areas list and the pages list's cards (4px)
  .areas {
    @include stack(var(--space-1));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // as AreaHead: 4px under the back-arrow title; sticky so it stays while the part scrolls
  .ah {
    position: sticky;
    top: -12px;
    z-index: 1;
    // -12px top margin cancels the padding at rest (same as AreaHead); when stuck, the
    // padding covers the scroll area's 12px inset so fields pass under the title
    margin: -12px 0 var(--space-1);
    padding: 12px 0 4px;
    background: var(--c-surface);
  }

  .ah__to {
    @include ellipsis;
    color: var(--c-text-muted);
  }

  .part {
    @include stack(var(--space-3));
  }

  // the section's gap is the space under the hint (its usual 12px margin would double it)
  .part > .hint {
    margin-bottom: 0;
  }

  .preview :global(.btn) {
    width: 100%;
  }

  // a style's name with its Min, Max and Line; more space between styles than under the name
  .styles {
    @include stack(var(--space-5));
    margin-top: var(--space-3); // plus the part's 12px gap: 24px above the first style
  }

  // a style's name: 14px, medium, the regular text colour; 24px row, 4px grid
  .style-name {
    @include row(var(--space-2));
    margin: 0 0 var(--space-2);
    min-height: 24px;
    color: var(--c-text-strong);
    font-family: var(--f-mono);
    font-size: var(--fs-md);
    font-weight: 500;
    line-height: 16px;
  }

  // a style's Font under its Min, Max and Line; the 3-column scale does not shrink
  .style-font {
    margin-top: var(--gap-fields);
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
