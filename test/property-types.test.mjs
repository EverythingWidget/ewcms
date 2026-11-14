import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIND_TYPES,
  PROPERTY_TYPES,
  FORMAT_TYPES,
  SOURCE_PROPERTY_TYPES,
  SETTING_TYPES,
  blankOf,
  controlOf,
  parseInput,
  storedAs,
} from '../src/site/property-types.js';
import { checkSchema, newItemOf } from '../src/site/schemas.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';

test('property types: one list; schemas and widget settings use its names', () => {
  assert.deepEqual(Object.keys(PROPERTY_TYPES), [
    'text',
    'words',
    'multiline',
    'number',
    'photo',
    'photos',
    'link',
    'choice',
    'boolean',
    'date',
  ]);
  assert.deepEqual(SOURCE_PROPERTY_TYPES, [
    'text',
    'multiline',
    'number',
    'photo',
    'photos',
    'link',
    'choice',
    'boolean',
    'date',
  ]);
  assert.deepEqual(SETTING_TYPES, ['text', 'words', 'multiline', 'number', 'photo']);
  assert.deepEqual(FORMAT_TYPES, ['text', 'words', 'multiline', 'link']);
  // the old names are gone
  for (const old of ['longtext', 'image', 'images'])
    assert.match(checkSchema({ title: 'a', properties: [{ key: 'a', type: old }] })[0], /"type"/);
  // every bind lists source types only
  for (const list of Object.values(BIND_TYPES))
    for (const t of list) assert.ok(SOURCE_PROPERTY_TYPES.includes(t), t);
  // a widget setting's type (not an editor-only kind) is in the list
  const kinds = new Set(['rich', 'select', 'seg', 'spot', 'source']);
  for (const w of Object.values(WIDGET_TYPES))
    for (const f of w.settings || [])
      if (!kinds.has(f.type) && f.type) assert.ok(SETTING_TYPES.includes(f.type), f.type);
});

test('property types: stored value, editor input, blank, parse', () => {
  assert.equal(storedAs('number'), 'number');
  assert.equal(storedAs('multiline'), 'string');
  assert.equal(storedAs('seg'), 'string');
  assert.equal(controlOf('choice'), 'select');
  assert.equal(controlOf('link'), 'text');
  assert.equal(controlOf('photos'), 'photo');
  assert.deepEqual(['text', 'number', 'boolean', 'photos', 'x'].map(blankOf), [
    '',
    0,
    false,
    [],
    '',
  ]);
  assert.notEqual(blankOf('photos'), blankOf('photos'), 'a new list each time');
  assert.equal(parseInput('multiline', 'a\nb'), 'a\nb');
  assert.equal(parseInput('text', 'a\n b'), 'a b');
  assert.equal(parseInput('words', '  '), undefined);
  assert.equal(parseInput('number', 'x'), undefined);
  const item = newItemOf({
    title: 'name',
    properties: [
      { key: 'name', type: 'text' },
      { key: 'body', type: 'multiline' },
      { key: 'photos', type: 'photos' },
      { key: 'kind', type: 'choice', required: true, options: ['a', 'b'] },
    ],
  });
  assert.deepEqual([item.body, item.photos, item.kind], ['', [], 'a']);
});
