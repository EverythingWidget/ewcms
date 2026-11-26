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

## The roles: `--color-*`

Each color theme sets all 12; a value is a palette slot 1-5, a custom `#rrggbb` (it doesn't follow
the palette), or `"none"` (transparent) on a fill.

| Variable | Role | Kind | Notes |
| --- | --- | --- | --- |
| `--color-background` | Background | fill (can be none) | the section's surface |
| `--color-text` | Text | text | body text, on Background |
| `--color-heading` | Heading | text | titles and headings, on Background |
| `--color-link` | Link | text | on Background |
| `--color-accent` | Accent | text | highlights, focus, selection; tints the glass |
| `--color-button` | Button | fill (colour, glass or none) | see [Button modes](#button-modes) |
| `--color-button-text` | Button text | text | on Button (glass and none: on Background) |
| `--color-line` | Line | fill (can be none) | rules, borders |
| `--color-header` | Header | fill (can be none) | the header bar |
| `--color-header-text` | Header text | text | on Header |
| `--color-curtain` | Curtain | fill | the page-change curtain (`.curtain`) |
| `--color-curtain-text` | Curtain text | text | on Curtain |

Inside the header (`.header`, `.mmenu`) Background and Text are the Header and Header text, so
CSS there reads `--color-background` / `--color-text` like anywhere else.

A color theme can also colour each text style (sub-roles, its `textStyles` in
`content/theme.json`): `--color-type-title`,
`--color-type-heading`, `--color-type-subheading`, `--color-type-statement` (they follow Heading)
and `--color-type-paragraph`, `--color-type-label`, `--color-type-small` (they follow Text). They
are only set when a theme sets them, so always read them with their parent as the fallback:
`color: var(--color-type-label, var(--color-text));`.
In CSS, `type` (and `ts` in class names) is the short form of "text style": `--color-type-label`,
`--type-label-min` and `.ts--label` all belong to the Label text style.

An item template (a List's `config.template`) can set its own Background, Text, Heading, Link,
Button, Button text, Line and text styles per color theme; inside its items (class `tpl-<id>`) the same
variables carry them, so nothing changes in the CSS.

## Smart colours: `--smart-*`

Worked out from the roles (`color-mix`), never picked: read them for states instead of mixing
your own, so they follow every color theme.

| Variable | Worked out as |
| --- | --- |
| `--smart-button-hover` | Button, 12% toward Button text (none: Text at 10% over Background; glass: the glass a step lighter) |
| `--smart-button-pressed` | Button, 18% toward Background (none: Text at 18% over Background; glass: the glass two steps lighter) |
| `--smart-link-hover` | Link at 65% over Background |
| `--smart-faded` | Text at 60% over Background (secondary text) |
| `--smart-focus` | Accent (a focus ring outside the element) |
| `--smart-disabled` | Text at 35% over Background |
| `--smart-line-hover` | Line, 35% toward Text (none: transparent) |
| `--smart-selection` | Accent at 35% over Background |
| `--smart-header-glass` | Header, a little see-through over the page |
| `--smart-field` | Background, 6% toward Text (an input's fill) |

## Button modes

The Button role decides what `.btn` looks like (the Button widget, the Form's Send, the header's
CTA), per color theme and per item template. There is no per-button setting.

| Value | Mode | Looks like |
| --- | --- | --- |
| `"glass"` | glass (the default) | the glass pill: Background a step toward Text, see-through and blurred (`--btn-backdrop`), tinted by Accent |
| `"none"` | none | text only, no fill |
| `1` … `5` | colour (palette slot) | a solid pill in that slot |
| `"#c9a27a"` | colour (hex) | a solid pill in that colour |

Button text (`--color-button-text`) is the text in all four. Hover and pressed are
`--smart-button-hover` and `--smart-button-pressed`, which always show, glass and none included.
`--color-button` is `transparent` for glass and none, so a site's CSS that needs the button's
look should style `.btn`'s own rules rather than read `--color-button`. `ewcms check` warns when
Button text is under 4.5:1 on the button colour (glass and none: on the section's Background).

The button's shape, type and blur are tokens in `theme/tokens.scss` (`--btn-radius`,
`--btn-backdrop`, …), not colours.

## Old names

`--bg`, `--fg`, `--muted`, `--faint`, `--brand`, `--line`, `--header-fill` and the other old colour
tokens are aliases of the roles above, for old site CSS only. Use the roles in new CSS, and don't
set the old names in `theme/tokens.scss`: they colour nothing of the engine (`ewcms check` warns).
