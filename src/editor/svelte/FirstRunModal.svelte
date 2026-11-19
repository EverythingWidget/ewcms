<!--
  First run (a site ewcms dev just made from the default site, src/cli/scaffold.mjs): the site's name,
  language and look, asked once. Opened by App.svelte when site.json has no name (the default site's
  is empty): the files say whether it was asked, nothing else does. Start writes them to
  content/site.json (name, lang, accent) and saves; Later closes it (asked again next time,
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
  // the look: the accent colour (site.json accent), the default site's first
  const LOOKS = [
    ['#cfc8b8', 'Sand'],
    ['#b8c8cf', 'Mist'],
    ['#c8cfb8', 'Sage'],
    ['#cfb8c0', 'Rose'],
  ];
  let name = $state('');
  let lang = $state('en');
  let accent = $state(LOOKS[0][0]);
  let busy = $state(false);
  const hint = $derived(langHint(lang));

  function onopen() {
    lang = live.get(SITE, '/lang') || 'en';
    const own = live.get(SITE, '/accent');
    accent = LOOKS.some(([c]) => c === own) ? own : LOOKS[0][0];
  }

  async function start(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    const set = (key, value) => live.store.set(SITE, `/${key}`, value, { source: 'panel' });
    set('name', name.trim());
    set('lang', lang);
    set('accent', accent);
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
      Three things to start with. Each can be changed later in Site settings.
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
    <div class="tf">
      <span class="tf__label" id="{uid}-look">Accent colour</span>
      <div class="first-run__looks" role="radiogroup" aria-labelledby="{uid}-look">
        {#each LOOKS as [color, label] (color)}
          <button
            type="button"
            role="radio"
            aria-checked={accent === color}
            class={['first-run__look', accent === color && 'is-active']}
            title={`${label} ${color}`}
            onclick={() => (accent = color)}
          >
            <span class="first-run__swatch" style:background={color}></span>{label}
          </button>
        {/each}
      </div>
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

  .first-run__looks {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }

  .first-run__look {
    @include row(var(--space-2));
    height: var(--size-control);
    padding: 0 var(--space-3);
    border: 1px solid var(--c-line-hover);
    border-radius: var(--radius-md);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &.is-active {
      border-color: var(--c-accent);
    }
  }

  .first-run__swatch {
    width: var(--space-4);
    height: var(--space-4);
    border-radius: var(--radius-round);
  }
</style>
