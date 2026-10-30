<!--
  InfoHelp: a small (i) in a label row that explains its setting. An 11px icon in a 16px circle
  (top-aligned in the 16px label line: the row keeps its height, nothing shifts); at rest the
  quiet text of the surface it sits on (--text-quiet, _mixins.scss surface()), hovered or open
  its strong text on its hover wash (--text-strong, --field-hover). A click opens a
  floating note (232px, DM Mono 12/18; a slate-blue surface of its own, a 1px ring) in the top layer, under the icon, flipped to stay in view
  (left when it would leave the right edge or sits in a dialog's right half, above when it would leave the bottom). Esc or a click
  outside closes it.
    label:    what it explains (its button's name: "About Source")
    children: the note's text (<b> for the terms)
-->
<script>
  let { label = 'Help', children } = $props();

  let open = $state(false);
  let btn = $state();
  let note = $state();
  const id = $props.id();

  const W = 232;
  const GAP = 6;
  const EDGE = 8;

  /** The note placed under the icon (or over it), inside the window; its arrow at the icon. */
  function place() {
    if (!btn || !note) return;
    const q = btn.getBoundingClientRect();
    const h = note.offsetHeight;
    // leftwards when it would leave the window, or sits in the right half of a dialog (the
    // pop-up): the note stays over it
    const box = btn.closest('[role="dialog"]')?.getBoundingClientRect();
    const right =
      q.left - EDGE + W > innerWidth - EDGE || (!!box && q.left > box.left + box.width / 2);
    let x = right ? q.right + EDGE - W : q.left - EDGE;
    x = Math.max(EDGE, Math.min(x, innerWidth - W - EDGE));
    const up = q.bottom + GAP + h > innerHeight - EDGE && q.top - GAP - h > EDGE;
    note.style.left = `${Math.round(x)}px`;
    note.style.top = `${Math.round(up ? q.top - GAP - h : q.bottom + GAP)}px`;
    note.style.setProperty('--arr', `${Math.round(q.left + q.width / 2 - x - 5)}px`);
    note.classList.toggle('is-up', up);
  }

  /** Shown in the top layer (no panel clips it); closes on Esc, a click outside, a scroll. */
  function show(el) {
    el.showPopover?.();
    place();
    const key = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      open = false;
      btn?.focus();
    };
    const away = (e) => {
      if (!el.contains(e.target) && !btn.contains(e.target)) open = false;
    };
    const move = () => place();
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', away, true);
    addEventListener('resize', move);
    addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', away, true);
      removeEventListener('resize', move);
      removeEventListener('scroll', move, true);
    };
  }
</script>

<button
  bind:this={btn}
  type="button"
  class={['ih', open && 'is-open']}
  aria-label={label}
  aria-expanded={open}
  aria-controls={open ? id : undefined}
  onclick={(e) => {
    e.stopPropagation();
    open = !open;
  }}><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button
>
{#if open}
  <div bind:this={note} class="ih__note" {id} role="note" popover="manual" {@attach show}>
    {@render children?.()}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .ih {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin: 0 0 0 4px;
    vertical-align: top;
    border-radius: 50%;
    color: var(--text-quiet);
    font-size: var(--fs-sm);
    line-height: 1;
    cursor: pointer;
    &:hover,
    &.is-open {
      color: var(--text-strong);
      background: var(--field-hover);
    }
    &:focus-visible {
      outline: 1px solid var(--focus-line);
      outline-offset: 1px;
    }
  }

  .ih__note {
    position: fixed;
    inset: auto;
    box-sizing: border-box;
    width: 232px;
    margin: 0;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    overflow: visible;
    // its own surface (in the top layer, over any surface): slate blue, the same in every
    // pop-up; a 1px ring (a shadow: no border), the pop-ups' shadow
    @include surface(var(--c-help-note));
    color: var(--c-text);
    background: var(--surface);
    box-shadow:
      0 0 0 1px var(--c-help-note-ring),
      var(--shadow-pop);
    font: 400 var(--fs-base) / 18px var(--f-mono);
    letter-spacing: 0;
    text-transform: none;
    text-align: left;
    white-space: normal;
    :global(b) {
      color: var(--text-strong);
      font-weight: 500;
    }
    // the arrow at the icon
    &::before {
      content: '';
      position: absolute;
      top: -4px;
      left: var(--arr);
      width: 8px;
      height: 8px;
      background: inherit;
      border-radius: var(--radius-xs) 0 0;
      // the ring on its two outer sides; it covers the note's ring where it meets it
      box-shadow: -1px -1px 0 0 var(--c-help-note-ring);
      transform: rotate(45deg);
    }
    &:global(.is-up)::before {
      top: auto;
      bottom: -4px;
      border-radius: 0 0 var(--radius-xs);
      box-shadow: 1px 1px 0 0 var(--c-help-note-ring);
    }
  }
</style>
