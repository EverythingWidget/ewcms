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
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  {
    name: 'page transition: { "preset": "none" } -> { "curtain": "off" }',
    run(files) {
      const notes = [];
      for (const f of files) {
        const t = f.data?.transition;
        if (!isObject(t) || t.preset !== 'none' || Object.keys(t).length !== 1) continue;
        f.data.transition = { curtain: 'off' };
        notes.push(`${f.rel}: "transition" { "preset": "none" } -> { "curtain": "off" }`);
      }
      return notes;
    },
  },
  {
    name: 'source schema field types: "longtext" -> "multiline"',
    run(files) {
      const notes = [];
      for (const f of files) {
        if (!f.rel.endsWith('.schema.json') || !Array.isArray(f.data?.fields)) continue;
        let n = 0;
        for (const field of f.data.fields)
          if (isObject(field) && field.type === 'longtext') ((field.type = 'multiline'), n++);
        if (n) notes.push(`${f.rel}: ${plural(n, 'field')} "longtext" -> "multiline"`);
      }
      return notes;
    },
  },
  {
    name: 'source photos: "images" -> "photos", "image" -> "photo" (items, schemas, bindings)',
    run(files) {
      const notes = [];
      const keys = { images: 'photos', image: 'photo' };
      for (const f of files) {
        const rel = f.rel.replaceAll('\\', '/');
        if (/(^|\/)sources\/[^/]+\.schema\.json$/.test(rel)) {
          let n = 0;
          for (const field of Array.isArray(f.data?.fields) ? f.data.fields : [])
            if (isObject(field) && keys[field.key]) ((field.key = keys[field.key]), n++);
          if (n) notes.push(`${f.rel}: ${plural(n, 'field')} "images"/"image" -> "photos"/"photo"`);
          continue;
        }
        if (/(^|\/)sources\/[^/]+\.json$/.test(rel)) {
          let n = 0;
          for (const item of Array.isArray(f.data?.items) ? f.data.items : [])
            for (const [from, to] of Object.entries(keys)) if (renameKey(item, from, to)) n++;
          if (n)
            notes.push(`${f.rel}: ${plural(n, 'item key')} "images"/"image" -> "photos"/"photo"`);
          continue;
        }
        let n = 0;
        walk(f.data, (v, k, parent) => {
          if (k === 'bind' && isObject(parent) && typeof v === 'string' && keys[v])
            return (n++, keys[v]);
        });
        if (n) notes.push(`${f.rel}: ${plural(n, 'binding')} "images"/"image" -> "photos"/"photo"`);
      }
      return notes;
    },
  },
  {
    name: 'animation "image-reveal" -> "photo-reveal", target "place.card.image" -> "place.card.photo"',
    run(files) {
      const notes = [];
      const NAMES = { 'image-reveal': 'photo-reveal' };
      for (const f of files) {
        let n = 0;
        if (isAnimations(f)) {
          if (renameKey(f.data.animations, 'image-reveal', 'photo-reveal')) n++;
          if (renameKey(f.data.targets, 'place.card.image', 'place.card.photo')) n++;
        }
        for (const w of widgetsIn(f.data))
          if (
            isObject(w.motion?.elements) &&
            renameKey(w.motion.elements, 'place.card.image', 'place.card.photo')
          )
            n++;
        walk(f.data, (v, k) => {
          if (k === 'animation' && typeof v === 'string' && NAMES[v]) return (n++, NAMES[v]);
        });
        if (n)
          notes.push(`${f.rel}: ${plural(n, 'name')} "image-reveal"/"place.card.image" -> photo`);
      }
      return notes;
    },
  },
  {
    name: 'share photo: site "ogImage" -> "ogPhoto", a page\'s "meta.image" -> "meta.photo"',
    run(files) {
      const notes = [];
      for (const f of files) {
        const rel = f.rel.replaceAll('\\', '/');
        if (rel.endsWith('settings/site.json') && renameKey(f.data, 'ogImage', 'ogPhoto'))
          notes.push(`${f.rel}: "ogImage" -> "ogPhoto"`);
        if (isObject(f.data?.meta) && renameKey(f.data.meta, 'image', 'photo'))
          notes.push(`${f.rel}: "meta.image" -> "meta.photo"`);
      }
      return notes;
    },
  },
];

/** Convert loaded files ({ rel, data }) in place; returns [{ name, notes }] per step. */
export function convert(files) {
  return steps.map((step) => ({ name: step.name, notes: step.run(files) }));
}

/**
 * A package.json's text with `ewcms images` -> `ewcms photos` and `--no-images` -> `--no-photos`
 * in its scripts, and a script named "images" that runs `ewcms photos` named "photos". Text in,
 * text out (its formatting kept); { text (null: unchanged or not safe), notes }.
 */
export function renamePackage(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { text: null, notes: [] };
  }
  const scripts = isObject(data?.scripts) ? data.scripts : {};
  const old = Object.entries(scripts).filter(
    ([, v]) => typeof v === 'string' && /\bewcms\b.*(\bimages\b|--no-images)/.test(v),
  );
  if (!old.length) return { text: null, notes: [] };
  let out = text;
  const notes = [];
  for (const [k, v] of old) {
    const to = v
      .replace(/\bewcms images\b/g, 'ewcms photos')
      .replaceAll('--no-images', '--no-photos');
    const name = k === 'images' && !('photos' in scripts) ? 'photos' : k;
    const from = `${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    if (out.split(from).length !== 2) {
      notes.push(`package.json: script "${k}" runs "${v}": change it by hand to "${to}"`);
      continue;
    }
    out = out.replace(from, `${JSON.stringify(name)}: ${JSON.stringify(to)}`);
    notes.push(`package.json: script "${k}": "${v}" -> "${name}": "${to}"`);
  }
  return { text: out === text ? null : out, notes };
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
  // the site's package.json (next to content/): its "images": "ewcms images" script
  const pkgPath = join(dir, '..', 'package.json');
  const pkg = existsSync(pkgPath) ? renamePackage(readFileSync(pkgPath, 'utf8')) : null;
  console.log(`package.json: ${pkg?.notes.length ? '' : 'nothing to change'}`);
  for (const n of pkg?.notes || []) console.log(`  ${n}`);
  if (pkg?.notes.length) {
    total += pkg.notes.length;
    if (write && pkg.text) writeFileSync(pkgPath, pkg.text);
  }
  // written as the editor's Save writes them (src/editor/lib/json-format.js)
  let changed = pkg?.text ? 1 : 0;
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
