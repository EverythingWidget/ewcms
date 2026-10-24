# Theme migration: from a full copy to layers (ewcms 0.1.37+)

Before 0.1.37 a site's `theme/` was a full copy of the engine's `theme-default/` (`theme.json`
and `styles/` with `_look.scss`, `_chrome.scss`, `_home.scss`, …). Such a copy replaces the
engine's theme, so it misses every theme fix the engine ships. It still works; `ewcms check`
warns about it.

Since 0.1.37 the engine's theme always loads, and `theme/` holds only what differs, each file
optional:

| File                   | What it does                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/tokens.scss`    | `:root` tokens after the engine's (`theme-default/styles/_tokens.scss`): colours, fonts, radius, … Every colour of the engine's look is a token there. `@use 'site-core/tokens' as *;` for the breakpoints (`$bp-sm`). |
| `theme/fonts.scss`     | `@font-face` rules after the engine's (files in `public/fonts`).                                                                                                                                                       |
| `theme/overrides.scss` | rules after the engine's look (`.btn`, `.hero__title`, …). Keep it short.                                                                                                                                              |
| `theme/theme.json`     | merged over the engine's key by key (`name`, `themeColor`, `colorScheme`, `preloads`: a key replaces the engine's whole value).                                                                                        |

## Steps

1. Diff your copy against the engine's: `diff -r theme/styles node_modules/ewcms/theme-default/styles`.
2. Token values that differ from the engine's `_tokens.scss` go in `theme/tokens.scss`
   (`:root { … }`), with any tokens of your own (brand colours, glass, …).
3. Your `@font-face` rules go in `theme/fonts.scss` (the engine's DM Mono and Momo Trust Display
   stay declared; unused fonts are never downloaded).
4. Rule changes in `_chrome`, `_home`, `_pages`, `_album`, `_glass` go in `theme/overrides.scss`.
5. In `theme/theme.json` keep only the keys that differ.
6. Delete `theme/styles/`. A `theme/` with only the engine's values can go entirely.
7. `npx ewcms check` (no theme warning), then compare every page, desktop and mobile, before and
   after (screenshots).

## 0.1.41: `--brand` and the hero's height

- **`--brand`**: the site's fixed colour. It defaults to `site.json`'s `accent` (the page head
  sets `--site-accent`; the engine's token is `--brand: var(--site-accent, #cfc8b8)`), and
  `src/client/theme.js` never tweens it: only `--accent` follows the open album. The engine's
  links (the nav's hover, the menu's active item), focus rings and the header's clock dot use
  `--brand`; the glass tints, the background glow, `::selection` and the album and project names'
  hover keep `--accent`. A site with its own brand colour sets `--brand` in `theme/tokens.scss`
  (it wins over the engine's). Use `var(--brand)` for buttons and links that must stay on-brand.
- **The hero takes its widget's height.** `.hero` no longer sets `calc(100svh - var(--nav-h))`
  (and no `min-height`): a hero sized **Rows** or **Aspect** is as tall as its rows, in every
  Style, and its section grows with it. A hero sized **Auto** (no rows of its own) fills what its
  section's preset height (Third / Half / Full) leaves under the navbar, else the screen, as
  before. A Rows hero that relied on the old screen height now needs its rows set to it (about
  the screen's height divided by the cell: 68 rows on a 1440 × 900 full-width section).
