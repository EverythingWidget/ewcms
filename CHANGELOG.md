# Changelog

Releases are tagged `vX.Y.Z` on main; a site pins one in its `package.json`
(`"ewcms": "github:EverythingWidget/ewcms#vX.Y.Z"`). Breaking changes are marked **Breaking** and
say what a site must do before it bumps its pin.

## Unreleased

### Breaking: what a site must do before bumping to the next release

- **Breaking: a section's own space above it is gone (Space above this section).** A section's
  `sectionSpace` / `sectionSpacePhone` and the section popup's **Space above this section** field
  are removed: the space between sections is the site's, the same for every section (Theme ›
  Layout's **Space between sections**, `content/theme.json` `layout.sectionSpace` /
  `layout.sectionSpacePhone`, unchanged: not on the first visible section of a page, on the first
  footer section). For more above one section, leave empty rows above its widgets. A leftover is a
  gone key: the content still loads, the renderer ignores it (no `--sspace` / `--msspace`), and
  `ewcms check` warns: `section 2: "sectionSpace" is gone: the space between sections is the
site's, Space between sections in Theme › Layout ("layout.sectionSpace" in content/theme.json);
for more above one section, leave empty rows above its widgets. Remove "sectionSpace" (it was
8)`. Migration: remove the keys (to keep the space, add that many empty rows above the
  section's widgets, or set the site's).
- **Breaking: an item template's `style.background` and `style.hoverBackground` are gone: one
  fill, the color theme's.** An item's fill (on hover too) is the Background its template sets in
  `content/theme.json` (`colorThemes.<theme>.templates.<id>.background`; left out or
  `"transparent"`: no fill, the section shows through). The presets lost theirs too (Plain and
  Photo were `transparent`, which is now simply the default). `ewcms check` warns about a leftover
  (a warning: the content still loads and the render ignores the key):
  `"style.background" is gone: … Remove "style.background" (it was "transparent")`. Migration: drop
  the key from each `content/templates/t-*.json`; where a color theme gives that template a
  Background and the item should stay see-through, set it to `"transparent"` there. The editor
  never showed these keys (the dead `item-style-rows.js` is removed), and contrast reads
  `theme.json` only (no "see-through templates" list). eeliyarasta: `content/templates/t-prow.json`
  `"style": { "border": "bottom", "background": "transparent" }` becomes
  `"style": { "border": "bottom" }` (its `theme.json` has no `colorThemes`, so nothing to add there).

- **Breaking: `theme/meta.json` `colorScheme` moves to `content/theme.json` `color.scheme`.** The
  color-scheme meta is written from `color.scheme` (`dark`, `light`, `light dark`, and the other
  usual values; left out: none), the same way `color.themeColor` already is. No migration:
  `ewcms check` warns about a leftover `colorScheme` in `theme/meta.json` (ignored). In the
  commit that bumps the pin, move it into `content/theme.json` and drop it from `theme/meta.json`.

