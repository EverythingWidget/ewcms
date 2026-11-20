/**
 * The section renders waiting their turn (main.js renderSections, POST /__editor/render), per
 * root (the page's view, or the footer). A change while a render for the same root waits (not
 * started yet) joins it: its sections added, rendered from the file as it is when it starts.
 * So changes in a row render once more after the one running, not once each.
 */
export function createRenderJobs() {
  const waiting = new Map(); // root -> { ids: Set, only }
  return {
    /**
     * Sections `ids` of `root` to render (`only`: the one widget that changed). A new job to
     * queue, or null when a waiting one took them in.
     */
    add(root, ids, only = null) {
      const queued = waiting.get(root);
      if (queued) {
        for (const id of ids) queued.ids.add(id);
        // one widget swapped alone only when every change was that widget
        if (queued.only !== only) queued.only = null;
        return null;
      }
      const job = { ids: new Set(ids), only };
      waiting.set(root, job);
      return job;
    },
    /** The job runs now: a change after this waits for a job of its own. Its ids: [...]. */
    start(root, job) {
      if (waiting.get(root) === job) waiting.delete(root);
      return [...job.ids];
    },
  };
}
