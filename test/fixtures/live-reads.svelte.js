// For test/live-copy.test.mjs: a widget read the way the widget pop-up reads it, in a $derived,
// and what a field shows from inside it (its config.columns), run by real Svelte reactivity.
import { createLive } from '../../src/editor/svelte/live.svelte.js';

/**
 * read(live): the widget object. flush: the client runtime's (svelte's own entry is its server
 * build in Node, where flushSync does nothing). Returns columns(): what the field shows now.
 */
export function watch(store, read, flush) {
  const live = createLive(store);
  let shown;
  const stop = $effect.root(() => {
    const widget = $derived(read(live) || {});
    $effect(() => {
      shown = widget.config?.columns;
    });
  });
  flush();
  return {
    columns: () => (flush(), shown),
    stop,
  };
}
