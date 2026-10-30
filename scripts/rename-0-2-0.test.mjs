import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, renamePackage } from './rename-0-2-0.mjs';

/** A 0.1 site's content, the parts the rename touches. */
const old = () => [
  {
    rel: 'en/settings/animations.json',
    data: {
      version: 1,
      presets: { 'fade-up': { type: 'reveal' }, 'image-reveal': { type: 'reveal' } },
      targets: {
        'hero.title': { preset: 'fade-up', delay: 0.1 },
        'hero.photos': { preset: 'scatter' },
        'place.card.image': { preset: 'image-reveal' },
      },
      transitions: {},
    },
  },
  {
    rel: 'en/pages/index.json',
    data: {
      meta: { title: 'Home', image: 'share.jpg' },
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
            {
              id: 'b-ef56',
              type: 'photo',
              src: 'a.jpg',
              motion: {
                anim: 'image-reveal',
                parts: { 'place.card.image': { preset: 'fade-up' } },
              },
            },
            { id: 'b-gh78', type: 'text', body: [{ t: 'x', value: { bind: 'images' } }] },
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
  {
    rel: 'en/sources/people.json',
    data: { version: 1, items: [{ id: 'p-aaaa', name: 'A', images: ['a.jpg'], cover: 'a.jpg' }] },
  },
  {
    rel: 'en/sources/projects.json',
    data: { version: 1, items: [{ id: 'p-bbbb', title: 'B', image: 'b.jpg', year: 2020 }] },
  },
  { rel: 'en/settings/site.json', data: { name: 'S', ogImage: 's.jpg', url: 'https://s' } },
  // photos keep their names
  { rel: 'en/settings/photos.json', data: { version: 1, photos: { 'a.jpg': { alt: 'A' } } } },
];

const changes = (files) => convert(files).flatMap((s) => s.notes);

test('rename-0-2-0 converts every old name, keeping key order', () => {
  const files = old();
  assert.ok(changes(files).length);
  const [lib, page, schema, people, projects, site, library] = files.map((f) => f.data);
  assert.deepEqual(Object.keys(lib), ['version', 'animations', 'targets', 'transitions']);
  assert.deepEqual(Object.keys(lib.animations), ['fade-up', 'photo-reveal']);
  assert.deepEqual(lib.targets['place.card.photo'], { animation: 'photo-reveal' });
  assert.deepEqual(page.meta, { title: 'Home', photo: 'share.jpg' });
  assert.deepEqual(
    schema.fields.map((f) => f.key),
    ['body', 'photo', 'photos', 'title'],
  );
  assert.deepEqual(Object.keys(people.items[0]), ['id', 'name', 'photos', 'cover']);
  assert.deepEqual(Object.keys(projects.items[0]), ['id', 'title', 'photo', 'year']);
  assert.deepEqual(Object.keys(site), ['name', 'ogPhoto', 'url']);
  assert.deepEqual(lib.targets['hero.title'], { animation: 'fade-up', delay: 0.1 });
  assert.deepEqual(Object.keys(lib.targets), ['hero.title', 'hero.photos', 'place.card.photo']);
  assert.deepEqual(page.backdrop, { photos: ['a.jpg'], transition: 'fade' });
  assert.deepEqual(
    schema.fields.map((f) => f.type),
    ['multiline', 'photo', 'photos', 'text'],
  );
  assert.deepEqual(library, { version: 1, photos: { 'a.jpg': { alt: 'A' } } });
  assert.deepEqual(page.transition, { curtain: 'off' });
  const [hero, photo, text, button] = page.sections[0].widgets;
  assert.deepEqual(text.body[0].value, { bind: 'photos' });
  assert.deepEqual(Object.keys(hero), ['id', 'type', 'photos', 'title', 'motion']);
  assert.deepEqual(photo, {
    id: 'w-ef56',
    type: 'photo',
    src: 'a.jpg',
    motion: {
      animation: 'photo-reveal',
      elements: { 'place.card.photo': { animation: 'fade-up' } },
    },
  });
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

test('rename-0-2-0: the package.json script, its formatting kept; again: nothing', () => {
  const text =
    '{\n  "scripts": {\n    "dev": "ewcms dev --no-images",\n    "images": "ewcms images"\n  }\n}\n';
  const { text: out, notes } = renamePackage(text);
  assert.equal(
    out,
    '{\n  "scripts": {\n    "dev": "ewcms dev --no-photos",\n    "photos": "ewcms photos"\n  }\n}\n',
  );
  assert.equal(notes.length, 2);
  assert.deepEqual(renamePackage(out), { text: null, notes: [] });
  assert.deepEqual(renamePackage('not json'), { text: null, notes: [] });
});
