// Small floating rest-timer pill. Visible while a workout is open, minimised elsewhere.
import { el, mount, fmtDuration } from './dom.js';
import { ctx } from './ctx.js';

let target = 0;        // seconds of rest prescribed
let startedAt = 0;     // ms
let running = false;
let minimised = false;
let visible = false;
let tick = null;
let label = 'Rest';

function root() { return document.getElementById('timer-root'); }

export function startRest(seconds, name = 'Rest') {
  target = Math.max(0, Number(seconds) || 0);
  label = name;
  startedAt = Date.now();
  running = target > 0;
  minimised = false;
  if (running) ensureTick();
  render();
}

export function stopRest() {
  running = false;
  if (tick) { clearInterval(tick); tick = null; }
  render();
}

/** Called when the workout screen opens or closes. Outside a workout the pill
 *  always collapses to its smallest form so it cannot obscure other screens. */
export function setVisible(v) {
  visible = v;
  if (!v) minimised = true;
  render();
}

export function isRunning() { return running; }

function ensureTick() {
  if (tick) return;
  tick = setInterval(render, 250);
}

function elapsed() { return Math.floor((Date.now() - startedAt) / 1000); }

function render() {
  const r = root();
  if (!r) return;
  if (!running) { mount(r); return; }
  const left = target - elapsed();
  const over = left <= 0;
  if (minimised || !visible) {
    mount(r, el('button', {
      class: 'timer', dataset: { min: 'true', over: String(over) },
      'aria-label': visible ? 'Expand rest timer' : 'Back to the workout',
      onclick: () => {
        if (!visible) { ctx.openWorkout(ctx.today()); return; }
        minimised = false;
        render();
      },
    }, el('span', { class: 'timer-time num', text: fmtDuration(left) })));
    return;
  }
  mount(r, el('div', { class: 'timer', dataset: { min: 'false', over: String(over) }, role: 'timer' },
    el('span', { class: 'timer-label', text: over ? 'Ready' : label }),
    el('span', { class: 'timer-time num', text: fmtDuration(left) }),
    el('button', { class: 'timer-btn', 'aria-label': 'Add 30 seconds', onclick: () => { target += 30; render(); } }, '+30'),
    el('button', { class: 'timer-btn', 'aria-label': 'Minimise timer', onclick: () => { minimised = true; render(); } }, '–'),
    el('button', { class: 'timer-btn', 'aria-label': 'Dismiss timer', onclick: stopRest }, '×')));
}

export function renderTimer() { render(); }
