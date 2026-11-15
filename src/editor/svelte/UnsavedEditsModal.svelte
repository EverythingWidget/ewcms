<script>
  /**
   * Unsaved edits kept from an earlier visit (a reload, a closed tab: draft-copy.js, F80),
   * offered back: Restore puts them back as unsaved edits, Discard throws them away. One of the
   * two must be picked (Esc doesn't close it). Not autosave: nothing reaches content/ until
   * Ctrl+S. openUnsavedEdits({ t, page, files, onrestore, ondiscard }) (modals.svelte.js).
   */
  import Button from './Button.svelte';
  import { argsOf, closeModal, modal } from './modals.svelte.js';

  const args = $derived(argsOf('unsavedEdits'));
  const when = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const pick = (fn) => {
    closeModal('unsavedEdits');
    fn?.();
  };
</script>

<dialog
  class="modal__box save-alert"
  aria-labelledby="unsaved-edits-title"
  oncancel={(e) => e.preventDefault()}
  {@attach modal('unsavedEdits')}
>
  {#if args}
    <h3 class="modal__title" id="unsaved-edits-title">Unsaved edits from before</h3>
    <p class="save-alert__msg">
      Edits from {when(args.t)}{args.page ? ` (on ${args.page})` : ''} were never saved:
      {#each args.files || [] as f, i (f)}{i ? ', ' : ''}<code>content/{f}</code>{/each}
    </p>
    <p class="hint small">
      Restore puts them back as unsaved edits (Ctrl+S saves them); Discard throws them away.
    </p>
    <footer class="modal__actions">
      <Button variant="danger" onclick={() => pick(args.ondiscard)}>Discard</Button>
      <Button variant="primary" onclick={() => pick(args.onrestore)}>Restore</Button>
    </footer>
  {/if}
</dialog>

<style>
  .save-alert {
    max-width: 440px;
  }

  .save-alert__msg,
  .save-alert code {
    overflow-wrap: anywhere;
  }

  .save-alert__msg {
    margin: 0 0 var(--space-2);
  }
</style>