- **Breaking: the engine's chrome and widgets read the palette's roles, not the theme's colour
  tokens.** Colours come from `content/theme.json` `palette` and `colorThemes` (the engine's
  defaults are today's default-site look). A theme's `tokens.scss` colour tokens (`--bg`,
  `--fg`, `--muted`, `--brand`, `--line`, `--header-fill`, …) no longer colour the engine: they
  are aliases of the roles for a site's own CSS only. Until a site sets a palette, its
  `color.brand` is slot 4 (Accent). In the commit that bumps the pin: put the site's colours in
  `content/theme.json` `"palette"` (slot 1 the background end) and drop the colour literals from
  `theme/tokens.scss` (keep the shades, `--error` and `--hero-*`). The text over a photo
  (`--hero-fg`, `--hero-muted`), the shades (`--shade-*`) and `--error` stay tokens.

- **Breaking: the colour tokens that could override a role are gone:** `--btn-bg`, `--btn-fg`,
  `--btn-hover-bg`, `--btn-hover-fg`, `--nav-active-bg`, `--nav-active-fg`, `--menu-active-fg`,
  `--selection-bg`, `--selection-fg`, `--skip-link-bg`, `--skip-link-fg` and
  `--tag-border-color`. Each colour has one source, the color theme (the button: its Button role,
  glass by default; the current nav item: Text and Background; the phone menu's: Accent; selection: the
  smart Selection; the skip link: Text and Background; a tag's border: the smart Disabled). The
  button's shape, type and blur tokens (`--btn-radius`, `--btn-backdrop`, …) stay. In the commit
  that bumps the pin: drop them from `theme/tokens.scss`.

- **Breaking: a list item's fill is no token any more: `--item-bg` and `--item-bg-hover` in
  `theme/tokens.scss` are not read.** Each item sets its own fill (its style's Surface or Transparent,
  else the Background its own template sets in the color theme, else transparent), so an item inside
  another never takes the outer one's; hover keeps its own fill unless its style sets one.
  `ewcms check` names them. In the commit that bumps the pin: drop them from `theme/tokens.scss`.

- **Breaking: the text styles' colour tokens `--type-<style>-color` are gone.** A text style's
  colour is its sub-role in `content/theme.json` `colorThemes.<name>.textStyles.<text style>`.
  Paragraph, Label and Small now follow Text instead of the faded colour, and a List's facts
  and count follow Label. In the commit that bumps the pin: move any `--type-<style>-color`
  from `theme/tokens.scss` into the site theme's `textStyles` (a palette slot or `#hex`).

- **Breaking: a color theme's text-style colours are `textStyles`, not `typography`.** In
  `content/theme.json` `colorThemes.<name>` and in each template entry
  (`colorThemes.<name>.templates.<id>`), the per-text-style colour sub-roles moved from
  `"typography": { "label": 4 }` to `"textStyles": { "label": 4 }`, so they no longer share a name
  with theme.json's `typography` (sizes and `typography.fonts`, unchanged). The CSS variables stay
  `--color-type-<text style>`. `ewcms check` names a leftover `typography` there as not a role. No
  migration: no site has color themes saved yet; one that does renames the key.

- **Breaking: Heading is a text style, not a color theme role.** The roles are 11: `heading` is
  gone from `colorThemes.<name>` and from template entries (`colorThemes.<name>.templates.<id>`),
  and `--color-heading` is no longer set. Every text style left out follows Text, Title, Heading,
  Subheading and Statement too (the engine's Heading was Text's slot in every theme, so nothing
  looks different); a template's text style it leaves out follows its own Text when it sets one,
  over the section's text style. `ewcms check` names a leftover `heading` key and where it goes
  (`textStyles.heading`, `title`, `subheading`, `statement`). In a site's CSS, read
  `var(--color-type-<text style>, var(--color-text))` instead of `--color-heading`. No migration: no
  site has color themes saved yet.

- **Breaking: the colour value `"none"` is `"transparent"`.** A fill with no colour of its own is
  `"transparent"` everywhere: a color theme's roles and template entries in `content/theme.json`
  (Background, Button, Line, Header; Button's mode is Glass / Color / Transparent) and an item
  template's `style.background` / `style.hoverBackground` (`content/templates/t-….json`; the
  presets Plain and Photo say it too). `"none"` is no longer read: a role falls back to the
  engine's default and an item style fill to the theme's. `ewcms check` names a leftover `"none"`
  and says to use `"transparent"`. Other `"none"` values (border, shadow, text over photo, hover
  effect, motion, sources) are unchanged. In the commit that bumps the pin: change
  `"background": "none"` / `"hoverBackground": "none"` in `content/templates/*.json` (and any
  colour role set to `"none"` in `content/theme.json`) to `"transparent"`.

### Engine

- **A removed or retired key is a warning, not an error.** Old content loads again in the dev
  server and the editor (`assertContent` no longer throws for it; the editor's error overlay
  stayed up on a leftover `style.background`), and `ewcms check` lists it under warnings; the
  renderer ignores the key. This covers an item template's `style.background` /
  `style.hoverBackground` and the style keys the template grid took over (`padding`, `spacing`,
  `photoRatio`, `photoFit`, `photoPlacement`, `textOverPhoto`, `align`, `titleSize`: a site
  template's are no longer rendered), a template's `opens` / `photoFirst`, a template widget's
  `details`, `grow` and a photo's `config.width`, a widget's `z`, `header.json` and
  `strings.json` `footer`, and a [param] page's `template`. Real problems stay errors: a wrong
  value, a retired widget type (Photo grid, Side by side, the toggle …), an old shape the
  renderer can't read (`field` / `bind` parts, a `where` rule's `field`).

- **Off counts nowhere in the published output.** A widget that is off (`config.enabled: false`),
  or one in a section that is off, no longer names its page (`<title>`, the curtain), and a
  [param] page whose main widget is off (or sits in a section that is off) builds no item pages:
  `ewcms check` says "No pages are built: the main widget is off (or its section is): switch it
  on". The editor still gets those pages to edit on (unbuilt, noindex), as before.

- **A widget that is off is left out of the published page.** `config.enabled: false` on a page's
  or footer's widget now drops it from the built HTML, as a section that is off (it used to be
  there with `hidden`). A template's widgets were already left out. The editor's preview still
  renders it hidden, so it can be switched on live. The key stays `config.enabled`.

- **One color theme check and one class helper for every kind.** `theme.json` `colorTheme`, a
  section's and `header.json`'s are checked by one function (`colorThemeProblems`, colors.js) and
  get their `ct-<name>` class from one (`withColorTheme`). The message is now the same everywhere:
  `"colorTheme" must be a color theme: "lightest", "light", "accent", "dark", "darkest", not "blue"`
  (a section's still starts with its name).

- **One grid check for every widget (`gridProblems`).** A template's widgets and the Summary and details widget
  are checked as a page's are: layout, `size`, `aspect`, `layer`, `box`, `place`, `scale` and
  `config.enabled`. A bad `box`, `place` or `scale` in a template used to pass `ewcms check` and
  render anyway; it is now a problem. A template's messages read as a page's
  (`sections.0.widgets.2: "size" must be …`).

- **The header's height in grid rows: `header.json` `rows` and `rowsPhone`.** Whole numbers from 1
  to 30 (`ewcms check`); a row is a contained section's square cell (`--grid-row`), so the header
  grows with the window as the sections' rows do. An unset `rowsPhone` is the same number of rows
  as `rows`. Site-wide, no per-page value. They set `--header-h` in the head, over the theme's
  `tokens.scss`. Not breaking: without them the theme's `--header-h` is the height, as before.
  **A site can drop its `tokens.scss` `--header-h` (and its phone value) once it sets `rows`.**
- **A page's own palette: the page file's `palette`.** 5 entries, slot 1 first, each `"#rrggbb"`
  or `null` (that slot is the site's); left out, the site's palette (`ewcms check` validates it).
  Its slots go on `:root` for that page (the head, then the view's `data-palette` on `<html>` on
  each page change, instantly for now). Nothing is rendered for a page without one.

- **Palette and color themes (step 1 of the colour plan, no UI yet).** `content/theme.json` can set
  `palette` (5 × `#rrggbb`, slot 1 the calm, background end), `colorThemes` (Lightest, Light,
  Accent, Dark, Darkest: each of the 11 roles a palette slot 1-5, a custom `#rgb`/`#rrggbb`, or
  `"transparent"` on fills: Background, Button, Line, Header) and `colorTheme` (the site color theme,
  default `darkest`). Left out, the engine's defaults apply. The page head gets one static
  `<style id="color-themes">`: `--palette-1…5`, each theme's `--color-*` roles on `.ct-<name>`
  (the site theme on `:root` too) and the smart colours (`--smart-*`, worked out with
  `color-mix`). A palette set in theme.json is on `:root:root`; until a site has one,
  `color.brand` stands in for slot 4. `ewcms check` validates the shape and warns about text
  under WCAG contrast against its nearest real background. Nothing reads the roles yet.
- **Sections, the header and the phone menu pick a color theme (step 2).** A section (page or
  footer) and `content/header.json` take `"colorTheme": "<name>"`, rendered as class
  `ct-<name>`; left out, they follow the site color theme. A section that picks one paints its
  background edge to edge (contained or not) and sets its text colour. `ewcms check` flags an
  unknown name.
- **Chrome and widgets read roles and smart colours only (step 3).** Text, backgrounds, lines,
  the header (Header, Header text; its bar is the smart Header glass), the phone menu, the
  curtain (Curtain, Curtain text), glass (Background a step toward Text, tinted by Button),
  links in text (Link, Link hover), focus rings, selection and form fields follow the color
  theme of the section, header or page they are in. The default site's `tokens.scss` drops its
  colour literals and its `theme.json` gets the palette that draws the same look. A guard test
  allows no hex, `rgb()` or `hsl()` in the client, the widgets or the default theme but the
  named shades, scrims, the error colour and text over a photo.
- **Sub-roles: text styles and templates (step 4).** A color theme can set each text style's
  colour (`colorThemes.<name>.textStyles.<text style>`, `--color-type-<text style>`); unset, every
  text style follows Text (Paragraph, Label and Small: not a faded colour any more). It can set a template's roles too
  (`colorThemes.<name>.templates."<template id>"`, e.g. `"preset:card"` or `"t-ab12"`:
  Background, Text, Link, Button, Button text, Line and its text styles), for its items
  only (class `tpl-<id>`). A template is its own thing: one made from a preset or another
  template (Duplicate) gets a copy of its parent's sub-roles in `content/theme.json`, once (the
  editor copies them from its theme.json, unsaved edits too, as one undo step; theme.json is then
  unsaved until Save); `basedOn` stays a note and is never followed (a template with no entry of its own uses the
  section's roles). A Background a template sets paints its items when the item style's fill
  is left empty; Transparent is always see-through, Surface a surface of it. `ewcms check` reads a
  template's text against what renders under it: with fill Transparent (Plain, Photo, a site template
  whose style says Transparent) the section's background, not the template's Background. `ewcms check` checks a template's text against its own Background.
- **The editor's preview follows theme.json's color themes in place:** a palette, role or
  sub-role edit rewrites the page's `<style id="color-themes">` (no reload), as it already does
  the theme's CSS variables.
- **`ewcms check` names colour tokens a site's `tokens.scss` still sets** (the old aliases
  `--bg`, `--fg`, `--muted`, `--brand`, …, the retired `--btn-bg`, `--nav-active-bg`, … and
  `--type-<style>-color`): they colour nothing of the engine, so it says to put the colours in
  `content/theme.json` `palette` / `colorThemes` and drop them.

- **Buttons take a mode from the color theme's Button role: a colour, glass or transparent.** Button (a
  theme's or a template's) is a palette slot or `#hex` (a solid fill), `"glass"` (the glass pill,
  the default in every theme, so a site that sets nothing looks as before) or `"transparent"` (text
  only). The Button widget, the Form's Send and the header's CTA read it; Button text applies in
  all modes (its defaults are each theme's Text, as the pill's text was); hover and pressed are
  the smart Button hover / Button pressed, with their own rule for glass (the glass a step and two
  lighter) and transparent (Text at 10% / 18%), so hover always shows. The glass is tinted by Accent now,
  not Button (the same slot in Accent, Dark and Darkest; Lightest and Light move from slot 1 to
  their Accent). A template that sets Text but no Button text: its glass or no-fill button's text
  follows its Text. Only once some Button is not glass does the color-themes style write the
  `.btn` fill per theme. `ewcms check` takes `"glass"` on Button only; the contrast check reads
  Button text on the button colour, or on the section's Background for glass and transparent. The
  chrome (a header with no color theme of its own) works its smart colours out with the site
  theme's modes. No per-button setting and no editor field yet (the Color card is step 5).

