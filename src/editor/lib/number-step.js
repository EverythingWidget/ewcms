/**
 * The − / + buttons of a number field (Field.svelte): the value a click gives, and whether a
 * button can be used. A field's shown value is its own, else its placeholder when that is a
 * number (an inherited value, dimmed: "8" from the desktop), else nothing; a click starts from
 * it, so + on an inherited 8 gives 9. With nothing shown, + starts at min (or 0) + step.
 */

/** A finite number from a field's value or placeholder, else null. */
const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The number a field shows: its value, else a numeric placeholder, else null. */
export const shownNumber = (value, placeholder) => num(value) ?? num(placeholder);

/** Decimals in a step (0.05: 2), to round away float noise (0.1 + 0.2). */
const decimals = (n) => {
  const s = String(n);
  const e = s.match(/e-(\d+)$/);
  if (e) return +e[1];
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
};

/**
 * The value after one click: dir -1 (−) or 1 (+), by `step` (1 if not a positive number),
 * clamped to min / max (either may be missing); null when there is nothing to change (at the
 * limit already).
 */
export function stepNumber({ value, placeholder, min, max, step, dir }) {
  const by = num(step) > 0 ? num(step) : 1;
  const lo = num(min);
  const hi = num(max);
  const from = shownNumber(value, placeholder);
  let next = from === null ? (lo ?? 0) + (dir > 0 ? by : 0) : from + dir * by;
  if (from === null && dir < 0) next = lo ?? 0;
  const places = Math.max(decimals(by), from === null ? 0 : decimals(from));
  next = Number(next.toFixed(Math.min(places, 10)));
  if (lo !== null && next < lo) next = lo;
  if (hi !== null && next > hi) next = hi;
  return from !== null && next === from && num(value) !== null ? null : next;
}

/** Whether − (dir -1) or + (1) is used up: the shown number is at or past min / max. */
export function atLimit({ value, placeholder, min, max, dir }) {
  const n = shownNumber(value, placeholder);
  if (n === null) return false;
  const edge = num(dir < 0 ? min : max);
  return edge !== null && (dir < 0 ? n <= edge : n >= edge);
}
