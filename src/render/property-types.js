/**
 * The property types: one list, each type declared once. A property is a quality of a source
 * item (a key of it, declared in its schema file: ./schemas.js); a widget's settings
 * (./widgets/index.js `settings`) and a list item's subkeys use the same types. Each type says:
 *
 *   source   a source schema can use it ("type" in content/en/sources/<id>.schema.json)
 *   setting  a widget's setting can use it (its definition's `settings`)
 *   value    what it stores: 'string' | 'number' | 'boolean' | 'list' (of photo paths)
 *   control  the editor's input for it (Field.svelte `type`)
 *   format   it can mix text and properties (parts, ../layout/parts.js: [{ t }, { property, format? }])
 *   binds    the property types whose whole value it can show ([{ "property": "<name>" }])
 *   blank    a new source item's value
 *   match    a URL param can be compared with it (a page's From URL rules)
 *
 * Widgets also have editor-only kinds that are not values of their own: 'rich' (the Text
 * widget's body, ../text.js), 'select' / 'seg' / 'spot' (one of `options`), 'source' (a
 * content/en/sources file) and, in `config`, 'boolean' and 'link'.
 */
export const PROPERTY_TYPES = Object.freeze({
  text: {
    source: true,
    setting: true,
    value: 'string',
    control: 'text',
    format: true,
    match: true,
    binds: ['text', 'choice', 'number', 'date', 'link'],
    blank: '',
  },
  words: {
    setting: true,
    value: 'string',
    control: 'words',
    format: true,
    binds: ['text', 'choice'],
  },
  multiline: {
    source: true,
    setting: true,
    value: 'string',
    control: 'multiline',
    format: true,
    binds: ['multiline', 'text', 'choice', 'number', 'date'],
    blank: '',
  },
  number: {
    source: true,
    setting: true,
    value: 'number',
    control: 'number',
    match: true,
    binds: ['number'],
    blank: 0,
  },
  photo: {
    source: true,
    setting: true,
    value: 'string',
    control: 'photo',
    binds: ['photo'],
    blank: '',
  },
  photos: { source: true, value: 'list', control: 'photo', binds: ['photos'], blank: [] },
  link: {
    source: true,
    value: 'string',
    control: 'text',
    format: true,
    binds: ['link'],
    blank: '',
  },
  choice: { source: true, value: 'string', control: 'select', match: true, blank: '' },
  boolean: { source: true, value: 'boolean', control: 'boolean', blank: false },
  date: { source: true, value: 'string', control: 'date', match: true, blank: '' },
});

const names = (fact) => Object.keys(PROPERTY_TYPES).filter((n) => PROPERTY_TYPES[n][fact]);

/** The types a source schema can use, in order. */
export const SOURCE_PROPERTY_TYPES = names('source');
/** The value types of a widget's settings (besides its editor-only kinds). */
export const SETTING_TYPES = names('setting');
/** The types whose bound value can have a format. */
export const FORMAT_TYPES = names('format');
/** The text types of a widget (one line, words, lines). */
export const TEXT_TYPES = ['text', 'words', 'multiline'];
/** The property types a URL param can be compared with. */
export const MATCH_TYPES = names('match');
/** Setting types -> the property types whose whole value fits them ([{ property }]). */
export const BIND_TYPES = Object.fromEntries(
  Object.entries(PROPERTY_TYPES)
    .filter(([, t]) => t.binds)
    .map(([n, t]) => [n, t.binds]),
);

/** What a value of `type` is stored as ('string' for types it doesn't know). */
export const storedAs = (type) => PROPERTY_TYPES[type]?.value ?? 'string';

/** The editor's input (Field.svelte type) for a type ('text' for types it doesn't know). */
export const controlOf = (type) => PROPERTY_TYPES[type]?.control ?? 'text';

/** A new source item's value of a property type ('' for types it doesn't know). */
export const blankOf = (type) => {
  const b = PROPERTY_TYPES[type]?.blank;
  return Array.isArray(b) ? [] : (b ?? '');
};

/**
 * An input's text -> the value it stores, for the editor's inputs (control types). undefined:
 * invalid, not stored. 'multiline' keeps line breaks; 'text' joins lines; 'words' trims.
 */
export function parseInput(control, raw) {
  if (control === 'number') {
    const n = Number(raw);
    return raw.trim() !== '' && Number.isFinite(n) ? n : undefined;
  }
  if (control === 'words') return raw.replace(/\s+/g, ' ').trim() || undefined;
  if (control === 'text') return raw.replace(/\s*\n\s*/g, ' ');
  return raw;
}
