<!--
  Motion tab, one animated element (ui.anim, picked in the preview or in the Elements list):
  replay and scroll it, pick where edits go (this widget's elements with its data-anim name, the
  widget's motion.elements in the page file; or every element with that name), its animation, and its timing (a Custom switch per field, MotionGroups).
  What the animation does is shown read-only: it is edited in the Animations sub-tab
  (AnimLibrary.svelte). Older overrides of those values get a notice: move them into the
  animation, or drop them.
  (In code and animations.json an animation is a "animation".)
  MotionPanel creates a new one for every pick.
-->
<script>
  import Button from './Button.svelte';
  import MotionGroups from './MotionGroups.svelte';
  import Select from './Select.svelte';
  import { ui, pickElement } from './ui.svelte.js';
  import { GENERIC_TYPES, animModel, keepFor, layerPtr } from './motion.js';
  import { ANIMATIONS } from '../../site/files.js';

  // cfg: animations.json as edited; items: the page's animated elements; gsap: the preview's;
  // onlibrary(name): open the Animations sub-tab at that animation;
  // file, sections: the page file and its sections (MotionPanel), to find the element's widget
  let { live, bridge, cfg, items, gsap, onlibrary, file, sections } = $props();

  const sel = ui.anim; // { el, id, key, owner, scope }
  // its widget in the page file: /sections/<i>/widgets/<j> (null: outside the widgets)
  const base = $derived.by(() => {
    for (const s of sections)
      for (const widget of s.widgets)
        if (widget.id === sel.owner) return `/sections/${s.at}/widgets/${widget.j}`;
    return null;
  });
  const element = $derived.by(() => {
    live.version;
    return base ? live.get(file, `${base}/motion/elements`)?.[sel.id] : undefined;
  });
  // where edits go: picked, else this widget's elements when they have values, else All
  const scope = $derived(sel.scope || (element ? 'element' : 'target'));
  const m = $derived(animModel(cfg, sel, element));
  const sameTarget = $derived(items.filter((x) => x.id === sel.id).length);
  const sameWidget = $derived(
    items.filter(
      (x) => x.id === sel.id && x.el.closest('[data-widget]')?.dataset.widget === sel.owner,
    ).length,
  );
  const scopes = $derived([
    ...(base
      ? [['element', 'This widget', `The "${sel.id}" elements of this widget (${sameWidget})`]]
      : []),
    [
      'target',
      'All',
      `Every data-anim="${sel.id}" element on the site (${sameTarget} on this page)`,
    ],
  ]);
  const animations = $derived(
    Object.entries(cfg.animations).filter(
      ([name, p]) => GENERIC_TYPES.has(p.type) || name === m.animationName,
    ),
  );
  const hasOverrides = $derived(Object.keys(m.own).length > 0);

  // Scroll position of the element in the preview, 0-100 (read once, when it is picked).
  const scrolled = () => Math.round(bridge.scrubProgress(sel.el) * 100);
  let progress = $state(scrolled());

  const ptr = () => layerPtr(m, sel, scope, base);
  const fileOf = () => (scope === 'element' ? file : ANIMATIONS);
  const removeAnimation = () =>
    live.store.remove(fileOf(), `${ptr()}/animation`, {
      keep: keepFor(scope),
      source: 'motion-structure',
    });
  function setAnimation(name) {
    if (scope === 'element' && name === m.target.animation) removeAnimation();
    else
      live.store.set(fileOf(), `${ptr()}/animation`, name, {
        keep: keepFor(scope),
        source: 'motion-structure',
      });
  }
</script>

<div class="msel__head">
  <Button size="small" icon="arrow-left" onclick={() => pickElement(null)}>Elements</Button>
  <h3 class="msel__title">{sel.id}</h3>
</div>

<div class="msel__actions">
  <Button size="small" icon="play" onclick={() => bridge.replay(sel.el)}>Replay</Button>
  <label
    class="scrub"
    title="Scroll the page through this element (0% = entering at the bottom, 100% = leaving at the top)"
  >
    <span class="scrub__label">Scroll</span>
    <input
      type="range"
      min="0"
      max="100"
      step="0.5"
      class="scrub__range"
      bind:value={progress}
      oninput={() => bridge.scrubTo(sel.el, progress / 100)}
    />
    <span class="scrub__val">{Math.round(progress)}%</span>
  </label>
</div>

<div class="scope">
  <div class="seg">
    {#each scopes as [s, label, title] (s)}
      <button
        type="button"
        class={['seg__btn', s === scope && 'is-active']}
        {title}
        onclick={() => (sel.scope = s)}
        >{label}
        {#if s === 'target'}<span class="scope__id">“{sel.id}”</span>{/if}</button
      >
    {/each}
  </div>
  <p class="hint">Edits apply to: {scopes.find((s) => s[0] === scope)[2]}.</p>
</div>

<div class="f">
  <div class="f__top">
    <span class="f__label">Animation</span>
    <span class="f__src" data-src={m.own.animation ? 'element' : 'target'}
      >{m.own.animation ? 'widget' : 'all'}</span
    >
    {#if scope === 'element' && m.own.animation}
      <Button
        size="small"
        icon="rotate-left"
        iconOnly
        label="Use the animation of all &quot;{sel.id}&quot;"
        onclick={removeAnimation}
      />
    {/if}
    <!-- like a grid's Source edit button: the animation's own values, in the library -->
    <Button
      size="small"
      icon="pen-to-square"
      iconOnly
      label="Edit {m.animationName} in Animations"
      onclick={() => onlibrary(m.animationName)}
    />
  </div>
  <Select
    aria-label="Animation"
    value={m.animationName}
    options={animations.map(([name, p]) => ({ value: name, label: name, hint: p.type }))}
    onchange={setAnimation}
  />
</div>
<MotionGroups {live} {gsap} {m} {scope} file={fileOf()} ptr={ptr()} />
{#if hasOverrides}
  <Button
    variant="danger"
    size="small"
    onclick={() =>
      live.store.remove(file, layerPtr(m, sel, 'element', base), {
        keep: keepFor('element'),
        source: 'motion-structure',
      })}
  >
    Remove all overrides of this widget's elements
  </Button>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .msel__head {
    @include stack(var(--space-1));
    margin-bottom: var(--space-3);
    justify-items: start;
  }

  .msel__title {
    margin: var(--space-2) 0 0;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: var(--fs-3xl);
    line-height: 1;
  }

  .msel__actions {
    @include row(var(--space-3));
    margin-bottom: var(--space-4);
  }

  .scrub {
    flex: 1;
    @include row(var(--space-2));
    color: var(--c-text-muted);
  }

  .scrub__label {
    font-size: var(--fs-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .scrub__val {
    width: 36px;
    text-align: right;
    color: var(--c-text);
  }

  .scope {
    margin-bottom: var(--space-4);

    // the data-anim name as written in the HTML (the tab's other text is uppercase)
    &__id {
      text-transform: none;
    }

    .seg {
      margin-bottom: var(--space-2);
    }

    .hint {
      font-size: var(--fs-sm);
      margin: 0;
    }
  }
</style>
