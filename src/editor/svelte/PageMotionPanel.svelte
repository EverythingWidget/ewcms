<!--
  A page's Page motion tab (ContentPanel.svelte, ui.pageTab 'page-motion'): the page's own
  cards, Scroll backdrop (ScrollBackdropCard.svelte: its backdrop) then Page entrance
  (EntranceCard.svelte: its curtain, a link to Animations > Page entrance). No widget list:
  the preview's clicks arrange here, as on Sections (previewClicks, ui.svelte.js).
    live  reactive store; actions  main.js; file  the page file
-->
<script>
  import { tick } from 'svelte';
  import ScrollBackdropCard from './ScrollBackdropCard.svelte';
  import EntranceCard from './EntranceCard.svelte';
  import { ui } from './ui.svelte.js';

  let { live, actions, file } = $props();

  /** Animations, its Page entrance section opened and scrolled to (the site's curtain and page fade). */
  async function openEntranceSettings() {
    ui.sections['animations:entrance'] = true;
    actions.setPanel('animations');
    await tick();
    document
      .querySelector('[data-section="page-entrance"]')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
</script>

<ScrollBackdropCard {live} {file} />
<EntranceCard {live} onsettings={openEntranceSettings} />