- **docs/COLORS.md: the colours a site's CSS may use.** The palette (`--palette-1…5`), the 12
  roles (`--color-*`) and the text-style sub-roles, the smart colours (`--smart-*`) and the Button
  modes (glass, transparent, slot, hex), with the code's names (a test keeps them in step). Prefer roles
  over palette slots, so a section's color theme keeps working; overriding a colour is the
  exception. The default site's `theme/tokens.scss` points to it.

### Editor

- **The selected section's toolbar: its name, and the widget toolbar's +.** With a section
  selected, the Sections tab's toolbar shows the section's name on the left in its own casing
  (the typed name, else "Section N"; a widget's type, PHOTO, stays uppercase), then the same 32px
  **+** icon button as a selected widget's (Add widget to this section; off while the section is
  hidden) as the first of gear / ↑ / ↓ / trash / ⋯. The **+ Add widget** text button is gone.
  Both toolbars have six buttons, so the + sits in the same place and nothing moves when the
  selection switches between a section and a widget. A section card's title in the Sections list
  is in its own casing too ("Section 1", "Intro"; same size, colour and spacing).

- **A widget's fields are declared once for pages and templates.** A setting or config entry
  that a template also offers carries `inTemplate` (a Photo's photo, a Button's label and link, a
  List's Template); `templateFields()` (src/widgets/index.js) lists a type's template rows from
  them and its template-only rows (`inTemplate.fields`: a Button's Opens the item's page, an inner
  List's Items from). When a value is missing is one component (`MissingField.svelte`) for a page's
  and a template's widget. Nothing looks or works differently. A custom widget's
  `inTemplate.fields` still works.

- **The color theme picker can follow the site.** Given `follow` (a section's or the header's
  picker, once they exist; never the site's own), it offers **Follow site** first and stores
  nothing for it; left out, the inherited theme shows dimmed ("Darkest (the site's)"). Any theme
  picked is stored, the site's own theme too, so it stays when the site's changes; the reset reads
  "Use the site's". The site's picker is unchanged.

- **One color theme picker (`ColorThemePicker.svelte`).** Theme › Color's Site color theme is
  drawn by it (the same select, unsaved dot and Use Darkest reset); a section's and the header's
  pickers will use it too.

- **A page's Style tab: Sections | Page motion | Style | SEO.** Its own palette: five full-width
  rows (the hex field with its swatch), a slot that follows the site shown dimmed (bright on hover
  or focus), one of its own bright with a reset arrow back to the site's, and the yellow unsaved
  dot. The preview takes it as you type (no reload).
- **The Header's Style tab: Menu | Elements | Style.** **Height (rows)** and **Height (phone)**
  (empty: the theme's height and desktop's rows, a reset arrow on a value of its own), with the
  height in px at a 1440 window and a 390 phone. The preview takes it at once: a rows edit no
  longer reloads it (other header edits still do).
- **Opacity on a color theme's fill roles.** Theme › Color gives each fill (Background, Button,
  Line, Header, Curtain; a template's Background, Button and Line) an opacity in its label row: a
  compact percent with − and +, empty 100 (a template's: the section's, dimmed), its reset arrow
  putting the colour and the opacity back, the yellow dot while unsaved. Text roles have none.
  Stored as `"opacity": { "<role>": 0-100 }` in a color theme or template entry (left out: solid,
  so nothing changes for existing sites); the role's variable is the colour see-through
  (`color-mix(in srgb, … N%, transparent)`). `ewcms check` validates it, and its contrast warnings
  blend a see-through fill over what is behind it first (text on a see-through site Background
  isn't checked: what is behind the page isn't known). Under each text role and Line the editor
  shows the contrast it works out (docs/COLORS.md).
- **Number fields have − and + buttons.** Every number setting drawn as a field (the Header's
  height, Theme › Layout and Typography, a section's space above and custom rows, a List's space
  between items, other widget numbers) shows its value on the left and two 32 x 32 buttons flush
  right, no dividers. A click steps by the field's step from the value shown (an inherited,
  dimmed value too), clamped: − is disabled at the minimum, + at the maximum. The arrow keys
  still step; quick clicks are one undo step. The motion numbers beside sliders are unchanged.

- **A widget card's motion opens and closes smoothly; a panel header is clickable all over.**
  The card's motion and an animated widget's element list grow and shrink with the panel
  sections' own speed and ease (0.25s, one shared setting), only their own height moving, and
  appear at once with reduced motion. The card's motion sits 4px under its row, 12px at the
  sides and below. A collapsible header (the panel sections, Theme's colour themes, Header's CTA
  button, the motion editor's groups) opens and closes from a click anywhere on it, its padding
  and the card's top edge too, not only on its title or chevron; the controls in it (a switch, a
  reset button) still act alone, and the title stays the keyboard's toggle. Nothing moves on
  screen.
- **Fixed: hovering an element in the motion tree outlines it in the preview again.** An
  element outside the widgets no longer breaks the preview's boxes.
- The old Element motion click mode's leftover code is removed (no change in use); the mockup
  kit's page tabs are Sections | Page motion | SEO (an old `element-motion` tab shows Sections).

- **A page's motion is in its Sections tab (no Element motion tab).** A page's tabs are
  Sections | Page motion | SEO; a saved Element motion tab opens Sections. One tree: each widget
  row shows its animation as a quiet tag ("none" without one) and a 32px ▶ Replay (its room
  always kept, disabled without an animation); a 16px chevron room is kept on every row, the
  chevron drawn when the widget has `data-anim` elements, which list under its card, each with
  its own motion editor (per element, This widget or All, as before). The animated elements
  outside the widgets (Fixed elements) follow Add section. Select a widget and its motion opens
  in its own card: the 48px row stays its header, the slim panel is the body, the accent ring
  goes round the whole card. The slim panel: the Animation select beside a 32px info button
  (disabled for none) whose popover lists the animation's properties with their start and end
  values; no From/To, Target or summary. Timing shows only the fields the widget sets, the rest
  behind **Customize timing**; Scroll start, Scrub and the **Scroll** field only when it plays
  On scroll, Stagger only with several elements. The inherit/Custom switches give way to the
  reset arrow rule: an own value is bright with its reset arrow, an inherited one dimmed but
  editable. In the Sections tab the preview's clicks always arrange (a click picks the widget,
  not an animated element); a Replay or the Scroll field plays the page's animations until the
  motion closes, a text edit starts or the clicks change. The shared Popover gets an opt-in
  `tip` (an 8×4.5 tip on the trigger's centre, the same surface and ring, no seam); the other
  popovers are unchanged. No content change.

- **The dots: yellow means unsaved, the reset arrow means a value of its own.** Every field's
  unsaved dot is the top bar's yellow and sits right after its label (and its (i)); a section
  card's or a pane heading's after its title. Its room is always kept, so nothing moves when it
  shows. A value of its own (not the default) is shown only by the reset arrow, never a cyan dot:
  Motion's elements with their own values in a widget get a reset arrow (drop them: the
  animation of all), and a color theme card with any own colour gets one on its bar (all back to
  the defaults), in a slot kept while empty. Theme › Color's roles, palette slots and site color
  theme show the unsaved dot too. Components take `unsaved` (was `changed`).

- **Theme › Color is the palette and the color themes (step 5).** The card ("Palette and color
  themes") holds the **Palette** (5 slots, each a hex field with its swatch picker), a card per
  **color theme** (Lightest … Darkest, a fixed-size preview chip on its bar; open: its 11 roles,
  each a row of field-style swatches on a 7-column grid, every box the same size (a row without
  Transparent leaves the 7th empty): the 5 palette slots, Transparent on fills and a
  custom colour in the 190px popover, kept inside the panel; the picked one has a 2px inner
  ring), its read-only **Smart colors** and the **Site color theme** select. Button is Color /
  Glass / Transparent on a row of its own, its swatches under it, greyed out and disabled for Glass and
  Transparent (the row keeps its height). The 7 text styles are rows of their own right
  after Text (Title, Heading, Subheading, Statement, Paragraph, Label, Small: no group), in a theme
  and in a template's sub-roles (pick the template under Templates), greyed while they follow
  ("follows Text"); the chip's Aa is the Title's colour. A role that isn't the default, or a sub-role set, gets the editor's
  changed dot in its row's padding (no shift); a theme with any, on its card. theme.json keeps only
  what differs. Every pick is one undo step and the preview's `#color-themes` / theme-vars are
  rewritten in place (no reload, no render job). The Brand color and Color scheme fields leave
  (`color.brand` and `color.scheme` are still read until step 10).

- **The preview keeps a stable scrollbar gutter,** so a short page and a long one
  have the same width when the bar appears. Injected by the editor only; the
  published site is unchanged.

- **Header has Menu and Elements tabs.** Menu holds the nav links as border-only cards (a
  dropdown's links too). Elements holds Title, Logo, CTA button and Labels, each a
  collapsible card; the CTA's show switch sits on the card bar. The logo (a photo) and the
  CTA (show, label, a link) live in `content/header.json`; when a logo is set it replaces the
  site name in the header. The CTA, when shown and labelled, is a button at the end of the
  nav and the phone menu. Title stays `site.json` `name`. Subtitle: “The menu, logo and
  button.”
- **Theme opens as Color, Typography and Layout cards.** A click opens that part on its own
  screen (title over a quiet “Theme”, ← back to the list). The open part is kept across a
  refresh. Typography’s Preview is full width under the hint; style names (Title · H1, …) are
  14px and medium weight. Typography size fields bind their stored min, max and line
  (the pointer had `{key}` as text, so overrides did not show).
- **A field’s revert** shows only when that field has a stored value, at the right end of the
  label row (the 24px row does not shift). The unsaved-change dot is unchanged.

- **Theme › Color** has a Color scheme field (`color.scheme`): Dark, Light, Light dark, Dark
  light and Normal; empty writes no meta. The preview updates the color-scheme meta in place,
  with no reload.
- **Theme › Typography can pick fonts.** The theme lists the families it provides in
  `theme/meta.json` `"fonts"` (`{ family, fallback? }`). `content/theme.json`
  `typography.fonts.display` / `body` write `--f-display` / `--f-body`, and
  `typography.<style>.font` writes `--type-<style>-font`. Empty, the theme's stacks apply. A name
  the theme doesn't list is kept but not emitted; `ewcms check` warns. Not breaking: every key is
  optional. See docs/THEME-MIGRATION.md.

## 0.12.0 (2026-11-24)

### Breaking: what a site must do before bumping to 0.12.0

Migration, in the commit that bumps the pin (no automatic conversion; `ewcms check` warns about
each leftover):

1. `git mv theme/theme.json theme/meta.json`, and take `themeColor` out of it.
2. Add `content/theme.json` with the look's values: `color.brand` (was `site.json` `accent`),
   `color.themeColor` (was `theme/theme.json` / `site.json` `themeColor`), `typography` (was
   `site.json` `type`) and `layout` (was `site.json` `layout`), each only if the site set it:
   `{ "version": 1, "color": { "brand": "#cfc8b8", "themeColor": "#050505" }, "layout": { "containedCols": 96 } }`.
3. Remove `accent`, `layout` (and `type`, `themeColor` if present) from `content/site.json`.
4. In `theme/tokens.scss`, a `--brand: var(--site-accent, …)` becomes a plain `--brand: …;`
   (`--site-accent` is no longer written).
5. The page head's `<style id="accent-init">` is `<style id="theme-vars">`: CSS or scripts that
   looked for `#accent-init` look for `#theme-vars`, and a section named "Theme vars" now clashes
   (a reserved id) instead of "Accent init".

- **Breaking: `theme/theme.json` is `theme/meta.json`.** The theme folder's manifest (`name`,
  `themeColor`, `colorScheme`, `preloads`) is renamed, so `theme.json` only means
  `content/theme.json`. No migration: `git mv theme/theme.json theme/meta.json` in the commit
  that bumps the pin. Until then its preloads and color-scheme are not used; `ewcms check` warns
  while a `theme/theme.json` is left.
- **Breaking: the look's values move to `content/theme.json`.** A new content file next to
  `site.json`: `color.brand` (`--brand`, `#rrggbb`), `color.themeColor` (the theme-color meta),
  `typography` (was `site.json` `type`, same shape) and `layout` (was `site.json` `layout`). The
  page head writes them over the theme's `tokens.scss` defaults (`:root:root`); left out, the
  defaults apply and no theme-color meta is written. The head's style that holds them (and an
  album's `--accent`) is `<style id="theme-vars">` (was `id="accent-init"`), so `theme-vars`, not
  `accent-init`, is a reserved id a section's name can't take. `site.json` keeps only site facts. No
  migration: `ewcms check` warns about `accent`, `themeColor`, `type`, `typography` or `layout`
  left in `site.json` and `themeColor` left in `theme/meta.json` (all ignored). See
  docs/THEME-MIGRATION.md.
- **Breaking: `site.json` `accent` is gone.** The brand colour is `content/theme.json`
  `color.brand` (or the theme's `--brand` default in `theme/tokens.scss`). Album item `accent`
  values are unchanged. First run no longer asks for a look colour; Site settings no longer has
  Accent color.
- **Glass follows `--brand`.** The glass surfaces (the header's pill, dropdowns, the phone menu,
  `.btn` such as the Button widget and the Form's Send, the carousel's arrows) are tinted by
  `--brand`, so they stay the brand colour on every page. An album's `--accent` now tints only
  the background glow. A site whose `--accent` already equals `--brand` looks the same.

### Editor

- **Theme edits `content/theme.json`.** Color (Brand color: a hex field with a swatch that opens
  the color picker; empty, the theme's `--brand`, shown greyed), Typography (was Type; Fonts and
  styles is folded into it, so its Coming soon row is gone) and Layout read and save
  `content/theme.json`; Save makes the
  file when the site has none. The preview follows every value as it is typed, undo and redo
  too, without a reload. A section's space placeholder follows `theme.json` `layout`.
- **Space between sections** (F90): a number of grid rows (`layout.sectionSpace`,
  `sectionSpacePhone`, now in `content/theme.json`), with a per-section override in the section
  popup.
- **Templates is its own area** (a grid icon), no longer under Theme; Theme holds the look only
  (Type and Layout moved there from Site settings, then became Typography and Layout).
- A List's Custom items are border-only cards with Source last; the template editor allows Edit
  template on a List inside a template, and widget types declare their add rules and Content rows.
- The preview in edit, and an open header or footer, get a white and black ring; the header's and
  footer's ring is drawn above their children. The section popup's Height and Width no longer
  overlap; picking a text style closes the Style menu; Typography's style names sit with their
  own fields.

## 0.11.0 (2026-11-23)

### Breaking: what a site must do before bumping to 0.11.0

- **Breaking: Album (the item) (`album`) is gone.** Use a List (`list`) with a From URL source
  and a template (`"config": { "template": "preset:plain", "columns": "1" }`, or a site template
  such as `t-albp` / `t-albl`). `ewcms check` names the replacement. There is no conversion.

### Editor

- The old `/edit/?path=…` redirect is gone. The editor is `?edit` only.
- The `site.config.mjs` warning is gone (`ewcms.config.mjs` is the one config). Sites that have
  not yet renamed do so on their next pin bump (`git mv site.config.mjs ewcms.config.mjs`).
  There is no fallback: a site that still has `site.config.mjs` is read as having no config.
- The preview's layout layer (`src/editor/overlay.js`) is split: `overlay.js` keeps what shows,
  the pointer's dispatch and the one draw loop; `overlay-drag.js` (one widget's move and resize),
  `overlay-select.js` (group move, nudge, selection box), `overlay-links.js` (link lines and link
  drag) and `overlay-rows.js` (a Custom section's rows) share its one state. The split itself
  changes nothing in how it works.
- Esc cancels any drag in the preview (a widget's move or resize, a group move, the selection
  box, a link, a Custom section's rows) wherever the focus is, in the editor or the preview. It no
  longer also drops the selection.
- Arrows, Enter and letters pressed in the preview act as they do in the editor (G14): the arrows
  nudge the picked widgets, Enter or a letter edits a picked Text. A text edited in place keeps
  them (the caret, a line break, typing).
- **Areas.** The editor opens on one list of the site's parts: Pages, Media, Sources, Theme,
  Animations, Site settings and History, each with what it holds. It replaces the Pages | Site
  Settings tabs and the footer's Sources and Media buttons: each part opens from the list only,
  and comes back to it with ← Back to areas. History and Theme's Fonts and styles say Coming
  soon. Pages starts with its Site parts (Header, Footer); the item templates moved to Theme
  (their ← and Done come back there); the default timing, the Animations library and the Page
  entrance moved from Site settings to Animations. The URL's `tab` is the area (`areas`, `pages`,
  `theme`, `animations`, `site-settings`); an old `tab=settings` link (or session) opens Site
  settings, an old `tab=settings&animation=…` link Animations.
  No content or data format change.
- **About.** The areas that open a window (Media, Sources and the new **About**) are half-width
  cards, two a row, under the list. About holds what the footer's Update available pill and its
  card did: its card says the version (`ewcms v0.9.0`) or the update (`Update to v0.10.0`,
  highlighted in teal); its window shows the update with its changes, Later / Update and the
  update's steps, or Up to date, then what ewcms is and the engine the site pins. Later closes
  it and takes the highlight off for this visit. The footer is Desktop | Phone (and undo, redo).
  `GET /__editor/update` also answers the pin (`pin`).
- **Publish commits every saved change in the site folder** (content, theme, `media/`, other
  files), not only content JSON; `.gitignore`d files stay out. It refuses, with nothing staged,
  secret-looking files (`.env*` but `.env.example`, `.dev.vars`, `*.pem`, `*.key`, `id_rsa*`,
  `*.p12`), files over 95 MB, a detached HEAD, a rebase or merge in progress, and a missing git
  name/email. It brings in GitHub's new commits first (fetch + rebase; on a conflict the rebase is
  aborted and the commit kept), then pushes (`-u` for a new branch). Never forced. The Publish
  window lists the files grouped (content, sources, templates, theme, media, other) and the
  refused ones. Load, save, status and publish go through the data layer (`src/editor/data/`,
  `src/editor/server/local-data-layer.mjs`).

## 0.10.0 (2026-11-17)

### Breaking: what a site must do before bumping to 0.10.0

- **Breaking: `starter/` is `default-site/`.** The engine's default site (what `ewcms dev` copies
  into a folder with no site) moved; `STARTER_THEME` is `DEFAULT_SITE_THEME` and the scaffold's
  `STARTER` is `DEFAULT_SITE`. A site's own files are not affected; a script that read
  `ewcms/starter/...` reads `ewcms/default-site/...`.

- **Breaking: `ewcms new-site` is gone; `ewcms dev` makes the site.** Run `npx ewcms dev` in a
  folder with no site files (no `ewcms.config.mjs`, `site.config.mjs` or `content/site.json`): it
  copies the default site first, only the files that are missing (a `package.json`, `README.md` or
  `.gitignore` already there stays as it is), pins the ewcms that runs (its release tag, else its
  commit) in a new `package.json` and runs `npm install` once (that run only; `EWCMS_NO_INSTALL=1`
  skips it), then starts the editor, which asks once for the
  site's name, language and accent and writes them to `content/site.json`. The default site's
  `site.json` has an empty `name` until then. A script that called `ewcms new-site <dir>` runs
  `ewcms dev --root <dir>` instead; `newSite` is no longer exported (`scaffoldSite` is). Existing
  sites need nothing.
- The language folder follows `site.json` `lang` (without a `contentDir` in `ewcms.config.mjs`):
  `content/<lang>/` when it exists, else `content/en/`, with a warning in `ewcms check`, `dev` and
  `build`. No folder is made or moved. Sites with `lang: "en"` see no change.

- **Breaking: the body font token `--f-mono` is `--f-body`.** It was the body and UI font (the
  body text, Labels, the chrome), whatever the font: a site with a sans body set "mono" to it.
  There is no alias: the engine reads `--f-body` only, so a theme that still sets `--f-mono` gets
  the browser's default font. Rename it in `theme/tokens.scss` (and anywhere `theme/overrides.scss`
  reads `var(--f-mono)`) in the same commit as the pin bump; `ewcms check` names the rename.
  (The editor's own `--f-mono`, its DM Mono, is the editor's and stays.)

