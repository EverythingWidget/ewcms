<!--
  One widget's motion (its `motion` in the page file, src/render/layout/motion.js), the body of its
  card in the Sections tab (SectionCard.svelte, the widget selected): its animation (none, or one of
  the library's that works on any widget) beside an info button whose popover (Popover.svelte, with
  its tip) lists what the animation moves, each property's start and end value; what it does is
  edited in the Animations library (Animations > Motion), the pen on the Animation label. Then its
  timing: the fields this widget sets for itself (its own values: bright, with the reset arrow), the
  others (the animation's, dimmed, still in reach: an edit gives the widget its own) behind
  Customize timing (kept open or closed in ui.sections['motion:timing']); the yellow dot after a
  label: unsaved, as every field's. Scroll start and Scrub only when it plays On scroll (Scroll end
  when it also scrubs), Stagger only when the animation moves several elements in it; after them,
  Scroll moves the page through the widget in the preview. Replay is its card's play button
  (WidgetRow.svelte). Nothing here when it has no animation but the Animation field.
    file, at, j   where the widget is: sections[at].widgets[j] of the page file
    el            its element in the preview (null when not shown)
    onlibrary     (name) open the animation in the Animations library (Animations > Motion)
-->
<script>
  import Button from './Button.svelte';
  import MotionField from './MotionField.svelte';
  import Popover from './Popover.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import {
    GENERIC_TYPES,
    GROUPS,
    TIMING,
    dig,
    formatValue,
    inherited,
    isTiming,
    keepFor,
    propFields,
    widgetModel,
  } from './motion.js';
  import { compile } from '../lib/pointer.js';

  let { live, bridge, gsap, cfg, file, at, j, el = null, onlibrary } = $props();

  const base = $derived(`/sections/${at}/widgets/${j}`);
  const ptr = $derived(`${base}/motion`);
  const motion = $derived.by(() => {
    const m = live.get(file, ptr);
    return m && typeof m === 'object' ? { ...m } : null;
  });
  const m = $derived(widgetModel(cfg, motion));
  const known = $derived(!!motion?.animation && !!cfg.animations[m.animationName]);
  const options = $derived([
    { value: '', label: 'none', hint: 'no motion' },
    ...Object.entries(cfg.animations)
      .filter(([name, p]) => GENERIC_TYPES.has(p.type) || name === m.animationName)
      .map(([name, p]) => ({ value: name, label: name, hint: p.type })),
  ]);

  /** Pick the animation (its own timing stays); '' removes the widget's motion. */
  function setAnimation(animation) {
    if (!animation) live.store.remove(file, ptr, { keep: 4, source: 'motion-structure' });
    else live.store.set(file, ptr, { ...motion, animation }, { source: 'motion-structure' });
  }

  // ---- the start and end values (the info button's popover)
  let propsAt = $state();
  let propsOpen = $state(false);
  // the property's short name in the table (Distance Y: Y)
  const short = (label) => label.replace(/^Distance /, '');
  const props = $derived.by(() => {
    const from = m.animation.from || {};
    const to = m.animation.to || {};
    return propFields('from', { ...from, ...to }).map((def) => {
      const key = def.path[1];
      return [short(def.label), formatValue(def, from[key]), formatValue(def, to[key])];
    });
  });

  // ---- timing: the animation type's timing fields (never what it does), in its groups' order
  const pathsOf = (def) => def.paths || [def.path];
  const each = (def, fn) => (def.paths ? def.paths.map(fn) : fn(def.path));
  const defs = $derived(
    (GROUPS[m.type] || [TIMING])
      .filter((g) => Array.isArray(g))
      .flatMap(([, list]) => list)
      .filter((def) => isTiming(def)),
  );
  // several elements move (Stagger is the delay between them): split text, or the animation's
  // targets in the widget (src/client/anim/engine.js widgetTargets)
  const several = $derived.by(() => {
    if (m.type === 'split') return true;
    return live.read(() => {
      if (!el) return false;
      try {
        const sel = m.spec.children;
        return (sel ? el.querySelectorAll(sel) : el.children).length > 1;
      } catch {
        return false;
      }
    });
  });
  const own = (def) => pathsOf(def).some((p) => dig(m.layers.widget, p) !== undefined);
  // the value the widget gets without its own: the animation's, the site's default timing,
  // then GSAP's own (0.5s, power1.out, no delay or stagger)
  const GSAP = { duration: 0.5, ease: 'power1.out', delay: 0, stagger: 0 };
  const fallback = (p) => cfg.defaults?.[p.at(-1)] ?? GSAP[p.at(-1)];
  const inheritedOf = (p) => inherited(m, 'widget', p)[0] ?? fallback(p);
  const valueOf = (def) => each(def, (p) => dig(m.layers.widget, p) ?? inheritedOf(p));
  const unsavedOf = (def) => pathsOf(def).some((p) => live.changed(file, ptr + compile(p)));

  const timingOpen = $derived(!!ui.sections['motion:timing']);
  // shown: its own values always; the rest with Customize timing open; each by its own rule
  const shown = $derived(
    defs.filter((def) => {
      if (def.when && !def.when(m.spec)) return false;
      if (def.path?.[0] === 'stagger' && !several && !own(def)) return false;
      return timingOpen || own(def);
    }),
  );
  // the Scroll slider: after Scroll start and Scrub, when they show
  const scrolls = $derived(
    !!el && shown.some((def) => ['start', 'scrub'].includes(def.path?.at(-1))),
  );

  function setValue(path, value) {
    live.store.set(file, ptr + compile(path), value, {
      key: `anim:${ptr}:${path.join('.')}`, // one undo step while dragging
      keep: keepFor('widget'),
      source: 'motion',
    });
  }
  /** Back to the animation's value: one undo step. */
  const reset = (def) =>
    live.store.batch(
      () =>
        pathsOf(def).forEach((p) =>
          live.store.remove(file, ptr + compile(p), { keep: keepFor('widget') }),
        ),
      { source: 'motion' },
    );

  // Scroll position of the widget in the preview, 0-100 (read when it is shown).
  const scrolled = () => (el ? Math.round(bridge.scrubProgress(el) * 100) : 0);
  let progress = $state(scrolled());

  // the card closed: the page's animations stop again for arranging (a Replay played them)
  $effect(() => () => bridge.settle?.());
