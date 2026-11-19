<!--
  Theme (ui.panel 'theme', an area: ../areas.js): under its head (Back to areas) the theme's
  own look, Fonts and styles (Coming soon), then the item templates (Templates). Their rows are
  the pages list's (PagesList.svelte, area 'theme'): a click shows one in the preview, a double
  click (or Edit) opens it in Pages; its ← and Done come back here.
-->
<script>
  import PagesList from './PagesList.svelte';

  // live: reactive store (live.svelte.js); actions: pickTarget, setPanel (main.js)
  let { live, actions } = $props();
</script>

<section class="ed-body" aria-label="Theme">
  <PagesList {live} {actions} area="theme" />
</section>
