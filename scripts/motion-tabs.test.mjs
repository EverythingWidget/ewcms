// Nav | Settings, a page's Sections | Motion | SEO, and the site's default animation timing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent } from '../src/site/validate.js';
import { DEFAULT_TIMING, defaultsProblems } from '../src/site/layout/motion.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const anims = JSON.parse(
  readFileSync(new URL('../templates/content/en/settings/animations.json', import.meta.url)),
);

test('defaults: duration, delay, ease, all optional', () => {
  assert.deepEqual(Object.keys(DEFAULT_TIMING), ['duration', 'delay', 'ease']);
  assert.deepEqual(defaultsProblems(undefined), []);
  assert.deepEqual(defaultsProblems({}), []);
  assert.deepEqual(defaultsProblems({ duration: 0.6, delay: 0, ease: 'power2.out' }), []);
  assert.equal(defaultsProblems({ duration: -1 }).length, 1);
  assert.equal(defaultsProblems({ duration: '0.6' }).length, 1);
  assert.equal(defaultsProblems({ ease: '' }).length, 1);
  assert.equal(defaultsProblems({ stagger: 0.1 }).length, 1);
  assert.equal(defaultsProblems([]).length, 1);
});

test('animations.json: with or without defaults it is valid', () => {
  assert.deepEqual(checkContent('settings/animations.json', anims), []);
  const withDefaults = { ...anims, defaults: { duration: 0.6, delay: 0, ease: 'power2.out' } };
  assert.deepEqual(checkContent('settings/animations.json', withDefaults), []);
  const bad = { ...anims, defaults: { duration: 'slow' } };
  assert.match(checkContent('settings/animations.json', bad).join('\n'), /defaults\.duration/);
});

test("the engine starts every spec from the defaults (not the scroll types' ease)", () => {
  const e = read('client/anim/engine.js');
  assert.match(e, /merge\(defaultsFor\(animation\), animation, target, own, inline,/);
  assert.match(
    e,
    /merge\(defaultsFor\(animation\), animation, parse\(el\.dataset\.motionOptions\),/,
  );
  assert.match(e, /SCROLLED = new Set\(\['scroll', 'scrub-words', 'parallax'\]\)/);
});

test('top tabs Nav | Settings; page tabs Sections | Motion | SEO', () => {
  const app = read('editor/svelte/App.svelte');
  assert.match(app, /\['nav', 'Nav'\],\s*\['settings', 'Settings'\],\s*\];/);
  assert.doesNotMatch(app, /MotionPanel/);
  const c = read('editor/svelte/ContentPanel.svelte');
  assert.match(c, /\['sections', 'Sections'\],\s*\['motion', 'Motion'\],\s*\['seo', 'SEO'\],/);
  assert.doesNotMatch(c, /transitions/);
  const m = read('editor/svelte/MotionPanel.svelte');
  assert.doesNotMatch(m, /AnimLibrary|Tabs/);
  assert.match(m, /<PageTransition /);
  assert.match(read('editor/svelte/SettingsPanel.svelte'), /<MotionSettings /);
  assert.match(read('editor/svelte/MotionSettings.svelte'), /<AnimLibrary /);
});

test('URL tabs are ui.panel: nav, settings, preview; clicks: arrange, animate, visitor', () => {
  const p = read('editor/svelte/persist.js');
  assert.match(p, /PANELS = \['nav', 'settings', 'preview'\]/);
  assert.match(p, /set\('tab', ui\.panel\)/);
  const u = read('editor/svelte/ui.svelte.js');
  assert.match(u, /if \(ui\.panel !== 'nav'\) return 'visitor';/);
  assert.match(u, /ui\.pageTab === 'motion' \? 'animate' : 'arrange'/);
  for (const f of [
    'editor/main.js',
    'editor/bridge.js',
    'editor/overlay.js',
    'editor/svelte/App.svelte',
  ])
    assert.doesNotMatch(read(f), /ui\.mode\b|lastEdit|previewMode|'browse'/, f);
});
