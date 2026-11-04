<!--
  A text field that can hold an item's fields (parts, src/site/layout/parts.js): typed text with
  chips in it, one line (multiline: Enter a line break). Typing `{name}` turns it into the chip
  {name}, the same as picking it (Field.svelte's picker, its + Field); `{{` is a literal `{`.
  A chip whose name isn't in `names` (the item's fields and the sources) is a warning chip.
    value    a string (only text) or parts; onvalue(next) gets the same shapes
    ref      { insert }: ref.insert(name) puts a field's chip at the caret (else at the end)
-->
<script>
  import { insertChip, readParts, renderParts, typedChip } from '../lib/parts-input.js';

  let {
    id,
    value,
    names = null,
    multiline = false,
    placeholder = '',
    label = '',
    onfocus,
    onvalue,
    ref = null,
  } = $props();

  let el = $state();
  let last = null; // the value this input sent (not rendered again: the caret stays)
  let range = null; // the caret when it lost the focus (+ Field puts a chip there)

  $effect(() => {
    const v = value ?? '';
    if (!el || JSON.stringify(v) === JSON.stringify(last)) return;
    renderParts(el, v, names);
    last = v;
  });

  const send = () => {
    last = readParts(el);
    onvalue(last);
  };

  function oninput(e) {
    if (e.data === '}') typedChip(el, names);
    send();
  }

  function onkeydown(e) {
    if (e.key === 'Enter' && !multiline) e.preventDefault();
  }

  function onpaste(e) {
    e.preventDefault();
    const t = e.clipboardData?.getData('text/plain') ?? '';
    el.ownerDocument.execCommand('insertText', false, multiline ? t : t.replace(/\s*\n\s*/g, ' '));
  }

  function onblur() {
    const sel = el.ownerDocument.getSelection();
    range = sel?.rangeCount && el.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  }

  // ref.insert(name): a field's chip at the caret (+ Field, Field.svelte)
  $effect(() => {
    if (!ref) return;
    ref.insert = (name) => {
      insertChip(el, range, name, names);
      range = null;
      send();
    };
  });
</script>

<div
  bind:this={el}
  {id}
  class={['tf__input', 'pin', multiline && 'pin--multi']}
  contenteditable="true"
  role="textbox"
  tabindex="0"
  aria-label={label}
  aria-multiline={multiline}
  data-placeholder={placeholder}
  spellcheck="true"
  {onfocus}
  {oninput}
  {onkeydown}
  {onpaste}
  {onblur}
></div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // an input's look (editor.scss .tf__input), 32px for one line
  .pin {
    min-height: var(--size-control);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    cursor: text;

    &:empty::before {
      content: attr(data-placeholder);
      color: var(--text-quiet);
      pointer-events: none;
    }
  }

  .pin--multi {
    min-height: 80px;
  }

  // a field's chip: a ring in the widget accent; an unknown name's in the warning colour
  .pin :global(.pin__chip) {
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    color: var(--c-widget-accent);
    background: color-mix(in srgb, var(--c-widget-accent) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-widget-accent) 45%, transparent);
    user-select: all;
    cursor: default;
  }

  .pin :global(.pin__chip.is-unknown) {
    color: var(--c-warning);
    background: color-mix(in srgb, var(--c-warning) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-warning) 60%, transparent);
  }
</style>
