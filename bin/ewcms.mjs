#!/usr/bin/env node
/**
 * ewcms: the site's commands (src/cli/cli.mjs). Run in the site's folder (npm scripts do):
 *
 *   ewcms dev [--port N] [--host] [--no-photos]   (in an empty folder: a new site first)
 *   ewcms build [--no-photos]
 *   ewcms preview [--port N]
 *   ewcms check [--links] [--no-lint]
 *   ewcms photos
 *   ewcms publish-media
 *
 * --root <dir> runs it for another site's folder. In a workspace with ewcms checked out, the
 * workspace's ewcms runs (src/cli/locate.mjs), whichever copy npm put in the site's node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preferredEngine } from '../src/cli/locate.mjs';

// This copy of ewcms, or the workspace's (src/cli/locate.mjs): hand over before loading anything
const self = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const rootArg = process.argv.indexOf('--root');
const siteDir = path.resolve(rootArg > 0 ? process.argv[rootArg + 1] : process.cwd());
let engine = self;
try {
  engine = preferredEngine(siteDir) || self;
} catch (err) {
  console.error(`ewcms: ${err.message}`);
  process.exit(1);
}
// (that one's own check finds itself: no loop)
if (engine !== self) {
  if (process.env.EWCMS_VERBOSE) console.log(`ewcms: ${self} hands over to ${engine}`);
  await import(pathToFileURL(path.join(engine, 'bin', 'ewcms.mjs')).href);
} else await main();

async function main() {
  // ASCII output where Unicode would arrive garbled (Windows, piped: src/cli/term.mjs)
  const term = await import('../src/cli/term.mjs');
  if (term.wantsAscii()) term.asciiOutput();
  // the site's own files that import ewcms/… get this engine's (src/cli/resolve-hook.mjs)
  register(pathToFileURL(path.join(self, 'src', 'cli', 'resolve-hook.mjs')).href, {
    data: { engine: self },
  });
  const cli = await import('../src/cli/cli.mjs');
  const { ENGINE_VERSION } = await import('../src/cli/engine.mjs');

  const [command, ...rest] = process.argv.slice(2);
  const opts = { photos: true, lint: true, links: false };
  const args = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--port') opts.port = Number(rest[++i]);
    else if (a === '--root') opts.root = rest[++i];
    else if (a === '--host') opts.host = true;
    else if (a === '--no-photos') opts.photos = false;
    else if (a === '--no-lint') opts.lint = false;
    else if (a === '--links') opts.links = true;
    else args.push(a);
  }
  const root = path.resolve(opts.root || process.cwd());

  const USAGE = `ewcms ${ENGINE_VERSION}
usage: ewcms <dev | build | preview | check | photos | publish-media> [options]`;

  try {
    switch (command) {
      case 'dev':
        await cli.dev(root, opts);
        break;
      case 'build':
        await cli.build(root, opts);
        break;
      case 'preview':
        await cli.preview(root, opts);
        break;
      case 'check':
        if (!(await cli.check(root, opts))) process.exitCode = 1;
        break;
      case 'photos': {
        const { buildPhotos } = await import('../src/cli/photos.mjs');
        await buildPhotos(root);
        break;
      }
      case 'publish-media':
        await cli.publishMedia(root);
        break;
      case '--version':
      case '-v':
        console.log(ENGINE_VERSION);
        break;
      default:
        console.log(USAGE);
        if (command && command !== 'help' && command !== '--help') process.exitCode = 1;
    }
  } catch (err) {
    console.error(`ewcms ${command}: ${err.message}`);
    process.exitCode = 1;
  }
}
