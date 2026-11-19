/**
 * The preview's pointer in one place: every click, double click and press in the preview's
 * page goes through here, to the editing (preview-edit.js) and to the overlay (overlay.js:
 * picking, dragging and resizing widgets, its own handles), in that order.
 *
 *   arrange clicks  a click in a widget picks it and a press drags it (overlay.js); a click on a
 *                   link in a Text edits it there and opens its link box (F108); a text, photo
 *                   or bound value outside the widgets opens its field in the panel; links,
 *                   buttons and forms don't act (Alt+click clicks through); a double click on a
 *                   Text widget edits it in place, on any other text, photo or bound value
 *                   opens its field, then the widget's pop-up (overlay.js)
 *   animate clicks  a click picks the data-anim element or widget under it ('pick'), the
 *                   pointer outlines it ('hover')
 *   visitor clicks  the site's own (links work), nothing picked
 * A locked Header or Footer takes no click (CSS); while one is open a click outside it does
 * nothing.
 *
 * bridge: preview-runtime.js (its emit and edit); overlay: overlay.js (its pointer handlers);
 * clicks(): previewClicks; hovered(): ui.hoverEl; widget(): ui.widget.
 */
/** What animate clicks pick under the pointer: a data-anim element, else its widget. */
const MOTION_PICK = '[data-anim], [data-widget]';
/** What would act on a click (follow, open, send): off with arrange clicks. */
const ACTIVE = 'a, button, [role="button"], label, summary, input, select, textarea';

