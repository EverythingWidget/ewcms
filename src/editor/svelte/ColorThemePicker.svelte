<!--
  ColorThemePicker: the one picker of a "colorTheme", for every kind that picks one: the site's
  (Theme › Color, theme.json /colorTheme) today; a section's and the header's use it too when
  they get one. A select of the color themes (THEMES, lightest first) with the yellow unsaved
  dot and a reset when it has a value of its own.
    live      the reactive store (live.svelte.js)
    file      the content file it edits (theme.json, a page, header.json)
    ptr       its pointer there ('/colorTheme', '/sections/2/colorTheme')
    fallback  the theme it shows when it picks none (the site's own: Darkest; a section's: the
              site's theme)
    follow    what it follows ('site': a section's, the header's), or '' (the site's own picker:
              nothing to follow). Following: a Follow site choice first, stored as nothing (left
              out); left out, the inherited theme shows dimmed (the Select's placeholder); every
              theme pick is stored, the site's own theme too (its own, it stays when the site's
              changes); the reset reads "Use the site's". Not following (the site's): picking the
              fallback stores nothing, as its reset (Use Darkest) does
    label, help  the Field's
  One undo step a pick (keyed as Theme › Color's edits: color:<file>#<ptr>). The values it may
  store are the ones ewcms check accepts (src/render/colors.js colorThemeProblems).
-->
<script>
  import Field from './Field.svelte';
  import { THEMES } from '../../render/colors.js';
  import {
    FOLLOW,
    followEdit,
    followShown,
    themeEdit,
    themeLabel,
    themeShown,
  } from '../lib/color-themes.js';

  let { live, file, ptr, fallback, follow = '', label, help = '' } = $props();

  const THEME_OPTIONS = THEMES.map(([name, text]) => [name, text]);
  const opts = () => ({ key: `color:${file}#${ptr}`, source: 'panel' });
  const stored = $derived(live.get(file, ptr));
  // following: its own theme, or '' with the inherited one dimmed (the placeholder)
  const pick = $derived(
    follow
      ? followShown(stored, fallback)
      : { value: themeShown(stored, fallback), own: themeShown(stored, fallback) !== fallback },
  );
  const options = $derived(
    follow ? [[FOLLOW, `Follow ${follow}`], ...THEME_OPTIONS] : THEME_OPTIONS,
  );
  const resetText = $derived(follow ? `Use the ${follow}'s` : `Use ${themeLabel(fallback)}`);
  const write = (v) =>
    live.store.set(file, ptr, follow ? followEdit(v) : themeEdit(v, fallback), opts());
</script>

<Field
  edit="{file}#{ptr}"
  {label}
  type="select"
  {options}
  value={pick.value}
  placeholder={follow ? `${themeLabel(fallback)} (the ${follow}'s)` : ''}
  unsaved={live.changed(file, ptr)}
  {help}
  reset={{
    on: pick.own,
    label: resetText,
    title: resetText,
    run: () => live.store.set(file, ptr, undefined, opts()),
  }}
  onvalue={write}
/>
