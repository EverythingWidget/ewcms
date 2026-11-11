// Page entrance: the curtain or none per page (curtain.js, entrance-curtain.js) and its editor parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curtainFor, curtainMode } from '../src/client/anim/curtain.js';
import { checkContent } from '../src/site/validate.js';
import { createStore } from '../src/editor/store.js';
import { setCurtainMode } from '../src/editor/svelte/entrance-curtain.js';

const site = { label: true, in: { duration: 0.3, ease: 'power4.out' }, total: 1.1 };
const esrc = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('page entrance: the site curtain or none; its timing is the site curtain alone', () => {
  assert.equal(curtainMode(undefined), 'global');
  assert.equal(curtainMode({ curtain: 'off' }), 'off');
  assert.equal(curtainFor(undefined, site), site);
  assert.equal(curtainFor({ curtain: 'off' }, site), null);
});

test('page entrance: validation and the editor modes', () => {
  const F = 'pages/x/index.json';
  const of = (transition) =>
    checkContent(F, { version: 1, kind: 'page', id: 'pg-xxxx', transition });
  assert.deepEqual(of({ curtain: 'off' }), []);
  assert.equal(of({ curtain: 'global', overrides: { total: 2 } }).length, 1); // no per-page timing
  assert.equal(of({ mode: 'custom' }).length, 1);
  assert.equal(of({ curtain: 'off', overrides: {} }).length, 1);
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-xxxx' } });
  const page = { file: F, ptr: '/transition' };
  setCurtainMode(store, page, 'off');
  assert.deepEqual(store.current[F].transition, { curtain: 'off' });
  setCurtainMode(store, page, 'global');
  assert.ok(!('transition' in store.current[F]));
});

test('Page entrance: one Settings section (curtain, page fade); the page card links to it', () => {
  const sp = esrc('svelte/SettingsPanel.svelte');
  assert.match(
    sp,
    /key="settings:entrance"[\s\S]*?id="page-entrance"[\s\S]*?title="Page entrance"/,
  );
  assert.match(sp, /<EntranceCurtain[^>]*\/>\s*<EntranceFade[^>]*\/>\s*<\/Collapsible>/);
  for (const [f, head] of [
    ['EntranceCurtain', 'Curtain'],
    ['EntranceFade', 'Page fade'],
  ]) {
    const s = esrc(`svelte/${f}.svelte`);
    assert.doesNotMatch(s, /<Collapsible|title="Transition: /);
    assert.match(s, new RegExp(`<h3 class="pane__head">${head}</h3>`));
  }
  const pc = esrc('svelte/EntrancePageCurtain.svelte');
  assert.match(pc, /global: 'Site default', off: 'Off'/);
  assert.match(pc, /onclick=\{onsettings\}>Page entrance settings<\/button>/);
  assert.match(
    esrc('svelte/EntranceCard.svelte'),
    /title="Page entrance"\s*name="Curtain: \{curtain === 'off' \? 'off \(page fade\)' : 'site default'\}"/,
  );
  assert.doesNotMatch(esrc('svelte/EntranceCard.svelte'), /<ScrollBackdrop|Backdrop:/);
  assert.match(
    esrc('svelte/ScrollBackdropCard.svelte'),
    /title="Scroll backdrop"\s*name="Scroll backdrop: \{backdrop\}"/,
  );
  assert.match(
    esrc('svelte/PageMotionPanel.svelte'),
    /<ScrollBackdropCard \{live\} \{file\} \/>\s*<EntranceCard /,
  );
  const mp = esrc('svelte/PageMotionPanel.svelte');
  assert.match(mp, /ui\.sections\['settings:entrance'\] = true;/);
  assert.match(mp, /\[data-section="page-entrance"\]/);
});
