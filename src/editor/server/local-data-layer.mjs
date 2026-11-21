/**
 * The local data layer: the editor's files on this machine's disk and their git repo. It loads
 * the editable content files, saves them (checked first), tells what changed since the last
 * commit and publishes it (commit + push). The dev server's /__editor/* routes
 * (editor-server.mjs) call it; the browser side is src/editor/data/local-data-layer.js, the
 * same interface:
 *
 *   load()           { mode, files: { [name]: data }, media, photos, r2 }
 *   save(files)      { status, body: { ok, written } | { error, problems } }
 *   status()         the git status (contentStatus below)
 *   publish(message) { status, body } (publish below)
 *
 * Only the local one exists for now (a hosted one would answer the same).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { repoEnv } from './git-env.mjs';
import { formatJSON } from '../lib/json-format.js';
import { loadSiteConfig, repoUrl } from '../../cli/site-config.mjs';
import { countEdits } from '../lib/edit-count.js';
import {
  ANIMATIONS,
  PHOTOS,
  isContentFile,
  LANG_FILES,
  ROOT_FILES,
  itemsOf,
  schemaFile,
  schemaIdOf,
  sourceFile,
  sourceIdOf,
  FOLDERS,
} from '../../render/files.js';
import { checkItems, photoChecker, schemaOf } from '../../render/schemas.js';
import { r2Config } from '../../cli/r2.mjs';
import {
  loadContent,
  assertNoSettingsFolder,
  contentFilePath,
  templateFiles,
  readContentFile,
  walkJson,
  writeFileAtomic,
} from '../../cli/content.mjs';
import { checkContent } from '../../render/validate.js';
import { omitDefaults } from '../../render/defaults.js';
import { bindingProblems } from '../../render/layout/bindings.js';
import { motionProblems } from '../../render/layout/motion.js';
import { WIDGET_TYPES } from '../../widgets/index.js';

/** The site's content folder, absolute, and from the root with "/" (git paths, messages). */
export const contentDirOf = (root) => loadSiteConfig(root).contentDir;
export const contentRel = (root) => loadSiteConfig(root).contentRel;

/** A content file's path from the site's root with "/" ("content/header.json"): git paths. */
export const diskRel = (root, file) =>
  path.relative(root, contentFilePath(root, file)).split(path.sep).join('/');

/** Editable content files that exist on disk, e.g. "pages/index.json", "site.json" (content file names). */
export function editableFiles(root) {
  assertNoSettingsFolder(root);
  const files = [];
  for (const folder of FOLDERS) {
    for (const name of walkJson(path.join(contentDirOf(root), folder))) {
      const file = `${folder}/${name}`;
      // photos.json belongs to the upload, not to the editor's edits
      if (isContentFile(file) && file !== PHOTOS) files.push(file);
    }
  }
  for (const file of LANG_FILES)
    if (fs.existsSync(path.join(contentDirOf(root), file))) files.push(file);
  // photos.json belongs to the upload, not to the editor's edits
  for (const file of ROOT_FILES)
    if (file !== PHOTOS && fs.existsSync(contentFilePath(root, file))) files.push(file);
  files.push(...templateFiles(root));
  return new Set(files);
}

/**
 * Every editable file's data. Broken JSON throws, naming the file; wrong shapes don't (the
 * editor is where they get fixed, and Save checks them).
 */
export const readContentFiles = (root) =>
  Object.fromEntries(
    [...editableFiles(root)].map((f) => [f, readContentFile(root, f, { check: false })]),
  );

export const mediaFile = (root) => loadSiteConfig(root).manifest;
export const readMediaManifest = (root) =>
  fs.existsSync(mediaFile(root)) ? JSON.parse(fs.readFileSync(mediaFile(root), 'utf8')) : {};

/**
 * Local photos (.generated/media.json, src/cli/photos.mjs): { src, thumb, width, height,
 * sizes } per media/ file.
 */
export function readMedia(root) {
  return Object.fromEntries(
    Object.entries(readMediaManifest(root)).map(([k, m]) => [
      k,
      {
        src: m.src,
        thumb: m.srcset?.[0]?.url || m.src,
        width: m.width,
        height: m.height,
        sizes: m.srcset?.length || 1,
      },
    ]),
  );
}

