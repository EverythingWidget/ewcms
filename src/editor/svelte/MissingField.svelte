<!--
  MissingField: a widget's When a value is missing (config.missing; src/render/layout/missing.js),
  the one row a page widget's Content (GroupFields.svelte) and a template widget's
  (TemplateWidgetFields.svelte) both have: one full row, a select with its tip.
    edit      its data-edit ref (<file>#<ptr>)
    value, options, unsaved, onvalue   the Field's
    inherit   in an item template: its options start with Inherit (as the List says) and its
              tip says so; a page widget's are Hide / Show empty
-->
<script>
  import Field from './Field.svelte';

  let { edit, value, options, unsaved = false, inherit = false, onvalue } = $props();
</script>

<Field {edit} label="When a value is missing" type="select" {value} {options} {unsaved} {onvalue}>
  {#snippet tip()}{#if inherit}<b>When a value is missing</b>: an item has no value for a property
      this widget shows. <b>Hide</b> leaves the widget out of that item when all its properties are
      empty (a button: its link or label). <b>Show empty</b> keeps it, empty. <b>Inherit</b>: as the
      List says.{:else}<b>When a value is missing</b>: what happens on the published page when the
      values this widget takes from its Source are all empty. <b>Hide</b>: the widget is left out (a
      button too when its label or link is empty). <b>Show empty</b>: it stays, empty. The editor
      always shows it, dimmed. A List's items follow the List unless they set their own.{/if}{/snippet}
</Field>
