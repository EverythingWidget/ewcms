<!--
  An area's head (Pages at the top of its list, Theme, Animations, Site settings): the page
  head's square ← (back to the areas, ui.panel 'areas'), the area's name over a quiet "Back to
  areas", an optional control on the right (Pages: its square +). BackHead.svelte, the same
  control on the same 12px edge as a page's head and a folder's.
-->
<script>
  import BackHead from './BackHead.svelte';
  import { areaOf } from '../areas.js';

  // id: the area (../areas.js); actions: setPanel (main.js); trailing: the control on the right
  let { id, actions, trailing = undefined } = $props();
</script>

<div class="ah">
  <BackHead
    backLabel="Back to areas"
    backTitle="Back to areas"
    title={areaOf(id)?.label ?? ''}
    onback={() => actions.setPanel('areas')}
    {trailing}
  >
    <span class="ah__to">Back to areas</span>
  </BackHead>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // as the pages list's folder head: 4px more under it
  .ah {
    margin-bottom: var(--space-1);
  }

  .ah__to {
    @include ellipsis;
    color: var(--c-text-muted);
  }
</style>
