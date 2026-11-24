/**
 * The Publish window's list (src/editor/svelte/PubFiles.svelte, PublishModal.svelte): the data
 * layer's status files grouped, binary sizes, and the default commit message.
 */

/** The groups in the order the data layer's status gives them (site-git.mjs GROUPS). */
export const GROUP_LABELS = {
  content: 'Content',
  sources: 'Sources',
  templates: 'Templates',
  theme: 'Theme',
  media: 'Media',
  other: 'Other files',
};

/** A content file name's group: "templates/t-x.json" templates, "sources/…" sources, else content. */
export const groupOfName = (name) =>
  name.startsWith('templates/') ? 'templates' : name.startsWith('sources/') ? 'sources' : 'content';

/** [{ group, label, files }] in GROUP_LABELS order; empty groups left out. */
export function groupFiles(files) {
  return Object.entries(GROUP_LABELS)
    .map(([group, label]) => ({
      group,
      label,
      files: files.filter((f) => (f.group || groupOfName(f.name || '')) === group),
    }))
    .filter((g) => g.files.length);
}

/** 812 -> "812 B", 4300 -> "4.2 KB", 3_250_000 -> "3.1 MB". */
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The default commit message. Content files only: "Content: update about, index (visual
 * editor)". With other files too, counted: "Update 3 content files, 2 photos, 1 theme file
 * (visual editor)". names: the content files' names; others: the other files ({ group }).
 */
export function defaultMessage(names, others = []) {
  if (!others.length)
    return names.length
      ? `Content: update ${names.map((f) => f.replace(/^.*\//, '').replace(/\.json$/, '')).join(', ')} (visual editor)`
      : '';
  const count = (group) => others.filter((f) => f.group === group).length;
  const parts = [
    names.length && n(names.length, 'content file'),
    count('media') && n(count('media'), 'photo'),
    count('theme') && n(count('theme'), 'theme file'),
    count('other') && n(count('other'), 'other file'),
  ].filter(Boolean);
  return `Update ${parts.join(', ')} (visual editor)`;
}