- **Breaking: `site.config.mjs` is `ewcms.config.mjs`.** Rename the file at the site's root
  in the same commit as the pin bump (eeliyarasta-website, godzillaworx, unicderma-website).
  There is no fallback: a site that still has `site.config.mjs` is read as having no config
  (the defaults only). `ewcms check`, `dev` and `build` warn and say to
  `git mv site.config.mjs ewcms.config.mjs`.

- **Breaking: the contact form import is `ewcms/functions/contact`** (was `ewcms/server/contact`).
  A site's `functions/api/contact.js` must import the new path in the same commit as the pin
  bump (eeliyarasta-website, godzillaworx, unicderma-website). The old export is gone.

- **Breaking: Album cards (`albums`) is gone.** Use a List (`list`) with a Card template
  (`"config": { "template": "preset:card" }`, or a site template such as `t-acrp` / `t-acrl`).
  `ewcms check` names the replacement. There is no conversion.

### Editor

- Show only: a List from a source (All or From URL) can show only the items whose field has one
  value, "Show only items where category is uitstraling", with an ⓘ. The field comes from the
  source's schema (else its items), the value from a dropdown of the values its items have.
  Content: `config.showOnly: { "field", "value" }`, values compared as text. One condition only;
  a List without it shows every item, as before.

## 0.9.0 (2026-11-15)

