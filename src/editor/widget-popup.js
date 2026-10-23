/**
 * The widget settings pop-up (WidgetPopup.svelte): one only, ever. Which widget it shows is
 * ui.widget (a widget row's double click or Enter, a widget clicked in the preview); opening
 * another swaps its content in the same pop-up. Where it sits: 12px left of the editor panel,
 * level with the widget's row, 360px wide, kept 12px inside the window; once dragged by its
 * header, that place is kept for the session (sessionStorage) and used for every widget.
 */
export const POP_W = 360;
export const GAP = 12; // from the panel
export const EDGE = 12; // from the window's edges
const KEY = 'ewcms:widget-popup';

/** `pos` kept inside a `vw` × `vh` window, for a pop-up `w` × `h`. */
export function clampPos({ left, top }, { vw, vh, w = POP_W, h = 0 }) {
  const maxL = Math.max(EDGE, vw - EDGE - w);
  const maxT = Math.max(EDGE, vh - EDGE - Math.min(h, vh - 2 * EDGE));
  return {
    left: Math.round(Math.min(Math.max(left, EDGE), maxL)),
    top: Math.round(Math.min(Math.max(top, EDGE), maxT)),
  };
}

/** Its default place: 12px left of the panel, its top on the row's (else the panel's top). */
export function anchorPos({ panel, row, vw, vh, h = 0 }) {
  const left = (panel?.left ?? vw) - GAP - POP_W;
  const top = row?.top ?? (panel?.top ?? 0) + 120;
  return clampPos({ left, top }, { vw, vh, h });
}

/**
 * The pop-up's state: open(id) (a swap when another is open), close() (gives the id whose row
 * takes the focus back), drag(pos) (kept for the session), place(...) (where it shows now).
 */
export function createPopup(store = globalThis.sessionStorage) {
  let id = null;
  let moved = null;
  try {
    moved = JSON.parse(store?.getItem(KEY) || 'null');
  } catch {
    moved = null;
  }
  return {
    get id() {
      return id;
    },
    get moved() {
      return moved;
    },
    open(next) {
      const swapped = id !== null && id !== next;
      id = next;
      return { swapped };
    },
    close() {
      const was = id;
      id = null;
      return was;
    },
    drag(pos) {
      moved = { left: Math.round(pos.left), top: Math.round(pos.top) };
      try {
        store?.setItem(KEY, JSON.stringify(moved));
      } catch {
        // private mode: kept in memory only
      }
    },
    place(at) {
      return moved ? clampPos(moved, at) : anchorPos(at);
    },
  };
}
