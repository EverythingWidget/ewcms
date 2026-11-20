/**
 * A mock's variants: one mock file, several states, one screenshot each. A mock exports them
 * from its <script module>:
 *
 *   export const variants = [{ name: 'few', props: {} }, { name: 'many', props: { pages: 'many' } }];
 *
 * and draws its props. sandbox/main.js draws them (all, stacked, or ?variant=<name>'s);
 * scripts/mock.mjs saves <mock>-<variant>.png for each. Plain JS: also used by Node.
 */

/** The variants to draw: all, only `pick`'s, or (no variants) the mock once, name null. */
export function pickVariants(variants, pick, mock = 'the mock') {
  const list = Array.isArray(variants) ? variants : [];
  if (!list.length) return [{ name: null, props: {} }];
  if (!pick) return list.map((v) => ({ props: {}, ...v }));
  const one = list.find((v) => v.name === pick);
  if (!one) throw new Error(`No variant "${pick}" in ${mock} (${list.map((v) => v.name)})`);
  return [{ props: {}, ...one }];
}

/** A variant's PNG next to the mock's: "/m/siteparts.png" → "/m/siteparts-few.png". */
export const variantFile = (file, variant) =>
  variant ? file.replace(/(\.png)?$/i, `-${variant}.png`) : file;
