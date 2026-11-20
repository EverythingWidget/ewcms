/**
 * The ewcms update (dev only, ../server/update.mjs), shared by the About area's card
 * (AreaList.svelte, its record in ../areas.js: subtitle, highlight) and the About window
 * (AboutModal.svelte: the versions, the changelog, Later / Update, then installing,
 * restarting, done or the error). loadUpdate() once, at the start (App.svelte).
 *   info   GET /__editor/update: { current, latest, available, changes, pin, boot }
 *   phase  offer | installing | restarting | done | error
 *   later  Later was picked: the card isn't highlighted any more (this visit), the offer stays
 * An update restarts the dev server; sessionStorage keeps the job across it, and the About
 * window opens again on "done".
 */
import { closeModal, openModal } from './modals.svelte.js';

const KEY = 'ewcms-update';

export const upd = $state({
  info: null,
  phase: 'offer',
  job: { log: '', from: '', to: '', changes: [] },
  pct: 0,
  later: false,
});

let timer;

const api = async (url, opts) => {
  const res = await fetch(`/__editor${url}`, { cache: 'no-store', ...opts });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

/** Is an update running (installing, or the dev server restarting)? */
export const updating = () => upd.phase === 'installing' || upd.phase === 'restarting';

/** The About card highlighted: an update not put off with Later, one running, or one failed. */
export const highlighted = () =>
  (!!upd.info?.available && !upd.later && upd.phase === 'offer') ||
  updating() ||
  upd.phase === 'error';

/** Ask the dev server (once); after an update's restart: done, and the About window opens. */
export function loadUpdate() {
  const pending = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  api('/update')
    .then((data) => {
      upd.info = data;
      if (pending && pending.boot !== data.boot) {
        // the restarted dev server: the update is done
        upd.job = pending;
        upd.phase = 'done';
        upd.pct = 100;
        sessionStorage.removeItem(KEY);
        openModal('about');
      } else if (pending) follow(pending.boot);
    })
    .catch(() => {});
}

function progress(at) {
  if (upd.phase === 'installing')
    upd.pct = Math.round(85 * (1 - Math.exp(-(Date.now() - at) / 15000)));
  else if (upd.phase === 'restarting') upd.pct = 90;
}

// the job's progress; across the restart: until another dev server answers
function follow(boot, at = Date.now()) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const s = await api('/update/status');
      if (s.boot !== boot) {
        upd.job = { ...upd.job, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') };
        sessionStorage.removeItem(KEY);
        upd.phase = 'done';
        upd.pct = 100;
        return;
      }
      upd.job = { ...upd.job, log: s.log, from: s.from || upd.job.from, to: s.to || upd.job.to };
      if (s.state === 'error') {
        upd.phase = 'error';
        sessionStorage.removeItem(KEY);
        return;
      }
      if (s.state === 'installing' || s.state === 'restarting') upd.phase = s.state;
    } catch {
      if (upd.phase === 'restarting') upd.job = { ...upd.job, log: 'waiting for the dev server…' };
    }
    progress(at);
    follow(boot, at);
  }, 700);
}

/** Update: package.json's tag set to the latest, npm install, the dev server restarted. */
export async function startUpdate() {
  const { info } = upd;
  const to = info.latest;
  upd.job = { log: '', from: info.current, to, changes: info.changes, boot: info.boot };
  upd.phase = 'installing';
  upd.pct = 0;
  sessionStorage.setItem(KEY, JSON.stringify(upd.job));
  try {
    const s = await api('/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    upd.job = { ...upd.job, log: s.log };
    if (s.state === 'error') {
      upd.phase = 'error';
      sessionStorage.removeItem(KEY);
      return;
    }
    follow(info.boot);
  } catch (err) {
    upd.job = { ...upd.job, log: err.message };
    upd.phase = 'error';
    sessionStorage.removeItem(KEY);
  }
}

/** Later: the window closes and the card is no longer highlighted (the offer stays in it). */
export function later() {
  upd.later = true;
  closeModal('about');
}

/** Done (after an update): back to the offer, on the new version (nothing to offer). */
export function finishUpdate() {
  upd.phase = 'offer';
  upd.info = { ...upd.info, current: upd.job.to || upd.info?.current, available: false };
  closeModal('about');
}
