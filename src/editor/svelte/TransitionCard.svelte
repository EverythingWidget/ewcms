<!--
  A page's Motion tab, last: the Transition card, a section card (Section.svelte) whose
  second line sums it up ("Curtain: global · Backdrop: off"). Inside it, the page's backdrop
  (TransitionBackdrop.svelte) and its curtain (TransitionPageCurtain.svelte).
    live  reactive store; file  the page file; onsettings  open Settings (the curtain's timing)
-->
<script>
  import TransitionBackdrop from './TransitionBackdrop.svelte';
  import TransitionPageCurtain from './TransitionPageCurtain.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { isObject } from '../../site/is.js';
  import { splitEdit } from '../../site/helpers.js';
  import { curtainMode } from '../../client/anim/curtain.js';

  let { live, file, onsettings } = $props();

  const route = $derived(live.routeOf(ui.path));
  const curtain = $derived.by(() => {
    live.version;
    const at = route && splitEdit(route.transitionEdit);
    return at ? curtainMode(live.get(at.file, at.ptr)) : 'global';
  });
  // on: shown (an image, not switched off), as the backdrop's switch
  const backdrop = $derived.by(() => {
    live.version;
    const b = live.get(file, '/backdrop');
    if (!isObject(b)) return 'off';
    const has = Array.isArray(b.images) && b.images.some(Boolean);
    return has && b.enabled !== false ? 'on' : 'off';
  });
</script>

<Section
  key="motion:transition"
  title="Transition"
  name="Curtain: {curtain} · Backdrop: {backdrop}"
>
  <TransitionBackdrop {live} {file} />
  <TransitionPageCurtain {live} {onsettings} />
</Section>
