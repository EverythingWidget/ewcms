// Properties (step 2b): the old "field" keys rejected with a clear message, a schema's own
// property never falls back to a source of the same name, and the hide rule (a widget is off the
// published page when all its bound properties are empty: undefined, null or ''; 0 and [] are values).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './content.mjs';
import { setEditable } from '../src/site/helpers.js';
import { checkContent } from '../src/site/validate.js';
import { checkSchema } from '../src/site/schemas.js';
import { checkBody, typedProperty } from '../src/site/text.js';
import { widgetProblems } from '../src/site/widgets/index.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { resolve } from '../src/site/layout/bindings.js';
import { isEmpty, partEmpty, propertyValue } from '../src/site/layout/parts.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const content = loadContent(SITE_A);

test('old "field" keys: rejected, the message says what to write now', () => {
  const ids = new Set();
  const page = (patch, type = 'button') => ({
    version: 1,
    kind: 'page',
    id: 'pg-t004',
    sections: [newSection(ids, [{ ...newWidget(type, ids), ...patch }])],
  });
  const one = (p, type) => checkContent('pages/x/index.json', page(p, type)).join('; ');
  // a part
  assert.match(
    one({ label: [{ field: 'role' }] }),
    /"label" must be \[\{ "property": "role" \}\] now \(not \{ "field" \}\)/,
  );
  // a where rule
  assert.match(
    one({
      source: {
        mode: 'url',
        from: 'people',
        where: { op: 'and', rules: [{ param: 'person', field: 'slug' }] },
      },
    }),
    /write "property" now: \{ "param": "person", "property": "slug" \} \(not "field"\)/,
  );
  // a Text widget's run
  assert.match(
    checkBody([{ style: 'paragraph', text: [{ field: 'title' }] }]).join('; '),
    /write "property" now: \{ "property": "title" \} \(not \{ "field" \}\)/,
  );
  // a schema
  assert.ok(
    checkSchema({ version: 1, title: 'a', fields: [{ key: 'a', type: 'text' }] }).includes(
      '"fields" is "properties" now: write "properties": [{ "key", "label", "type" }]',
    ),
  );
  // a widget definition
  assert.ok(
    widgetProblems({ type: 'x', label: 'X', fields: [], render: () => '' }).includes(
      '"fields" is "settings" now: write `settings: [{ key, label, type? }]`',
    ),
  );
});

test('same name: a schema property never falls back to a source', () => {
  const sources = { projects: [{ id: 'a' }, { id: 'b' }] };
  // the item's own value
  assert.equal(
    propertyValue('projects', { item: { projects: 'X' }, keys: new Set(['projects']), sources }),
    'X',
  );
  // a property of the schema the item leaves empty: empty, not the source
  const own = { item: {}, keys: new Set(['projects']), sources };
  assert.equal(propertyValue('projects', own), undefined);
  assert.equal(resolve([{ t: 'n=' }, { property: 'projects' }], own), 'n=');
  assert.ok(partEmpty({ property: 'projects' }, own));
  // not a property: the source (a list in a text: its length)
  const none = { item: {}, keys: new Set(['title']), sources };
  assert.deepEqual(propertyValue('projects', none), sources.projects);
  assert.equal(resolve([{ t: 'n=' }, { property: 'projects' }], none), 'n=2');
});

test('{{ and }}: typed in a Text line they stay literal braces', () => {
  const at = (line, offset) => ({ line, at: offset });
  const line = (t) => [{ style: 'paragraph', text: [{ t }] }];
  const close = typedProperty(line('a }}'), at(0, 4));
  assert.deepEqual(close.body[0].text, [{ t: 'a }' }]);
  assert.deepEqual(close.at, at(0, 3));
  assert.deepEqual(typedProperty(line('{{name}'), at(0, 7)).body[0].text, [{ t: '{name}' }]);
  assert.equal(typedProperty(line('a } b'), at(0, 3)), null);
});

test('hide rule: all bound properties empty (undefined, null, "") hides; 0 and [] are values', () => {
  for (const v of [undefined, null, '']) assert.ok(isEmpty(v), String(v));
  for (const v of [0, [], false, 'x', {}]) assert.ok(!isEmpty(v), JSON.stringify(v));
  const item = { id: 'p-t0z0', slug: 'z', title: 'Z', zero: 0, none: [], nul: null, blank: '' };
  const c = {
    ...content,
    sources: { ...content.sources, people: [...content.sources.people, item] },
  };
  const ids = new Set();
  const page = (text) => [
    newSection(ids, [
      {
        ...newWidget('text', ids),
        body: [
          { style: 'label', text: [{ t: 'Own' }] },
          { style: 'paragraph', text },
        ],
        source: { mode: 'item', from: 'people', id: 'p-t0z0' },
      },
    ]),
  ];
  const html = (text) => renderSections(c, { id: 'x' }, 'pages/x/index.json', page(text));
  const shown = (text) => /wgt--text/.test(html(text));
  assert.ok(shown([{ property: 'zero' }]));
  assert.match(html([{ t: 'n=' }, { property: 'zero' }]), /n=<span[^>]*>0<\/span>/);
  assert.ok(shown([{ property: 'none' }]));
  assert.ok(!shown([{ property: 'nul' }]));
  assert.ok(!shown([{ property: 'blank' }]));
  assert.ok(!shown([{ property: 'missing' }]));
  assert.ok(!shown([{ property: 'nul' }, { property: 'blank' }]));
  assert.ok(shown([{ property: 'nul' }, { property: 'zero' }])); // one value: shown
  // the editor dims by the same rule
  setEditable(true);
  try {
    assert.match(html([{ property: 'nul' }, { property: 'blank' }]), /data-no-value=/);
    assert.doesNotMatch(html([{ property: 'zero' }]), /data-no-value=/);
    assert.doesNotMatch(html([{ property: 'none' }]), /data-no-value=/);
  } finally {
    setEditable(false);
  }
});
