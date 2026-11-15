/**
 * Waits that never hang (G1, F104). A tab in the background paints no frames, so
 * requestAnimationFrame waits there until the tab is in front again: Add widget waited for the
 * preview's next frame before it added the widget, and a pick in a background tab (an agent
 * driving several editor tabs) added nothing. Timers still run there (throttled), so each wait
 * also ends after a time.
 */

/** The window's next frame, or `ms` later, whichever comes first. */
export const frameOr = (win, ms = 100) =>
  new Promise((done) => {
    win.requestAnimationFrame(() => done());
    setTimeout(done, ms);
  });

/** `promise` settled, or `ms` later, whichever comes first (a render that never answers). */
export const within = (promise, ms) =>
  Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((done) => setTimeout(done, ms)),
  ]);
