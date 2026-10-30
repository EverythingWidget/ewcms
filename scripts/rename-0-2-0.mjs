#!/usr/bin/env node
/**
 * Converts a site's content folder to the 0.2.0 names, in place (every change: README,
 * "Breaking content changes 0.2.0"):
 *
 *   node scripts/rename-0-2-0.mjs <site>/content            what it would change (nothing written)
 *   node scripts/rename-0-2-0.mjs <site>/content --write    change the files
 *
 * Run it once, on a clean checkout (git shows what it changed). Running it again changes nothing.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatJSON } from '../src/editor/lib/json-format.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every .json file under `dir`. */
function* jsonFiles(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* jsonFiles(p);
    else if (name.endsWith('.json')) yield p;
  }
}

/** Every widget of a file's data: its sections' widgets (pages, the footer). */
function* widgetsIn(data) {
  for (const s of Array.isArray(data?.sections) ? data.sections : [])
    for (const w of Array.isArray(s?.widgets) ? s.widgets : []) if (isObject(w)) yield w;
}

/** Visit every value of `v`: fn(value, key, parent) may return a replacement. */
function walk(v, fn) {
  if (Array.isArray(v)) v.forEach((x, i) => ((v[i] = walk(x, fn) ?? x), walkInto(v[i], fn)));
  else if (isObject(v))
    for (const k of Object.keys(v)) ((v[k] = fn(v[k], k, v) ?? v[k]), walkInto(v[k], fn));
  return undefined;
}
const walkInto = (v, fn) => (Array.isArray(v) || isObject(v)) && walk(v, fn);

/** Rename `obj[from]` to `obj[to]` in place, keeping the key's position; true when renamed. */
function renameKey(obj, from, to) {
  if (!isObject(obj) || !(from in obj) || to in obj) return false;
  const entries = Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]);
  for (const k of Object.keys(obj)) delete obj[k];
  Object.assign(obj, Object.fromEntries(entries));
  return true;
}

const isAnimations = (f) => f.rel.replaceAll('\\', '/').endsWith('settings/animations.json');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The steps, in order. Each gets every file ({ path, data }) and returns notes of what it
 * changed ("file: old -> new").
 */
const steps = [
  {
    name: 'widget ids b-xxxx -> w-xxxx',
    run(files) {
      const ids = new Map();
      for (const f of files)
        for (const w of widgetsIn(f.data))
          if (typeof w.id === 'string' && /^b-[a-z0-9]{4,12}$/.test(w.id))
            ids.set(w.id, `w-${w.id.slice(2)}`);
      const notes = [];
      for (const f of files) {
        let n = 0;
        walk(f.data, (v) => {
          if (typeof v === 'string' && ids.has(v)) return (n++, ids.get(v));
        });
        if (n) notes.push(`${f.rel}: ${plural(n, 'widget id')} (and links to them)`);
      }
      return notes;
    },
  },
  {
    name: 'animation names: "presets" -> "animations", "preset" and "anim" -> "animation"',
    run(files) {
      const notes = [];
      for (const f of files) {
        if (isAnimations(f)) {
          const lib = renameKey(f.data, 'presets', 'animations');
          let n = 0;
          for (const t of Object.values(isObject(f.data.targets) ? f.data.targets : {}))
            if (renameKey(t, 'preset', 'animation')) n++;
          if (lib) notes.push(`${f.rel}: "presets" -> "animations"`);
          if (n) notes.push(`${f.rel}: ${plural(n, 'target')} "preset" -> "animation"`);
          continue;
        }
        let widgets = 0;
        let parts = 0;
        for (const w of widgetsIn(f.data)) {
          if (renameKey(w.motion, 'anim', 'animation')) widgets++;
          // motion.parts (motion.elements from the next step on)
          for (const key of ['parts', 'elements'])
            for (const p of Object.values(isObject(w.motion?.[key]) ? w.motion[key] : {}))
              if (renameKey(p, 'preset', 'animation')) parts++;
        }
        if (widgets)
          notes.push(`${f.rel}: ${plural(widgets, 'widget')} motion "anim" -> "animation"`);
        if (parts) notes.push(`${f.rel}: ${plural(parts, 'element')} "preset" -> "animation"`);
      }
      return notes;
    },
  },
  {
    name: 'widget motion: "parts" -> "elements"',
    run(files) {
      const notes = [];
      for (const f of files) {
        let n = 0;
        for (const w of widgetsIn(f.data)) if (renameKey(w.motion, 'parts', 'elements')) n++;
        if (n) notes.push(`${f.rel}: ${plural(n, 'widget')} motion "parts" -> "elements"`);
      }
      return notes;
    },
  },
];

/** Convert loaded files ({ rel, data }) in place; returns [{ name, notes }] per step. */
export function convert(files) {
  return steps.map((step) => ({ name: step.name, notes: step.run(files) }));
}

// the command (not when a test imports convert)
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('Usage: node scripts/rename-0-2-0.mjs <site>/content [--write]');
    process.exitCode = 1;
    return;
  }
  const files = [...jsonFiles(dir)].map((path) => {
    const text = readFileSync(path, 'utf8');
    return { path, rel: relative(dir, path), text, data: JSON.parse(text) };
  });
  let total = 0;
  for (const { name, notes } of convert(files)) {
    console.log(`${name}: ${notes.length ? '' : 'nothing to change'}`);
    for (const n of notes) console.log(`  ${n}`);
    total += notes.length;
  }
  // written as the editor's Save writes them (src/editor/lib/json-format.js)
  let changed = 0;
  for (const f of files) {
    if (JSON.stringify(JSON.parse(f.text)) === JSON.stringify(f.data)) continue;
    changed++;
    if (write) writeFileSync(f.path, formatJSON(f.data));
  }
  console.log(
    total
      ? `${changed} file${changed === 1 ? '' : 's'} ${write ? 'changed' : 'would change (dry run: add --write to change them)'}`
      : 'Nothing to change: the content already has the 0.2.0 names.',
  );
}
