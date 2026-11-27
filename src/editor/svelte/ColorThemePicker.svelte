<!--
  ColorThemePicker: the one picker of a "colorTheme", for every kind that picks one: the site's
  (Theme › Color, theme.json /colorTheme) today; a section's and the header's use it too when
  they get one. A select of the color themes (THEMES, lightest first) with the yellow unsaved
  dot and a reset (Use <fallback>) when it has a value of its own.
    live      the reactive store (live.svelte.js)
    file      the content file it edits (theme.json, a page, header.json)
    ptr       its pointer there ('/colorTheme', '/sections/2/colorTheme')
    fallback  the theme shown when it picks none (the site's: Darkest; a section's: the site's);
              picking it stores nothing (left out), as a reset does
    label, help  the Field's
  One undo step a pick (keyed as Theme › Color's edits: color:<file>#<ptr>). The values it may
  store are the ones ewcms check accepts (src/render/colors.js colorThemeProblems).
-->
<script>
  import Field from './Field.svelte';
  import { THEMES } from '../../render/colors.js';
  import { themeEdit, themeLabel, themeShown } from '../lib/color-themes.js';

  let { live, file, ptr, fallback, label, help = '' } = $props();

  const OPTIONS = THEMES.map(([name, text]) => [name, text]);
  const opts = () => ({ key: `color:${file}#${ptr}`, source: 'panel' });
  const stored = $derived(live.get(file, ptr));
  const shown = $derived(themeShown(stored, fallback));
</script>

<Field
  edit="{file}#{ptr}"
  {label}
  type="select"
  options={OPTIONS}
  value={shown}
  unsaved={live.changed(file, ptr)}
  {help}
  reset={{
    on: shown !== fallback,
    label: `Use ${themeLabel(fallback)}`,
    title: `Use ${themeLabel(fallback)}`,
    run: () => live.store.set(file, ptr, undefined, opts()),
  }}
  onvalue={(v) => live.store.set(file, ptr, themeEdit(v, fallback), opts())}
/>
