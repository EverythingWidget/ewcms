/**
 * Editing in place in the preview (preview-runtime.js makes it; its bridge hands the toolbar's
 * calls on): the only text edited inline is a Text widget's body ([data-edit-inline]
 * [data-edit-type="rich"]: rich.js, ../render/text.js), started by a double click on it, Enter or
 * a letter on its picked widget (keys.js), or its toolbar's Edit, until it loses focus. Any
 * other [data-edit-inline] (none today) is a plain text edited until it loses focus.
 *
 *   typing          its lines into the store (one undo step per field: store.js), the toolbar's
 *                   state ('rich': richState) following the caret
 *   keys            Enter splits its line (Shift+Enter: a line break), Backspace at a list
 *                   item's start ends it, Ctrl+B / I its marks, Ctrl+A its line then all of it,
 *                   Ctrl+K its link box ('richLink'), Esc ends the edit; the editor's own keys
 *                   are forwarded to keys.js ('key': isShortcut), never the browser's
 *   paste           its lines (safe links only), a selection typed over keeps one line's style
 *   a link clicked  its link box opens (a second click: a word selected, no box: F108)
 *
 * store: store.js; emit(name, ...args): the bridge's events; clicks(): previewClicks;
 * reveal(el): a focused text centred when out of view; markApplied(el, value): the bridge's
 * note of what an element shows (applyTexts).
 */
import { splitEdit, words } from '../render/helpers.js';
import { templateIdOf } from '../render/files.js';
import { isShortcut } from './keys.js';
import {
  isCaret,
  oneLineSelection,
  lineToSelect,
  posOf,
  readBody,
  renderEditing,
  select as selectAt,
  selectionOf,
} from './rich.js';
import {
  hasMark,
  htmlLines,
  insertLines,
  lineLength,
  linkIn,
  linkRangeAt,
  plainLines,
  splitLine,
  oneLineBody,
  toggleMark,
  unlist,
  autoList,
  typedProperty,
  typeOver,
} from '../render/text.js';
import { isDraftHref, isSafeHref } from '../render/hrefs.js';

/** How long a click on a link waits for a second click before its link box opens, ms. */
const LINK_BOX_WAIT = 300;

