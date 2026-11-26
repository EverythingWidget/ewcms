<!--
  Site settings (ui.panel 'site-settings', an area: ../areas.js): what is the same on every page.
  Under its head (AreaHead.svelte: Back to areas) the site's name and details (site.json), its
  search and share defaults (SEO: titles, description, share photo, address, robots, language;
  a page's own are in its SEO tab), where contact forms send (Forms), where uploaded photos are
  served from (site.json mediaUrl). Typography and Layout are in Theme (ThemePanel.svelte).
  Per-page things stay on the page (sections; Motion: its animations, scroll backdrop and
  curtain; SEO); the header's menu and labels are the Header site part in Pages
  (HeaderPart.svelte). redirects.json is in Redirects (RedirectSettings.svelte). The default
  timing, the Animations library and the Page entrance are in Animations (AnimationsPanel.svelte).
-->
<script>
  import Field from './Field.svelte';
  import RedirectSettings from './RedirectSettings.svelte';
  import Collapsible from './Collapsible.svelte';
  import Select from './Select.svelte';
  import AreaHead from './AreaHead.svelte';
  import { SEO_SETTINGS, SITE_SETTINGS } from './content-groups.js';
  import { languageOptions, langHint } from '../lib/languages.js';
  import { TARGETS } from '../../widgets/form/index.js';
  import { SITE } from '../../render/files.js';

  // live: reactive store (live.svelte.js); actions: setPanel (main.js)
  let { live, actions } = $props();

  const uid = $props.id();

  function set(key, value) {
    live.store.set(SITE, `/${key}`, value, { key: `text:${SITE}#/${key}`, source: 'panel' });
  }

  // the (i) tips of Name & Details and SEO fields, by key (the snippets below)
  const TIPS = { name: nameTip, title: titleTip };

</script>

{#snippet nameTip()}<b>Site name</b>: your site's name, for the header's logo text, share cards and
  search engines. It also fills <b>{'{site}'}</b> in the other pages' titles, and is Home's title
  while <b>Home page title</b> (SEO) is empty.{/snippet}
{#snippet titleTip()}<b>Home page title</b>: the browser tab and search result of your Home page,
  used as written. Empty: the <b>Site name</b>. Home's own Title (its SEO tab) wins over both.{/snippet}

<section class="ed-body" aria-label="Site settings">
  <AreaHead id="site-settings" {actions} />

  <Collapsible key="site-settings:site" title="Name & Details">
    <p class="hint">
      Used on every page: the clock and search engines' details about you. The preview shows them
      after Save.
    </p>
    {#each SITE_SETTINGS as [key, label, type] (key)}
      <Field
        edit="{SITE}#/{key}"
        {label}
        {type}
        tip={TIPS[key]}
        value={live.get(SITE, `/${key}`)}
        unsaved={live.changed(SITE, `/${key}`)}
        onvalue={(value) => set(key, value)}
      />
    {/each}
    <div class={['tf', live.changed(SITE, '/lang') && 'is-unsaved']}>
      <label class="tf__label" for="{uid}-lang">Language</label>
      <Select
        id="{uid}-lang"
        value={live.get(SITE, '/lang') || 'en'}
        options={languageOptions(live.get(SITE, '/lang'))}
        onchange={(value) => set('lang', value)}
      />
      <!-- its lines kept free: the hint moves nothing -->
      <p class="hint small lang-note">{langHint(live.get(SITE, '/lang') || 'en')}</p>
    </div>
  </Collapsible>

  <Collapsible key="site-settings:seo" title="SEO">
    <p class="hint">
      What search engines and share cards show. Pages can set their own in their SEO tab; these are
      the defaults.
    </p>
    {#each SEO_SETTINGS as [key, label, type] (key)}
      <Field
        edit="{SITE}#/{key}"
        {label}
        {type}
        tip={TIPS[key]}
        placeholder={key === 'title' ? live.get(SITE, '/name') || undefined : undefined}
        value={live.get(SITE, `/${key}`)}
        unsaved={live.changed(SITE, `/${key}`)}
        onvalue={(value) => set(key, value)}
      />
    {/each}
    <div class={['tf', live.changed(SITE, '/robots') && 'is-unsaved']}>
      <label class="tf__label" for="{uid}-robots">Search engines</label>
      <Select
        id="{uid}-robots"
        value={live.get(SITE, '/robots') || 'index'}
        options={[
          { value: 'index', label: 'Index the site' },
          { value: 'noindex', label: 'Keep the whole site out (noindex)' },
        ]}
        onchange={(value) => set('robots', value)}
      />
    </div>
  </Collapsible>

  <Collapsible key="site-settings:forms" title="Forms">
    <p class="hint">
      Where contact forms send (a form can pick its own in Content). The Cloudflare function emails
      through Resend with the keys set in the Cloudflare Pages project, never here (see the README,
      "Contact form"). In npm run dev it only logs the message.
    </p>
    <div class={['tf', live.changed(SITE, '/forms/target') && 'is-unsaved']}>
      <label class="tf__label" for="{uid}-forms">Forms send to</label>
      <Select
        id="{uid}-forms"
        value={live.get(SITE, '/forms/target') || 'function'}
        options={TARGETS.map(([value, label]) => ({ value, label }))}
        onchange={(value) => set('forms/target', value)}
      />
    </div>
    <Field
      edit="{SITE}#/forms/endpoint"
      label="External endpoint (https://…, e.g. Formspree)"
      placeholder="https://formspree.io/f/…"
      value={live.get(SITE, '/forms/endpoint')}
      unsaved={live.changed(SITE, '/forms/endpoint')}
      onvalue={(value) => set('forms/endpoint', value.trim() || undefined)}
    />
    <Field
      edit="{SITE}#/forms/turnstileSiteKey"
      label="Turnstile site key (optional spam check; empty: off)"
      value={live.get(SITE, '/forms/turnstileSiteKey')}
      unsaved={live.changed(SITE, '/forms/turnstileSiteKey')}
      onvalue={(value) => set('forms/turnstileSiteKey', value.trim() || undefined)}
    />
    <p class="hint small">
      Email link: the visitor's mail app, to the site email ({live.get(SITE, '/email') ||
        'not set'}).
    </p>
  </Collapsible>

  <RedirectSettings {live} />

  <Collapsible key="site-settings:media" title="Photos">
    <p class="hint">
      Photos you upload in the editor go to Cloudflare R2 (keys in .env.local, see the README). The
      content stores their key (photos/…); the site shows them from this address. Photos in media/
      keep working.
    </p>
    <Field
      edit="{SITE}#/mediaUrl"
      label="Photo address (R2 public URL)"
      placeholder="https://photos.eeliyarasta.com"
      value={live.get(SITE, '/mediaUrl')}
      unsaved={live.changed(SITE, '/mediaUrl')}
      onvalue={(value) => set('mediaUrl', value.trim())}
    />
  </Collapsible>
</section>

<style lang="scss">
  .lang-note {
    min-height: 48px;
    margin: var(--space-1) 0 0;
  }
</style>
