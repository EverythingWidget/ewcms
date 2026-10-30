<!--
  Settings > Motion: what every page's animations share (settings/animations.json).
    Animations      the library (AnimLibrary.svelte): every animation, edit one with the
                    preview in view; "uses on this page" counts the page in the preview.
                    The animation open is ui.library.name, kept by persist.js.
-->
<script>
  import AnimLibrary from './AnimLibrary.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { motionSections } from './page-motion.js';
  import { targetFile } from '../layout-sync.js';
  import { ANIMATIONS } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js); gsap: the preview's
  let { live, bridge, gsap } = $props();

  const cfg = $derived(live.current(ANIMATIONS));
  const items = $derived.by(() => {
    ui.previewVersion;
    live.version;
    return bridge.api ? bridge.animElements() : [];
  });
  const sections = $derived.by(() => {
    ui.previewVersion;
    live.version;
    const file = targetFile(ui.target, bridge.doc);
    return motionSections(file ? live.get(file, '/sections') : null, bridge.doc, items);
  });
</script>

<Section key="settings:motion" title="Motion">
  <p class="hint">Used on every page: the animations every widget can use</p>
  {#if gsap}
    <AnimLibrary {live} {bridge} {cfg} {items} {sections} {gsap} />
  {/if}
</Section>