export function createPointer({
  bridge,
  overlay,
  clicks,
  hovered = () => null,
  widget = () => null,
}) {
  const { emit, edit } = bridge;
  let doc = null;
  let win = null;
  let down = null; // the last press: where, and the widget selected then

  /** The link under x, y in a Text, { a, body }, or null. */
  function pickedLinkAt(x, y) {
    // the link's box (its links take no pointer: caretRangeFromPoint can miss and hit the
    // paragraph instead: G12); a first click opens it too, not only once the widget is picked
    const hit = doc.elementFromPoint?.(x, y);
    const body = hit?.closest?.('[data-edit-inline][data-edit-type="rich"]');
    if (!body) return null;
    const a = [...body.querySelectorAll('a')].find((el) => {
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (!a) return null;
    const own = body.closest('[data-tw], [data-widget]');
    const id = own?.dataset.tw || own?.dataset.widget;
    const moved = down && Math.hypot(x - down.x, y - down.y) > 4;
    return body && id && !moved ? { a, body } : null;
  }

  /** A text's (or photo's, bound value's) field opens in the panel. */
  const pickField = (hit) => {
    emit('pick', hit, 'text');
    emit('textPick', hit.dataset.edit ?? hit.dataset.bound);
  };

  /** The preview's document connected (after the overlay's: main.js). */
  function attach(siteWin) {
    win = siteWin;
    doc = siteWin.document;
    const ov = overlay.pointer;
    doc.addEventListener(
      'pointermove',
      (e) => {
        // (arrange clicks: the overlay shows the widget under the pointer, CSS the text)
        if (clicks() !== 'animate') return;
        const t = e.target instanceof win.Element ? e.target : null;
        const el = t?.closest(MOTION_PICK) || null;
        if (el !== hovered()) emit('hover', el);
      },
      { passive: true },
    );
    doc.documentElement.addEventListener('pointerleave', () => {
      emit('hover', null);
      ov.leave(); // no widget outlined
    });

    // Clicks: arrange and animate clicks select instead of navigating. With arrange clicks no link,
    // button or form acts (a click in a widget picks it: overlay.js; outside the widgets it
    // picks the text's field); with animate clicks a click on an animated element picks it. Hold Alt
    // to click through.
    win.addEventListener(
      'click',
      (e) => {
        if (clicks() === 'visitor' || e.altKey) return;
        const t = e.target instanceof win.Element ? e.target : null;
        // A site part (the header, the footer) opens only from the pages list (Edit mode) and
        // locks again with Done: a locked one takes no click (CSS: no pointer events); while
        // one is open, a click outside it does nothing (finish it first, then pick the page)
        const open = doc.querySelector('[data-header][data-ed-open], [data-footer][data-ed-open]');
        if (open && !open.contains(t)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (clicks() === 'arrange') {
          if (t?.closest('[contenteditable]')) {
            if (t.closest('a, button')) e.preventDefault(); // the caret moves, nothing follows
            if (edit.richEditing && e.detail === 1 && t.closest('a')) edit.linkBoxSoon();
            return;
          }
          // a link in the picked Text widget (its links take no pointer, so a click there picks
          // the widget): its text edited, the caret in the link, its link box opened (F108)
          const link = e.detail === 1 ? pickedLinkAt(e.clientX, e.clientY) : null;
          if (link) {
            e.preventDefault();
            e.stopPropagation();
            edit.startRich(link.body, e.clientX, e.clientY);
            edit.linkBoxSoon();
            return;
          }
          const hit = t?.closest('[data-edit], [data-bound]');
          if (!hit && !t?.closest(ACTIVE)) return;
          e.preventDefault();
          e.stopPropagation();
          if (hit && !hit.closest('[data-widget]')) pickField(hit);
          return;
        }
        const hit = t?.closest(MOTION_PICK);
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        emit('pick', hit, 'anim');
      },
      true,
    );
    // Alt held: a widget's links and buttons take the pointer again (Alt+click clicks through)
    const altClass = (e) => doc.documentElement.classList.toggle('__ed-alt', !!e.altKey);
    for (const type of ['keydown', 'keyup', 'pointermove', 'pointerdown'])
      win.addEventListener(type, altClass, true);
    // a form doesn't send, Enter in a field included
    doc.addEventListener(
      'submit',
      (e) => {
        if (clicks() === 'visitor') return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
    // a press: where, and what was picked before it (the window hears it before the overlay
    // picks); a double click opens no link box
    win.addEventListener(
      'pointerdown',
      (e) => {
        if (e.detail > 1) edit.cancelLinkBox();
        down = { x: e.clientX, y: e.clientY, widget: widget() };
      },
      true,
    );
    doc.addEventListener(
      'pointerdown',
      (e) => {
        edit.pointerdown(e); // a held link box let go
        ov.down(e); // a widget picked or dragged, a selection box
      },
      true,
    );
    // the page's own press and click on a widget swallowed (no :active, nothing follows)
    doc.addEventListener('mousedown', ov.swallow, true);
    doc.addEventListener('click', ov.swallow, true);
    doc.addEventListener('pointerover', ov.over, true);
    // a clickable template item's widgets get no pointerover: the pointer's move finds them
    doc.addEventListener('pointermove', ov.move, { capture: true, passive: true });
    // Arrange clicks: a double click edits a Text widget's text in place ([data-edit-inline]);
    // any other text, a photo or a bound value opens its field in the panel.
    doc.addEventListener(
      'dblclick',
      (e) => {
        textDblclick(e);
        ov.dblclick(e); // then a widget's own pop-up (overlay.js)
      },
      true,
    );
  }

  /**
   * A double click with arrange clicks: a Text widget's text edited in place (anywhere on the
   * widget: its own edit mode, as its toolbar's Edit; a template widget is [data-tw], inside
   * the preview List's [data-widget]); any other text, a photo or a bound value: its field.
   */
  function textDblclick(e) {
    if (clicks() !== 'arrange' || e.altKey) return;
    const t = e.target instanceof win.Element ? e.target : null;
    const found = t?.closest('[data-edit], [data-bound]');
    const hit =
      found?.dataset.editType === 'rich' || !found
        ? found || edit.richOf(t?.closest('[data-tw], [data-widget]'))
        : found;
    if (!hit || hit.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    const inline = hit.dataset.editInline !== undefined && hit.dataset.bound === undefined;
    if (!inline) pickField(hit);
    else if (hit.dataset.editType === 'rich') edit.startRich(hit, e.clientX, e.clientY);
    else edit.startEdit(hit, e.clientX, e.clientY);
  }

  return { attach };
}
