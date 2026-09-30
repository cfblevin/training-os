// Settings: preferences, colorway, program configuration, backup and recovery.
import { el, openSheet, menuSheet, confirmSheet, toast } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import {
  exportBundle, importBundle, readSnapshot, createInitialState, KEY, BACKUP_KEY, deepClone,
} from '../core/store.js';
import { PROGRAMS, MODES } from '../data/program.js';
import { LEDGER_GROUPS, defaultTargets } from '../core/volume.js';
import { openAnchorsSheet, openBlockReview, openRotationSheet, blockSummary } from './blocks.js';
import { APP_VERSION, BUILD } from '../version.js';
import { rangeText } from '../core/progression.js';
import { shortDate } from '../core/schedule.js';

const THEMES = [
  { id: 'analog', name: 'Analog Instrument Panel', note: 'Charcoal panel, amber readouts, monospaced numbers.' },
  { id: 'alpine', name: 'Alpine Field Log', note: 'Paper ground, ink text, forest accents, serif headings.' },
  { id: 'midnight', name: 'Midnight Ledger', note: 'Near-black ledger, cool grey rules, cyan accents.' },
  { id: 'chalk', name: 'Chalk & Iron', note: 'Maximum contrast. Square corners, chalk type, one signal red.' },
];

const set = (fn) => { ctx.store.update(fn); ctx.refresh(); };

function toggleRow(label, note, value, onChange) {
  return el('label', { class: 'list-row', style: 'cursor:pointer' },
    el('div', { class: 'list-row-main' },
      el('div', { class: 'list-name', text: label }),
      note ? el('div', { class: 'list-sub', text: note }) : null),
    el('input', {
      type: 'checkbox', checked: value ? true : null, style: 'width:22px;height:22px;accent-color:var(--accent)',
      onchange: (e) => onChange(e.target.checked),
    }));
}

function section(title, ...body) {
  return el('section', { class: 'section' },
    el('div', { class: 'section-head' }, el('h3', { class: 'section-title', text: title })),
    ...body);
}

