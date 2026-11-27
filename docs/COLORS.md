# Colours in a site's CSS

A site's colours are `content/theme.json`: one **palette** of 5 colours and 5 **color themes**
(Lightest, Light, Accent, Dark, Darkest) that give them jobs, the **roles**. A section, the footer
and the header pick a color theme (class `ct-<name>`); the rest of the page is the site's
(`colorTheme`). The engine writes it all into one `<style id="color-themes">`
(`src/render/colors.js`, the one source of every name below).

A site's own CSS (`theme/*.scss`, a widget's style) may read three kinds of variables.

## Prefer roles

Use a **role** (`--color-*`) or a **smart colour** (`--smart-*`), not a palette slot. A role
changes with the color theme it sits in, so the same CSS works in a dark section and a light one.
A palette slot (`--palette-3`) is the same colour in every section, so it breaks the moment a
section picks another color theme.

Overriding colours is the exception: don't set a `--color-*`, `--smart-*` or `--palette-*`
yourself, and keep colour literals out of `theme/tokens.scss` (it holds what is fixed by design:
fonts, radius, easing, `--error`, the shades `--shade-*` and the text over a photo `--hero-fg`,
`--hero-muted`). To change a colour, change the palette or a color theme in `content/theme.json`.

## The palette: `--palette-1` … `--palette-5`

Slot 1 is the calm, background end, slot 5 the other end. Read a slot only for something that must
stay the same colour in every color theme.

