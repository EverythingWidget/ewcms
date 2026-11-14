# starter/

What `ewcms new-site` copies into a new site.

- `site/` — the site root: `package.json`, `site.config.mjs`, `public/`, `functions/`, and `gitignore` (renamed to `.gitignore`).
- `theme/` — a tokens stub. The new site's theme layers over the engine's `theme-default/`; its name is written into `theme.json`.
- `content/` — Home (a short guide), About, and 404. `content/templates/` and `content/en/sources/` are there, empty, so those folders exist from the start.
- `media/` — source photos; empty until you add some.
- `widgets/` — the site's own widgets; empty until you add some.

`ewcms new-site` copies these folders and leaves out this README and the `.gitkeep` files that hold the empty ones in git.
