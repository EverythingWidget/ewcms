<!--
  Site Settings tab: what is the same on every page. First Motion (MotionSettings.svelte: the
  default timing and the Animations library), then where contact forms send (Forms), the site's
  name and details
  (site.json), its search and share defaults (SEO: titles, description, share photo,
  address, robots, language; a page's own are in Nav > SEO), the Page entrance section (the site's curtain
  and the page fade, animations.json), where uploaded photos are served from (site.json mediaUrl)
  and the text styles' sizes (Type: site.json type, px, src/site/layout/type.js; the preview
  follows them as they are typed, and its Preview shows every style: the type specimen,
  site/layout/type-specimen.js, until Close preview or the Pages tab).
  Per-page things stay in Nav, on the page (sections; Motion: its animations, scroll
  backdrop and curtain; SEO); the header's menu and labels are the Header site part in Content
  (HeaderPart.svelte). redirects.json is in Redirects (RedirectSettings.svelte).
-->
<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Button from './Button.svelte';
  import RedirectSettings from './RedirectSettings.svelte';
  import Collapsible from './Collapsible.svelte';
  import Select from './Select.svelte';
  import EntranceCurtain from './EntranceCurtain.svelte';
  import MotionSettings from './MotionSettings.svelte';
  import EntranceFade from './EntranceFade.svelte';
  import { ui } from './ui.svelte.js';
  import { SEO_SETTINGS, SITE_SETTINGS } from './content-groups.js';
  import { TARGETS } from '../../site/widgets/form/index.js';
  import { SITE } from '../../site/files.js';
  import { COLS } from '../../site/layout/grid.js';
  import { TYPE_KEYS, TYPE_SCALE, TYPE_VARS, typeVarList } from '../../site/layout/type.js';
  import { isTypeSpecimen } from '../../site/layout/type-specimen.js';
  import { LINE_STYLES } from '../../site/text.js';
  import { isObject } from '../../site/is.js';
  import {
    CONTAINED,
    CONTAINED_MIN,
    containedOf,
    containedWidth,
  } from '../../site/layout/contain.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: showSpecimen (main.js)
  let { live, bridge, actions } = $props();

  const uid = $props.id();

  // The preview's GSAP, for the ease curves.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });

  function set(key, value) {
    live.store.set(SITE, `/${key}`, value, { key: `text:${SITE}#/${key}`, source: 'panel' });
  }

  // Type: [key, label] of a style's fields (site.json type, by style and key)
  const TYPE_FIELDS = [
    ['min', 'Min (px)'],
    ['max', 'Max (px)'],
    ['line', 'Line'],
  ];
  const typeVars = $derived.by(() => {
    live.version;
    return typeVarList(live.get(SITE, '') || {});
  });
  // the theme's sizes (the placeholders): the preview's own, read where site.json sets none
  let themeType = $state(structuredClone(TYPE_SCALE));
  // the preview's text follows the type as it is typed (the page's head has it after Save)
  $effect(() => {
    ui.previewVersion;
    const root = bridge.doc?.documentElement;
    if (!root) return;
    const set = new Map(typeVars);
    for (const name of TYPE_VARS) {
      if (set.has(name)) root.style.setProperty(name, set.get(name));
      else root.style.removeProperty(name);
    }
    const css = root.ownerDocument.defaultView.getComputedStyle(root);
    const next = untrack(() => structuredClone($state.snapshot(themeType)));
    for (const k of Object.keys(TYPE_SCALE))
      for (const [key, suffix] of TYPE_KEYS) {
        const name = `--type-${k}-${suffix}`;
        const v = parseFloat(css.getPropertyValue(name));
        if (!set.has(name) && Number.isFinite(v)) next[k][key] = v;
      }
    themeType = next;
  });
  const specimen = $derived(isTypeSpecimen(ui.path));

  /** A style's setting typed (undefined: cleared, the theme's); empty objects left out. */
  function setType(k, key, value) {
    if (value !== undefined && !(typeof value === 'number' && value > 0)) return;
    const own = live.get(SITE, '/type');
    const type = isObject(own) ? structuredClone($state.snapshot(own)) : {};
    const style = { ...(isObject(type[k]) ? type[k] : {}), [key]: value };
    if (value === undefined) delete style[key];
    if (Object.keys(style).length) type[k] = style;
    else delete type[k];
    live.store.set(SITE, '/type', Object.keys(type).length ? type : undefined, {
      key: `text:${SITE}#/type/${k}/${key}`,
      source: 'panel',
    });
  }
  // Layout: a contained section's columns (layout/contain.js), its width at common windows
  const contained = $derived.by(() => {
    live.version;
    return containedOf(live.get(SITE, '') || {});
  });
  const WINDOWS = [1280, 1366, 1440, 1536, 1920];
  // the preview follows as it is typed (the page's head has it after Save)
  $effect(() => {
    ui.previewVersion;
    bridge.doc?.documentElement.style.setProperty('--contain', String(contained));
  });
  function setContained(value) {
    if (!Number.isInteger(value) || value < CONTAINED_MIN || value > COLS) return;
    set('layout/containedCols', value);
  }
</script>

