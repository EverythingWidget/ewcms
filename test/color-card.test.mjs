// Theme › Color (step 5): the card's data and the theme.json edits its picks make
// (src/editor/lib/color-themes.js), through the editor's store (one undo step per pick).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/editor/store.js';
import {
  buttonModeValue,
  customCount,
  defaultPaletteOf,
  followsOf,
  isCustomSlot,
  paletteEdit,
  previewOf,
  roleEdit,
  roleRow,
  rolePointer,
  siteThemeEdit,
  swatchOf,
  textStylesUnder,
} from '../src/editor/lib/color-themes.js';
import { DEFAULT_PALETTE, ROLES, colorThemeCss } from '../src/render/colors.js';

const THEME = 'theme.json';
const storeWith = (theme) => {
  const s = createStore();
  s.load({ [THEME]: theme });
  return s;
};
const apply = (s, edit, key) => s.set(THEME, edit.ptr, edit.value, { key, source: 'panel' });

test('palette: the slots show theme.json\'s, else the engine\'s (color.brand as slot 4); back to the default leaves it out', () => {
  assert.deepEqual(defaultPaletteOf({}), DEFAULT_PALETTE);
  assert.equal(defaultPaletteOf({ color: { brand: '#cc2020' } })[3], '#cc2020');
  assert.equal(isCustomSlot({}, 0), false);
  // one slot: the whole palette is stored (theme.json's palette is all 5)
  const p = paletteEdit({}, 4, '#FFF');
  assert.deepEqual(p, [...DEFAULT_PALETTE.slice(0, 4), '#ffffff']);
  assert.equal(isCustomSlot({ palette: p }, 4), true);
  assert.equal(isCustomSlot({ palette: p }, 0), false);
  // back to the default: left out
  assert.equal(paletteEdit({ palette: p }, 4, undefined), undefined);
  assert.equal(paletteEdit({ palette: p }, 4, DEFAULT_PALETTE[4]), undefined);
  assert.equal(paletteEdit({}, 4, 'blue'), null);
  assert.equal(paletteEdit({}, 5, '#fff'), null);
  // through the store: one undo step, and the CSS follows (the palette on :root:root is theme-vars')
  const s = storeWith({ version: 1 });
  apply(s, { ptr: '/palette', value: p }, 'palette');
  assert.deepEqual(s.get(THEME, '/palette'), p);
  s.undo();
  assert.equal(s.get(THEME, '/palette'), undefined);
});

test('roles: a row shows what applies; custom is a base role not the engine\'s default', () => {
  const row = roleRow({}, { theme: 'dark', key: 'text' });
  assert.deepEqual(
    { label: row.label, own: row.own, shown: row.shown, custom: row.custom, none: row.none },
    { label: 'Text', own: undefined, shown: 5, custom: false, none: false },
  );
  assert.equal(roleRow({}, { theme: 'dark', key: 'background' }).none, true);
  // the default's value stored is not custom; another is
  assert.equal(roleRow({ colorThemes: { dark: { text: 5 } } }, { theme: 'dark', key: 'text' }).custom, false);
  assert.equal(roleRow({ colorThemes: { dark: { text: '#ABC' } } }, { theme: 'dark', key: 'text' }).shown, '#abc');
  assert.equal(roleRow({ colorThemes: { dark: { text: 3 } } }, { theme: 'dark', key: 'text' }).custom, true);
  // labels come from ROLES
  for (const r of ROLES) assert.equal(roleRow({}, { theme: 'light', key: r.key }).label, r.label);
});

test('roles: a pick stores only what differs; None only on fills; one undo step each', () => {
  const s = storeWith({ version: 1 });
  const theme = () => s.get(THEME, '');
  apply(s, roleEdit(theme(), { theme: 'dark', key: 'link' }, 2), 'a');
  assert.deepEqual(s.get(THEME, '/colorThemes'), { dark: { link: 2 } });
  apply(s, roleEdit(theme(), { theme: 'dark', key: 'line' }, 'none'), 'b');
  assert.equal(s.get(THEME, '/colorThemes/dark/line'), 'none');
  assert.equal(roleEdit(theme(), { theme: 'dark', key: 'text' }, 'none'), null);
  assert.equal(roleEdit(theme(), { theme: 'dark', key: 'text' }, 'glass'), null);
  assert.equal(roleEdit(theme(), { theme: 'dark', key: 'text' }, 9), null);
  assert.equal(roleEdit(theme(), { theme: 'nope', key: 'text' }, 1), null);
  // a custom hex, lowercase long form
  apply(s, roleEdit(theme(), { theme: 'dark', key: 'accent' }, '#C9A27A'), 'c');
  assert.equal(s.get(THEME, '/colorThemes/dark/accent'), '#c9a27a');
  // back to the default: left out, the empty theme and colorThemes too
  s.undo();
  s.undo();
  apply(s, roleEdit(theme(), { theme: 'dark', key: 'link' }, 4), 'd'); // dark's default Link: 4
  assert.equal(s.get(THEME, '/colorThemes'), undefined);
  s.undo();
  assert.deepEqual(s.get(THEME, '/colorThemes'), { dark: { link: 2 } });
});

