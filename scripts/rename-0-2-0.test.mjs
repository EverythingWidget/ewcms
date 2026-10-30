import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from './rename-0-2-0.mjs';

/** A 0.1 site's content, the parts the rename touches. */
const old = () => [
  {
    rel: 'en/settings/animations.json',
    data: {
      version: 1,
      presets: { 'fade-up': { type: 'reveal' } },
      targets: {
        'hero.title': { preset: 'fade-up', delay: 0.1 },
        'hero.photos': { preset: 'scatter' },
      },
      transitions: {},
    },
  },
  {
    rel: 'en/pages/index.json',
    data: {
      transition: { preset: 'none' },
      backdrop: { photos: ['a.jpg'], transition: 'fade' },
      sections: [
        {
          id: 's-aaaa',
          widgets: [
            {
              id: 'b-ab12',
              type: 'hero',
              photos: [{ src: 'a.jpg' }],
              title: 'Name',
              motion: { parts: { 'hero.photos': { preset: 'scatter' } } },
            },
            { id: 'b-ef56', type: 'photo', src: 'a.jpg' },
            {
              id: 'b-cd34',
              type: 'button',
              link: '#b-ab12',
              target: 'b-ab12',
              motion: { anim: 'fade-up', delay: 0.2 },
            },
          ],
        },
      ],
    },
  },
  {
    rel: 'en/sources/people.schema.json',
    data: {
      fields: [
        { key: 'body', type: 'longtext' },
        { key: 'image', type: 'photo' },
        { key: 'images', type: 'photos' },
        { key: 'title', type: 'text' },
      ],
    },
  },
  // photos keep their names
  { rel: 'en/settings/photos.json', data: { version: 1, photos: { 'a.jpg': { alt: 'A' } } } },
];

const changes = (files) => convert(files).flatMap((s) => s.notes);

test('rename-0-2-0 converts every old name, keeping key order', () => {
  const files = old();
  assert.ok(changes(files).length);
  const [lib, page, schema, library] = files.map((f) => f.data);
  assert.deepEqual(Object.keys(lib), ['version', 'animations', 'targets', 'transitions']);
  assert.deepEqual(lib.targets['hero.title'], { animation: 'fade-up', delay: 0.1 });
  assert.deepEqual(Object.keys(lib.targets), ['hero.title', 'hero.photos']);
  assert.deepEqual(page.backdrop, { photos: ['a.jpg'], transition: 'fade' });
  assert.deepEqual(
    schema.fields.map((f) => f.type),
    ['multiline', 'photo', 'photos', 'text'],
  );
  assert.deepEqual(library, { version: 1, photos: { 'a.jpg': { alt: 'A' } } });
  assert.deepEqual(page.transition, { curtain: 'off' });
  const [hero, photo, button] = page.sections[0].widgets;
  assert.deepEqual(Object.keys(hero), ['id', 'type', 'photos', 'title', 'motion']);
  assert.deepEqual(photo, { id: 'w-ef56', type: 'photo', src: 'a.jpg' });
  assert.equal(hero.id, 'w-ab12');
  assert.equal(button.target, 'w-ab12');
  assert.equal(button.link, '#b-ab12'); // only whole ids are ids
  assert.deepEqual(button.motion, { animation: 'fade-up', delay: 0.2 });
  assert.deepEqual(hero.motion, { elements: { 'hero.photos': { animation: 'scatter' } } });
});

test('rename-0-2-0 changes nothing the second time', () => {
  const files = old();
  convert(files);
  const once = JSON.stringify(files);
  assert.deepEqual(changes(files), []);
  assert.equal(JSON.stringify(files), once);
});
