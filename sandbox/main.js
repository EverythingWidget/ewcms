/**
 * Editor UI sandbox (dev only: /sandbox/, never built; npm run mock:serve). Two kinds of
 * page:
 *
 *   (no ?mock)          the viewer: the mocks, newest first, to open or delete (Viewer.svelte),
 *                       in its own minimal style (viewer.css): no editor styles at all
 *   ?mock=name          one mock      ?mock=a,b,c   several, stacked with their names
 *   ?width=400          the panel's width (default: the editor's, --panel-w)
 *   ?bare=1             no panel around it (the editor's page background only)
 *   ?shot=1             no viewer bar (scripts/mock.mjs screenshots), and no scrollbars
 *   ?scrollbars=1       a shot keeps the scrollbars (a mock can ask too: its
 *                       <script module> export const scrollbars = true)
 *   ?variant=few        one of the mock's variants (its <script module> export const
 *                       variants = [{ name: 'few', props: {…} }, …]); without it, all of
 *                       them stacked with their names (npm run mock shoots one PNG each)
 *
 * Mocks come from sandbox/mocks/<name>.svelte (or .html), drawn on the editor's panel with the
 * editor's real styles, tokens, fonts and icons, loaded only on a mock page, so they can import
 * its real components and look exactly like the editor.
 *
 * When everything is drawn (fonts too) window.__mockReady is true; scripts/mock.mjs waits for
 * it and screenshots #sandbox. A mock that failed to load sets window.__mockError too (its
 * message): mock.mjs loads it again.
 */
import { mount } from 'svelte';
import { settled } from './kit/ready.js';
import { pickVariants } from './kit/variants.js';
import './viewer.css';

// this machine's mocks (sandbox/mocks/: git-ignored), and the kit's demo (tracked) as "kit-demo"
const svelteMocks = {
  ...import.meta.glob('./mocks/*.svelte'),
  './mocks/kit-demo.svelte': () => import('./kit/demo.svelte'),
};
const htmlMocks = import.meta.glob('./mocks/*.html', { query: '?raw', import: 'default' });

const params = new URLSearchParams(location.search);
const names = (params.get('mock') || '').split(',').filter(Boolean);
const root = document.getElementById('sandbox');
if (names.length) document.documentElement.classList.add('is-mock');

/** A mock's module ({ default, scrollbars?, variants? }), or { html }, or null (no such mock). */
async function load(name) {
  const svelte = svelteMocks[`./mocks/${name}.svelte`];
  const html = htmlMocks[`./mocks/${name}.html`];
  if (svelte) return svelte();
  if (html) return { html: await html() };
  return null;
}

/** Draw a loaded mock into `into`, with the props of one of its variants (or none). */
function render(name, mod, into, props = {}) {
  if (mod?.default) mount(mod.default, { target: into, props });
  else if (mod?.html) into.innerHTML = mod.html;
  else into.innerHTML = `<p class="hint">No mock "${name}".</p>`;
}

/** The viewer's bar over a mock page: back to the list, the mock's name (not in screenshots). */
function bar() {
  const nav = document.createElement('nav');
  nav.className = 'vw-bar';
  const back = document.createElement('a');
  back.href = location.pathname;
  back.textContent = '← Mocks';
  const name = document.createElement('span');
  name.textContent = names.join(', ');
  nav.append(back, name);
  document.body.prepend(nav);
}

async function mocks() {
  // the editor's styles, icons and the panel: only here, never on the viewer
  await Promise.all([
    import('../src/editor/styles/editor.scss'),
    import('@fortawesome/fontawesome-free/css/fontawesome.css'),
    import('@fortawesome/fontawesome-free/css/solid.css'),
    import('./sandbox.scss'),
  ]);
  if (!params.get('shot')) bar();
  if (params.get('width'))
    root.style.setProperty('--mock-w', `${parseInt(params.get('width'), 10)}px`);
  if (params.get('bare')) root.classList.add('is-bare');
  // a shot hides the scrollbars (sandbox.scss .sb-no-scrollbars: they take no room, as before),
  // unless ?scrollbars=1 or a mock exports scrollbars = true (a mock about scrolling)
  let scrollbars = !!params.get('scrollbars');
  // every mock's variants, for scripts/mock.mjs: { name: ['few', 'many'] } (one shot each)
  window.__mockVariants = {};
  const drawn = [];
  for (const name of names) {
    const mod = await load(name);
    if (mod?.scrollbars === true) scrollbars = true;
    if (Array.isArray(mod?.variants)) window.__mockVariants[name] = mod.variants.map((v) => v.name);
    for (const v of pickVariants(mod?.variants, params.get('variant'), name))
      drawn.push({ name, mod, v });
  }
  for (const { name, mod, v } of drawn) {
    const item = document.createElement('section');
    item.className = 'sb-item';
    if (drawn.length > 1) {
      const label = document.createElement('p');
      label.className = 'sb-label';
      label.textContent = v.name ? `${name} · ${v.name}` : name;
      item.append(label);
    }
    const panel = document.createElement('div');
    panel.className = 'sb-panel';
    item.append(panel);
    root.append(item);
    render(name, mod, panel, v.props);
  }
  if (params.get('shot') && !scrollbars) document.documentElement.classList.add('sb-no-scrollbars');
}

async function main() {
  if (names.length) await mocks();
  else mount((await import('./Viewer.svelte')).default, { target: root });
  await settled(); // what a mock loads first (kit/ready.js hold)
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__mockReady = true;
}

main().catch((err) => {
  root.textContent = String(err?.stack || err);
  // scripts/mock.mjs loads the page again on this (a cold dev server's first load can fail
  // with "Failed to fetch dynamically imported module" while Vite optimizes dependencies)
  window.__mockError = String(err?.message || err);
  window.__mockReady = true;
});