export function createEdit({ store, emit, clicks, reveal, markApplied }) {
  let doc = null;
  let win = null; // null while a reload is on its way (the bridge's too)
  let plaintext = true;
  // the Text widget being edited in place (rich.js): { el, edit, file, ptr, widget, hold },
  // and its last selection in model positions (kept while the toolbar has focus)
  let rich = null;
  let richSel = null;

  /** End the edit in place (the preview renders the widget again). */
  function endRich() {
    if (!rich) return;
    const { el } = rich;
    rich.hold = false;
    finishRich();
    el.blur();
  }
  /**
   * A click away from the toolbar's own field (the link box): the hold is let go; the edit
   * ends unless the click was in the widget being edited (it keeps the caret there).
   */
  function releaseRich(target) {
    if (!rich) return;
    rich.hold = false;
    if (!(target && rich.el.contains(target))) endRich();
  }
  /**
   * Change the Text widget's body: fn(body, sel) -> { body, sel? }. While it is edited the
   * lines are rendered again and the selection put back; otherwise (the widget only picked)
   * `fallback` is the widget's body ptr: { file, ptr } and the change renders the section.
   */
  function richApply(fn, fallback = null) {
    const target = rich || fallback;
    if (!target) return;
    const body = structuredClone(store.get(target.file, target.ptr) || []);
    const sel = rich ? selectionOf(rich.el, win) || richSel : null;
    const out = fn(body, sel);
    if (!out?.body) return;
    if (rich) {
      rich.el.focus({ preventScroll: true });
      renderLines(out.body);
      writeRich(out.body);
      const next = out.sel || sel;
      if (next) selectAt(rich.el, win, next);
      richSel = next;
      emit('rich', richState());
    } else store.set(target.file, target.ptr, out.body, { source: 'panel', structure: true });
  }
  /** The caret in a link: all of the link selected (the link box edits it). False: no link. */
  function selectLink() {
    if (!rich) return false;
    const sel = selectionOf(rich.el, win) || richSel;
    const r = sel && linkRangeAt(store.get(rich.file, rich.ptr) || [], sel.to);
    if (!r) return false;
    selectAt(rich.el, win, r);
    richSel = r;
    emit('rich', richState());
    return true;
  }
  /** Keep the edit going while the toolbar's own field (a link, a ratio) has the focus. */
  function holdRich(on) {
    if (rich) rich.hold = !!on;
    if (!on && rich && doc.activeElement !== rich.el) {
      rich.el.focus({ preventScroll: true });
      if (richSel) selectAt(rich.el, win, richSel);
    }
  }
  /** Edit a Text widget's text (the caret at its end), `typed` typed there; false: no Text. */
  function editWidget(id, typed = '') {
    const el = richOf(
      doc?.querySelector(`[data-tw="${CSS.escape(id)}"]`) ||
        doc?.querySelector(`[data-widget="${CSS.escape(id)}"]`),
    );
    if (!el) return false;
    startRich(el);
    if (typed) doc.execCommand('insertText', false, typed);
    return true;
  }

  /**
   * Edit a text in place (a double click with arrange clicks on a [data-edit-inline] element
   * that isn't a Text widget's body; none does today): editable until it loses focus,
   * the caret where it was clicked (x, y).
   */
  function startEdit(el, x, y) {
    el.setAttribute('contenteditable', plaintext ? 'plaintext-only' : 'true');
    el.setAttribute('spellcheck', 'true');
    el.closest('a')?.setAttribute('draggable', 'false');
    el.focus({ preventScroll: true });
    const range = x === undefined ? null : doc.caretRangeFromPoint?.(x, y);
    if (range && el.contains(range.startContainer)) {
      const sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  function endEdit(el) {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.classList.remove('__ed-invalid');
  }
  const endEdits = () => {
    if (rich) finishRich();
    doc?.querySelectorAll('[data-edit-inline][contenteditable]').forEach(endEdit);
  };

  // ---- the Text widget's editor (rich.js, ../render/text.js)

  /** A paste's lines: its HTML's (bold, italic, safe links only), else its plain text's. */
  function pastedLines(data, w) {
    const htmlText = data.getData('text/html');
    if (htmlText) {
      const parsed = new w.DOMParser().parseFromString(htmlText, 'text/html');
      // (a copied editor link: data-ts-link; its href, the preview's "#" made absolute, is dropped)
      const lines = htmlLines(parsed.body, (h) => isSafeHref(h) && !isDraftHref(h));
      if (lines.length) return lines;
    }
    return plainLines(data.getData('text/plain'));
  }

  /** The toolbar's view of it: editing, the caret line's style, a selection and its marks. */
  function richState() {
    if (!rich) return null;
    const body = store.get(rich.file, rich.ptr) || [];
    const sel = (doc && selectionOf(rich.el, win)) || richSel;
    const caret = sel?.to || { line: 0, at: 0 };
    const range = sel && !isCaret(sel);
    return {
      widget: rich.widget,
      edit: rich.edit,
      style: body[caret.line]?.style || 'paragraph',
      list: body[caret.line]?.list || '',
      fit: body[caret.line]?.fit === true,
      line: caret.line,
      selected: !!range,
      bold: range ? hasMark(body, sel.from, sel.to, 'b') : false,
      italic: range ? hasMark(body, sel.from, sel.to, 'i') : false,
      // a caret in a link: that link (the link box takes all of it: selectLink)
      link: range ? linkIn(body, sel.from, sel.to) : sel ? caretLink(body, sel.to) : null,
    };
  }

  /** The link around a caret, or null. */
  function caretLink(body, at) {
    const r = linkRangeAt(body, at);
    return r ? linkIn(body, r.from, r.to) : null;
  }

  /** Render the lines for editing (chips named). */
  function renderLines(body) {
    renderEditing(rich.el, body);
  }

  /** The body typed into the store (no re-render: the preview shows it already). */
  function writeRich(body) {
    // a template Text is one line (validate.js): a paste's later lines follow on the same line
    const next = templateIdOf(rich.file) ? oneLineBody(body) : body;
    if (next !== body) renderLines(next);
    store.set(rich.file, rich.ptr, next, {
      key: `text:${rich.edit}`,
      source: rich.el,
      structure: true, // its undo and redo render the section again
    });
  }

  // a click on a link while its Text is edited: the link box opens for it (its address in
  // the field, a broken one with its note: F107), unless a second click follows (a double
  // click selects a word of it, the box stays closed)
  let linkBoxTimer = 0;
  function linkBoxSoon() {
    clearTimeout(linkBoxTimer);
    linkBoxTimer = setTimeout(() => {
      if (!rich) return;
      const s = selectionOf(rich.el, win);
      if (!s || !isCaret(s) || !linkRangeAt(store.get(rich.file, rich.ptr), s.to)) return;
      richSel = s;
      emit('rich', richState());
      emit('richLink');
    }, LINK_BOX_WAIT);
  }

  /** A widget's Text body (the element edited in its edit mode), or null. */
  const richOf = (w) => w?.querySelector('[data-edit-inline][data-edit-type="rich"]') || null;

  function startRich(el, x, y) {
    if (rich?.el === el) return;
    if (rich) finishRich();
    const edit = el.dataset.edit;
    const { file, ptr } = splitEdit(edit);
    const body = store.get(file, ptr);
    if (!Array.isArray(body)) return;
    // where it was clicked, as a model position (chips are 1 either way)
    const range = x === undefined ? null : doc.caretRangeFromPoint?.(x, y);
    const at =
      range && el.contains(range.startContainer)
        ? posOf(el, range.startContainer, range.startOffset)
        : null;
    rich = {
      el,
      edit,
      file,
      ptr,
      widget:
        el.closest('[data-tw]')?.dataset.tw || el.closest('[data-widget]')?.dataset.widget || '',
      hold: false,
    };
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    renderLines(body);
    el.focus({ preventScroll: true });
    const end = { line: body.length - 1, at: lineLength(body.at(-1)) };
    richSel = at ? { from: at, to: at } : { from: end, to: end };
    selectAt(el, win, richSel);
    emit('pick', el, 'text');
    emit('rich', richState());
  }

  function finishRich() {
    const { el, edit } = rich;
    rich = null;
    richSel = null;
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    emit('rich', null);
    emit('richDone', edit);
  }

  /** A key in the Text widget being edited; true when it was handled. */
  function richKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      rich.el.blur();
      return true;
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      doc.execCommand('insertLineBreak');
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // a template Text is one line: another line is a Text of its own on the grid
      if (templateIdOf(rich.file)) {
        const sel = selectionOf(rich.el, win);
        const body = store.get(rich.file, rich.ptr) || [];
        if (sel && isCaret(sel) && !lineLength(body[sel.to.line]) && body[sel.to.line]?.list) {
          richApply((b) => ({ body: unlist(b, sel.to.line), sel }));
        }
        return true;
      }
      // a selection typed over first (the browser's delete), then the line split
      const s = selectionOf(rich.el, win);
      if (s && !isCaret(s)) doc.execCommand('delete');
      const sel = selectionOf(rich.el, win);
      if (!sel) return true;
      richApply((body) => {
        const line = body[sel.to.line];
        // an empty list item: the list ends there (the line stays, a paragraph)
        const ends = line?.list && !lineLength(line);
        const next = ends ? { line: sel.to.line, at: 0 } : { line: sel.to.line + 1, at: 0 };
        return { body: splitLine(body, sel.to), sel: { from: next, to: next } };
      });
      return true;
    }
    // Backspace at the start of a list item: no list item any more (its text stays)
    if (e.key === 'Backspace' && !mod && !e.altKey) {
      const sel = selectionOf(rich.el, win);
      const body = store.get(rich.file, rich.ptr) || [];
      if (sel && isCaret(sel) && sel.to.at === 0 && body[sel.to.line]?.list) {
        e.preventDefault();
        richApply((b) => ({ body: unlist(b, sel.to.line), sel }));
        return true;
      }
    }
    if (mod && !e.altKey && (k === 'b' || k === 'i')) {
      e.preventDefault();
      e.stopPropagation();
      richApply((body, sel) =>
        sel && !isCaret(sel) ? { body: toggleMark(body, sel.from, sel.to, k) } : null,
      );
      return true;
    }
    // Ctrl+A: the caret's line first (typed over, it keeps its style), then every line (F56)
    if (mod && !e.altKey && !e.shiftKey && k === 'a') {
      const line = lineToSelect(selectionOf(rich.el, win), store.get(rich.file, rich.ptr));
      if (!line) return false;
      e.preventDefault();
      e.stopPropagation();
      selectAt(rich.el, win, line);
      richSel = line;
      emit('rich', richState());
      return true;
    }
    if (mod && !e.altKey && k === 'k') {
      e.preventDefault();
      e.stopPropagation();
      // a selection, or a caret in a link (the box takes the whole link)
      const inLink =
        richSel && isCaret(richSel) && linkRangeAt(store.get(rich.file, rich.ptr), richSel.to);
      if (richSel && (!isCaret(richSel) || inLink)) emit('richLink');
      return true;
    }
    return false;
  }

  function readValue(el) {
    const type = el.dataset.editType || 'text';
    if (type === 'multiline') return el.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '');
    if (type === 'words') {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      return text || undefined; // the name can't be empty
    }
    const text = el.textContent.replace(/\u00a0/g, ' ').replace(/\s*\n\s*/g, ' ');
    if (type === 'number') {
      const n = Number(text.trim());
      return text.trim() !== '' && Number.isFinite(n) ? n : undefined;
    }
    return text;
  }

  /**
   * A press in the preview (preview-pointer.js): the link box held the edit open, a press away
   * from the widget lets go and ends it (the toolbar's box closes with it).
   */
  function pointerdown(e) {
    if (rich?.hold && !rich.el.contains(e.target)) endRich();
  }

  /** The preview's listeners for editing (its document connected: the bridge's connect). */
  function attach() {
    const probe = doc.createElement('div');
    try {
      probe.contentEditable = 'plaintext-only';
    } catch {
      /* unsupported */
    }
    plaintext = probe.contentEditable === 'plaintext-only';

    doc.addEventListener('focusin', (e) => {
      const el = e.target.closest?.('[data-edit-inline]');
      if (clicks() !== 'arrange' || !el) return;
      // Word-split text (hero name) is edited as plain text and re-split on blur.
      if (el.dataset.editType === 'words') {
        const { file, ptr } = splitEdit(el.dataset.edit);
        el.textContent = String(store.get(file, ptr) ?? el.textContent.replace(/\s+/g, ' ').trim());
        const sel = win.getSelection();
        sel.selectAllChildren(el);
        sel.collapseToEnd();
      }
      emit('pick', el, 'text');
      emit('textPick', el.dataset.edit);
      // Focus (e.g. Tab to an off-screen field) may leave the field under the header or at
      // an edge: center it.
      setTimeout(() => reveal(el), 50);
    });

    doc.addEventListener('focusout', (e) => {
      // the Text widget: its edit ends, unless the toolbar's own field took the focus
      if (rich && e.target === rich.el) {
        if (!rich.hold) finishRich();
        return;
      }
      const edited = e.target.closest?.('[data-edit-inline][contenteditable]');
      if (edited) endEdit(edited);
      const el = e.target.closest?.('[data-edit-type="words"]');
      if (!el) return;
      const { file, ptr } = splitEdit(el.dataset.edit);
      const value = store.get(file, ptr);
      if (value === undefined || value === null) return;
      el.classList.remove('__ed-invalid');
      el.innerHTML = words(value);
      markApplied(el, value);
    });

    doc.addEventListener('input', (e) => {
      if (rich && rich.el.contains(e.target)) {
        const body = readBody(rich.el);
        const sel = selectionOf(rich.el, win);
        // "- " or "1. " typed at a line's start: a list item; {name} typed: a property chip
        const auto =
          sel && isCaret(sel)
            ? autoList(body, sel.to) || (e.data === '}' && typedProperty(body, sel.to)) || null
            : null;
        writeRich(body);
        if (auto) {
          richApply(() => ({ body: auto.body, sel: { from: auto.at, to: auto.at } }));
          return;
        }
        richSel = sel || richSel;
        emit('rich', richState());
        return;
      }
      const el = e.target.closest?.('[data-edit-inline]');
      if (clicks() !== 'arrange' || !el) return;
      const value = readValue(el);
      el.classList.toggle('__ed-invalid', value === undefined);
      if (value === undefined) return;
      const { file, ptr } = splitEdit(el.dataset.edit);
      store.set(file, ptr, value, { key: `text:${el.dataset.edit}`, source: el });
    });

    doc.addEventListener(
      'keydown',
      (e) => {
        if (rich && rich.el.contains(e.target)) {
          if (richKey(e)) return;
          if (isShortcut(e)) {
            e.preventDefault(); // Ctrl+Z: the editor's undo, not the iframe's (G14)
            emit('key', e);
          }
          e.stopPropagation();
          return;
        }
        const el = e.target.closest?.('[contenteditable][data-edit-inline]');
        if (el) {
          if (e.key === 'Enter' && el.dataset.editType !== 'multiline') {
            e.preventDefault();
            el.blur();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            doc.execCommand('insertLineBreak');
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            el.blur(); // ends the edit (the widget stays picked)
            return;
          }
          e.stopPropagation(); // keep site shortcuts (album arrows, menu) out of typing
        }
        if (isShortcut(e)) {
          // to keys.js first, as a key in the editor (not yet defaultPrevented: the arrows nudge,
          // Enter or a letter edits a picked Text), then the browser's own action prevented
          // (Ctrl+Z after a drag: the store's undo on the first press, G14)
          emit('key', e);
          e.preventDefault();
        }
      },
      true,
    );
    // a paste into a Text widget is its plain text (the model's runs stay clean)
    doc.addEventListener(
      'paste',
      (e) => {
        if (!rich || !rich.el.contains(e.target)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const lines = pastedLines(e.clipboardData, win);
        richApply((body, sel) => {
          if (!sel) return null;
          const out = insertLines(body, sel.from, sel.to, lines);
          return { body: out.body, sel: { from: out.at, to: out.at } };
        });
      },
      true,
    );
    // a letter typed over several lines: one line, its style not a Label's when the first was
    // one (typeOver, G3); within a line the browser types as usual
    doc.addEventListener(
      'beforeinput',
      (e) => {
        if (!rich || !rich.el.contains(e.target) || e.inputType !== 'insertText' || !e.data) return;
        const sel = selectionOf(rich.el, win);
        if (!sel || sel.from.line === sel.to.line) return;
        e.preventDefault();
        richApply((body, at) => {
          const out = typeOver(body, (at || sel).from, (at || sel).to, e.data);
          return out && { body: out.body, sel: { from: out.at, to: out.at } };
        });
      },
      true,
    );
    // a triple click selects its paragraph only (not up to the next one: typed over, the two merged)
    doc.addEventListener('mouseup', (e) => {
      if (!rich || e.detail !== 3 || !rich.el.contains(e.target)) return;
      const one = oneLineSelection(selectionOf(rich.el, win), store.get(rich.file, rich.ptr));
      if (!one) return;
      selectAt(rich.el, win, one);
      richSel = one;
      emit('rich', richState());
    });
    // the caret moved: the toolbar's style and B / I state follow
    doc.addEventListener('selectionchange', () => {
      if (!rich) return;
      const s = selectionOf(rich.el, win);
      if (s) richSel = s;
      emit('rich', richState());
    });

    if (!plaintext) {
      doc.addEventListener('paste', (e) => {
        if (!e.target.closest?.('[contenteditable][data-edit-inline]')) return;
        e.preventDefault();
        doc.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      });
    }
  }

  return {
    /** A page connected (a new document, nothing edited yet), or win null: a reload is on its way. */
    connect(siteDoc, siteWin) {
      rich = null;
      richSel = null;
      doc = siteDoc;
      win = siteWin;
    },
    lost() {
      win = null;
    },
    attach,
    /** The Text widget editor's state for the toolbar (richState), or null. */
    get rich() {
      return richState();
    },
    /** Is a Text widget being edited? */
    get richEditing() {
      return !!rich;
    },
    endRich,
    releaseRich,
    richApply,
    selectLink,
    holdRich,
    editWidget,
    endEdits,
    startEdit,
    startRich,
    richOf,
    linkBoxSoon,
    /** A double click's press: the link box a first click asked for stays closed. */
    cancelLinkBox: () => clearTimeout(linkBoxTimer),
    pointerdown,
  };
}
