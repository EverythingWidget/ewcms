<!--
  First run (a site ewcms dev just made from the default site, src/cli/scaffold.mjs): the site's name,
  language and look, asked once. Opened by App.svelte when site.json has no name (the default site's
  is empty): the files say whether it was asked, nothing else does. Start writes them to
  content/site.json (name, lang) and saves; Later closes it (asked again next time,
  while the name is empty). openFirstRun() (modals.svelte.js), mounted once in App.svelte.
-->
<script>
  import { closeModal, modal } from './modals.svelte.js';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import { SITE } from '../../render/files.js';
  import { languageOptions, langHint } from '../lib/languages.js';

  // live: reactive store (live.svelte.js); actions: save (main.js)
  let { live, actions } = $props();

  const uid = $props.id();
  let name = $state('');
  let lang = $state('en');
  let busy = $state(false);
  const hint = $derived(langHint(lang));

  function onopen() {
    lang = live.get(SITE, '/lang') || 'en';
  }

  async function start(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    const set = (key, value) => live.store.set(SITE, `/${key}`, value, { source: 'panel' });
    set('name', name.trim());
    set('lang', lang);
    busy = true;
    const saved = await actions.save();
    busy = false;
    if (saved) closeModal('firstRun');
  }
</script>

<dialog
  class="modal__box first-run"
  aria-labelledby="{uid}-title"
  {@attach modal('firstRun', { onopen })}
>
  <form onsubmit={start}>
    <h3 class="modal__title" id="{uid}-title">Your new site</h3>
    <p class="hint small first-run__lead">
      A name and a language to start with. Both can be changed later in Site settings; the brand colour lives in the theme.
    </p>
    <label class="tf">
      <span class="tf__label">Site name</span>
      <input class="tf__input" bind:value={name} placeholder="My site" />
    </label>
    <div class="tf">
      <label class="tf__label" for="{uid}-lang">Language</label>
      <Select id="{uid}-lang" bind:value={lang} options={languageOptions()} />
      <!-- two lines kept free: the hint moves nothing -->
      <p class="hint small first-run__note">{hint}</p>
    </div>
    <footer class="modal__actions">
      <Button onclick={() => closeModal('firstRun')}>Later</Button>
      <Button
        type="submit"
        variant="primary"
        disabled={!name.trim() || busy}
        title={name.trim() ? 'Write them to content/site.json' : 'Name the site first'}
        >Start</Button
      >
    </footer>
  </form>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  dialog.first-run {
    width: min(400px, calc(100vw - 32px));
  }

  .first-run form {
    @include stack(var(--space-3));

    .tf {
      margin: 0;
    }
  }

  .first-run .modal__title,
  .first-run__lead {
    margin: 0;
  }

  .first-run .modal__actions {
    margin-top: 0;
  }

  .first-run__note {
    min-height: 32px;
    margin: var(--space-1) 0 0;
  }

</style>
