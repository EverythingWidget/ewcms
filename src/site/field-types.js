/**
 * The field types: one list, each type declared once. A field is a value a person edits: a
 * widget's content field (./widgets/index.js `fields`), a source item's field (a schema file,
 * ./schemas.js) or a list item's subkey. Each type says:
 *
 *   source   a source schema can use it ("type" in content/en/sources/<id>.schema.json)
 *   widget   a widget's field can use it (its definition's `fields`)
 *   value    what it stores: 'string' | 'number' | 'boolean' | 'list' (of photo paths)
 *   control  the editor's input for it (Field.svelte `type`)
 *   format   a bound value can have a text around it ({ "bind", "format" }, ../layout/bindings.js)
 *   binds    the source field types whose value it can show ({ "bind": "<field>" })
 *   blank    a new source item's value
 *   match    a URL param can be compared with it (a page's From URL rules)
 *
 * Widgets also have editor-only kinds that are not values of their own: 'rich' (the Text
 * widget's body, ../text.js), 'select' / 'seg' / 'spot' (one of `options`), 'source' (a
 * content/en/sources file) and, in `config`, 'boolean' and 'link'.
 */
export const FIELD_TYPES = Object.freeze({
  text: {
    source: true,
    widget: true,
    value: 'string',
    control: 'text',
    format: true,
    match: true,
    binds: ['text', 'choice', 'number', 'date', 'link'],
    blank: '',
  },
  words: {
    widget: true,
    value: 'string',
    control: 'words',
    format: true,
    binds: ['text', 'choice'],
  },
  multiline: {
    source: true,
    widget: true,
    value: 'string',
    control: 'multiline',
    format: true,
    binds: ['multiline', 'text', 'choice', 'number', 'date'],
    blank: '',
  },
  number: {
    source: true,
    widget: true,
    value: 'number',
    control: 'number',
    match: true,
    binds: ['number'],
    blank: 0,
  },
  photo: {
    source: true,
    widget: true,
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

const names = (fact) => Object.keys(FIELD_TYPES).filter((n) => FIELD_TYPES[n][fact]);

/** The types a source schema can use, in order. */
export const SOURCE_FIELD_TYPES = names('source');
/** The value types of a widget's fields (besides its editor-only kinds). */
export const WIDGET_FIELD_TYPES = names('widget');
/** The types whose bound value can have a format. */
export const FORMAT_TYPES = names('format');
/** The text types of a widget (one line, words, lines). */
export const TEXT_TYPES = ['text', 'words', 'multiline'];
/** The source field types a URL param can be compared with. */
export const MATCH_TYPES = names('match');
/** Field types -> the source field types that fit a { bind }. */
export const BIND_TYPES = Object.fromEntries(
  Object.entries(FIELD_TYPES)
    .filter(([, t]) => t.binds)
    .map(([n, t]) => [n, t.binds]),
);

/** What a value of `type` is stored as ('string' for types it doesn't know). */
export const storedAs = (type) => FIELD_TYPES[type]?.value ?? 'string';

/** The editor's input (Field.svelte type) for a field type ('text' for types it doesn't know). */
export const controlOf = (type) => FIELD_TYPES[type]?.control ?? 'text';

/** A new source item's value of a field type ('' for types it doesn't know). */
export const blankOf = (type) => {
  const b = FIELD_TYPES[type]?.blank;
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
