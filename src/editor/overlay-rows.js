/**
 * The layout overlay's section rows (overlay.js): a Custom height section's bottom edge dragged
 * up or down sets its rows, in whole cells, never fewer than its content needs, the count shown
 * live (overlay.js layout() draws the line and the count); on release one undo step (onrows). On
 * the phone preview it sets the section's own phone rows. Esc puts the section back.
 */
import { MAX_MIN_ROWS } from '../render/layout/index.js';
import { linesOf } from '../render/layout/geometry.js';
import { setSecRows } from './svelte/ui.svelte.js';

/**
 * `ctx`: the overlay's one state (S: S.sizing is the drag running) and its helpers. Gives
 * minOf(sec, phone), customOf(sec) and startRows(e) (a press on the line).
 */
export function createOverlayRows(ctx) {
  const { S, ui, tplOpen, isPhone, secOf, widgetEl, flowOf, secKey, kick, onrows, escKeys } = ctx;

  /** A section's own rows (Custom height; the phone's on the phone), 0 for any other. */
  function minOf(sec, phone) {
    return parseInt(sec?.style.getPropertyValue(phone ? '--mminrows' : '--minrows'), 10) || 0;
  }
  // custom on the grid shown (the phone's height on the phone: its --mminrows)
  // (a template's item on the phone: none, its phone rows are its desktop rows halved)
  const customOf = (sec) =>
    sec && !sec.hidden && !(tplOpen() && isPhone()) && minOf(sec, isPhone()) ? sec : null;

  function startRows(e) {
    const sec = customOf(S.hoverSec) || customOf(secOf(widgetEl(ui.widget)));
    if (!sec || S.drag || S.linking) return;
    e.preventDefault();
    e.stopPropagation();
    const phone = isPhone();
    const flow = flowOf(sec, phone);
    // the rows its content needs: down to its lowest widget, as rows.js placed them
    const content = Math.max(1, ...Object.values(flow).map((a) => a.row + a.rows - 1));
    const rows = Number(sec.style.getPropertyValue('--frows')) || minOf(sec, phone) || content;
    const lines = linesOf(sec, S.win);
    S.doc.documentElement.setAttribute('data-flow-hold', '');
    S.sizing = {
      sec,
      phone,
      content,
      from: rows,
      rows,
      y: e.clientY,
      step: lines.row + lines.rowGap,
      saved: [sec.style.cssText, phone ? '--mminrows' : '--minrows'],
      max: phone ? Math.ceil(MAX_MIN_ROWS / 2) : MAX_MIN_ROWS,
    };
    setSecRows({ id: secKey(sec), rows, phone });
    S.win.addEventListener('pointermove', moveRows, true);
    S.win.addEventListener('pointerup', endRows, true);
    escKeys(cancelRows, true);
    kick();
  }

  function moveRows(e) {
    const s = S.sizing;
    const n = Math.min(s.max, Math.max(s.content, Math.round(s.from + (e.clientY - s.y) / s.step)));
    if (n === s.rows) return;
    s.rows = n;
    s.sec.style.setProperty('--frows', n);
    s.sec.style.setProperty(s.saved[1], n);
    setSecRows({ id: secKey(s.sec), rows: n, phone: s.phone });
  }

  function stopRows() {
    S.doc.documentElement.removeAttribute('data-flow-hold');
    S.win.removeEventListener('pointermove', moveRows, true);
    S.win.removeEventListener('pointerup', endRows, true);
    escKeys(cancelRows, false);
    S.sizing = null;
    setSecRows(null);
  }

  function endRows() {
    const { sec, rows, from, phone } = S.sizing;
    if (rows === from) sec.style.cssText = S.sizing.saved[0];
    stopRows();
    if (rows !== from) onrows(secKey(sec), rows, { phone });
  }

  function cancelRows(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    S.sizing.sec.style.cssText = S.sizing.saved[0];
    stopRows();
  }

  return { minOf, customOf, startRows };
}
