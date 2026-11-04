// Test helper (not a test): src/editor/svelte/ui.svelte.js compiled (its runes) and loaded fresh
// from a temp file, its relative imports pointed at src/editor/svelte, so its helpers can be
// called and their effect on `ui` checked without a browser.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileModule } from 'svelte/compiler';

const dir = new URL('../src/editor/svelte/', import.meta.url);

/** A fresh copy of ui.svelte.js (its own `ui`) on every call. */
export async function loadUi() {
  const file = new URL('ui.svelte.js', dir);
  const { js } = compileModule(readFileSync(file, 'utf8'), { filename: 'ui.svelte.js' });
  const code = js.code
    .replace(/from '(\.\.?\/[^']+)'/g, (_, p) => `from '${new URL(p, dir)}'`)
    .replace(
      /from 'svelte\/internal\/client'/,
      `from '${import.meta.resolve('svelte/internal/client')}'`,
    );
  const f = join(mkdtempSync(join(tmpdir(), 'ui-')), 'ui.mjs');
  writeFileSync(f, code);
  return import(f);
}
