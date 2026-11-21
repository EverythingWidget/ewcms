/**
 * fetch for the dev server's /__editor/* routes: the JSON answer, or an Error carrying the
 * server's answer ({ error, hint, ... }) when the request failed.
 */
export async function json(url, opts) {
  const res = await fetch(url, { cache: 'no-store', ...opts });
  const isJSON = (res.headers.get('content-type') || '').includes('json');
  const data = isJSON ? await res.json() : null;
  if (!res.ok || !isJSON) {
    const err = new Error(data?.error || `${url}: ${res.status}`);
    Object.assign(err, data || {});
    throw err;
  }
  return data;
}

export const post = (url, body) =>
  json(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
