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
The **Pages** tab starts at the pages list, in menu order. **+** adds a page. Drag a row to
reorder the menu, or into **Not linked** to take it out. Double-click a row to go in, or use the
pen to edit it. Rename a page in its **SEO** tab (Address); links follow.

## Sections and widgets
A page is a stack of **sections**; each holds **widgets** (text, photo, button, list…).
- **Add section** at the bottom, **+ Add widget** in the section's toolbar. Drag a widget's
  grip in the list to change its order.
- In the preview: **click** selects a widget, **drag** moves it, the **handles** resize it
  (it snaps to the grid). Ctrl/⌘+click or drag a box over empty space to select several.
  Esc or a click on empty space deselects.
- **Double-click** a widget (or its row) opens its widget settings pop-up; the **gear** in its toolbar
  does too. Double-click text to edit it in place. The pop-up has two tabs: **Content** (its
  source, widget settings and texts) and **Layout** (size, layer, what it follows, the **Content box**:
  Contain / Cover on a photo, Fit / Fill on a button, placement, Scale to fit). It opens on the
  tab you used last.
- Drag a widget's top circle onto another's bottom circle to make it follow that widget.
- **Text sizes**: each line has its style's size. **Fit width** in the text toolbar (after
  the style) makes the line the caret is in fill the widget's width; click it again for the
  style's size. **Scale to fit** in a Text widget's Layout tab (after Placement; also in its
  toolbar, after Auto height) scales the whole text down when the widget is too narrow or too
  short for it.
- **Lists** in text: the two list buttons in the text toolbar (after Fit width), or type `- ` or `1. `
  at the start of a line. Enter adds the next item; Enter on an empty item ends the list;
  Backspace at the start of an item makes it a normal line again.
- **Properties** in text: type `{name}` (a property of the widget's source), or pick one from
  **+ Property**; both make the same chip. A source's name (e.g. `{people}`, under **Count of a
  source**) is not a property: it shows how many items that source has. `{value}` is only the
  placeholder of a format; typed in a text, it is a property called value. Type `{{` for a
  plain `{` and `}}` for a plain `}`. A chip in orange is a name nothing has (Save refuses it).
  In a widget's settings, the picker at a setting's label: **Custom** (its own text), a
  property, or **Text with properties** (text and chips, + Property adds one). A widget whose
  properties all have no value (empty; 0 is a value) isn't on the site; in the editor it's
  dimmed with "No value for {name}".
- **Ctrl/⌘+Z** undoes, Shift+Ctrl/⌘+Z redoes.
- An **ⓘ** beside a setting explains it: click it, Esc or a click elsewhere closes it.

## Sources and media
**Sources** (database icon) holds your lists, e.g. people or albums; a list widget shows one.
**Media** holds your photos; a photo field's **Change** opens it to pick or upload one.

## Menu and footer
They belong to every page: open them under **Site** at the top of the pages list.

## Page entrance, scroll backdrop, SEO, motion
The **page entrance** is how visitors arrive at a page: the **curtain** (a panel covering the
screen, showing the page's name) or, without one, the **page fade**. Both are set once for the
site in **Site Settings > Page entrance**. A page's **Element motion** tab sets its animations; its
**Page motion** tab holds the **Page entrance** card, which says whether it uses the curtain (**Site default**) or not (**Off**: a page
fade), with a link to those site Settings. The **Scroll backdrop** card, just above it in the
**Page motion** tab, holds the images behind its sections that change as the visitor scrolls. Each page also has **SEO** (title,
description, address, hidden from search).

## Saving
**Save** (Ctrl/⌘+S) writes your changes as a draft. **Publish** commits and pushes everything
saved, so the live site updates. ▶ previews the site as a visitor sees it.
