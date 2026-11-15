// F97 (also F42, F48): a scroll reveal (photo-reveal, grid-reveal, fade-in) starts clipped or at
// opacity 0 and plays when its start is reached. clamp() keeps every start where the page can
// scroll (a widget near the page end, a short page), so each one plays: on screen at load at
// once (start 0, never passed: F48), at the end of the page when scrolled there, and in the
// editor preview again when scrolled back to the top (start 0 reset it there and it stayed blank).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollVars } from '../src/client/anim/types.js';
import { flags } from '../src/client/anim/flags.js';

const once = { trigger: 'scroll', start: 'top 85%' };
// a ScrollTrigger as its callbacks see it: start (clamped), scroll, its animation's progress
const self = ({ start, scroll = 0, progress = 0 }) => {
  const anim = {
    p: progress,
    plays: 0,
    progress: () => anim.p,
    play: () => anim.plays++,
    restart: () => anim.plays++,
  };
  return { start, scroll: () => scroll, animation: anim };
};

test('F97: every reveal start is clamped to where the page can scroll (near the end, short pages)', () => {
  for (const preview of [false, true]) {
    flags.preview = preview;
    assert.equal(scrollVars(once, 'el').scrollTrigger.start, 'clamp(top 85%)');
    assert.equal(
      scrollVars({ ...once, start: 'top top' }, 'el').scrollTrigger.start,
      'clamp(top top)',
    );
    const scrub = scrollVars({ ...once, scrub: true, end: 'bottom 20%' }, 'el').scrollTrigger;
    assert.equal(scrub.start, 'clamp(top 85%)');
    assert.equal(scrub.end, 'clamp(bottom 20%)');
  }
  flags.preview = false;
  assert.deepEqual(scrollVars({ trigger: 'load' }, 'el'), {}); // on load: no scroll position
});

test('F97: live, a reveal on screen at load (or on a short page) plays without scrolling', () => {
  flags.preview = false;
  const st = scrollVars(once, 'el').scrollTrigger;
  assert.equal(st.once, true);
  const onScreen = self({ start: 0 });
  st.onRefresh(onScreen);
  assert.equal(onScreen.animation.plays, 1);
  // below the fold: it waits for the scroll; already played: not again
  for (const s of [
    self({ start: 120 }),
    self({ start: 0, progress: 1 }),
    self({ start: 0, scroll: 40 }),
  ]) {
    st.onRefresh(s);
    assert.equal(s.animation.plays, 0);
  }
});

test('F97: in the editor preview, back at the top a reveal clamped to 0 plays again, not blank', () => {
  flags.preview = true;
  const st = scrollVars(once, 'el').scrollTrigger;
  assert.equal(st.toggleActions, 'play none none reset');
  const top = self({ start: 0 });
  st.onLeaveBack(top);
  assert.equal(top.animation.plays, 1);
  const lower = self({ start: 300 }); // above its start again: reset, to watch it once more
  st.onLeaveBack(lower);
  assert.equal(lower.animation.plays, 0);
  flags.preview = false;
});
