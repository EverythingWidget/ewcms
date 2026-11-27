// One color theme check, one class helper and one picker for every kind that picks a theme
// (theme.json's site theme, a section, header.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorThemeProblems, withColorTheme } from '../src/render/colors.js';
import { themeEdit, themeShown, siteThemeEdit } from '../src/editor/lib/color-themes.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('colorThemeProblems: left out or a theme name is fine, anything else names the themes', () => {
  assert.deepEqual(colorThemeProblems(undefined), []);
  for (const n of ['lightest', 'light', 'accent', 'dark', 'darkest'])
    assert.deepEqual(colorThemeProblems(n), []);
  assert.deepEqual(colorThemeProblems('Dark'), [
    '"colorTheme" must be a color theme: "lightest", "light", "accent", "dark", "darkest", not "Dark"',
  ]);
  assert.equal(colorThemeProblems(3).length, 1);
});

test('withColorTheme: the theme class added, or the classes alone', () => {
  assert.equal(withColorTheme('sec sec--full', 'light'), 'sec sec--full ct-light');
  assert.equal(withColorTheme('header', undefined), 'header');
  assert.equal(withColorTheme('header', 'blue'), 'header');
});

test('the picker stores the name, or nothing for its fallback', () => {
  assert.equal(themeEdit('light', 'darkest'), 'light');
  assert.equal(themeEdit('darkest', 'darkest'), undefined);
  assert.equal(themeEdit('nope', 'darkest'), undefined);
  assert.equal(themeShown(undefined, 'dark'), 'dark');
  assert.equal(themeShown('accent', 'dark'), 'accent');
  assert.equal(siteThemeEdit('darkest'), undefined);
});

test('one check, one class helper, one picker: no copies left', () => {
  const v = read('src/render/validate.js');
  const c = read('src/render/colors.js');
  assert.equal((v.match(/colorThemeProblems\(/g) || []).length, 2); // header, section
  assert.match(c, /out\.push\(\.\.\.colorThemeProblems\(d\.colorTheme\)\)/); // the site's
  for (const f of ['src/render/validate.js', 'src/render/colors.js'])
    assert.doesNotMatch(read(f), /!THEME_NAMES\.includes\([a-z]+\.colorTheme\)/, f);
  assert.match(read('src/render/layout/index.js'), /withColorTheme\(/);
  assert.match(read('src/render/shell/header.js'), /withColorTheme\(/);
  for (const f of ['src/render/layout/index.js', 'src/render/shell/header.js'])
    assert.doesNotMatch(read(f), /colorThemeClass\(/, f);
  const part = read('src/editor/svelte/ColorPart.svelte');
  assert.match(part, /<ColorThemePicker[\s\S]*?ptr="\/colorTheme"[\s\S]*?label="Site color theme"/);
  assert.doesNotMatch(part, /edit="\{THEME\}#\/colorTheme"/);
});
