// docs/COLORS.md names every variable a site's CSS may read, with the code's names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUTTON_MODES, ROLES, SMART, TYPE_PARENT, typeVar } from '../src/render/colors.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('docs/COLORS.md: the palette, every role, sub-role and smart colour, the Button modes', () => {
  const doc = read('docs/COLORS.md');
  assert.ok(doc.includes('`--palette-1` … `--palette-5`'));
  for (const r of ROLES) assert.ok(doc.includes(`\`${r.css}\``), r.css);
  for (const s of SMART) assert.ok(doc.includes(`\`${s.var}\``), s.var);
  for (const s of Object.keys(TYPE_PARENT)) assert.ok(doc.includes(`\`${typeVar(s)}\``), s);
  for (const m of BUTTON_MODES.filter((m) => m !== 'color')) assert.ok(doc.includes(`"${m}"`), m);
  // every --color-* / --smart-* it names is a real one
  const real = new Set([...ROLES.map((r) => r.css), ...SMART.map((s) => s.var), ...Object.keys(TYPE_PARENT).map(typeVar)]);
  for (const [v] of doc.matchAll(/--(?:color|smart)-[a-z-]+[a-z]/g)) assert.ok(real.has(v), v);
  // the default site's tokens point to it
  assert.match(read('default-site/theme/tokens.scss'), /^\/\/ .*docs\/COLORS\.md/m);
});
