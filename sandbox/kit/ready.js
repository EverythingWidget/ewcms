/**
 * A mock that loads something first (editorState's site content) holds the screenshot until it
 * is in: hold(promise). main.js waits for settled() before it sets window.__mockReady.
 */
const waits = [];

/** Hold the screenshot until `promise` settles; returns it. */
export function hold(promise) {
  waits.push(promise);
  return promise;
}

/** Every held promise settled (also ones held while waiting). */
export async function settled() {
  while (waits.length) await Promise.allSettled(waits.splice(0));
}
