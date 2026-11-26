<!--
  A page's Page motion tab (PageMotionPanel.svelte), first, before the Page entrance card: the Scroll
  backdrop card, a section card (Collapsible.svelte) whose second line sums it up ("On" or
  "Off"). Inside it, the page's backdrop (ScrollBackdrop.svelte: page.backdrop, its photos and how they
  change as the visitor scrolls).
    live  reactive store; file  the page file
-->
<script>
  import ScrollBackdrop from './ScrollBackdrop.svelte';
  import Collapsible from './Collapsible.svelte';
  import { isObject } from '../../render/is.js';

  let { live, file } = $props();

  // On: shown (a photo, not switched off), as the backdrop's switch
  const backdrop = $derived.by(() => {
    const b = live.get(file, '/backdrop');
    if (!isObject(b)) return 'Off';
    const has = Array.isArray(b.photos) && b.photos.some(Boolean);
    return has && b.enabled !== false ? 'On' : 'Off';
  });
</script>

<Collapsible key="page:backdrop" id="scroll-backdrop" title="Scroll backdrop" name={backdrop}>
  <p class="hint">The images behind the page's sections that change as the visitor scrolls.</p>
  <ScrollBackdrop {live} {file} />
</Collapsible>
