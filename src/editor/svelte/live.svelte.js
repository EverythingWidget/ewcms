/**
 * `live`: a reactive view of the editor store (../store.js) for Svelte components.
 *
 * The store stays plain JavaScript with an on() event. Every store event bumps `version`;
 * everything below reads `version` first, so a component that uses it re-renders after
 * each edit, undo, save, ... without knowing about store events. Components ask for what they
 * show (a file, a value, the routes, the sources, a schema) and never read the counter
 * themselves: this module is the one place that decides what wakes them.
 */
import { contentFromFiles, sourceIds } from '../../render/files.js';
import { schemaFor } from './source-items.js';
import { getRoutes } from '../../render/routes.js';

const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export function createLive(store) {
  let version = $state(0);
  store.on(() => version++);
  // the site's routes, built once per store change for everyone who asks (not per reader)
  let routesAt = -1;
  let routes = [];
  let contentAt = -1;
  let content = {};
  const contentNow = () => {
    if (contentAt !== version) {
      content = contentFromFiles(store.current);
      contentAt = version;
    }
    return content;
  };
  const routesNow = () => {
    if (routesAt !== version) {
      // the editor: [param] pages that build none too (unbuilt), so they can be edited
      routes = getRoutes(contentNow(), { unbuilt: true });
      routesAt = version;
    }
    return routes;
  };

  // the store's files, one new object per change (the store edits its own in place), shared
  let filesAt = -1;
  let files = {};
  // the number of unsaved changes, counted once per store change (App.svelte reads it 4 times)
  let changesAt = -1;
  let changes = 0;

  return {
    store,
    /** The edited files ({ name: data }), a new object per change, shared by every reader. Don't change it. */
    get files() {
      if (filesAt !== version) {
        files = { ...store.current };
        filesAt = version;
      }
      return files;
    },
    /** Read it to re-run after every store change (e.g. to re-read something outside the store). */
    get version() {
      return version;
    },
    /** The site's content with the edits ({ site, pages, sources, ... }), shared. Don't change it. */
    get content() {
      version;
      return contentNow();
    },
    /** Every route of the site with the edits (routes.js), shared: built once per change. */
    get routes() {
      version;
      return routesNow();
    },
    /** The route of `path` ("/about/"), or undefined. */
    routeOf(path) {
      return this.routes.find((r) => r.path === path);
    },
    /** A copy of a file's edited value. A new object each time, so Svelte sees in-place edits. */
    current(file) {
      version;
      return copy(store.current[file]);
    },
    /** A copy of a file's last saved value. */
    base(file) {
      version;
      return copy(store.base[file]);
    },
    /** One edited value, e.g. get('pages/index.json', '/sections/0/title'). Don't change it in place. */
    get(file, ptr) {
      version;
      return store.get(file, ptr);
    },
    /**
     * A copy of one edited value (an object: a widget), a new object per change. get() gives the
     * store's own, which it edits in place (a widget's config/columns): a $derived of it stays the
     * same object, so what reads inside it (widget.config.columns) would not re-run.
     */
    copy(file, ptr) {
      version;
      return copy(store.get(file, ptr));
    },
    /** Does the value at file#ptr differ from the saved one? */
    changed(file, ptr) {
      version;
      return store.changedAt(file, ptr);
    },
    /** Does the list item `id` at file#ptr differ from the saved one (store.changedItem)? */
    changedItem(file, ptr, id) {
      version;
      return store.changedItem(file, ptr, id);
    },
    get canUndo() {
      version;
      return store.canUndo();
    },
    get canRedo() {
      version;
      return store.canRedo();
    },
    /** Are the files loaded (any file in the store)? */
    get loaded() {
      version;
      return Object.keys(store.current).length > 0;
    },
    /** The sources' ids (content/en/sources/*.json), sorted. */
    get sources() {
      version;
      return sourceIds(store.current);
    },
    /** A source file's schema ("sources/people.json"): its schema file, else inferred (schemaFor). */
    schema(file) {
      version;
      return schemaFor(store, file);
    },
    /**
     * What `fn(store)` makes of the files, or of what follows them (the preview's elements, an
     * editor's plan from the store), run again after every store change: for what the getters
     * above don't name. Don't change the store's objects in it.
     */
    read(fn) {
      version;
      return fn(store);
    },
    /** Number of unsaved changes over all files (one per changed value). */
    get changes() {
      if (changesAt !== version) {
        changes = store.changeCount();
        changesAt = version;
      }
      return changes;
    },
  };
}