### Breaking: what a site must do before bumping to 0.9.0

- **Breaking: a List's `config.handmade` is `config.custom`.** The content key now matches the
  editor's label (Source: **Custom**). There is no fallback: a List that still says
  `"handmade": true` is not Custom and shows none of its `config.items`. Rename it to `"custom": true`
  on every List that has it (pages, item templates, inner Lists) in the same commit as the pin
  bump.

### Editor

- Info tips (ⓘ) where you learn the editor: the grid and Size / Auto height on the widget
  toolbar, links on the Layout tab, Desktop and Phone, a List's Template and Source, Role, and
  When a value is missing. The single-item widget's Source tip explains From URL, Item and None.
  The Desktop and Phone tip leads the footer row, before the Desktop | Phone toggle.
- Names: Size **Auto** is **Auto height**; the widget toolbar's **Edit** is **Edit text**; the
  Page entrance card's field is **On this page**; Edit template points at Pages › Templates; the
  Sources button's examples are generic.
- The header's Edit / Done and Publish are 32px, as the back arrow and the icon buttons.
- List order: a source owns it. In Sources, each item row has a grip (drag, or Alt+↑/↓) and Save
  writes the new order to `sources/<id>.json`; every List of that source follows it. A List's
  Custom items keep their grip. An ⓘ on the Sources item count and on the List's Source says so.

