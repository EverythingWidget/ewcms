// No baked colour (colour plan step 3): the chrome and widgets read the color theme's roles and
// smart colours only (src/render/colors.js), so a palette or theme change reaches everything.
// A fixed colour is allowed only by design, named here: shades and scrims (black at n%), the
// error colour, and text over a photo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi;

/** [file, literal, how many, why] */
const ALLOWED = [
  ['src/client/styles/_backdrop.scss', '#', 2, 'the backdrop fades through black (a scrim)'],
  ['src/client/ui/menu.js', 'rgba(', 2, "the phone menu's scrim (black at 0 and 35%)"],
  ['src/widgets/list/style.scss', 'rgb(', 1, 'a text shadow over a photo (black at 80%)'],
  ['default-site/theme/tokens.scss', 'rgb(', 9, 'the shades (black at n%) and the hero text over its photo'],
  ['default-site/theme/tokens.scss', '#', 2, 'the error colour and the hero text over its photo'],
];

const files = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((f) => {
    const rel = `${dir}/${f.name}`;
    if (f.isDirectory()) return files(rel);
    return /\.(scss|js|mjs|svelte|css)$/.test(f.name) ? [rel] : [];
  });

// comments say what a colour was; only code counts
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

test('no hex, rgb() or hsl() in the client, the widgets or the default theme but the named few', () => {
  const found = {};
  for (const f of [...files('src/client'), ...files('src/widgets'), ...files('default-site/theme')]) {
    // a data: URI (an SVG's filter ids) is not a colour
    const text = code(fs.readFileSync(path.join(root, f), 'utf8')).replace(/url\("data:[^"]*"\)/g, '');
    for (const m of text.matchAll(COLOR)) {
      const kind = m[0].startsWith('#') ? '#' : m[0].toLowerCase();
      const key = `${f} ${kind}`;
      found[key] = (found[key] || 0) + 1;
    }
  }
  const allowed = Object.fromEntries(ALLOWED.map(([f, kind, n]) => [`${f} ${kind}`, n]));
  assert.deepEqual(found, allowed);
});
