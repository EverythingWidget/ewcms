# ewcms: a short guide for site builders

## Start the editor
In your site's folder run `npm run dev` (that is `ewcms dev`) and open
`http://localhost:5173/?edit`. Any page plus `?edit` opens that page. Ctrl/⌘+Shift+E opens the
page you are on in the editor. The editor only exists while `dev` runs; the built site has none.

## What you may change
Only your **site** repo: the content the editor saves (`content/`), your photos (`media/`) and
your theme. Never edit the engine (`ewcms`, in `node_modules`); update it by changing its
version in `package.json`.

## Pages
The **Content** tab starts at the pages list, in menu order. **+** adds a page. Drag a row to
reorder the menu, or into **Not linked** to take it out. Double-click a row to go in, or use the
pen to edit it. Rename a page in its **SEO** tab (Address); links follow.

## Sections and widgets
A page is a stack of **sections**; each holds **widgets** (text, photo, button, list…).
- **Add section** at the bottom, **+ Add widget** in the section's toolbar. Drag a widget's
  grip in the list to change its order.
- In the preview: **click** selects a widget, **drag** moves it, the **handles** resize it
  (it snaps to the grid). Ctrl/⌘+click or drag a box over empty space to select several.
  Esc or a click on empty space deselects.
- **Double-click** a widget (or its row) opens its settings pop-up; the **gear** in its toolbar
  does too. Double-click text to edit it in place.
- Drag a widget's top circle onto another's bottom circle to make it follow that widget.
- **Lists** in text: the two list buttons in the text toolbar (after Fit), or type `- ` or `1. `
  at the start of a line. Enter adds the next item; Enter on an empty item ends the list;
  Backspace at the start of an item makes it a normal line again.
- **Ctrl/⌘+Z** undoes, Shift+Ctrl/⌘+Z redoes.
- An **ⓘ** beside a setting explains it: click it, Esc or a click elsewhere closes it.

## Sources and media
**Sources** (database icon) holds your lists, e.g. people or albums; a list widget shows one.
**Media** holds your photos; a photo field's **Change** opens it to pick or upload one.

## Menu and footer
They belong to every page: open them under **Site** at the top of the pages list.

## Transitions, SEO, motion
Each page has **Transitions** (how it enters) and **SEO** (title, description, address, hidden
from search). The **Motion** tab sets animations.

## Saving
**Save** (Ctrl/⌘+S) writes your changes as a draft. **Publish** commits and pushes everything
saved, so the live site updates. ▶ previews the site as a visitor sees it.