## 0.8.0 (2026-11-15)

### Breaking: what a site must do before bumping to 0.8.0

- **Breaking: a site needs its own `theme/`.** `theme-default/` is gone from the engine; nothing
  is layered over an engine theme anymore. The look (tokens, fonts, `theme.json`) moved to
  `starter/theme/`, which `ewcms new-site` copies, so a site owns its look. A site without its
  own `theme/tokens.scss`, `fonts.scss` and `theme.json` loses its colours, fonts and head meta.
  `theme.json` is no longer merged over an engine one. `ewcms check` lists any starter token the
  site's `tokens.scss` / `overrides.scss` misses. Steps: `docs/THEME-MIGRATION.md`.
- **Breaking: the contact form import is `ewcms/server/contact`** (was `ewcms/functions/contact`).
  A site's `functions/api/contact.js` must import the new path; the old export is gone.
- **Breaking: the List widget's heading, See all and property mapping are removed.** A List is
  only its items: `heading`, `config.seeAll` and `config.properties` are gone from the type (no
  setting, no Content-tab rows, nothing rendered). A heading is a Text widget and See all a Button
  widget placed next to the List; the item template names the properties it shows (a source
  naming one otherwise duplicates the template and uses `{cover}`, …). Leftover keys render
  nothing and `ewcms check` warns about them, on pages and on inner Lists in item templates.
