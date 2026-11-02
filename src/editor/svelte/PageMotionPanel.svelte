<!--
  A page's Page motion tab (ContentPanel.svelte, ui.pageTab 'page-motion'): the page's own
  cards, Scroll backdrop (ScrollBackdropCard.svelte: its backdrop) then Page entrance
  (TransitionCard.svelte: its curtain, a link to Settings > Page entrance). No widget list:
  the preview's clicks arrange here, as on Sections (previewClicks, ui.svelte.js).
    live  reactive store; actions  main.js; file  the page file
-->
<script>
  import { tick } from 'svelte';
  import ScrollBackdropCard from './ScrollBackdropCard.svelte';
  import TransitionCard from './TransitionCard.svelte';
  import { ui } from './ui.svelte.js';

  let { live, actions, file } = $props();

  /** Settings, its Page entrance section opened and scrolled to (the site's curtain and page fade). */
  async function openEntranceSettings() {
    ui.sections['settings:entrance'] = true;
    actions.setPanel('settings');
    await tick();
    document
      .querySelector('[data-section="page-entrance"]')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
</script>

<ScrollBackdropCard {live} {file} />
<TransitionCard {live} onsettings={openEntranceSettings} />