</script>

<div class="wmotion">
  <div class="f">
    <div class="f__top">
      <span class="f__label">Animation</span>
      {#if known}
        <Button
          size="small"
          icon="pen-to-square"
          iconOnly
          label="Edit {m.animationName} in Animations"
          onclick={() => onlibrary(m.animationName)}
        />
      {/if}
    </div>
    <div class="anim-row">
      <Select
        aria-label="Animation"
        value={motion?.animation ?? ''}
        {options}
        onchange={setAnimation}
      />
      <span class="anim-props" bind:this={propsAt}>
        <Button
          size="small"
          icon="circle-info"
          iconOnly
          label="Start and end properties"
          disabled={!known}
          aria-expanded={propsOpen}
          onclick={() => (propsOpen = !propsOpen)}
        />
      </span>
    </div>
  </div>
  <Popover
    open={propsOpen && known}
    anchor={propsAt}
    width={320}
    tip
    label="Start and end properties"
    class="props-pop"
    onclose={() => (propsOpen = false)}
  >
    <span class="props-head">{m.animationName}</span>
    <table class="props">
      <thead>
        <tr>
          <th>Property</th>
          <th>Start</th>
          <th>End</th>
        </tr>
      </thead>
      <tbody>
        {#each props as [label, start, end] (label)}
          <tr>
            <th scope="row">{label}</th>
            <td>{start}</td>
            <td>{end}</td>
          </tr>
        {:else}
          <tr>
            <th scope="row">None</th>
            <td>–</td>
            <td>–</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Popover>

  {#if motion?.animation && !known}
    <p class="hint small">
      There is no animation “{motion.animation}” in the library: pick another one, or Save will
      refuse it.
    </p>
  {:else if known && defs.length}
    <button
      type="button"
      class="link timing-link"
      aria-expanded={timingOpen}
      onclick={() => (ui.sections['motion:timing'] = !timingOpen)}
    >
      Customize timing
      <i
        class="fa-solid fa-chevron-{timingOpen ? 'down' : 'right'} timing-link__caret"
        aria-hidden="true"
      ></i>
    </button>
    {#if shown.length}
      <div class="timing">
        {#each shown as def (def.label)}
          {@const mine = own(def)}
          <div class={['mf', unsavedOf(def) && 'is-unsaved']}>
            <MotionField
              {def}
              {gsap}
              view={mine ? 'edit' : 'dim'}
              value={valueOf(def)}
              onvalue={setValue}
            >
              {#snippet actions()}
                <button
                  type="button"
                  class={['mf__reset', mine && 'is-on']}
                  title={mine ? 'Use the animation’s value' : undefined}
                  aria-label={mine ? `${def.label}: use the animation’s value` : undefined}
                  aria-hidden={mine ? undefined : 'true'}
                  tabindex={mine ? 0 : -1}
                  onclick={() => mine && reset(def)}
                  ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
                >
              {/snippet}
            </MotionField>
          </div>
        {/each}
        {#if scrolls}
          <div class="f scroll-field">
            <div class="f__top">
              <span class="f__label">Scroll</span>
            </div>
            <label
              class="scrub"
              title="Scroll the page through this widget (0% = entering at the bottom, 100% = leaving at the top)"
            >
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                class="scrub__range"
                aria-label="Scroll"
                bind:value={progress}
                oninput={() => bridge.scrubTo(el, progress / 100)}
              />
              <span class="scrub__val">{Math.round(progress)}%</span>
            </label>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the card's body: 4px under the header's row, 12px at the sides and below
  .wmotion {
    padding: var(--space-1) var(--space-3) var(--space-3);
  }

  // [ the animation's select | its info button ]
  .anim-row {
    @include row(var(--space-2));
    min-width: 0;
  }

  // its 32px always kept, the button disabled when the animation is none
  .anim-props {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
  }

  // the popover's heading: .pov__head's type, on the popover's own 8px inset (no extra 4px),
  // as the table's
  :global(.props-pop) .props-head {
    display: block;
    padding: 0;
    color: var(--c-text-soft);
    font-size: var(--fs-2xs);
    line-height: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  // Property | Start | End: the values in full, 9px on 12px lines
  :global(.props-pop) .props {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-2xs);
    line-height: 12px;

    th,
    td {
      padding: var(--space-1) 0;
      font-weight: 400;
      text-align: left;
      vertical-align: baseline;
    }

    thead th {
      padding-top: 0;
      color: var(--c-text-soft);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-bottom: 1px solid var(--c-line);
    }

    tbody tr:last-child th,
    tbody tr:last-child td {
      padding-bottom: 0;
    }

    thead th:not(:first-child),
    td {
      text-align: right;
      padding-left: var(--space-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    tbody th {
      color: var(--c-text);
      white-space: nowrap;
    }
  }

  .timing-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
  }

  .timing-link__caret {
    flex: none;
    // the mock's 2px between the link and its caret (its 8px gap + 2px)
    // stylelint-disable-next-line local/grid-4px
    margin-left: 2px;
    font-size: var(--fs-xs);
  }

  .timing {
    min-width: 0;
  }

  // its top row 24px (the reset arrow in it), the unsaved dot after the label in its own room,
  // always kept (as a field's .tf__label)
  .mf :global(.f__top) {
    min-height: 24px;
  }

  .mf :global(.f__label) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .mf :global(.f__label)::after {
    @include unsaved-dot;
    content: '';
    visibility: hidden;
    pointer-events: none;
  }

  .mf.is-unsaved :global(.f__label)::after {
    visibility: visible;
  }

  // a value of its own: the reset arrow at the row's end (its 16px always kept)
  .mf__reset {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    visibility: hidden;
    pointer-events: none;

    &.is-on {
      visibility: visible;
      pointer-events: auto;
      cursor: pointer;
    }

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  // Scroll: the page through the widget, bright (no reset, no dot)
  .scrub {
    @include row(var(--space-2));
    color: var(--c-text-muted);
  }

  .scrub__range {
    flex: 1;
    min-width: 0;
  }

  .scrub__val {
    flex: none;
    width: 36px;
    text-align: right;
    color: var(--c-text);
  }
</style>
