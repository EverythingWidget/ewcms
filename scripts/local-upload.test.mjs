/**
 * Upload without R2 keys (scripts/local-upload.mjs): saved in media/ and resized at once.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { uploadLocal } from './local-upload.mjs';

const site = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-local-'));
const jpeg = (r) =>
  sharp({ create: { width: 2000, height: 1000, channels: 3, background: { r, g: 40, b: 40 } } })
    .jpeg()
    .toBuffer();

test('a photo goes to media/ and gets its WebP sizes, placeholder and colour', async () => {
  const root = site();
  const body = await jpeg(200);
  const { status, body: out } = await uploadLocal(root, {
    name: 'Noor Vermeer 01.JPG',
    type: 'image/jpeg',
    body,
  });
  assert.equal(status, 200);
  assert.equal(out.key, 'noor-vermeer-01.jpg');
  assert.equal(out.local, true);
  assert.ok(fs.readFileSync(path.join(root, 'media', out.key)).equals(body));
  const m = JSON.parse(fs.readFileSync(path.join(root, '.generated', 'media.json'), 'utf8'))[
    out.key
  ];
  assert.deepEqual(
    m.srcset.map((s) => s.w),
    [480, 960, 1600],
  );
  for (const s of m.srcset) assert.ok(fs.existsSync(path.join(root, 'public', s.url)));
  assert.match(m.lqip, /^data:image\/webp/);
  assert.ok(m.color);
  fs.rmSync(root, { recursive: true });
});

test('the same photo again is not copied; another one by that name gets its own file', async () => {
  const root = site();
  const a = await jpeg(200);
  const first = await uploadLocal(root, { name: 'x.jpg', type: 'image/jpeg', body: a });
  const again = await uploadLocal(root, { name: 'x.jpg', type: 'image/jpeg', body: a });
  assert.equal(again.body.key, first.body.key);
  assert.equal(again.body.existing, true);
  const other = await uploadLocal(root, {
    name: 'x.jpg',
    type: 'image/jpeg',
    body: await jpeg(20),
  });
  assert.match(other.body.key, /^x-[0-9a-f]{10}\.jpg$/);
  fs.rmSync(root, { recursive: true });
});

test('not an image: refused, nothing left in media/', async () => {
  const root = site();
  assert.equal(
    (await uploadLocal(root, { name: 'a.txt', type: 'text/plain', body: Buffer.from('x') })).status,
    415,
  );
  const bad = await uploadLocal(root, {
    name: 'a.jpg',
    type: 'image/jpeg',
    body: Buffer.from('not a jpeg'),
  });
  assert.equal(bad.status, 415);
  assert.deepEqual(fs.readdirSync(path.join(root, 'media')), []);
  fs.rmSync(root, { recursive: true });
});