test('Button: Glass / Color / None; Color keeps a colour, else starts from Accent', () => {
  const spec = { theme: 'dark', key: 'button' };
  assert.equal(roleRow({}, spec).mode, 'glass');
  assert.equal(buttonModeValue({}, spec, 'color'), 4); // dark's Accent
  assert.equal(buttonModeValue({ colorThemes: { dark: { button: '#123456' } } }, spec, 'color'), '#123456');
  assert.equal(buttonModeValue({}, spec, 'none'), 'none');
  assert.equal(roleRow({ colorThemes: { dark: { button: 2 } } }, spec).mode, 'color');
  assert.equal(roleRow({ colorThemes: { dark: { button: 'none' } } }, spec).mode, 'none');
  // glass is the default: picking it again leaves the key out
  assert.deepEqual(roleEdit({ colorThemes: { dark: { button: 2 } } }, spec, 'glass'), { ptr: '/colorThemes/dark/button', value: undefined });
  assert.equal(roleRow({}, spec).custom, false);
  assert.equal(roleRow({ colorThemes: { dark: { button: 'none' } } }, spec).custom, true);
});

test('sub-roles: empty follows the parent and says so; set, it is custom; cleared, it follows again', () => {
  assert.deepEqual(textStylesUnder('heading'), ['title', 'heading', 'subheading', 'statement']);
  assert.deepEqual(textStylesUnder('text'), ['paragraph', 'label', 'small']);
  const title = { theme: 'light', textStyle: 'title' };
  assert.equal(followsOf(title), 'Heading');
  assert.equal(followsOf({ theme: 'light', textStyle: 'label' }), 'Text');
  assert.equal(followsOf({ theme: 'light', key: 'background', template: 'preset:card' }), "the section's Background");
  assert.equal(followsOf({ theme: 'light', textStyle: 'small', template: 'preset:card' }), "the template's Text");
  const t = { colorThemes: { light: { heading: 3 } } };
  assert.deepEqual([roleRow(t, title).own, roleRow(t, title).shown, roleRow(t, title).custom], [undefined, 3, false]);
  assert.equal(rolePointer(title), '/colorThemes/light/textStyles/title');
  const s = storeWith({ version: 1 });
  apply(s, roleEdit({}, title, 2), 'a');
  assert.deepEqual(s.get(THEME, '/colorThemes'), { light: { textStyles: { title: 2 } } });
  assert.equal(roleRow(s.get(THEME, ''), title).custom, true);
  apply(s, roleEdit(s.get(THEME, ''), title, undefined), 'b');
  assert.equal(s.get(THEME, '/colorThemes'), undefined);
  // a template's: its roles follow the section's, its text styles its own Heading / Text
  const card = { theme: 'dark', key: 'background', template: 'preset:card' };
  assert.equal(rolePointer(card), '/colorThemes/dark/templates/preset:card/background');
  assert.equal(roleRow({}, card).shown, 2);
  const tt = { colorThemes: { dark: { templates: { 'preset:card': { heading: 1 } } } } };
  assert.equal(roleRow(tt, { theme: 'dark', textStyle: 'title', template: 'preset:card' }).shown, 1);
  assert.equal(roleEdit({}, { theme: 'dark', key: 'header', template: 'preset:card' }, 1), null); // not a template role
  // a template's value equal to the section's is still its own (it is its own thing)
  assert.deepEqual(roleEdit({}, card, 2), { ptr: card && rolePointer(card), value: 2 });
  // what it writes is what colors.js reads
  assert.match(colorThemeCss({ colorThemes: { dark: { templates: { 'preset:card': { background: 2 } } } } }), /\.ct-dark \.tpl-preset-card \{ --color-background: var\(--palette-2\)/);
});

test('chips, dots and counts; the site color theme', () => {
  assert.equal(swatchOf({}, 1), DEFAULT_PALETTE[0]);
  assert.equal(swatchOf({}, '#abc'), '#aabbcc');
  assert.equal(swatchOf({}, 'none'), '');
  assert.equal(swatchOf({}, 'glass'), '');
  assert.deepEqual(previewOf({}, 'lightest'), { background: DEFAULT_PALETTE[4], text: DEFAULT_PALETTE[0], heading: DEFAULT_PALETTE[0], accent: DEFAULT_PALETTE[2] });
  assert.equal(customCount({}, 'dark'), 0);
  assert.equal(customCount({ colorThemes: { dark: { text: 5, link: 1, textStyles: { title: 2 }, templates: { 'preset:card': { background: 3, textStyles: { small: 1 } } } } } }, 'dark'), 4);
  assert.equal(siteThemeEdit('light'), 'light');
  assert.equal(siteThemeEdit('darkest'), undefined);
  assert.equal(siteThemeEdit('nope'), undefined);
});
