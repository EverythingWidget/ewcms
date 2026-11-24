# Changelog

Releases are tagged `vX.Y.Z` on main; a site pins one in its `package.json`
(`"ewcms": "github:EverythingWidget/ewcms#vX.Y.Z"`). Breaking changes are marked **Breaking** and
say what a site must do before it bumps its pin.

## Unreleased

### Breaking

- **Breaking: `theme/theme.json` is `theme/meta.json`.** The theme folder's manifest (`name`,
  `themeColor`, `colorScheme`, `preloads`) is renamed, so `theme.json` only means
  `content/theme.json`. No migration: `git mv theme/theme.json theme/meta.json` in the commit
  that bumps the pin. Until then its preloads and color-scheme are not used; `ewcms check` warns
  while a `theme/theme.json` is left.
- **Breaking: `site.json` `accent` is gone.** The brand colour is `--brand` in the theme
  (`theme/tokens.scss`), not `site.json`. `ewcms check` warns if `accent` is still in
  `site.json` (it is ignored; you can delete the key). Album item `accent` values are
  unchanged. First run no longer asks for a look colour; Site settings no longer has
  Accent color. Set `--brand` (and `--accent`, the default background glow) in the theme.
  Once the Theme area can edit tokens, those values are changed there.
- **Glass follows `--brand`.** The glass surfaces (the header's pill, dropdowns, the phone menu,
  `.btn` such as the Button widget and the Form's Send, the carousel's arrows) are tinted by
  `--brand`, so they stay the brand colour on every page. An album's `--accent` now tints only
  the background glow. A site whose `--accent` already equals `--brand` looks the same.

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
