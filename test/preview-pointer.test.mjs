import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createPointer } from '../src/editor/preview-pointer.js';

// The preview's pointer (preview-pointer.js): every click, double click and press in the
// preview goes to the editing first, then to the overlay, as when each registered its own.
function setup(clicks = 'arrange') {
  const { window, document } = parseHTML(`<html><body>
    <header data-header data-ed-open><a id="nav" href="/x">Nav</a></header>
    <main><div data-widget="w1"><p id="t" data-edit="p#/t" data-edit-inline data-edit-type="rich">Hi</p></div>
    <h1 id="h" data-edit="p#/h">Title</h1><div data-anim id="anim">a</div></main>
    <footer data-footer></footer></body></html>`);
  const on = { win: {}, doc: {}, root: {} };
  const rec = (where) => (type, fn) => (on[where][type] ||= []).push(fn);
  const win = { document, Element: window.Element, addEventListener: rec('win') };
  document.addEventListener = rec('doc');
  document.documentElement.addEventListener = rec('root');
  const log = [];
  const edit = {
    richEditing: false,
    pointerdown: () => log.push('edit.pointerdown'),
    cancelLinkBox: () => log.push('edit.cancelLinkBox'),
    richOf: (w) => w?.querySelector('[data-edit-inline]') || null,
    startRich: (el) => log.push(`edit.startRich ${el.id}`),
    startEdit: (el) => log.push(`edit.startEdit ${el.id}`),
    linkBoxSoon: () => log.push('edit.linkBoxSoon'),
  };
  const emit = (...a) => log.push(`emit ${a[0]} ${a[1]?.id ?? a[1]}${a[2] ? ' ' + a[2] : ''}`);
  const pointer = {};
  for (const k of ['down', 'dblclick', 'swallow', 'over', 'move', 'leave'])
    pointer[k] = () => log.push(`overlay.${k}`);
  const mode = { clicks };
  createPointer({
    bridge: { emit, edit },
    overlay: { pointer },
    clicks: () => mode.clicks,
    widget: () => 'w1',
  }).attach(win);
  const fire = (where, type, target, more = {}) => {
    const e = {
      target,
      detail: 1,
      clientX: 0,
      clientY: 0,
      altKey: false,
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {},
      ...more,
    };
    for (const fn of on[where][type] || []) fn(e);
    return e;
  };
  return { document, on, log, mode, fire, $: (s) => document.querySelector(s) };
}

test('a press, a double click and the pointer leaving: the editing first, then the overlay', () => {
  const { log, fire, $ } = setup();
  fire('doc', 'pointerdown', $('#t'));
  assert.deepEqual(log.splice(0), ['edit.pointerdown', 'overlay.down']);
  fire('win', 'pointerdown', $('#t'), { detail: 2 });
  assert.deepEqual(log.splice(0), ['edit.cancelLinkBox']);
  fire('doc', 'dblclick', $('#t'));
  assert.deepEqual(log.splice(0), ['edit.startRich t', 'overlay.dblclick']);
  fire('root', 'pointerleave', $('#t'));
  assert.deepEqual(log.splice(0), ['emit hover null', 'overlay.leave']);
});

test('while the Header is open a click outside it does nothing; inside it, it acts as usual', () => {
  const { log, fire, $ } = setup();
  const out = fire('win', 'click', $('#h'));
  assert.equal(out.prevented, true);
  assert.deepEqual(log, []);
  const nav = fire('win', 'click', $('#nav'));
  assert.equal(nav.prevented, true); // a link in it doesn't follow (arrange clicks)
});

test('arrange clicks: a text outside the widgets opens its field; a double click on it too', () => {
  const { document, log, fire, $ } = setup();
  document.querySelector('header').removeAttribute('data-ed-open');
  fire('win', 'click', $('#h'));
  assert.deepEqual(log.splice(0), ['emit pick h text', 'emit textPick p#/h']);
  fire('doc', 'dblclick', $('#h'));
  assert.deepEqual(log.splice(0), ['emit pick h text', 'emit textPick p#/h', 'overlay.dblclick']);
});

test('animate clicks pick the animated element; visitor clicks are the site own', () => {
  const s = setup('animate');
  s.document.querySelector('header').removeAttribute('data-ed-open');
  s.fire('win', 'click', s.$('#anim'));
  assert.deepEqual(s.log.splice(0), ['emit pick anim anim']);
  s.fire('doc', 'dblclick', s.$('#t'));
  assert.deepEqual(s.log.splice(0), ['overlay.dblclick']); // no in-place edit
  s.mode.clicks = 'visitor';
  const e = s.fire('win', 'click', s.$('#nav'));
  assert.equal(e.prevented, false);
  assert.deepEqual(s.log, []);
});
