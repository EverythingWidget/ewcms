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
      targets: { 'hero.title': { preset: 'fade-up', delay: 0.1 } },
      transitions: {},
    },
  },
  {
    rel: 'en/pages/index.json',
    data: {
      sections: [
        {
          id: 's-aaaa',
          widgets: [
            {
              id: 'b-ab12',
              type: 'hero',
              motion: { parts: { 'hero.title': { preset: 'fade-up' } } },
            },
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
];

const changes = (files) => convert(files).flatMap((s) => s.notes);

test('rename-0-2-0 converts every old name, keeping key order', () => {
  const files = old();
  assert.ok(changes(files).length);
  const [lib, page] = files.map((f) => f.data);
  assert.deepEqual(Object.keys(lib), ['version', 'animations', 'targets', 'transitions']);
  assert.deepEqual(lib.targets['hero.title'], { animation: 'fade-up', delay: 0.1 });
  const [hero, button] = page.sections[0].widgets;
  assert.equal(hero.id, 'w-ab12');
  assert.equal(button.target, 'w-ab12');
  assert.equal(button.link, '#b-ab12'); // only whole ids are ids
  assert.deepEqual(button.motion, { animation: 'fade-up', delay: 0.2 });
  assert.deepEqual(hero.motion, { elements: { 'hero.title': { animation: 'fade-up' } } });
});

test('rename-0-2-0 changes nothing the second time', () => {
  const files = old();
  convert(files);
  const once = JSON.stringify(files);
  assert.deepEqual(changes(files), []);
  assert.equal(JSON.stringify(files), once);
});
