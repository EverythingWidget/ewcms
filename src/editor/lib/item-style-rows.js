/**
 * The template editor's Style tab (TemplatePanel.svelte): one picker per item style key
 * (src/site/widgets/list/item-style.js), its first option Theme ('': the key left out).
 */
import { STYLE_KEYS } from '../../site/widgets/list/item-style.js';

const px = (n) => [String(n), `${n} px`];
const RATIO = {
  '1/1': '1:1',
  '4/5': '4:5',
  '4/3': '4:3',
  '3/2': '3:2',
  '16/9': '16:9',
  auto: 'Natural',
};
const NAMES = {
  photoFit: { fill: 'Fill', fit: 'Fit' },
  border: { none: 'None', line: 'Line', strong: 'Strong', bottom: 'Bottom' },
  shadow: { none: 'None', s: 'Small', m: 'Medium', l: 'Large' },
  background: { none: 'None', surface: 'Surface', 'surface-2': 'Surface 2' },
  textOverPhoto: { none: 'None', bottom: 'Bottom' },
  hoverEffect: {
    none: 'None',
    accent: 'Accent title',
    zoom: 'Zoom photo',
    shift: 'Slide title',
    lift: 'Lift',
  },
  align: { start: 'Start', center: 'Center', end: 'End' },
  photoPlacement: { above: 'Above', beside: 'Beside' },
  titleSize: { s: 'Small', m: 'Medium', l: 'Large' },
  textBody: { lines: 'Lines', prose: 'Prose' },
};
NAMES.hoverBackground = NAMES.background;
NAMES.photoRatio = RATIO;

const LABELS = [
  ['photoRatio', 'Photo ratio'],
  ['photoFit', 'Photo fit'],
  ['photoPlacement', 'Photo placement'],
  ['radius', 'Corner radius'],
  ['border', 'Border'],
  ['shadow', 'Shadow'],
  ['padding', 'Padding'],
  ['spacing', 'Space between widgets'],
  ['background', 'Background'],
  ['hoverBackground', 'Background on hover'],
  ['textOverPhoto', 'Text over photo'],
  ['hoverEffect', 'Hover effect'],
  ['titleSize', 'Title size'],
  ['textBody', 'Text body'],
  ['align', 'Align'],
];

export const THEME = ['', 'Theme'];

/** [{ key, label, options: [[value, label]] (Theme first), parse(picked) → stored | undefined }] */
export const STYLE_ROWS = LABELS.map(([key, label]) => {
  const allowed = STYLE_KEYS[key];
  const numeric = typeof allowed[0] === 'number';
  return {
    key,
    label,
    options: [THEME, ...allowed.map((v) => (numeric ? px(v) : [v, NAMES[key]?.[v] ?? v]))],
    parse: (raw) => (raw === '' || raw === undefined ? undefined : numeric ? Number(raw) : raw),
  };
});
