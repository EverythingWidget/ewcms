// Section renders coalesce (src/editor/render-jobs.js, main.js renderSections): changes made
// while a render waits join it, so a burst renders once more after the one running, not once
// per change, and from the file as it is when it starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRenderJobs } from '../src/editor/render-jobs.js';

/** renderSections as main.js runs it: one render at a time on a chain; what each POST sent. */
function harness() {
  const jobs = createRenderJobs();
  const posts = [];
  let chain = Promise.resolve();
  let data = 0;
  const root = {};
  const renderSections = (ids, only = null, r = root) => {
    const job = jobs.add(r, ids, only);
    if (!job) return;
    chain = chain.then(async () => {
      const sent = jobs.start(r, job);
      posts.push({ ids: sent, only: job.only, data });
      await new Promise((ok) => setTimeout(ok, 5)); // the request
    });
  };
  return { renderSections, posts, idle: () => chain, edit: () => data++, root };
}

test('ten changes in a row: the render running, then one with the last of them', async () => {
  const h = harness();
  for (let i = 0; i < 10; i++) {
    h.edit();
    h.renderSections(['s-a']);
  }
  await h.idle();
  // the first started at once (its request read the data when it ran: all ten made by then)
  assert.equal(h.posts.length, 1);
  assert.equal(h.posts[0].data, 10);
  // changes while a render runs: one more after it, with their sections and the last data
  h.edit();
  h.renderSections(['s-a']);
  await Promise.resolve();
  for (let i = 0; i < 5; i++) {
    h.edit();
    h.renderSections(i % 2 ? ['s-b'] : ['s-a']);
  }
  await h.idle();
  assert.equal(h.posts.length, 3);
  assert.deepEqual(h.posts[2].ids.sort(), ['s-a', 's-b']);
  assert.equal(h.posts[2].data, 16);
});

test("one widget swapped alone only when every joined change was that widget's", async () => {
  const h = harness();
  h.renderSections(['s-a'], 'w-1');
  h.renderSections(['s-a'], 'w-1');
  await h.idle();
  assert.equal(h.posts.at(-1).only, 'w-1');
  h.renderSections(['s-a'], 'w-1');
  h.renderSections(['s-a'], 'w-2');
  await h.idle();
  assert.equal(h.posts.at(-1).only, null);
  h.renderSections(['s-a'], null);
  h.renderSections(['s-a'], 'w-1');
  await h.idle();
  assert.equal(h.posts.at(-1).only, null);
});

test("each root (the page's view, the footer) has its own waiting render", async () => {
  const h = harness();
  const footer = {};
  h.renderSections(['s-a']);
  h.renderSections(['s-f'], null, footer);
  h.renderSections(['s-b']);
  await h.idle();
  assert.deepEqual(
    h.posts.map((p) => p.ids),
    [['s-a', 's-b'], ['s-f']],
  );
});

test('main.js renders through the jobs', () => {
  const main = readFileSync(new URL('../src/editor/main.js', import.meta.url), 'utf8');
  assert.match(main, /const job = renderJobs\.add\(root, stale, only\);\s*if \(!job\) return;/);
  assert.match(main, /const ids = renderJobs\.start\(root, job\);/);
  assert.match(main, /source\.render\(\{ path, file, data: store\.current\[file\], ids \}\)/);
});
