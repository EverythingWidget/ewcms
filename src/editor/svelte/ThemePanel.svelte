<!--
  Theme (ui.panel 'theme', an area: ../areas.js): under its head (Back to areas) the theme's
  own look, Fonts and styles (Coming soon). Their rows are the pages list's (PagesList.svelte,
  area 'theme').
-->
<script>
  import PagesList from './PagesList.svelte';

  // live: reactive store (live.svelte.js); actions: pickTarget, setPanel (main.js)
  let { live, actions } = $props();
</script>

<section class="ed-body" aria-label="Theme">
  <PagesList {live} {actions} area="theme" />
</section>
