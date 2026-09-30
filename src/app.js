// App shell: store wiring, tab routing, theme, service worker.
import { el, mount, svg, closeTopSheet, toast } from './ui/dom.js';
import { ctx } from './ui/ctx.js';
import { createStore } from './core/store.js';
import { dateKey } from './core/schedule.js';
import { PROGRAMS } from './data/program.js';
import { renderToday } from './ui/today.js';
import { renderHistory } from './ui/history.js';
import { renderProfile } from './ui/profile.js';
import { renderSettings } from './ui/settings.js';
import { openWorkout, closeWorkout, isWorkoutOpen, render as renderWorkout } from './ui/workout.js';
import { renderTimer } from './ui/timer.js';
import { APP_VERSION } from './version.js';

const TABS = [
  { id: 'today', label: 'Today', icon: '<path d="M4 7h16M4 12h10M4 17h7"/>' },
  { id: 'history', label: 'History', icon: '<path d="M4 18V9M9.5 18V5M15 18v-6M20.5 18v-9"/>' },
  { id: 'profile', label: 'Profile', icon: '<circle cx="12" cy="8.5" r="3.4"/><path d="M5 20c1.6-3.4 4-5 7-5s5.4 1.6 7 5"/>' },
  { id: 'settings', label: 'Settings', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>' },
];

const view = { tab: 'today', today: dateKey() };

/** localStorage may be blocked (private mode); fall back to memory so the app still runs. */
function safeStorage() {
  try {
    const probe = '__tos_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      __memoryOnly: true,
    };
  }
}

const storage = safeStorage();
const store = createStore(storage, { debounceMs: 200, onStatus: () => paintStatus() });

ctx.store = store;
ctx.today = () => view.today;
ctx.refresh = refresh;
ctx.navigate = (tab) => { view.tab = tab; location.hash = `#${tab}`; refresh(); };
ctx.openWorkout = (key) => openWorkout(key);
ctx.closeWorkout = () => closeWorkout();

// ---------------------------------------------------------------- rendering
function applyTheme() {
  document.documentElement.dataset.theme = store.get().settings.theme || 'analog';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}

function paintStatus() {
  const dot = document.querySelector('.save-dot');
  if (dot) dot.dataset.state = store.status().state;
}

function appbar() {
  const state = store.get();
  const titles = { today: 'Today', history: 'History', profile: 'Profile', settings: 'Settings' };
  return el('div', { class: 'appbar-row' },
    el('h1', { text: titles[view.tab] }),
    el('div', { class: 'appbar-meta' },
      el('span', { class: 'chip', text: PROGRAMS[state.settings.mode].label }),
      el('span', { class: 'save-dot', dataset: { state: store.status().state }, title: 'Save status' })));
}

function tabbar() {
  return el('div', { class: 'row', style: 'width:100%' }, TABS.map((t) => el('button', {
    class: 'tab', 'aria-current': view.tab === t.id ? 'page' : null,
    onclick: () => ctx.navigate(t.id),
  }, svg(t.icon, { sw: view.tab === t.id ? '1.9' : '1.6' }), el('span', { text: t.label }))));
}

function screen() {
  if (view.tab === 'history') return renderHistory();
  if (view.tab === 'profile') return renderProfile();
  if (view.tab === 'settings') return renderSettings();
  return renderToday();
}

let pendingFrame = null;
export function refresh() {
  // setTimeout rather than requestAnimationFrame: rAF is paused in background
  // tabs, which would leave the app blank when it is reopened.
  if (pendingFrame) clearTimeout(pendingFrame);
  pendingFrame = setTimeout(() => {
    pendingFrame = null;
    applyTheme();
    mount(document.getElementById('appbar'), appbar());
    mount(document.getElementById('tabbar'), tabbar());
    const host = document.getElementById('screen');
    const top = host.scrollTop;
    mount(host, screen());
    host.scrollTop = top;
    if (isWorkoutOpen()) renderWorkout();
    renderTimer();
  }, 0);
}

// ---------------------------------------------------------------- lifecycle
function readHash() {
  const h = (location.hash || '').replace('#', '');
  if (TABS.some((t) => t.id === h)) view.tab = h;
}

window.addEventListener('hashchange', () => { readHash(); refresh(); });

window.addEventListener('beforeunload', () => { store.flush(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { store.flush(); return; }
  const now = dateKey();
  if (now !== view.today) { view.today = now; refresh(); }
});

// A day roll-over while the app sits open should move "Today" along with it.
setInterval(() => {
  const now = dateKey();
  if (now !== view.today) { view.today = now; refresh(); }
}, 60000);

window.addEventListener('popstate', () => { if (closeTopSheet()) return; });

readHash();
applyTheme();
refresh();

store.update((s) => { s.lastOpened = view.today; }, { silent: true });

if (storage.__memoryOnly) {
  toast('Storage is blocked in this browser mode — data will not persist.', 5000);
}

if (store.source === 'backup') {
  toast('Recovered your data from the backup copy.', 4000);
}

// ?nosw=1 skips the offline cache while developing. __TOS_NO_SW__ is set by hosts
// whose sandbox refuses service workers, so we do not throw on every load there.
if ('serviceWorker' in navigator && !location.search.includes('nosw') && !window.__TOS_NO_SW__) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Expose a small surface for the browser-level checks.
window.TrainingOS = {
  version: APP_VERSION,
  store,
  get state() { return store.get(); },
  refresh,
  openWorkout: (k) => openWorkout(k || view.today),
  closeWorkout,
  navigate: (t) => ctx.navigate(t),
  today: () => view.today,
};
