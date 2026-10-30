<!--
  Settings > Motion: what every page's animations share (settings/animations.json).
    Default timing  `defaults` { duration, delay, ease }: what an animation plays with when it
                    sets none itself (src/client/anim/engine.js). Empty: GSAP's own (the
                    placeholders), as before there was a setting. Checked by src/site/validate.js.
    Animations      the library (AnimLibrary.svelte): every animation, edit one with the
                    preview in view; "uses on this page" counts the page in the preview.
                    The animation open is ui.library.name, kept by persist.js.
-->
<script>
  import AnimLibrary from './AnimLibrary.svelte';
  import Field from './Field.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { motionSections } from './page-motion.js';
  import { targetFile } from '../layout-sync.js';
  import { ANIMATIONS } from '../../site/files.js';
  import { DEFAULT_TIMING } from '../../site/layout/motion.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js); gsap: the preview's
  let { live, bridge, gsap } = $props();

  const cfg = $derived(live.current(ANIMATIONS));
  const items = $derived.by(() => {
    ui.previewVersion;
    live.version;
    return bridge.api ? bridge.animElements() : [];
  });
  const sections = $derived.by(() => {
    ui.previewVersion;
    live.version;
    const file = targetFile(ui.target, bridge.doc);
    return motionSections(file ? live.get(file, '/sections') : null, bridge.doc, items);
  });

  // [key, label, GSAP's own: shown while unset]
  const FIELDS = [
    ['duration', 'Default duration (s)', '0.5'],
    ['delay', 'Default delay (s)', '0'],
    ['ease', 'Default ease', 'power1.out'],
  ];
  const valueOf = (key) => {
    live.version;
    const v = live.get(ANIMATIONS, `/defaults/${key}`);
    return v === undefined ? '' : String(v);
  };
  /** Typed text -> stored: empty clears it; a bad number is not stored. */
  function set(key, raw) {
    const text = String(raw).trim();
    let value;
    if (text === '') value = undefined;
    else if (DEFAULT_TIMING[key] === 'seconds') {
      value = Number(text);
      if (!Number.isFinite(value) || value < 0) return;
    } else value = text;
    live.store.set(ANIMATIONS, `/defaults/${key}`, value, {
      key: `text:${ANIMATIONS}#/defaults/${key}`,
      source: 'panel',
    });
  }
</script>

<Section key="settings:motion" title="Motion">
  <p class="hint">Used on every page: the default timing and the animations every widget can use</p>
  {#each FIELDS as [key, label, placeholder] (key)}
    <Field
      edit="{ANIMATIONS}#/defaults/{key}"
      {label}
      {placeholder}
      value={valueOf(key)}
      changed={live.changed(ANIMATIONS, `/defaults/${key}`)}
      onvalue={(v) => set(key, v)}
    />
  {/each}
  {#if gsap}
    <AnimLibrary {live} {bridge} {cfg} {items} {sections} {gsap} />
  {/if}
</Section>
