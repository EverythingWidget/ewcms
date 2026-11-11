<!--
  The editor's button: a filled control after the footer's Save / Publish, or an icon button.
    variant   'default' | 'primary' (the main action, light) | 'danger' (red: Delete, Discard)
              | 'file' (a file name as written, e.g. people.json: not uppercase, 24px)
    size      'default' (40px; icon only 32px) | 'small' (32px; icon only also 32×32)
    icon      Font Awesome name without the prefix, e.g. 'trash'
    iconOnly  just the icon, a utility (Grid, the phone view, undo / redo, close): no fill or
              shadow at rest, quiet colour; with aria-pressed it is a toggle, --c-accent while
              on, still no fill. label is its aria-label and title
    label     the text when there are no children
  Also disabled, type ('button'), title, onclick; anything else (aria-*, data-*, attachments)
  goes on the element. Hover / press change colour and fill; nothing moves.
-->
<script>
  let {
    variant = 'default',
    size = 'default',
    icon = '',
    iconOnly = false,
    label = '',
    disabled = false,
    type = 'button',
    title,
    onclick,
    children,
    ...rest
  } = $props();

  const classes = $derived([
    'btn',
    size === 'small' && 'btn--small',
    variant !== 'default' && `btn--${variant}`,
    iconOnly && 'btn--icon',
  ]);
  const name = $derived(iconOnly ? label : undefined);
</script>

{#snippet content()}
  {#if icon}<i class="fa-solid fa-{icon}" aria-hidden="true"></i>{/if}
  {#if !iconOnly}{#if children}{@render children()}{:else}{label}{/if}{/if}
{/snippet}

<button
  {type}
  class={classes}
  {disabled}
  aria-label={name}
  title={title ?? name}
  {onclick}
  {...rest}>{@render content()}</button
>

<style lang="scss">
  @use '../styles/mixins' as *;

  .btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) 20px;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--c-text);
    background: var(--field-bg);
    box-shadow:
      inset 0 1px 0 var(--white-a08),
      inset 0 0 0 1px var(--white-a04);
    font-size: var(--fs-sm);
    line-height: 16px; // 12 + 16 + 12 = 40px
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
    transition:
      background 0.2s,
      color 0.2s,
      box-shadow 0.2s;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--field-hover);
    }

    &:active:not(:disabled, [aria-disabled]) {
      background: var(--selected-bg);
      color: var(--selected-fg);
      box-shadow:
        0 0 0 1px var(--white-a40),
        0 0 8px var(--white-a40),
        0 0 14px color-mix(in srgb, var(--selected-bg) 55%, transparent);
    }

    &:disabled,
    &[aria-disabled] {
      opacity: var(--o-disabled);
      cursor: default;
    }
  }

  .btn--small {
    height: 32px;
    padding: var(--space-2) var(--space-4); // 32px
  }

  .btn--primary {
    color: var(--c-on-light);
    background: var(--c-text);
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--c-text-strong);
    }

    &:active:not(:disabled, [aria-disabled]) {
      background: var(--c-text-strong);
      color: var(--c-on-light);
      box-shadow:
        0 0 0 1px var(--white-a40),
        0 0 8px var(--white-a40),
        0 0 14px color-mix(in srgb, var(--selected-bg) 55%, transparent);
    }
  }

  .btn--danger {
    color: var(--c-on-danger);
    background: var(--c-danger);
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--c-danger-hover);
    }

    &:active:not(:disabled, [aria-disabled]) {
      background: var(--c-danger-hover);
      color: var(--c-on-danger);
      box-shadow:
        0 0 0 1px var(--white-a40),
        0 0 8px var(--white-a40),
        0 0 14px color-mix(in srgb, var(--selected-bg) 55%, transparent);
    }
  }

  // a file name: as written, 24px
  .btn--file {
    padding: var(--space-1) var(--space-3);
    letter-spacing: 0;
    text-transform: none;
  }

  // just the icon: a 32×32 square, no fill; a toggle (aria-pressed) is the accent while on
  .btn--icon {
    width: 32px;
    height: var(--size-control);
    padding: 0;
    font-size: var(--fs-lg);
    color: var(--text-quiet);
    background: none;
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      color: var(--text-strong);
      background: none;
      box-shadow: none;
    }

    // light icon + the default button's whitish glow; no solid fill (nothing moves)
    &:active:not(:disabled, [aria-disabled]) {
      color: var(--selected-bg);
      background: none;
      box-shadow:
        0 0 0 1px var(--white-a40),
        0 0 8px var(--white-a40),
        0 0 14px color-mix(in srgb, var(--selected-bg) 55%, transparent);
    }

    // a toggle stays the accent while on, still no fill
    &[aria-pressed='true'],
    &[aria-pressed='true']:hover:not(:disabled, [aria-disabled]),
    &[aria-pressed='true']:active:not(:disabled, [aria-disabled]) {
      color: var(--c-accent);
      background: none;
      box-shadow: none;
    }
  }

  .btn--icon.btn--small {
    width: 32px;
    height: 32px;
  }

  // last: the focus ring wins over every variant's shadow (icon specificity included)
  .btn:focus-visible,
  .btn--icon:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