<section class="ed-body">
  <MotionSettings {live} {bridge} {gsap} />

  <Collapsible key="settings:site" title="Name & Details">
    <p class="hint">
      Used on every page: the clock and search engines' details about you. The preview shows them
      after Save.
    </p>
    {#each SITE_SETTINGS as [key, label, type] (key)}
      <Field
        edit="{SITE}#/{key}"
        {label}
        {type}
        value={live.get(SITE, `/${key}`)}
        changed={live.changed(SITE, `/${key}`)}
        onvalue={(value) => set(key, value)}
      />
    {/each}
  </Collapsible>

  <Collapsible key="settings:seo" title="SEO">
    <p class="hint">
      What search engines and share cards show. Pages can set their own in Nav > SEO; these are the
      defaults.
    </p>
    {#each SEO_SETTINGS as [key, label, type] (key)}
      <Field
        edit="{SITE}#/{key}"
        {label}
        {type}
        value={live.get(SITE, `/${key}`)}
        changed={live.changed(SITE, `/${key}`)}
        onvalue={(value) => set(key, value)}
      />
    {/each}
    <div class={['tf', live.changed(SITE, '/robots') && 'is-changed']}>
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

  <Collapsible key="settings:forms" title="Forms">
    <p class="hint">
      Where contact forms send (a form can pick its own in Content). The Cloudflare function emails
      through Resend with the keys set in the Cloudflare Pages project, never here (see the README,
      "Contact form"). In npm run dev it only logs the message.
    </p>
    <div class={['tf', live.changed(SITE, '/forms/target') && 'is-changed']}>
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
      changed={live.changed(SITE, '/forms/endpoint')}
      onvalue={(value) => set('forms/endpoint', value.trim() || undefined)}
    />
    <Field
      edit="{SITE}#/forms/turnstileSiteKey"
      label="Turnstile site key (optional spam check; empty: off)"
      value={live.get(SITE, '/forms/turnstileSiteKey')}
      changed={live.changed(SITE, '/forms/turnstileSiteKey')}
      onvalue={(value) => set('forms/turnstileSiteKey', value.trim() || undefined)}
    />
    <p class="hint small">
      Email link: the visitor's mail app, to the site email ({live.get(SITE, '/email') ||
        'not set'}).
    </p>
  </Collapsible>

  <Collapsible key="settings:layout" title="Layout">
    <p class="hint">
      How wide a contained section is: columns of the {COLS}-column grid ({CONTAINED_MIN}–{COLS};
      {CONTAINED} by default), centred and never nearer the edges than the side margins. Its widgets keep
      their columns: they scale with it. Phones: the full width inside the margins.
    </p>
    <div class="fields">
      <Field
        edit="{SITE}#/layout/containedCols"
        label="Contained width (columns)"
        type="number"
        value={contained}
        changed={live.changed(SITE, '/layout/containedCols')}
        onvalue={setContained}
      />
    </div>
    <ul class="widths" aria-label="Contained width at common window sizes">
      {#each WINDOWS as w (w)}
        <li><span>{w}</span><strong>{Math.round(containedWidth(w, contained))} px</strong></li>
      {/each}
    </ul>
  </Collapsible>

  <Collapsible key="settings:type" title="Type">
    <p class="hint">
      The usual size of each text style, in pixels: it grows with the window between Min and Max.
      When they are the same, the size is fixed. Empty: the theme's (shown greyed).
    </p>
    <div>
      <Button
        size="small"
        label={specimen ? 'Close preview' : 'Preview'}
        title={specimen ? 'Back to the page you were on' : 'Every text style on a page of its own'}
        aria-pressed={specimen}
        onclick={() => actions.showSpecimen(!specimen)}
      />
    </div>
    {#each LINE_STYLES as [k, name, tag] (k)}
      <p class="tf__label">{name} · {tag.toUpperCase()}</p>
      <div class="scale">
        {#each TYPE_FIELDS as [key, label] (key)}
          <Field
            edit="{SITE}#/type/{k}/{key}"
            {label}
            type="number"
            empty
            placeholder={String(themeType[k][key])}
            value={live.get(SITE, `/type/${k}/${key}`)}
            changed={live.changed(SITE, `/type/${k}/${key}`)}
            onvalue={(value) => setType(k, key, value)}
          />
        {/each}
      </div>
    {/each}
  </Collapsible>

  <RedirectSettings {live} />

  <Collapsible key="settings:media" title="Photos">
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
      changed={live.changed(SITE, '/mediaUrl')}
      onvalue={(value) => set('mediaUrl', value.trim())}
    />
  </Collapsible>

  {#if gsap}
    <!-- one Page entrance section: the curtain, then the page fade (no curtain, or behind it) -->
    <Collapsible class="entrance" key="settings:entrance" id="page-entrance" title="Page entrance">
      <EntranceCurtain {live} {bridge} {gsap} />
      <EntranceFade {live} {gsap} />
    </Collapsible>
  {:else}
    <p class="hint">Waiting for the preview…</p>
  {/if}
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // Type: a style's Min, Max and Line in one row
  .scale {
    display: grid;
    // (minmax: a number input's default width can't widen a column)
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap-fields);
  }

  // the contained width at each window size: window | px
  .widths {
    @include stack(var(--space-1));
    margin: var(--space-3) 0 0;
    padding: 0;
    @include muted;
    list-style: none;

    li {
      display: flex;
      justify-content: space-between;
    }

    strong {
      color: var(--c-text);
      font-weight: 400;
    }
  }
</style>
