// A Collapsible's whole header opens and closes it: a click on the bar's padding (and on the
// card's top edge, now the bar's) toggles it, not only one on the title or the caret; the bar's
// own controls (a switch, a reset button, a count's link) act alone; a section card (onenter)
// doesn't toggle. The title button keeps the keyboard and aria. Nothing moves on screen: the
// card's top padding is the bar's now (the sticky bar's offsets follow).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const s = readFileSync(new URL('../src/editor/svelte/Collapsible.svelte', import.meta.url), 'utf8');

/** The component's bar click handler, run as is on a stand-in bar. */
function barHandler({ onenter = null } = {}) {
  const code = s.match(/const BAR_CONTROLS =[\s\S]*?function barClick\(e\) \{[\s\S]*?\n {2}\}/)[0];
  const log = [];
  const make = new Function('onenter', 'toggle', `${code}; return barClick;`);
  return { barClick: make(onenter, () => log.push('toggle')), log };
}

const { document } = parseHTML(`<div class="collapsible__bar">
  <button class="collapsible__toggle"><span class="collapsible__title">CTA button</span></button>
  <input type="checkbox" class="switch" role="switch">
  <span class="ctheme__reset"><button class="crole__reset"><i></i></button></span>
  <span class="count">3</span>
  <button class="collapsible__caret"><i></i></button>
</div>`);
const $ = (sel) => document.querySelector(sel);

test("a click on the bar's padding (its former dead edge) toggles it", () => {
  const { barClick, log } = barHandler();
  barClick({ target: $('.collapsible__bar') }); // the padding: the bar itself is the target
  barClick({ target: $('.count') }); // a plain label in it
  assert.deepEqual(log, ['toggle', 'toggle']);
});

test("the bar's own controls act alone; the title and caret toggle once (their own click)", () => {
  const { barClick, log } = barHandler();
  for (const sel of [
    '.switch',
    '.crole__reset i',
    '.collapsible__toggle .collapsible__title',
    '.collapsible__caret i',
  ])
    barClick({ target: $(sel) });
  assert.deepEqual(log, []);
  assert.match(
    s,
    /class="collapsible__toggle"\s*aria-expanded=\{isOpen\}\s*aria-controls="\{uid\}-body"\s*onclick=\{toggle\}/,
  );
  assert.match(s, /class=\{\['collapsible__caret'[\s\S]{0,120}onclick=\{toggle\}/);
});

test("a section card's bar (onenter) doesn't toggle", () => {
  const { barClick, log } = barHandler({ onenter: () => {} });
  barClick({ target: $('.collapsible__bar') });
  assert.deepEqual(log, []);
  assert.match(
    s,
    /<div class=\{\['collapsible__bar', !onenter && 'is-toggle'\]\} onclick=\{barClick\}>/,
  );
  assert.match(s, /&\.is-toggle \{\s*cursor: pointer;/);
});

test("the card's top padding is the bar's: the whole header a target, nothing moved", () => {
  assert.match(s, /\n {2}\.collapsible \{[^}]*?padding: 0 0 var\(--space-3\);/);
  assert.match(
    s,
    /\.collapsible__bar \{\s*display: flex;\s*padding: var\(--space-3\) var\(--space-2\) 0;/,
  );
  // the sticky bar (a panel's top level): its title still 4px under the scroll area's top
  assert.match(
    s,
    /top: -16px;[^}]*margin-bottom: -8px;\s*padding: var\(--space-3\) var\(--space-2\) var\(--space-2\);/,
  );
});
