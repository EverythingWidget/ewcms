<!--
  Animations (ui.panel 'animations', an area: ../areas.js): what every page's animations share
  (animations.json). Under its head (AreaHead.svelte: Back to areas) Motion (MotionSettings.svelte:
  the default timing and the Animations library, the animation open is ui.library.name), then
  the Page entrance (the site's curtain and the page fade). A page's own animations, scroll
  backdrop and curtain are on the page (its Element motion and Page motion tabs).
-->
<script>
  import Collapsible from './Collapsible.svelte';
  import AreaHead from './AreaHead.svelte';
  import EntranceCurtain from './EntranceCurtain.svelte';
  import EntranceFade from './EntranceFade.svelte';
  import MotionSettings from './MotionSettings.svelte';
  import { ui } from './ui.svelte.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../preview-runtime.js);
  // actions: setPanel (main.js)
  let { live, bridge, actions } = $props();

  // The preview's GSAP, for the ease curves.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });
</script>

<section class="ed-body" aria-label="Animations">
  <AreaHead id="animations" {actions} />
  <MotionSettings {live} {bridge} {gsap} />
  {#if gsap}
    <!-- one Page entrance section: the curtain, then the page fade (no curtain, or behind it) -->
    <Collapsible
      class="entrance"
      key="animations:entrance"
      id="page-entrance"
      title="Page entrance"
    >
      <EntranceCurtain {live} {bridge} {gsap} />
      <EntranceFade {live} {gsap} />
    </Collapsible>
  {:else}
    <p class="hint">Waiting for the preview…</p>
  {/if}
</section>
