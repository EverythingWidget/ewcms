// The look's finer tokens (F86–F96): each look value in the engine's CSS reads a token whose
// default is today's value, so a theme without them looks exactly as before. The default site's
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
const defaultSite = fs.readFileSync(path.join(root, 'default-site/theme/tokens.scss'), 'utf8');
const optional = defaultSite.slice(requiredPart(defaultSite).length);

// the engine's own stylesheets: the core, the chrome and the built-in widgets' looks
const styles = [
  ...fs.readdirSync(path.join(root, 'src/client/styles')).map((f) => `src/client/styles/${f}`),
  ...fs
    .readdirSync(path.join(root, 'src/widgets'))
    .map((w) => `src/widgets/${w}/style.scss`)
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

// a default of their own, said so in the default site's comment: the Form's Send (Text, as before)
const own = {
  '--btn-fg': ['var(--color-text)'],
  '--btn-hover-fg': ['var(--btn-fg, var(--color-text))'],
};

test("the default site's optional tokens: each read by the engine with that default (today's look)", () => {
  const listed = optionalTokens();
  const used = fallbacks(css);
  assert.ok(Object.keys(listed).length >= 20);
  for (const [name, value] of Object.entries(listed)) {
    assert.ok(used[name], `${name} is read by the engine's CSS`);
    assert.ok(used[name].includes(value), `${name}: the engine's default`);
    for (const f of used[name])
      assert.ok(f === value || own[name]?.includes(f), `${name}: ${f}, not ${value}`);
  }
});

test('F86: each text style reads its weight and tracking, and its colour sub-role', () => {
  const t = fs.readFileSync(path.join(root, 'src/client/styles/_text.scss'), 'utf8');
  for (const s of ['title', 'heading', 'subheading', 'statement', 'paragraph', 'label', 'small']) {
    const rule = t.slice(t.indexOf(`.ts--${s} {`), t.indexOf('}', t.indexOf(`.ts--${s} {`)));
    assert.match(rule, new RegExp(`font-weight: var\\(--type-${s}-weight, `), s);
    assert.match(rule, new RegExp(`letter-spacing: var\\(--type-${s}-tracking, `), s);
    const parent = ['title', 'heading', 'subheading', 'statement'].includes(s) ? 'heading' : 'text';
    assert.match(rule, new RegExp(`color: var\\(--color-type-${s}, var\\(--color-${parent}\\)\\);`), s);
  }
});

test('F94: the body font is --f-body (no --f-mono left in the site CSS); check names the rename', () => {
  assert.doesNotMatch(css, /--f-mono/);
  assert.match(css, /body \{[^}]*font-family: var\(--f-body\)/);
  assert.match(requiredPart(defaultSite), /^ {2}--f-body: /m);
  assert.doesNotMatch(defaultSite, /--f-mono/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-fbody-'));
  fs.mkdirSync(path.join(dir, 'theme'));
  fs.writeFileSync(
    path.join(dir, 'theme/tokens.scss'),
    requiredPart(defaultSite).replace('--f-body:', '--f-mono:'),
  );
  assert.match(
    themeWarning(loadSiteConfig(dir)),
    /misses 1 token\(s\) of the look \(--f-body\).* --f-mono is now --f-body: rename it\./,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('ewcms check asks only for the tokens before @optional', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-opt-'));
  fs.mkdirSync(path.join(dir, 'theme'));
  fs.writeFileSync(path.join(dir, 'theme/tokens.scss'), requiredPart(defaultSite));
  assert.equal(themeWarning(loadSiteConfig(dir)), '');
  fs.rmSync(dir, { recursive: true, force: true });
});

test("F87: the Label (and the chrome's .label) read their tracking and case", () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  for (const [f, sel] of [
    ['src/client/styles/_text.scss', '.ts--label {'],
    ['src/client/styles/_base.scss', '.label {'],
  ]) {
    const t = read(f);
    const rule = t.slice(t.indexOf(sel), t.indexOf('}', t.indexOf(sel)));
    assert.match(rule, /letter-spacing: var\(--type-label-tracking, 0\.08em\)/, f);
    assert.match(rule, /text-transform: var\(--type-label-case, uppercase\)/, f);
  }
});

const rule = (f, sel) => {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  return t.slice(t.indexOf(sel), t.indexOf('}', t.indexOf(sel)));
};

test('F89: the body text and the nav read their size, weight, tracking (and case, line height)', () => {
  const body = rule('src/client/styles/_base.scss', '\nbody {');
  for (const t of ['--body-size, 14px', '--body-lh, 1.55', '--body-weight, 400', '--body-tracking'])
    assert.ok(body.includes(`var(${t}`), t);
  for (const sel of ['&__item {', '.menu-toggle {']) {
    const nav = rule('src/client/styles/_chrome.scss', sel);
    for (const t of ['--nav-size, 12px', '--nav-weight', '--nav-tracking, 0.06em', '--nav-case'])
      assert.ok(nav.includes(`var(${t}`), `${sel} ${t}`);
  }
});

test('F88: the button reads its fill, blur, colours, type, padding and radius', () => {
  const btn = rule('src/client/styles/_glass.scss', '\n.btn {');
  for (const t of [
    '--btn-pad-y',
    '--btn-pad-x',
    '--btn-radius',
    '--btn-fg',
    '--btn-size',
    '--btn-weight',
  ])
    assert.ok(btn.includes(`var(${t},`), t);
  const glass = fs.readFileSync(path.join(root, 'src/client/styles/_glass.scss'), 'utf8');
  for (const t of [
    '--btn-bg',
    '--btn-hover-bg',
    '--btn-backdrop',
    '--btn-hover-fg',
    '--btn-tracking',
    '--btn-case',
  ])
    assert.ok(glass.includes(`var(${t},`), t);
});

test("F96: the current page's nav item reads its shape and colours", () => {
  const active = rule('src/client/styles/_chrome.scss', '&.is-active {');
  for (const t of [
    '--nav-active-radius',
    '--nav-active-bg, var(--color-text)',
    '--nav-active-fg, var(--color-background)',
  ])
    assert.ok(active.includes(`var(${t}`), t);
  const chrome = fs.readFileSync(path.join(root, 'src/client/styles/_chrome.scss'), 'utf8');
  assert.ok(chrome.includes('color: var(--menu-active-fg, var(--color-accent))'));
});

test('F93: selected text and the skip link read their colours', () => {
  const base = fs.readFileSync(path.join(root, 'src/client/styles/_base.scss'), 'utf8');
  for (const t of [
    '--selection-bg, var(--smart-selection)',
    '--selection-fg, var(--color-text)',
    '--skip-link-bg, var(--color-text)',
    '--skip-link-fg, var(--color-background)',
  ])
    assert.ok(base.includes(`var(${t})`), t);
});

test('F85: the default site has the type scale, the engine\'s defaults; check asks for it, theme.json "typography" counts', () => {
  const core = fs.readFileSync(path.join(root, 'src/client/styles/_tokens.scss'), 'utf8');
  const scale = [...core.matchAll(/^\s*(--type-[\w-]+): ([^;]+);/gm)];
  assert.equal(scale.length, 21);
  const required = requiredPart(defaultSite);
  for (const [, name, value] of scale)
    assert.ok(required.includes(`  ${name}: ${value};`), `${name}: ${value} in the default site`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-type-'));
  fs.mkdirSync(path.join(dir, 'theme'));
  fs.writeFileSync(
    path.join(dir, 'theme/tokens.scss'),
    required.replace(/^\s*--type-(title|heading)-[\w-]+: [^;]+;\n/gm, ''),
  );
  const w = themeWarning(loadSiteConfig(dir));
  assert.match(
    w,
    /doesn't set 6 token\(s\) of the type scale \(--type-title-min, .*content\/theme\.json "typography"/,
  );
  assert.doesNotMatch(w, /of the look/);
  fs.mkdirSync(path.join(dir, 'content'));
  fs.writeFileSync(
    path.join(dir, 'content/theme.json'),
    JSON.stringify({ typography: { title: { min: 30, max: 60, line: 1 }, heading: { min: 20 } } }),
  );
  assert.match(
    themeWarning(loadSiteConfig(dir)),
    /doesn't set 2 token\(s\) .*\(--type-heading-max, --type-heading-lh\)/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('F98: the Heading has a phone size capped at its max, as the Title', () => {
  const t = fs.readFileSync(path.join(root, 'src/client/styles/_text.scss'), 'utf8');
  for (const [s, vw] of [
    ['title', 13],
    ['heading', 10],
  ]) {
    const at = t.indexOf(`.ts--${s} {`);
    const block = t.slice(at, t.indexOf('\n}', at));
    assert.match(
      block,
      new RegExp(
        `@media \\(width <= 480px\\) \\{\\s*font-size: min\\(var\\(--type-${s}-phone, ${vw}vw\\), var\\(--type-${s}-max\\)\\);`,
      ),
      s,
    );
  }
});