export function renderSettings() {
  const state = ctx.store.get();
  const st = ctx.store.status();
  const storage = estimateStorage();
  const backup = readSnapshot(window.localStorage, BACKUP_KEY);

  return el('div', null,
    section('Training mode',
      el('div', { class: 'seg' }, MODES.map((m) => el('button', {
        'aria-pressed': String(state.settings.mode === m),
        onclick: () => changeMode(m),
      }, PROGRAMS[m].label))),
      el('p', { class: 'explainer', style: 'margin-top:8px', text: PROGRAMS[state.settings.mode].blurb })),

    section('Colorway',
      el('div', { class: 'list' }, THEMES.map((t) => el('button', {
        class: 'list-row',
        onclick: () => set((s) => { s.settings.theme = t.id; }),
      },
        el('div', { class: 'list-row-main' },
          el('div', { class: 'list-name', text: t.name }),
          el('div', { class: 'list-sub', text: t.note })),
        state.settings.theme === t.id ? el('span', { class: 'badge badge-good', text: 'On' }) : null))),
      el('p', { class: 'tiny faint', style: 'margin-top:8px', text: 'Colorways change appearance only: layout, navigation and training logic are identical.' })),

    section('Workout preferences',
      el('div', { class: 'list' },
        toggleRow('Start the rest timer automatically', 'When a set is marked complete', state.settings.autoStartTimer,
          (v) => set((s) => { s.settings.autoStartTimer = v; })),
        toggleRow('Show "why this workout"', 'One sentence on the Today card and previews', state.settings.showWhy,
          (v) => set((s) => { s.settings.showWhy = v; })),
        el('button', {
          class: 'list-row',
          onclick: () => menuSheet('Carousel length', [13, 14].map((n) => ({
            label: `${n} days`, onClick: () => set((s) => { s.settings.carouselDays = n; }),
          }))),
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Carousel length' }),
            el('div', { class: 'list-sub', text: `${state.settings.carouselDays} days` })),
          el('span', { class: 'caret', text: '›' })))),

    section('Program configuration',
      el('div', { class: 'list' },
        el('button', { class: 'list-row', onclick: () => openAnchorsSheet() },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Anchor lifts' }),
            el('div', { class: 'list-sub', text: `${A.anchorSlots(state).length} tracked lifts · locked for the block` })),
          el('span', { class: 'caret', text: '›' })),
        el('button', { class: 'list-row', onclick: () => openRotationSheet() },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Rotating slots' }),
            el('div', { class: 'list-sub', text: `${A.rotatingSlots(state).length} slots · a different movement each week` })),
          el('span', { class: 'caret', text: '›' })),
        el('button', { class: 'list-row', onclick: () => openBlockReview() },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Training block' }),
            el('div', { class: 'list-sub', text: blockSummary(state) })),
          el('span', { class: 'caret', text: '›' })),
        el('button', {
          class: 'list-row',
          onclick: () => menuSheet('Block length', [4, 6, 8, 12].map((w) => ({
            label: `${w} weeks`,
            onClick: () => { set((s) => { A.setBlockLength(s, w); }); toast(`Blocks now run ${w} weeks`); },
          }))),
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Block length' }),
            el('div', { class: 'list-sub', text: `${(state.block || {}).weeks || 6} weeks before the next review` })),
          el('span', { class: 'caret', text: '›' })),
        el('button', { class: 'list-row', onclick: () => openProgramSheet() },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Weekly plan' }),
            el('div', { class: 'list-sub', text: `${PROGRAMS[state.settings.mode].label} · ${state.program[state.settings.mode].days.length} training days` })),
          el('span', { class: 'caret', text: '›' })),
        el('button', { class: 'list-row', onclick: () => openTargetsSheet() },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Weekly volume targets' }),
            el('div', { class: 'list-sub', text: targetSummary(state) })),
          el('span', { class: 'caret', text: '›' })),
        el('button', {
          class: 'list-row',
          onclick: async () => {
            const n = Object.keys(state.dayOverrides || {}).length;
            if (!n) { toast('No single-day edits to clear'); return; }
            const ok = await confirmSheet({
              title: 'Clear single-day edits?',
              message: `${n} date${n > 1 ? 's' : ''} have today-only changes. Logged sessions are not affected.`,
              confirm: 'Clear', danger: true,
            });
            if (!ok) return;
            set((s) => { s.dayOverrides = {}; });
            toast('Single-day edits cleared');
          },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Clear single-day edits' }),
            el('div', { class: 'list-sub', text: `${Object.keys(state.dayOverrides || {}).length} dates changed` }))),
        el('button', {
          class: 'list-row',
          onclick: async () => {
            const ok = await confirmSheet({
              title: 'Restore the default program?',
              message: 'Future plans for every mode return to the built-in split. Logged sessions, baselines, custom exercises and your profile are kept.',
              confirm: 'Restore', danger: true,
            });
            if (!ok) return;
            set((s) => { s.program = deepClone(PROGRAMS); });
            toast('Program restored');
          },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Restore default program' }),
            el('div', { class: 'list-sub', text: 'Keeps history, baselines and profile' }))))),

    section('Data and backup',
      el('div', { class: 'list' },
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Save status' }),
            el('div', { class: 'list-sub', text: saveText(st) })),
          el('span', { class: 'save-dot', dataset: { state: st.state } })),
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Recovery copy' }),
            el('div', { class: 'list-sub', text: backup && backup.savedAt
              ? `Kept from ${new Date(backup.savedAt).toLocaleString()}`
              : 'Written after the next save' }))),
        el('button', { class: 'list-row', onclick: () => exportFile() },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Export backup file' }),
            el('div', { class: 'list-sub', text: 'Download the file, or copy it out' })),
          el('span', { class: 'caret', text: '›' })),
        el('label', { class: 'list-row', style: 'cursor:pointer' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Import / restore' }),
            el('div', { class: 'list-sub', text: 'Replaces everything on this device' })),
          el('span', { class: 'caret', text: '›' }),
          el('input', {
            type: 'file', accept: 'application/json,.json', style: 'display:none',
            onchange: (e) => importFile(e.target.files && e.target.files[0]),
          })),
        backup ? el('button', {
          class: 'list-row',
          onclick: async () => {
            const ok = await confirmSheet({
              title: 'Restore the recovery copy?',
              message: 'The current data is replaced by the previous saved snapshot.',
              confirm: 'Restore', danger: true,
            });
            if (!ok) return;
            ctx.store.replace(importBundle(JSON.stringify({ state: backup.state })));
            ctx.refresh(); toast('Recovery copy restored');
          },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Restore recovery copy' }),
            el('div', { class: 'list-sub', text: 'Rolls back to the previous snapshot' }))) : null,
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Local storage used' }),
            el('div', { class: 'list-sub', text: `${storage.kb} KB · ${(state.sessions || []).length} sessions · ${(state.photos || []).length} photos` }))))),

    section('Offline and version',
      el('div', { class: 'list' },
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'App version' }),
            el('div', { class: 'list-sub', text: `${APP_VERSION} · build ${BUILD} · data schema v${state.schemaVersion}` }))),
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Offline cache' }),
            el('div', { class: 'list-sub', id: 'sw-status', text: swStatusText() }))),
        el('button', {
          class: 'list-row',
          onclick: async () => {
            const reg = await navigator.serviceWorker?.getRegistration();
            if (!reg) { toast('No service worker registered'); return; }
            await reg.update();
            toast('Checked for an update');
          },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Check for update' }),
            el('div', { class: 'list-sub', text: 'Reload afterwards to apply' }))))),

    section('Advanced',
      el('div', { class: 'list' },
        el('button', {
          class: 'list-row',
          onclick: () => {
            const n = Object.keys(state.suggestions || {}).length;
            if (!n) { toast('No pending suggestions'); return; }
            set((s) => { s.suggestions = {}; });
            toast('Suggestions cleared. Loads unchanged.');
          },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: 'Clear pending load suggestions' }),
            el('div', { class: 'list-sub', text: `${Object.keys(state.suggestions || {}).length} waiting · loads stay as they are` }))),
        el('button', {
          class: 'list-row',
          onclick: async () => {
            const one = await confirmSheet({
              title: 'Erase all data?',
              message: 'Sessions, baselines, profile, measurements and custom exercises are deleted from this device.',
              confirm: 'Continue', danger: true,
            });
            if (!one) return;
            const two = await confirmSheet({
              title: 'Really erase everything?',
              message: 'Export a backup first if you might want this data back.',
              confirm: 'Erase everything', danger: true,
            });
            if (!two) return;
            ctx.store.replace(createInitialState());
            ctx.refresh(); toast('All data erased');
          },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name danger', style: 'color:var(--danger)', text: 'Erase all data' }),
            el('div', { class: 'list-sub', text: 'Two confirmations required' }))))));
}