A page can have its own palette (its **Style** tab; the page file's `"palette"`): 5 entries, slot 1
first, each a colour `"#rrggbb"` or `null` (that slot follows the site's). Left out, the page uses
the site's palette. Its slots are put on `:root` for that page only (`<style id="page-palette">` in
the head, then the view's `data-palette` on `<html>` on every page change: `src/client/palette.js`),
so every role and smart colour on the page follows them.

```json
{
  "version": 1,
  "kind": "page",
  "id": "pg-k3x9",
  "palette": [null, "#2a241e", null, null, null],
  "sections": []
}
```

## The roles: `--color-*`

Each color theme sets all 11; a value is a palette slot 1-5, a custom `#rrggbb` (it doesn't follow
the palette), or `"transparent"` (no fill) on a fill.

| Variable | Role | Kind | Notes |
| --- | --- | --- | --- |
| `--color-background` | Background | fill (can be transparent) | the section's surface |
| `--color-text` | Text | text | body text, on Background |
| `--color-link` | Link | text | on Background |
| `--color-accent` | Accent | text | highlights, focus, selection; tints the glass |
| `--color-button` | Button | fill (colour, glass or transparent) | see [Button modes](#button-modes) |
| `--color-button-text` | Button text | text | on Button (glass and transparent: on Background) |
| `--color-line` | Line | fill (can be transparent) | rules, borders |
| `--color-header` | Header | fill (can be transparent) | the header bar |
| `--color-header-text` | Header text | text | on Header |
| `--color-curtain` | Curtain | fill | the page-change curtain (`.curtain`) |
| `--color-curtain-text` | Curtain text | text | on Curtain |

Inside the header (`.header`, `.mmenu`) Background and Text are the Header and Header text, so
CSS there reads `--color-background` / `--color-text` like anywhere else.

The colour value `"none"` was renamed `"transparent"` (in color themes and template entries);
`ewcms check` names a leftover `"none"`.

An item's fill is its template's Background, one fill: `colorThemes.<theme>.templates.<id>.background`
(left out or `"transparent"`: no fill of its own, the section shows through), the same on
hover. An item template's old `style.background` /
`style.hoverBackground` are gone: `ewcms check` names a leftover and where the fill went.

A color theme can also colour each text style (sub-roles, its `textStyles` in
`content/theme.json`): `--color-type-title`, `--color-type-heading`, `--color-type-subheading`,
`--color-type-statement`, `--color-type-paragraph`, `--color-type-label` and `--color-type-small`.
Left out, a text style follows Text (Heading is a text style, not a role). They are only set when
a theme sets them, so always read them with Text as the fallback:
`color: var(--color-type-label, var(--color-text));`.
In CSS, `type` (and `ts` in class names) is the short form of "text style": `--color-type-label`,
`--type-label-min` and `.ts--label` all belong to the Label text style.

An item template (a List's `config.template`) can set its own Background, Text, Link, Button,
Button text, Line and text styles per color theme (a text style it leaves out follows its Text, when it
sets one); inside its items (class `tpl-<id>`) the same
variables carry them, so nothing changes in the CSS.

## Opacity on a fill

A color theme can make a fill see-through: its `"opacity"` gives a fill role a whole percent, 0-100.
Left out (or 100), the fill is solid, so existing sites don't change. Only the fills take one
(Background, Button, Line, Header, Curtain; in a template entry Background, Button and Line), never
a text role: text stays solid so it stays readable. The palette stays solid `"#rrggbb"`; the
opacity belongs to the role, so the same slot can be solid in one theme and see-through in another.

```json
"colorThemes": {
  "darkest": {
    "line": 5,
    "opacity": { "line": 20 },
    "templates": {
      "preset:card": { "background": 3, "opacity": { "background": 80 } }
    }
  }
}
```

The role's variable carries it: `--color-line: color-mix(in srgb, var(--palette-5) 20%, transparent)`,
so a site's CSS reads the same `--color-*` names and the smart colours follow. A Transparent fill and a
Glass or Transparent Button have no colour, so their opacity does nothing. In a template entry, an
opacity it leaves out follows the section's (as its colour does), and an opacity alone makes the
section's colour that see-through inside its items.

`ewcms check` names an opacity on a text role, an unknown role and a value that isn't a whole percent
0-100. Its contrast warnings blend a see-through fill over what is behind it first (opacity × colour +
(1 − opacity) × behind, as the browser does): a template's Background over its section's, a
section's over the site's, Button and Line over their Background, Header and Curtain over the
site's Background (the site color theme's own Header and Curtain too). What is behind the site
color theme's own Background (the browser's canvas or a page's backdrop photo) isn't known, so text
on a see-through site Background isn't checked. Theme › Color shows each text role's and Line's
contrast under its swatches the same way, as a hint, never a gate: a text role Pass or Fail, Line
(decorative) only its ratio (3:1 shows well; the check doesn't warn about lines).

## Smart colours: `--smart-*`

Worked out from the roles (`color-mix`), never picked: read them for states instead of mixing
your own, so they follow every color theme.

| Variable | Worked out as |
| --- | --- |
| `--smart-button-hover` | Button, 12% toward Button text (transparent: Text at 10% over Background; glass: the glass a step lighter) |
| `--smart-button-pressed` | Button, 18% toward Background (transparent: Text at 18% over Background; glass: the glass two steps lighter) |
| `--smart-link-hover` | Link at 65% over Background |
| `--smart-faded` | Text at 60% over Background (secondary text) |
| `--smart-focus` | Accent (a focus ring outside the element) |
| `--smart-disabled` | Text at 35% over Background |
| `--smart-line-hover` | Line, 35% toward Text (transparent Line: transparent) |
| `--smart-selection` | Accent at 35% over Background |
| `--smart-header-glass` | Header, a little see-through over the page |
| `--smart-field` | Background, 6% toward Text (an input's fill) |

## Button modes

The Button role decides what `.btn` looks like (the Button widget, the Form's Send, the header's
CTA), per color theme and per item template. There is no per-button setting.

| Value | Mode | Looks like |
| --- | --- | --- |
| `"glass"` | glass (the default) | the glass pill: Background a step toward Text, see-through and blurred (`--btn-backdrop`), tinted by Accent |
| `"transparent"` | transparent | text only, no fill |
| `1` … `5` | colour (palette slot) | a solid pill in that slot |
| `"#c9a27a"` | colour (hex) | a solid pill in that colour |

Button text (`--color-button-text`) is the text in all four. Hover and pressed are
`--smart-button-hover` and `--smart-button-pressed`, which always show, glass and transparent included.
`--color-button` is `transparent` for glass and transparent buttons, so a site's CSS that needs the button's
look should style `.btn`'s own rules rather than read `--color-button`. `ewcms check` warns when
Button text is under 4.5:1 on the button colour (glass and transparent: on the section's Background).

The button's shape, type and blur are tokens in `theme/tokens.scss` (`--btn-radius`,
`--btn-backdrop`, …), not colours.

## Old names

`--bg`, `--fg`, `--muted`, `--faint`, `--brand`, `--line`, `--header-fill` and the other old colour
tokens are aliases of the roles above, for old site CSS only. Use the roles in new CSS, and don't
set the old names in `theme/tokens.scss`: they colour nothing of the engine (`ewcms check` warns).
