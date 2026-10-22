#!/usr/bin/env node
/**
 * ewcms: the site's commands (scripts/cli.mjs). Run in the site's folder (npm scripts do):
 *
 *   ewcms dev [--port N] [--host] [--no-images]
 *   ewcms build [--no-images]
 *   ewcms preview [--port N]
 *   ewcms check [--links] [--no-lint]
 *   ewcms images
 *   ewcms publish-media
 *   ewcms new-site <dir>
 *
 * --root <dir> runs it for another site's folder.
 */
import path from 'node:path';
import * as cli from '../scripts/cli.mjs';
import { ENGINE_VERSION } from '../scripts/engine.mjs';

const [command, ...rest] = process.argv.slice(2);
const opts = { images: true, lint: true, links: false };
const args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--port') opts.port = Number(rest[++i]);
  else if (a === '--root') opts.root = rest[++i];
  else if (a === '--host') opts.host = true;
  else if (a === '--no-images') opts.images = false;
  else if (a === '--no-lint') opts.lint = false;
  else if (a === '--links') opts.links = true;
  else args.push(a);
}
const root = path.resolve(opts.root || process.cwd());

const USAGE = `ewcms ${ENGINE_VERSION}
usage: ewcms <dev | build | preview | check | images | publish-media | new-site <dir>> [options]`;

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
    case 'images': {
      const { buildImages } = await import('../scripts/images.mjs');
      await buildImages(root);
      break;
    }
    case 'publish-media':
      await cli.publishMedia(root);
      break;
    case 'new-site':
      if (!args[0]) throw new Error('usage: ewcms new-site <dir>');
      cli.newSite(args[0]);
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
