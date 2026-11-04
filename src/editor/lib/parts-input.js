/**
 * The DOM side of PartsInput.svelte (a text field with property chips: src/site/layout/parts.js):
 * render a value as text and chips, read it back, turn a typed {name} into a chip.
 */
import { esc } from '../../site/helpers.js';
import { isPropertyPart, isParts } from '../../site/layout/parts.js';

const unknown = (names, name) => !!names && !names.has(name);

/** A property's chip: {name}; a name not in `names` a warning chip. */
export const chipHtml = (p, names) =>
  `<span class="pin__chip${unknown(names, p.property) ? ' is-unknown' : ''}" data-property="${esc(p.property)}"${p.format ? ` data-format="${esc(p.format)}"` : ''} contenteditable="false"${unknown(names, p.property) ? ` title="No property or source “${esc(p.property)}”"` : ''}>{${esc(p.property)}}</span>`;

const partsOf = (v) => (isParts(v) ? v : typeof v === 'string' && v ? [{ t: v }] : []);

/** A value (a string or parts) rendered into `el`. */
export function renderParts(el, v, names) {
  el.innerHTML = partsOf(v)
    .map((p) => (isPropertyPart(p) ? chipHtml(p, names) : esc(p.t).replace(/\n/g, '<br>')))
    .join('');
}

/** `el` read back: parts, or a string when it holds no property. */
export function readParts(el) {
  const out = [];
  const text = (t) => {
    const z = out.at(-1);
    if (z && 't' in z) z.t += t;
    else if (t) out.push({ t });
  };
  const walk = (n) => {
    if (n.nodeType === 3) return text(n.textContent.replace(/\u00a0/g, ' '));
    if (n.nodeType !== 1) return;
    if (n.dataset.property !== undefined)
      return out.push({
        property: n.dataset.property,
        ...(n.dataset.format ? { format: n.dataset.format } : {}),
      });
    if (n.tagName === 'BR') return n.nextSibling ? text('\n') : undefined;
    if (n.tagName === 'DIV' && n.previousSibling) text('\n');
    n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.some(isPropertyPart) ? out : out.map((p) => p.t).join('');
}

const chipNode = (doc, name, names) => {
  const tmp = doc.createElement('span');
  tmp.innerHTML = chipHtml({ property: name }, names);
  return tmp.firstChild;
};

/**
 * `}` just typed in `el`: {name} before the caret a chip, {{name} the text "{name}", `}}` one
 * literal `}`.
 */
export function typedChip(el, names) {
  const doc = el.ownerDocument;
  const sel = doc.getSelection();
  const node = sel?.anchorNode;
  if (!sel?.isCollapsed || node?.nodeType !== 3 || !el.contains(node)) return false;
  const before = node.textContent.slice(0, sel.anchorOffset);
  if (before.endsWith('}}')) {
    const at = sel.anchorOffset - 1;
    node.textContent = node.textContent.slice(0, at) + node.textContent.slice(at + 1);
    const r = doc.createRange();
    r.setStart(node, at);
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  }
  const m = before.match(/(\{+)([\w-]+)\}$/);
  if (!m) return false;
  const braces = m[1].length;
  const start = sel.anchorOffset - m[0].length;
  const lit = '{'.repeat(Math.floor(braces / 2));
  const rest = node.splitText(sel.anchorOffset);
  node.textContent = node.textContent.slice(0, start) + lit;
  const r = doc.createRange();
  if (braces % 2) {
    const chip = chipNode(doc, m[2], names);
    rest.before(chip);
    r.setStartAfter(chip);
  } else {
    node.textContent += `${m[2]}}`;
    r.setStart(node, node.textContent.length);
  }
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}

/** A property's chip put in at `range` (in `el`), else at its end. */
export function insertChip(el, range, name, names) {
  const chip = chipNode(el.ownerDocument, name, names);
  if (range && el.contains(range.startContainer)) {
    range.deleteContents();
    range.insertNode(chip);
  } else el.append(chip);
}