- **Breaking: shared content files moved to the content root.** `content/en/settings/` is gone:
  `site.json`, `header.json` (was `nav.json`), `footer.json`, `animations.json`, `photos.json`
  and `redirects.json` sit in `content/`, next to `templates/`. A leftover `content/en/settings/`
  is an error that says where its files go. See the README, "Breaking content changes 0.8.0".
- **Breaking: `strings.json` group `nav` is `header`** (`header.menu`, `header.close`,
  `header.clock`, …). No fallback.
- **Breaking: item template format.** A template is one grid section:
  `{ version, kind, name, clickable, preview: { from, columns }, sections: [{ id, height?, rows?, widgets }] }`;
  `label` → `name`, `link` → `clickable`, `source` → `preview.from`; a widget's `z` is `layer`;
  the List's `config.gap` is a whole number of page cells (the `list--gap-*` classes are gone).
- **Breaking: `site.json` `"typography"` is refused**; text sizes are `"type": { <style>: { min, max, line } }`.

### Engine layout (moves only, no behaviour change)

- `src/site` is `src/render` (the `ewcms/widget-api` export is unchanged); `src/site/templates`
  is `src/render/shell`.
- The backend is `src/server` (the contact function, the editor's dev endpoints, local uploads,
  the update notice, Publish's git environment); the top-level `functions/` is gone.
- The CLI and build pipeline are `src/cli`; `scripts/` is the repo's own tooling (hooks, mocks,
  lint rules, test helpers). Tests moved from `scripts/` to `test/`.