export const readPhotos = (root) =>
  fs.existsSync(contentFilePath(root, PHOTOS)) ? readContentFile(root, PHOTOS).photos || {} : {};

// ---------------------------------------------------------------- save

/**
 * Problems of the sources among `files` (or whose schema is among them) against their
 * schema (src/render/schemas.js): the schema in `files`, else on disk, else inferred. Photos
 * must be in the media manifest or photos.json.
 */
function sourceProblems(root, files) {
  const names = Object.keys(files);
  const ids = new Set([...names.map(sourceIdOf), ...names.map(schemaIdOf)].filter(Boolean));
  const read = (file) =>
    file in files
      ? files[file]
      : fs.existsSync(contentFilePath(root, file))
        ? readContentFile(root, file, { check: false })
        : undefined;
  const photos = read(PHOTOS)?.photos || {};
  const photoExists = photoChecker(readMediaManifest(root), photos);
  return [...ids].flatMap((id) => {
    const list = itemsOf(read(sourceFile(id)));
    const schema = schemaOf(
      { sources: { [id]: list }, schemas: { [id]: read(schemaFile(id)) } },
      id,
    );
    return checkItems(list, schema, { photoExists }).map(
      (p) => `${contentRel(root)}/${sourceFile(id)}: ${p}`,
    );
  });
}

/**
 * Widgets of the saved pages whose animation isn't in the library (src/render/layout/motion.js):
 * an unknown animation id is a save error. A saved animations.json can break any page.
 */
function motionErrors(root, files) {
  const names = Object.keys(files);
  const content = loadContent(root, files);
  return motionProblems(content, { files: names.includes(ANIMATIONS) ? null : new Set(names) });
}

/**
 * Bindings of the saved pages that don't fit their sources' schemas (src/render/layout/bindings.js;
 * the 'error' level: an unknown source or property, a type that doesn't fit). A saved schema or
 * source can break any page's bindings, so then every page is checked.
 */
function bindingErrors(root, files) {
  const names = Object.keys(files);
  const all = names.some((n) => sourceIdOf(n) || schemaIdOf(n));
  const content = loadContent(root, files);
  return bindingProblems(content, {
    types: WIDGET_TYPES,
    files: all ? null : new Set(names),
  })
    .filter((p) => p.level === 'error')
    .map((p) => p.message);
}

/**
 * Save: write the editor's files ({ "pages/index.json": data, ... }) to content/. Only existing
 * editable files, and only when every one of them has the right shape (src/render/validate.js)
 * and every source fits its schema (sourceProblems): nothing is written otherwise. Each file is written atomically (temp file + rename).
 * Returns { status, body }.
 */
export function save(root, files, onWrite = () => {}) {
  const names = Object.keys(files && typeof files === 'object' ? files : {});
  const editable = editableFiles(root);
  const bad = names.filter((n) => !editable.has(n));
  if (!names.length || bad.length)
    return { status: 400, body: { error: `Not writable: ${bad.join(', ') || '(nothing)'}` } };
  for (const n of names) files[n] = omitDefaults(n, files[n]);
  const shape = names.flatMap((n) =>
    checkContent(n, files[n]).map((p) => `${diskRel(root, n)}: ${p}`),
  );
  const problems = shape.length
    ? shape
    : [...sourceProblems(root, files), ...bindingErrors(root, files), ...motionErrors(root, files)];
  if (problems.length)
    return { status: 400, body: { error: `Not saved. ${problems.join('; ')}`, problems } };
  // what it writes, by path: the dev server knows these changes are the editor's own however
  // late its watcher reports them (vite-plugin-static-site.mjs)
  const texts = new Map(names.map((n) => [contentFilePath(root, n), formatJSON(files[n])]));
  onWrite(texts);
  for (const [file, text] of texts) writeFileAtomic(file, text);
  return { status: 200, body: { ok: true, written: names } };
}

// ---------------------------------------------------------------- status and publish

/**
 * Run git without a shell, on the repo at `root` only (repoEnv: a GIT_DIR or GIT_INDEX_FILE a
 * hook exported can't send it to another repo). Never prompts in the terminal (a missing login
 * fails fast).
 */
function git(root, args, { timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: root,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: repoEnv(process.env, { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }),
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: String(stdout),
          stderr: String(stderr),
          output: `${stdout}${stderr}`.trim() || (err ? err.message : ''),
          timedOut: !!err?.killed,
        });
      },
    );
  });
}

const parseJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Content files that differ from HEAD (the ones Publish would commit), plus branch and
 * push state. Only content files (src/render/files.js FOLDERS, LANG_FILES, ROOT_FILES, the
 * templates) are looked at.
 */
export async function contentStatus(root) {
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok) return { git: false, error: 'Not a git repository', files: [], ahead: 0 };
  const [branchR, prefixR, remoteR] = await Promise.all([
    git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(root, ['rev-parse', '--show-prefix']),
    git(root, ['remote', 'get-url', 'origin']),
  ]);
  const branch = branchR.stdout.trim();
  const prefix = prefixR.stdout.trim();
  // Every JSON file in the editable folders, including deleted or new ones.
  const rel = [
    ...FOLDERS.map((d) => `:(glob)${contentRel(root)}/${d}/**/*.json`),
    ...LANG_FILES.map((f) => `${contentRel(root)}/${f}`),
    ...ROOT_FILES.map((f) => diskRel(root, f)),
    `:(glob)${loadSiteConfig(root).templatesRel}/*.json`,
  ];

  const st = await git(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    ...rel,
  ]);
  const files = [];
  const entries = st.stdout.split('\0').filter(Boolean);
  const add = (repoPath, status) => {
    const p = repoPath.startsWith(prefix) ? repoPath.slice(prefix.length) : repoPath;
    const { templatesRel: tRel, contentRootRel: rRel } = loadSiteConfig(root);
    const name = p.startsWith(`${tRel}/`)
      ? `templates/${p.slice(tRel.length + 1)}`
      : p.startsWith(`${contentRel(root)}/`)
        ? p.slice(contentRel(root).length + 1)
        : rRel === '.'
          ? p
          : p.slice(rRel.length + 1);
    if (isContentFile(name) && p === diskRel(root, name)) files.push({ name, path: p, status });
  };
  for (let i = 0; i < entries.length; i++) {
    const code = entries[i].slice(0, 2);
    const status =
      code === '??' || code[0] === 'R' || code[0] === 'C'
        ? 'new'
        : code.includes('D')
          ? 'deleted'
          : code.includes('A')
            ? 'new'
            : 'modified';
    add(entries[i].slice(3), status);
    // A rename or copy is followed by its source path: a rename (git mv) deletes it.
    if (code[0] === 'R' || code[0] === 'C') {
      i++;
      if (code[0] === 'R') add(entries[i], 'deleted');
    }
  }
  await Promise.all(
    files.map(async (f) => {
      const [numstat, head] = await Promise.all([
        git(root, ['diff', '--numstat', 'HEAD', '--', `:(literal)${f.path}`]),
        git(root, ['show', `HEAD:${prefix}${f.path}`]),
      ]);
      const [added, removed] = numstat.stdout.trim().split(/\s+/);
      const disk = fs.existsSync(path.join(root, f.path))
        ? parseJSON(fs.readFileSync(path.join(root, f.path), 'utf8'))
        : undefined;
      const before = head.ok ? parseJSON(head.stdout) : undefined;
      f.added =
        Number(added) ||
        (f.status === 'new'
          ? fs.readFileSync(path.join(root, f.path), 'utf8').split('\n').length - 1
          : 0);
      f.removed = Number(removed) || 0;
      f.changes = before === undefined || disk === undefined ? 1 : countEdits(before, disk, f.name);
    }),
  );
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Commits on this branch that origin doesn't have yet (e.g. a publish whose push failed).
  let upstream = (
    await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  ).stdout.trim();
  if (
    !upstream &&
    branch !== 'HEAD' &&
    (await git(root, ['rev-parse', '--verify', '-q', `refs/remotes/origin/${branch}`])).ok
  )
    upstream = `origin/${branch}`;
  const ahead = upstream
    ? Number((await git(root, ['rev-list', '--count', `${upstream}..HEAD`])).stdout.trim()) || 0
    : 0;
  const unpushed = ahead
    ? (await git(root, ['log', '--format=%h%x09%s', '-n', '20', `${upstream}..HEAD`])).stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => ({
          hash: line.split('\t')[0],
          subject: line.split('\t').slice(1).join('\t'),
        }))
    : [];

  return {
    git: true,
    branch,
    detached: branch === 'HEAD',
    upstream: upstream || null,
    ahead,
    unpushed,
    remote: remoteR.ok ? remoteR.stdout.trim() : null,
    repoUrl: repoUrl(remoteR.stdout.trim(), loadSiteConfig(root).config),
    files,
  };
}

