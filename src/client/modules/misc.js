/** Small page behaviours: photo fade-in. */

export function photoFade(view) {
  view.querySelectorAll('img').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener('load', done, { once: true });
  });
  return null;
}
