import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { save } from './editor-server.mjs';
import { motionChecks } from '../src/site/render.js';
import { checkContent } from '../src/site/validate.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import {
  WIDGET_ANIM_TYPES,
  TIMING_KEYS,
  checkMotion,
  motionAttrs,
  motionProblems,
} from '../src/site/layout/motion.js';
import { widgetModel, inherited, keepFor } from '../src/editor/svelte/motion.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const content = loadContent(SITE_A);
const animations = content.animations.animations;
const pageWith = (motion) => ({
  version: 1,
  kind: 'page',
  id: 'pg-t011',

  sections: [{ id: 's-aaaa', widgets: [{ id: 'w-aaaa', type: 'text', text: 'x', motion }] }],
});
const problems = (motion) =>
  motionProblems({ animations: content.animations, pages: { t: pageWith(motion) } });

test('checkMotion: an animation id and only timing keys of the right kind', () => {
  assert.deepEqual(checkMotion({ animation: 'fade-in' }), []);
  assert.deepEqual(
    checkMotion({
      animation: 'fade-in',
      duration: 1.2,
      delay: 0,
      stagger: 0.1,
      ease: 'power2.out',
      trigger: 'load',
      start: 'top 80%',
      end: 'bottom top',
      scrub: 0.5,
    }),
    [],
  );
  assert.deepEqual(checkMotion({ animation: 'x', scrub: true }), []);
  assert.equal(checkMotion('fade-in').length, 1);
  assert.equal(checkMotion({}).length, 1);
  assert.match(checkMotion({ animation: 'x', from: { y: 10 } })[0], /motion\.from/);
  assert.equal(checkMotion({ animation: 'x', duration: -1 }).length, 1);
  assert.equal(checkMotion({ animation: 'x', duration: '1' }).length, 1);
  assert.equal(checkMotion({ animation: 'x', trigger: 'hover' }).length, 1);
  assert.equal(checkMotion({ animation: 'x', scrub: 'yes' }).length, 1);
  assert.equal(checkMotion({ animation: 'x', start: 80 }).length, 1);
  assert.deepEqual(TIMING_KEYS.toSorted(), [
    'delay',
    'duration',
    'ease',
    'end',
    'scrub',
    'stagger',
    'start',
    'trigger',
  ]);
  assert.match(checkContent('pages/t/index.json', pageWith(3)).join(' '), /motion/);
});

test('motionProblems: unknown animations and markup-only types', () => {
  assert.deepEqual(problems({ animation: 'fade-in' }), []);
  assert.match(problems({ animation: 'nope' })[0], /unknown animation "nope"/);
  const markup = Object.entries(animations).find(([, p]) => !WIDGET_ANIM_TYPES.includes(p.type));
  if (markup) assert.match(problems({ animation: markup[0] })[0], /needs its own markup/);
  assert.deepEqual(problems(undefined), []);
});

test('motionAttrs: the animation and its timing on the widget element', () => {
  assert.equal(motionAttrs({}), '');
  assert.equal(motionAttrs({ motion: { animation: 'fade-in' } }), ' data-motion="fade-in"');
  assert.equal(
    motionAttrs({ motion: { animation: 'fade-in', start: 'top 80%' } }),
    ' data-motion="fade-in" data-motion-options="{&quot;start&quot;:&quot;top 80%&quot;}"',
  );
});

test('the library has the scroll animations and every default and page animation exists', () => {
  for (const k of ['parallax-y', 'fade-scrub', 'scale-scrub']) assert.ok(animations[k], k);
  assert.equal(animations['parallax-y'].type, 'scroll');
  for (const [type, def] of Object.entries(WIDGET_TYPES)) {
    const animation = def.defaults?.motion?.animation;
    if (!animation) continue;
    assert.ok(animations[animation], `${type}: ${animation}`);
    assert.ok(WIDGET_ANIM_TYPES.includes(animations[animation].type), `${type}: ${animation}`);
    assert.deepEqual(checkMotion(def.defaults.motion), [], type);
  }
  assert.deepEqual(motionChecks(content), []);
});

test('save refuses a widget with an unknown animation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  fs.cpSync(path.join(SITE_A, 'content/en'), path.join(root, 'content/en'), { recursive: true });
  const F = 'pages/index.json';
  const page = JSON.parse(fs.readFileSync(path.join(SITE_A, 'content/en', F), 'utf8'));
  const wgt = page.sections.flatMap((s) => s.widgets).find((widget) => widget.motion);
  const before = fs.readFileSync(path.join(root, 'content/en', F), 'utf8');
  wgt.motion = { animation: 'no-such-animation' };
  const res = save(root, { [F]: page });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /unknown animation "no-such-animation"/);
  assert.equal(fs.readFileSync(path.join(root, 'content/en', F), 'utf8'), before);
  // removing the animation from the library breaks the pages that use it
  const cfg = structuredClone(content.animations);
  const used = page.sections
    .flatMap((s) => s.widgets)
    .find((widget) => widget.motion && widget !== wgt);
  delete cfg.animations[used.motion.animation];
  assert.equal(save(root, { 'settings/animations.json': cfg }).status, 400);
  wgt.motion = { animation: 'fade-scrub', start: 'top 70%' };
  assert.equal(save(root, { [F]: page }).status, 200);
  fs.rmSync(root, { recursive: true });
});

test('editor: a widget layer over its animation, inherit and keep', () => {
  const m = widgetModel(content.animations, { animation: 'fade-scrub', end: 'top 40%' });
  assert.equal(m.type, 'scroll');
  assert.equal(m.spec.end, 'top 40%');
  assert.equal(m.spec.start, animations['fade-scrub'].start);
  assert.deepEqual(inherited(m, 'widget', ['start']), [
    animations['fade-scrub'].start,
    'animation',
  ]);
  assert.deepEqual(inherited(m, 'widget', ['nothing']), [null, null]);
  assert.equal(keepFor('widget'), 5);
  assert.equal(widgetModel(content.animations, undefined).type, undefined);
});

test('widget elements: shape, attributes; defaults and comments are refused', async () => {
  const { checkMotion, motionAttrs } = await import('../src/site/layout/motion.js');
  const { omitDefaults, storedDefaults } = await import('../src/site/defaults.js');
  assert.deepEqual(checkMotion({ elements: { 'hero.title': { animation: 'x', delay: 0.2 } } }), []);
  assert.deepEqual(checkMotion({ elements: { 'hero.title': { from: {} } } }), [
    '"motion.elements.hero.title.from" must be left out: only duration, ease, delay, stagger, trigger, start, end, scrub can be set',
  ]);
  assert.deepEqual(checkMotion({ delay: 1, elements: { a: { delay: 1 } } }), [
    '"motion.animation" must be set when the widget sets its own timing',
  ]);
  assert.equal(
    motionAttrs({ motion: { elements: { a: { delay: 1 } } } }),
    ' data-anim-elements="{&quot;a&quot;:{&quot;delay&quot;:1}}"',
  );
  const F = 'pages/x/index.json';
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-aaaa',

    sections: [{ id: 's-aaaa', enabled: true, height: 'fit', widgets: [] }],
  };
  assert.equal(storedDefaults(F, page).length, 2);
  assert.deepEqual(omitDefaults(F, page).sections[0], { id: 's-aaaa', widgets: [] });
  assert.deepEqual(checkContent(F, { ...omitDefaults(F, page), _comment: 'x' }), [
    '"_comment": no comments in content (the README documents the shape)',
  ]);
});