/** Readable hint for common push failures. */
function pushHint(output) {
  if (
    /could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403|invalid credentials|could not read Password/i.test(
      output,
    )
  ) {
    return "Git on this machine has no working GitHub login. In this repo's terminal run `gh auth login` (HTTPS) and `gh auth setup-git`, then click Publish again to push. Your commit is kept locally.";
  }
  if (/non-fast-forward|fetch first|rejected/i.test(output)) {
    return "GitHub has commits you don't have yet. Run `git pull --rebase` in the terminal, then click Publish again to push.";
  }
  if (/Could not resolve host|unable to access|timed out/i.test(output))
    return 'Could not reach GitHub. Check the connection and try again.';
  return '';
}

/** Commit every changed content file in one commit and push the branch. */
export async function publish(root, message) {
  const s = await contentStatus(root);
  if (!s.git) return { status: 400, body: { error: s.error } };
  if (s.detached)
    return {
      status: 409,
      body: { error: 'HEAD is detached: check out a branch before publishing.' },
    };
  if (!s.files.length && !s.ahead)
    return {
      status: 400,
      body: { error: 'Nothing to publish: no saved content changes and no unpushed commits.' },
    };

  let committed = false;
  const steps = [];
  if (s.files.length) {
    const msg = String(message || '').trim();
    if (!msg) return { status: 400, body: { error: 'A commit message is required.' } };
    if (msg.length > 5000) return { status: 400, body: { error: 'Commit message is too long.' } };
    const paths = s.files.map((f) => f.path);
    // literal: "[person]/index.json" is not a glob here
    const specs = paths.map((p) => `:(literal)${p}`);
    // Deleted files need no add (the commit below takes their removal; the old path of a
    // `git mv` isn't known to git add at all).
    const present = s.files.filter((f) => f.status !== 'deleted').map((f) => f.path);
    if (present.length) {
      const add = await git(root, ['add', '--', ...present.map((p) => `:(literal)${p}`)]);
      steps.push({ cmd: `git add -- ${present.join(' ')}`, ...add });
      if (!add.ok)
        return { status: 500, body: { error: 'git add failed', output: add.output, steps } };
    }
    // With pathspecs, `git commit` commits ONLY these paths, even if other files are staged.
    const commit = await git(root, ['commit', '-m', msg, '--', ...specs]);
    steps.push({ cmd: `git commit -m <message> -- ${paths.join(' ')}`, ...commit });
    if (!commit.ok)
      return { status: 500, body: { error: 'git commit failed', output: commit.output, steps } };
    committed = true;
  }
  const hash = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  const url = `${s.repoUrl}/commit/${hash}`;
  const push = await git(root, ['push', 'origin', s.branch], { timeout: 120_000 });
  steps.push({ cmd: `git push origin ${s.branch}`, ...push });
  const files = s.files.map((f) => f.path);
  if (!push.ok) {
    return {
      status: 502,
      body: {
        error: push.timedOut ? 'git push timed out' : 'git push failed',
        output: push.output,
        hint: pushHint(push.output),
        committed,
        hash,
        short: hash.slice(0, 7),
        url,
        branch: s.branch,
        files,
      },
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      committed,
      pushed: true,
      hash,
      short: hash.slice(0, 7),
      url,
      branch: s.branch,
      files,
      output: push.output,
    },
  };
}

/**
 * The local data layer of the site at `root` (see the top). env: the R2_* variables (whether
 * uploads go to R2); onWrite(texts) runs right before Save writes (the dev server's watcher).
 */
export function createLocalDataLayer(root, { env = {}, onWrite = () => {} } = {}) {
  return {
    load: () => ({
      mode: 'dev',
      files: readContentFiles(root),
      media: readMedia(root),
      photos: readPhotos(root),
      r2: !r2Config(env).missing,
    }),
    save: (files) => save(root, files, onWrite),
    status: () => contentStatus(root),
    publish: (message) => publish(root, message),
  };
}