- `templates/` (what `ewcms new-site` copies) is `starter/`; new-site copies its empty folders,
  READMEs and `.gitkeep` files.
- The chrome (header, phone menu, curtain, footer, glass) lives in `src/client/styles`; each
  built-in widget's look sits next to the widget (`src/render/widgets/<type>/style.scss`: hero,
  albums, photo, form, album, list).

### Fixes

- Linked widgets flow on the public page too: a widget another follows names itself with
  `data-lead`, so followers no longer overlap their leaders on a built site (About's texts and
  buttons, the 404's button).
- The editor shows the Summary and details widget by its name instead of "Unknown type".
- The Template preview render finds `/__template/` without the Vite render module.
- The section card's bar no longer covers its rounded ring.
- Stale starter and fixture comments fixed.

### Editor

- Browse and edit: one `ui.mode`; Edit / Done in the header, Desktop | Phone in the footer; the
  Preview panel, its Save button and Ctrl+E are gone (Ctrl+S stays).
- Template editor: on the page grid (drag, resize and link widgets, pick a clickable template's
  widgets by pointer), Widgets | Settings, a section card, a Text edited in the preview, the
  widget pop-up and toolbar delete as on pages; the Columns control above the preview (template
  editor only, no pill).
- Edit template from a List returns there: Back pops `ui.originStack` (at most two deep) to the
  page or template, the List selected, its pop-up on the same tab and scroll. The page head shows
  the path back ("People › Album card"), "Used in N lists", and Back's tooltip "Back to People".
- Every modal mounted once in App and opened through a stack (Media over Sources, Sources over
  the item picker); ItemPicker / PreviewPicker are ItemModal / PreviewModal; `lib/dialog.js` is
  `lib/modal.js`; Source Explorer is Sources; the footer's Mobile is Phone.
- The preview updates in place and reloads only when routes or the menu change.
- Site Settings › Type: each text style's min, max and line height as CSS variables, with a
  type specimen preview (`/__type/`, dev only).
- List: Arrangement Grid | Carousel, carousel rows only with Carousel; Content: the Items switch
  is gone, Source Custom is handmade, the source card hides with Custom; "As the List" is
  Inherit, Also needs is gone from the editor.
- Buttons: field fill, 8px corners, a light pressed glow, a filled 32×32 square option, bare
  icon-only buttons; the pages list folder head and page head use square buttons.
- A page opened shows its own sections at once; panel slides move one whole view.
- The widget pop-up's fields show a changed setting in place; quieter text at 45%.
- Renamed editor CSS: `.sec` is `.collapsible` (the generic panel Section is Collapsible), modal
  classes spelled out; the Pages tab id is `pages` (was `nav`).

### Theme

- The Statement style loses its 18% first-line indent.
