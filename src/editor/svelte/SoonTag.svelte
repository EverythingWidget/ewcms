<!--
  "Coming soon" where a row's › would be (a row not built yet, status 'soon': ../areas.js):
  the area list's and Theme's Fonts and styles. The row itself: the soon-row mixin.
-->
<script>
  import { COMING_SOON } from '../areas.js';
</script>

<span class="soon">{COMING_SOON}</span>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the row's right edge (its 4px + 8px), on one line
  .soon {
    flex: none;
    padding-right: var(--space-2);
    @include muted;
    white-space: nowrap;
  }
</style>
