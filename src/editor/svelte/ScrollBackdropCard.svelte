<!--
  A page's Motion tab, after the widgets and before the Page entrance card: the Scroll
  backdrop card, a section card (Section.svelte) whose second line sums it up ("Scroll
  backdrop: on"). Inside
  it, the page's backdrop (TransitionBackdrop.svelte: page.backdrop, its photos and how they
  change as the visitor scrolls).
    live  reactive store; file  the page file
-->
<script>
  import TransitionBackdrop from './TransitionBackdrop.svelte';
  import Section from './Section.svelte';
  import { isObject } from '../../site/is.js';

  let { live, file } = $props();

  // on: shown (a photo, not switched off), as the backdrop's switch
  const backdrop = $derived.by(() => {
    live.version;
    const b = live.get(file, '/backdrop');
    if (!isObject(b)) return 'off';
    const has = Array.isArray(b.photos) && b.photos.some(Boolean);
    return has && b.enabled !== false ? 'on' : 'off';
  });
</script>

<Section
  key="page:backdrop"
  id="scroll-backdrop"
  title="Scroll backdrop"
  name="Scroll backdrop: {backdrop}"
>
  <p class="hint">The images behind the page's sections that change as the visitor scrolls.</p>
  <TransitionBackdrop {live} {file} />
</Section>
