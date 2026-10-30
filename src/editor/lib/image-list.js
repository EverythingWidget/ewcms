// An image list's Add image in the Media window (MediaModal.svelte, multi-pick).
/** An image list with `keys` appended, in order: each a new item (`item`, its `image` set). */
export function appendImages(list, keys, { item = '', image = '' } = {}) {
  const items = keys.map((k) => (image ? { ...JSON.parse(JSON.stringify(item)), [image]: k } : k));
  return [...(Array.isArray(list) ? list : []), ...items];
}
