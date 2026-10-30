/**
 * The page's sections and widgets as the Motion views list them (MotionPanel.svelte, and the
 * library's "uses on this page" in MotionSettings.svelte): each widget with its element in the
 * preview, its animation and its animated parts (data-anim inside it).
 *   list   the page file's sections; doc  the preview's document; items  bridge.animElements()
 */
import { nameOf } from './content-groups.js';
import { WIDGET_TYPES } from '../../site/widgets/index.js';

export function motionSections(list, doc, items) {
  if (!Array.isArray(list) || !doc) return [];
  return list.map((s, at) => ({
    id: s.id,
    at,
    name: (s.widgets || []).map(nameOf).find(Boolean) || '',
    widgets: (s.widgets || []).map((widget, j) => {
      const el = doc.querySelector(`[data-widget="${CSS.escape(widget.id)}"]`);
      return {
        id: widget.id,
        j,
        el,
        label: WIDGET_TYPES[widget.type]?.label || widget.type,
        name: nameOf(widget),
        animation: widget.motion?.animation || '',
        parts: el ? items.filter((it) => it.el.closest('[data-widget]') === el) : [],
      };
    }),
  }));
}