function saveText(st) {
  if (st.state === 'saving') return 'Saving…';
  if (st.state === 'error') return `Not saved: ${st.error || 'storage unavailable'}`;
  if (st.state === 'trimmed') return 'Saved. Photos dropped to fit storage.';
  if (st.state === 'recovered') return 'Recovered from the backup copy';
  return st.savedAt ? `Saved ${new Date(st.savedAt).toLocaleTimeString()}` : 'Saved';
}

function swStatusText() {
  if (!('serviceWorker' in navigator)) return 'Not supported in this browser';
  return navigator.serviceWorker.controller ? 'Active — the app works offline' : 'Registering on first load';
}

function estimateStorage() {
  let bytes = 0;
  try {
    for (const k of [KEY, BACKUP_KEY]) bytes += (window.localStorage.getItem(k) || '').length;
  } catch { /* storage blocked */ }
  return { kb: Math.round(bytes / 1024) };
}

async function changeMode(m) {
  const state = ctx.store.get();
  if (state.settings.mode === m) return;
  const ok = await confirmSheet({
    title: `Switch to ${PROGRAMS[m].label}?`,
    message: 'Today and the carousel show the other plan. Sessions already logged stay under the mode they were trained in.',
    confirm: 'Switch',
  });
  if (!ok) return;
  set((s) => { s.settings.mode = m; });
  toast(`${PROGRAMS[m].label} mode`);
}

function targetSummary(state) {
  const t = state.volumeTargets || {};
  const priority = (state.profile.physiquePriorities || []).length;
  const g = t['Lateral delts'];
  return g ? `${priority} priority regions at ${g.min}\u2013${g.max} sets/week` : 'Not set';
}

