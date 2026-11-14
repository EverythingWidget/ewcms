/**
 * A Node module hook (bin/ewcms.mjs registers it): "ewcms" and "ewcms/…" imports, from the site's
 * own files (its widgets, functions/), load the running engine's files (its package.json
 * exports), never another copy of ewcms in the site's node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let engine = '';
let exportsMap = {};

export function initialize(data) {
  engine = data.engine;
  exportsMap = JSON.parse(fs.readFileSync(path.join(engine, 'package.json'), 'utf8')).exports;
}

export async function resolve(specifier, context, next) {
  if (engine && (specifier === 'ewcms' || specifier.startsWith('ewcms/'))) {
    const file = exportsMap[`.${specifier.slice('ewcms'.length)}`];
    if (typeof file === 'string')
      return { url: pathToFileURL(path.join(engine, file)).href, shortCircuit: true };
  }
  return next(specifier, context);
}
