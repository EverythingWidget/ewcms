import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  defaultMessage,
  formatBytes,
  groupFiles,
  groupOfName,
} from '../src/editor/lib/publish-list.js';

test('publish list: files grouped in status order, empty groups left out', () => {
  const files = [
    { path: 'content/en/pages/index.json', name: 'pages/index.json', group: 'content' },
    { path: 'theme/tokens.scss', group: 'theme' },
    { path: 'media/a.jpg', group: 'media' },
    { path: 'functions/api.js', group: 'other' },
    // an unsaved-only file from the editor: grouped by its name
    { path: 'content/templates/t-x.json', name: 'templates/t-x.json' },
  ];
  assert.deepEqual(
    groupFiles(files).map((g) => `${g.label} ${g.files.length}`),
    ['Content 1', 'Templates 1', 'Theme 1', 'Media 1', 'Other files 1'],
  );
  assert.equal(groupOfName('sources/people.json'), 'sources');
  assert.equal(groupOfName('pages/a/index.json'), 'content');
});

test('publish list: sizes and the default commit message', () => {
  assert.equal(formatBytes(812), '812 B');
  assert.equal(formatBytes(4300), '4.2 KB');
  assert.equal(formatBytes(3_250_000), '3.1 MB');
  // content only: as before
  assert.equal(
    defaultMessage(['pages/about/index.json', 'site.json']),
    'Content: update index, site (visual editor)',
  );
  assert.equal(defaultMessage([]), '');
  const others = [{ group: 'media' }, { group: 'media' }, { group: 'theme' }];
  assert.equal(
    defaultMessage(['a.json', 'b.json', 'c.json'], others),
    'Update 3 content files, 2 photos, 1 theme file (visual editor)',
  );
  assert.equal(defaultMessage([], [{ group: 'other' }]), 'Update 1 other file (visual editor)');
});

test('Publish window: only content files give the message names (others are counted)', () => {
  const src = fs.readFileSync(
    new URL('../src/editor/svelte/PublishModal.svelte', import.meta.url),
    'utf8',
  );
  assert.match(src, /\.filter\(\(f\) => f\.name\)\.map\(\(f\) => f\.name\)/);
  assert.match(src, /defaultMessage\(names, others\)/);
});
