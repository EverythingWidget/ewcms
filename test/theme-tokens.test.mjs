// The look's finer tokens (F86–F96): each look value in the engine's CSS reads a token whose
// default is today's value, so a theme without them looks exactly as before. The starter's
// tokens.scss lists each one after its `// @optional` line, as a comment with that default;
// ewcms check doesn't ask a theme for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requiredPart, themeWarning } from '../src/cli/cli.mjs';
import { loadSiteConfig } from '../src/cli/site-config.mjs';

const root = new URL('..', import.meta.url).pathname;
const starter = fs.readFileSync(path.join(root, 'starter/theme/tokens.scss'), 'utf8');
const optional = starter.slice(requiredPart(starter).length);

// the engine's own stylesheets: the core, the chrome and the built-in widgets' looks
const styles = [
  ...fs.readdirSync(path.join(root, 'src/client/styles')).map((f) => `src/client/styles/${f}`),
  ...fs
    .readdirSync(path.join(root, 'src/render/widgets'))
    .map((w) => `src/render/widgets/${w}/style.scss`)
    .filter((f) => fs.existsSync(path.join(root, f))),
].filter((f) => f.endsWith('.scss'));
const css = styles.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

/** Every var(--name, fallback) in the engine's CSS: { name: [fallbacks] } (nested var() kept). */
function fallbacks(text) {
  const out = {};
  for (let at = text.indexOf('var(--'); at >= 0; at = text.indexOf('var(--', at + 4)) {
    let depth = 0;
    let end = at;
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++;
      else if (text[end] === ')' && --depth === 0) break;
    }
    const inner = text.slice(at + 4, end);
    const comma = inner.indexOf(',');
    if (comma < 0) continue;
    const name = inner.slice(0, comma).trim();
    (out[name] ||= []).push(inner.slice(comma + 1).trim());
  }
  return out;
}
const optionalTokens = () =>
  Object.fromEntries(
    [...optional.matchAll(/^\s*\/\/ (--[\w-]+): (.+);$/gm)].map((m) => [m[1], m[2].trim()]),
  );

test("the starter's optional tokens: each read by the engine with that default (today's look)", () => {
  const listed = optionalTokens();
  const used = fallbacks(css);
  assert.ok(Object.keys(listed).length >= 20);
  for (const [name, value] of Object.entries(listed)) {
    assert.ok(used[name], `${name} is read by the engine's CSS`);
    for (const f of used[name]) assert.equal(f, value, `${name}: the engine's default`);
  }
});

test('F86: each text style reads its weight, tracking and colour', () => {
  const t = fs.readFileSync(path.join(root, 'src/client/styles/_text.scss'), 'utf8');
  for (const s of ['title', 'heading', 'subheading', 'statement', 'paragraph', 'label', 'small']) {
    const rule = t.slice(t.indexOf(`.ts--${s} {`), t.indexOf('}', t.indexOf(`.ts--${s} {`)));
    assert.match(rule, new RegExp(`font-weight: var\\(--type-${s}-weight, `), s);
    if (s !== 'label')
      assert.match(rule, new RegExp(`letter-spacing: var\\(--type-${s}-tracking, `), s);
    assert.match(rule, new RegExp(`color: var\\(--type-${s}-color, `), s);
  }
});

test('ewcms check asks only for the tokens before @optional', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-opt-'));
  fs.mkdirSync(path.join(dir, 'theme'));
  fs.writeFileSync(path.join(dir, 'theme/tokens.scss'), requiredPart(starter));
  assert.equal(themeWarning(loadSiteConfig(dir)), '');
  fs.rmSync(dir, { recursive: true, force: true });
});
