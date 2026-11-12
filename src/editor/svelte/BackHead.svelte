<!--
  The 32px filled square ← beside a two-line title: PageHead (a page name over its path) and
  the pages list's folder header (the folder path over "Back to /parent/", a square + on the
  right). The arrow is Button's icon (fa-arrow-left), the same control in both places, so it
  stays on the 12px edge when switching between them.
    backLabel / backTitle / onback   the square back button (label is its aria-label)
    title                            the first line
    children                         the quiet second line (path crumbs, a subtitle, "Back to /")
    trailing                         optional: a control on the right (the folder's +)
-->
<script>
  import Button from './Button.svelte';

  let { backLabel, backTitle = undefined, onback, title, children, trailing } = $props();
</script>

<div class="bh">
  <Button icon="arrow-left" square label={backLabel} title={backTitle} onclick={onback} />
  <div class="bh__main">
    <h2 class="bh__title">{title}</h2>
    {@render children?.()}
  </div>
  {@render trailing?.()}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the filled square ← beside the two-line title (8px gap); both 32px squares centre on it
  .bh {
    @include row(var(--space-2));
    align-items: center;
    min-width: 0;
    min-height: var(--size-control);
  }

  .bh__main {
    display: grid;
    flex: 1;
    min-width: 0;
    font-size: var(--fs-base);
    line-height: 20px;
  }

  .bh__title {
    @include ellipsis;
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    line-height: 20px;
  }
</style>
