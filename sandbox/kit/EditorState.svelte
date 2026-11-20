<!--
  editorState (state.js) as a wrapper: it sets the made-up state, loading the dev server's
  content first when no `files` are given (the screenshot waits for it: ready.js), then draws
  its children with the live state:
    <EditorState path="/about/" pages="many" update="available">
      {#snippet children(live)}<PagesList {live} {actions} />{/snippet}
    </EditorState>
  Props: state.js editorState's options (files, path, pages, panel, mode, widget, update).
-->
<script>
  import { hold } from './ready.js';
  import { editorState, siteFiles } from './state.js';

  let { children, files = null, ...opts } = $props();
  // the state once, at the start (a mock's made-up state; not reactive)
  // svelte-ignore state_referenced_locally
  const loading = hold(
    (files ? Promise.resolve(files) : siteFiles()).then((f) => editorState({ files: f, ...opts })),
  );
</script>

{#await loading then live}
  {@render children?.(live)}
{:catch err}
  <p class="hint">{String(err?.message || err)}</p>
{/await}
