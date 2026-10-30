<!--
  A page's Motion tab, last: the Page transition card, a section card (Section.svelte) whose
  second line sums it up ("Curtain: global · Backdrop: off"). The page's backdrop
  (BackdropFields.svelte) and its curtain (PageCurtain.svelte), as they were in the old
  Transitions tab.
    live  reactive store; file  the page file; onsettings  open Settings (the curtain's timing)
-->
<script>
  import BackdropFields from './BackdropFields.svelte';
  import PageCurtain from './PageCurtain.svelte';
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
  key="motion:transition"
  title="Page transition"
  name="Curtain: {curtain} · Backdrop: {backdrop}"
>
  <BackdropFields {live} {file} />
  <PageCurtain {live} {onsettings} />
</Section>
