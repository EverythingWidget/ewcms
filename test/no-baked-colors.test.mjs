// No baked colour (colour plan step 3): the chrome and widgets read the color theme's roles and
// smart colours only (src/render/colors.js), so a palette or theme change reaches everything.
// A fixed colour is allowed only by design, named here: shades and scrims (black at n%), the
// error colour, text over a photo, the engine's default palette and an album's glow. Hex, rgb(),
// hsl() and named colours (white, black, …: in a CSS value, not a word in code) count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
// the CSS named colours a hand would write (currentcolor is the text's colour: not fixed)
const NAMED = [
  'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey',
  'silver', 'gold', 'navy', 'teal', 'maroon', 'olive', 'lime', 'aqua', 'cyan', 'magenta',
  'fuchsia', 'brown', 'beige', 'ivory', 'tan', 'coral', 'salmon', 'crimson', 'indigo', 'violet',
  'khaki', 'lavender', 'turquoise', 'wheat', 'snow', 'plum', 'orchid', 'tomato', 'chocolate',
];
// a named colour in a CSS value: after a property's colon, not quoted ("through: 'black'" is a
// word in code, "color: white" a colour)
const COLOR = new RegExp(
  `#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?)\\(|(?<=:[^;{}'"\\n]*?)(?<![\\w$.'"-])(?:${NAMED.join('|')})(?![\\w-])`,
  'gi',
);

/** [file, literal, how many, why] */
const ALLOWED = [
  ['src/client/styles/_backdrop.scss', '#', 2, 'the backdrop fades through black (a scrim)'],
  ['src/client/ui/menu.js', 'rgba(', 2, "the phone menu's scrim (black at 0 and 35%)"],
  ['src/widgets/list/style.scss', 'rgb(', 1, 'a text shadow over a photo (black at 80%)'],
  ['default-site/theme/tokens.scss', 'rgb(', 9, 'the shades (black at n%) and the hero text over its photo'],
  ['default-site/theme/tokens.scss', '#', 2, 'the error colour and the hero text over its photo'],
  ['src/render/colors.js', '#', 5, "the engine's default palette (today's default-site look)"],
  ['src/render/helpers.js', 'hsl(', 1, "an album's glow, from its cover photo's colour (left as is)"],
];

const files = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((f) => {
    const rel = `${dir}/${f.name}`;
    if (f.isDirectory()) return files(rel);
    return /\.(scss|js|mjs|svelte|css)$/.test(f.name) ? [rel] : [];
  });

// comments say what a colour was; only code counts
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

test('no hex, rgb(), hsl() or named colour in the client, the widgets, the renderer or the default theme but the named few', () => {
  const found = {};
  const all = [...files('src/client'), ...files('src/widgets'), ...files('src/render'), ...files('default-site/theme')];
  for (const f of all) {
    // a data: URI (an SVG's filter ids) is not a colour
    const text = code(fs.readFileSync(path.join(root, f), 'utf8')).replace(/url\("data:[^"]*"\)/g, '');
    for (const m of text.matchAll(COLOR)) {
      const kind = m[0].startsWith('#') ? '#' : /\($/.test(m[0]) ? m[0].toLowerCase() : 'named';
      const key = `${f} ${kind}`;
      found[key] = (found[key] || 0) + 1;
    }
  }
  const allowed = Object.fromEntries(ALLOWED.map(([f, kind, n]) => [`${f} ${kind}`, n]));
  assert.deepEqual(found, allowed);
});

test('the guard sees named colours in CSS values, not words in code', () => {
  const kinds = (text) => [...text.matchAll(COLOR)].map((m) => m[0].toLowerCase());
  assert.deepEqual(kinds('.a { color: white; }'), ['white']);
  assert.deepEqual(kinds(".a { border: 1px solid black; }"), ['black']);
  assert.deepEqual(kinds("el.style.cssText = 'background: red';"), ['red']);
  assert.deepEqual(kinds("const black = v.through === 'black';"), []);
  assert.deepEqual(kinds("{ through: 'black' }"), []);
  assert.deepEqual(kinds('.a { white-space: nowrap; color: currentcolor; }'), []);
  assert.deepEqual(kinds('.a { color: #fff; background: rgb(0 0 0 / 50%); }'), ['#fff', 'rgb(']);
});
