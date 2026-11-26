# Changelog

Releases are tagged `vX.Y.Z` on main; a site pins one in its `package.json`
(`"ewcms": "github:EverythingWidget/ewcms#vX.Y.Z"`). Breaking changes are marked **Breaking** and
say what a site must do before it bumps its pin.

## Unreleased

### Breaking: what a site must do before bumping to the next release

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
  `--tag-border-color`. Each colour has one source, the color theme (the button: glass tinted by
  Button; the current nav item: Text and Background; the phone menu's: Accent; selection: the
  smart Selection; the skip link: Text and Background; a tag's border: the smart Disabled). The
  button's shape, type and blur tokens (`--btn-radius`, `--btn-backdrop`, …) stay. In the commit
  that bumps the pin: drop them from `theme/tokens.scss`.

- **Breaking: the text styles' colour tokens `--type-<style>-color` are gone.** A text style's
  colour is its sub-role in `content/theme.json` `colorThemes.<name>.typography.<style>`.
  Paragraph, Label and Small now follow Text instead of the faded colour, and a List's facts
  and count follow Label. In the commit that bumps the pin: move any `--type-<style>-color`
  from `theme/tokens.scss` into the site theme's `typography` (a palette slot or `#hex`).

### Engine

- **Palette and color themes (step 1 of the colour plan, no UI yet).** `content/theme.json` can set
  `palette` (5 × `#rrggbb`, slot 1 the calm, background end), `colorThemes` (Lightest, Light,
  Accent, Dark, Darkest: each of the 12 roles a palette slot 1-5, a custom `#rgb`/`#rrggbb`, or
  `"none"` on fills: Background, Button, Line, Header) and `colorTheme` (the site color theme,
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
  colour (`colorThemes.<name>.typography.<style>`, `--color-type-<style>`); unset, Title,
  Heading, Subheading and Statement follow Heading, and Paragraph, Label and Small follow Text
  (not a faded colour any more). It can set a template's roles too
  (`colorThemes.<name>.templates."<template id>"`, e.g. `"preset:card"` or `"t-ab12"`:
  Background, Text, Heading, Link, Button, Button text, Line and its text styles), for its items
  only (class `tpl-<id>`). A template is its own thing: one made from a preset or another
  template (Duplicate) gets a copy of its parent's sub-roles in `content/theme.json`, once;
  `basedOn` stays a note and is never followed (a template with no entry of its own uses the
  section's roles). A Background a template sets paints its items when the item style's fill
  is left empty; None is always see-through, Surface a surface of it. `ewcms check` reads a
  template's text against what renders under it: with fill None (Plain, Photo, a site template
  whose style says None) the section's background, not the template's Background. `ewcms check` checks a template's text against its own Background.
- **The editor's preview follows theme.json's color themes in place:** a palette, role or
  sub-role edit rewrites the page's `<style id="color-themes">` (no reload), as it already does
  the theme's CSS variables.
- **`ewcms check` names colour tokens a site's `tokens.scss` still sets** (the old aliases
  `--bg`, `--fg`, `--muted`, `--brand`, …, the retired `--btn-bg`, `--nav-active-bg`, … and
  `--type-<style>-color`): they colour nothing of the engine, so it says to put the colours in
  `content/theme.json` `palette` / `colorThemes` and drop them.

### Editor

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
