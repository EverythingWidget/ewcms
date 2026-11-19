/**
 * Item templates on the page grid (step I): a template is one section (its file's
 * `sections: [ { id, height?, rows?, widgets } ]`, exactly one), laid out exactly as a page's
 * (../../layout/index.js): 120 square columns, each widget at its
 * `layout.base { col, span, row, rows?, link? }`, size auto / aspect / rows, its `layer`, and a
 * phone area of its own in `layout.phone` (60 columns). Each item is a section of its own:
 *
 *   <div class="sec sec--item" style="--rows;--mrows">  <div class="wgt …" data-tw="w-…">…
 *
 * so src/client/modules/rows.js flows it like a page's: --cell is the item's width / 120, so a
 * template designed at 120 columns scales linearly with its item (a List of 4: each item the
 * same design at 30 columns' width); an Auto widget grows with its content and the widgets
 * linked below it move down. Items in one line of the List take the tallest one's height.
 * Its section's height is "fit" (its content) or "custom" (at least `rows.min` rows; on a
 * phone half as many, rounded up). On a phone: a widget's own phone area, else its desktop
 * area halved (the desktop layout scaled down; not the page's default stack). Hide (When a
 * value is missing) does what it does on a page: the widget is left out, its rows stay where
 * they are.
 */

/** A template's one section ({ id, height?, rows?, widgets }), or null. */
export const itemSection = (tpl) =>
  Array.isArray(tpl?.sections) && tpl.sections[0] && typeof tpl.sections[0] === 'object'
    ? tpl.sections[0]
    : null;

/** A template's widgets (its one section's), [] when it has none. */
export const itemWidgets = (tpl) => {
  const w = itemSection(tpl)?.widgets;
  return Array.isArray(w) ? w : [];
};

/** Where a template's widgets are in its file: "/sections/0/widgets". */
export const ITEM_WIDGETS = '/sections/0/widgets';

/** The item style keys the grid took over (a preset keeps them; a site template can't have them). */
export const GRID_STYLE_KEYS = [
  'padding',
  'spacing',
  'photoRatio',
  'photoFit',
  'photoPlacement',
  'textOverPhoto',
  'align',
  'titleSize',
];

/** Rows between two widgets stacked by stackToGrid (a link's gap). */
export const STACK_ROWS_GAP = 2;

/**
 * A preset's stack as grid widgets (Duplicate: a site template from a preset): each full
 * width, the first at row 1, each following the one before (a link, so an Auto one pushes
 * the rest down), its photo the preset's photo ratio. `newId` makes the widget ids.
 */
export function stackToGrid(widgets, style, newId) {
  const ratio =
    typeof style?.photoRatio === 'string' && style.photoRatio !== 'auto'
      ? style.photoRatio.replace('/', ':')
      : '';
  let prev = null;
  return (widgets || []).map((w) => {
    const id = newId();
    const base = {
      col: 1,
      span: 120,
      row: 1,
      ...(prev ? { link: { to: prev, gap: STACK_ROWS_GAP } } : {}),
    };
    prev = id;
    const sized = w.type === 'photo' && ratio ? { size: 'aspect', aspect: ratio } : {};
    // an Aspect widget stores its rows: its 120 columns × the ratio
    if (sized.size) {
      const [rw, rh] = ratio.split(':').map(Number);
      base.rows = Math.max(1, Math.round((120 * rh) / rw));
    }
    return { id, ...w, ...sized, layout: { base } };
  });
}

/** An item style without the keys the grid took over. */
export const gridStyle = (style) =>
  Object.fromEntries(
    Object.entries(style && typeof style === 'object' ? style : {}).filter(
      ([k]) => !GRID_STYLE_KEYS.includes(k),
    ),
  );
