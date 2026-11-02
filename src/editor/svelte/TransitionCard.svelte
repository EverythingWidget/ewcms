<!--
  A page's Page motion tab (PageMotionPanel.svelte), after Scroll backdrop: the Page entrance card (how visitors arrive at this page), a
  section card (Section.svelte) whose second line sums it up ("Curtain: site default" or
  "Curtain: off (page fade)"). Inside it, the page's curtain (TransitionPageCurtain.svelte).
  The page's backdrop is its own card just above (ScrollBackdropCard.svelte).
    live  reactive store; onsettings  open Settings at its Page entrance section
-->
<script>
  import TransitionPageCurtain from './TransitionPageCurtain.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { splitEdit } from '../../site/helpers.js';
  import { curtainMode } from '../../client/anim/curtain.js';

  let { live, onsettings } = $props();

  const route = $derived(live.routeOf(ui.path));
  const curtain = $derived.by(() => {
    live.version;
    const at = route && splitEdit(route.transitionEdit);
    return at ? curtainMode(live.get(at.file, at.ptr)) : 'global';
  });
</script>

<Section
  key="motion:entrance"
  title="Page entrance"
  name="Curtain: {curtain === 'off' ? 'off (page fade)' : 'site default'}"
>
  <p class="hint">How visitors arrive at this page.</p>
  <TransitionPageCurtain {live} {onsettings} />
</Section>
