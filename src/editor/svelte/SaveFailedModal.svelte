<script>
  /**
   * A save that failed (F80): what wasn't saved and why, until OK (or Esc). Not a toast: it can't
   * be missed. The edits stay unsaved, and copied in localStorage (draft-copy.js).
   * openSaveFailed({ message, files }) (modals.svelte.js).
   */
  import Button from './Button.svelte';
  import { argsOf, closeModal, modal } from './modals.svelte.js';

  const args = $derived(argsOf('saveFailed'));
</script>

<dialog
  class="modal__box save-alert"
  role="alertdialog"
  aria-labelledby="save-failed-title"
  {@attach modal('saveFailed')}
>
  {#if args}
    <h3 class="modal__title" id="save-failed-title">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Not saved
    </h3>
    <p class="save-alert__msg">{args.message}</p>
    <p class="hint small">
      Your edits are still here, unsaved{args.files?.length ? ':' : '.'}
      {#each args.files || [] as f, i (f)}{i ? ', ' : ''}<code>content/{f}</code>{/each}
    </p>
    <p class="hint small">Fix what it says, then save again (Ctrl+S).</p>
    <footer class="modal__actions">
      <Button variant="primary" onclick={() => closeModal('saveFailed')}>OK</Button>
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
