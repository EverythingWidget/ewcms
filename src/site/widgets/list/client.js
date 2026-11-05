/**
 * The List widget's behaviour on the page (a widget module's client.js: run on every
 * .wgt--list, ../index.js has the format): in Rows, the arrow keys move between its items'
 * links (Up / Down, Home / End), so a long list is quick to go through by keyboard.
 */
export default function listClient(el) {
  const list = el.querySelector('.list__items--rows');
  if (!list) return undefined;
  const links = () => [...list.querySelectorAll(':scope > a.li')];
  const onkey = (e) => {
    const all = links();
    const at = all.indexOf(document.activeElement);
    if (at < 0) return;
    const to =
      e.key === 'ArrowDown'
        ? at + 1
        : e.key === 'ArrowUp'
          ? at - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? all.length - 1
              : null;
    if (to === null || !all[to]) return;
    e.preventDefault();
    all[to].focus();
  };
  list.addEventListener('keydown', onkey);
  return () => list.removeEventListener('keydown', onkey);
}