function openTargetsSheet() {
  openSheet({
    title: 'Weekly volume targets',
    sub: 'Hard sets per region per week. The ledger measures against these; nothing is enforced.',
    build: ({ rerender }) => {
      const state = ctx.store.get();
      const t = state.volumeTargets || {};
      return el('div', null,
        el('div', { class: 'list' }, LEDGER_GROUPS.filter((g) => g !== 'Power').map((g) => el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' }, el('div', { class: 'list-name', text: g })),
          el('div', { class: 'row', style: 'gap:6px;flex:none' },
            el('input', {
              class: 'input num', type: 'number', inputmode: 'numeric', style: 'width:62px;min-height:40px;text-align:center',
              'aria-label': `${g} minimum`, value: String((t[g] || {}).min ?? 0),
              onchange: (e) => set((s) => {
                s.volumeTargets = { ...(s.volumeTargets || {}) };
                s.volumeTargets[g] = { ...(s.volumeTargets[g] || {}), min: Number(e.target.value || 0) };
              }),
            }),
            el('span', { class: 'faint', text: '\u2013' }),
            el('input', {
              class: 'input num', type: 'number', inputmode: 'numeric', style: 'width:62px;min-height:40px;text-align:center',
              'aria-label': `${g} maximum`, value: String((t[g] || {}).max ?? 0),
              onchange: (e) => set((s) => {
                s.volumeTargets = { ...(s.volumeTargets || {}) };
                s.volumeTargets[g] = { ...(s.volumeTargets[g] || {}), max: Number(e.target.value || 0) };
              }),
            }))))),
        el('p', { class: 'explainer', style: 'margin-top:12px' },
          'Priority regions default to 14\u201318 hard sets a week, the range where added volume still reliably pays for its recovery cost. Arms sit higher because the pulls and presses hand them a lot of half-credit work.'),
        el('div', { style: 'margin-top:12px' },
          el('button', {
            class: 'btn btn-quiet',
            onclick: () => {
              set((s) => { s.volumeTargets = defaultTargets(s.profile.physiquePriorities || []); });
              rerender();
              toast('Targets reset from your physique priorities');
            },
          }, 'Reset from physique priorities')));
    },
  });
}

function openProgramSheet() {
  openSheet({
    title: 'Weekly plan',
    build: () => {
      const state = ctx.store.get();
      const program = state.program[state.settings.mode];
      const libMap = A.libMapFor(state);
      return el('div', null,
        program.days.map((d) => el('details', { class: 'disc' },
          el('summary', null, el('span', { text: d.title }),
            el('span', { class: 'small muted', style: 'margin-left:auto;padding-right:8px', text: `${d.slots.length} slots` })),
          el('div', { class: 'disc-body' },
            el('p', { class: 'explainer', text: d.why }),
            el('div', { class: 'list' }, d.slots.map((slot) => {
              const f = libMap.get(slot.foundation);
              const vs = (slot.variations || []).map((v) => (libMap.get(v) || {}).name).filter(Boolean);
              return el('div', { class: 'list-row' },
                el('div', { class: 'list-row-main' },
                  el('div', { class: 'list-name', text: f ? f.name : slot.foundation }),
                  el('div', { class: 'list-sub', text: vs.length ? `Variations: ${vs.join(', ')}` : 'No variation in rotation' })),
                el('div', { class: 'list-right num', text: `${slot.sets}×${rangeText({ repMin: slot.repMin, repMax: slot.repMax })}` }));
            }))))),
        el('p', { class: 'explainer', style: 'margin-top:12px', text: 'Edit any slot from a workout preview or the exercise menu, where you choose whether a change is for one day or for every week.' }));
    },
  });
}

function exportFile() {
  const json = exportBundle(ctx.store.get());
  const state = ctx.store.get();
  openSheet({
    title: 'Backup',
    sub: `${(state.sessions || []).length} sessions · ${(state.measurements || []).length} measurements · schema v${state.schemaVersion}`,
    build: ({ close }) => {
      const area = el('textarea', {
        class: 'input', readonly: true, style: 'height:120px;font-family:var(--font-num);font-size:11px',
        onclick: (e) => e.target.select(),
      }, json);
      return el('div', null,
        el('p', { class: 'explainer', style: 'margin-bottom:10px',
          text: 'Everything in the app, as JSON. Save the file, or copy it somewhere you trust \u2014 a note, an email to yourself, a cloud drive.' }),
        area,
        el('div', { class: 'btn-row', style: 'margin-top:12px' },
          el('button', {
            class: 'btn btn-quiet',
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(json);
                toast('Backup copied');
              } catch {
                area.focus(); area.select();
                toast('Selected \u2014 copy it with your keyboard');
              }
            },
          }, 'Copy'),
          el('button', {
            class: 'btn btn-primary',
            onclick: () => { downloadBackup(json); close(); },
          }, 'Download file')));
    },
  });
}

function downloadBackup(json) {
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup file created');
  } catch {
    toast('This browser blocked the download \u2014 use Copy instead');
  }
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let next;
    try {
      next = importBundle(String(reader.result));
    } catch (err) {
      toast(String(err.message || err));
      return;
    }
    const ok = await confirmSheet({
      title: 'Replace all data?',
      message: `The backup holds ${(next.sessions || []).length} sessions and ${(next.measurements || []).length} measurement entries. Current data on this device is replaced.`,
      confirm: 'Restore', danger: true,
    });
    if (!ok) return;
    ctx.store.replace(next);
    ctx.refresh();
    toast('Backup restored');
  };
  reader.readAsText(file);
}
