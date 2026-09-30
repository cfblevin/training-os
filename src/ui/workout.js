// The active workout screen: one expanded exercise, one-tap set logging.
import { el, mount, clear, openSheet, menuSheet, confirmSheet, toast, fmtLoad } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { benchmarkText, rangeText, suggestedReps, effectiveReps, evaluateProgression } from '../core/progression.js';
import { shortDate, relativeLabel } from '../core/schedule.js';
import { PRIORITY_LABELS, FAMILY_LABELS } from '../data/library.js';
import { openLoadPicker, openRepsPicker, openExerciseMenu, openAddSheet } from './pickers.js';
import { startRest, stopRest, setVisible } from './timer.js';
import { openExerciseProgress } from './history.js';

const ui = { dateKey: null, openUid: null, scroll: 0 };

function root() { return document.getElementById('workout-root'); }

export function isWorkoutOpen() { return !!ui.dateKey; }

export function openWorkout(key) {
  ui.dateKey = key;
  ctx.store.update((s) => { A.startSession(s, key); });
  const session = A.sessionFor(ctx.store.get(), key);
  ui.openUid = firstIncomplete(session);
  ui.scroll = 0;
  setVisible(true);
  document.body.style.overflow = 'hidden';
  render();
}

export function closeWorkout() {
  ui.dateKey = null;
  setVisible(false);
  document.body.style.overflow = '';
  clear(root());
  ctx.refresh();
}

function firstIncomplete(session) {
  const e = (session.exercises || []).find((x) => !A.entryComplete(x) && !x.locked);
  return e ? e.uid : null;
}

function currentSession() {
  return A.sessionFor(ctx.store.get(), ui.dateKey);
}

function mutate(fn) {
  const body = root().querySelector('.workout-body');
  if (body) ui.scroll = body.scrollTop;
  ctx.store.update((s) => {
    const session = (s.sessions || []).find((x) => x.dateKey === ui.dateKey && x.mode === s.settings.mode);
    if (session) fn(s, session);
  });
  render();
}

// ------------------------------------------------------------------ render
export function render() {
  if (!ui.dateKey) return;
  const state = ctx.store.get();
  const session = currentSession();
  if (!session) { closeWorkout(); return; }
  const prog = A.sessionProgress(session);
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  const bar = el('div', { class: 'workout-bar' },
    el('button', { class: 'icon-btn', 'aria-label': 'Close workout', onclick: closeWorkout }, '⌄'),
    el('div', { class: 'grow' },
      el('h2', { class: 'truncate', text: session.title }),
      el('div', { class: 'tiny muted num', text: `${prog.done}/${prog.total} sets · ${relativeLabel(session.dateKey, ctx.today())}` })),
    el('button', { class: 'icon-btn', 'aria-label': 'Workout options', onclick: () => openSessionMenu(session) }, '⋯'));

  const body = el('div', { class: 'workout-body' },
    session.exercises.map((e) => renderExercise(state, session, e)),
    el('div', { style: 'margin-top:14px' },
      el('button', { class: 'btn btn-quiet', onclick: () => openAddSheet({ dateKey: ui.dateKey, allowScope: true }) }, 'Add exercise')),
    prog.done > 0 && !A.sessionComplete(session)
      ? el('div', { style: 'margin-top:8px' },
        el('button', { class: 'btn btn-quiet', onclick: () => finishEarly(session) }, 'Finish workout now'))
      : null,
    session.status === 'completed'
      ? el('p', { class: 'tiny faint', style: 'margin-top:14px', text: `Completed ${shortDate(session.dateKey)}. Edits here update the record.` })
      : null);

  // Reuse the shell on re-render so the open animation only plays once.
  let shell = root().querySelector('.workout');
  if (!shell) {
    shell = el('div', { class: 'workout' });
    mount(root(), shell);
  }
  mount(shell, bar, el('div', { class: 'progressbar' }, el('i', { style: `width:${pct}%` })), body);
  body.scrollTop = ui.scroll;
}

function renderExercise(state, session, e) {
  const open = ui.openUid === e.uid;
  const done = A.entryComplete(e);
  const last = A.lastPerformance(state, e.exerciseId, session.dateKey);
  const meta = el('div', { class: 'ex-meta' },
    el('span', null, el('b', { class: 'num', text: String(e.plannedSets) }), ' sets'),
    el('span', null, el('b', { class: 'num', text: rangeText(e) }), e.unit === 'reps' ? ' reps' : ` ${e.unit}`),
    e.increment || e.load ? el('span', null, el('b', { class: 'num', text: fmtLoad(e.load, e.loadConvention) }),
      e.loadConvention === 'per-hand' ? ' per hand' : e.loadConvention === 'stack' ? ' stack' : ' lb') : null,
    last ? el('span', { class: 'faint', text: `Last ${fmtLoad(last.topLoad, e.loadConvention)} × ${last.topReps}` }) : null);

  const head = el('div', { class: 'ex-head' },
    el('button', {
      class: 'grow', style: 'text-align:left;min-width:0',
      'aria-expanded': String(open),
      onclick: () => { ui.openUid = open ? null : e.uid; render(); },
    },
      el('div', { class: 'ex-name-row' },
        el('span', { class: 'ex-name', text: e.name }),
        e.priority && PRIORITY_LABELS[e.priority] ? el('span', { class: 'badge', text: 'Priority' }) : null,
        e.added ? el('span', { class: 'badge badge-quiet', text: 'Added' }) : null,
        e.locked ? el('span', { class: 'badge badge-quiet', text: 'Performed' }) : null),
      meta),
    done ? el('span', { class: 'ex-done-mark', text: '✓' }) : null,
    e.locked ? null : el('button', {
      class: 'icon-btn', 'aria-label': `Options for ${e.name}`,
      onclick: () => openExerciseMenu({ dateKey: ui.dateKey, entry: e, inWorkout: true }),
    }, '⋯'));

  const card = el('div', {
    class: 'ex',
    dataset: { open: String(open), done: String(done), anchor: String(!!e.isAnchor) },
  }, head);
  if (open) card.appendChild(renderExerciseBody(state, session, e));
  else if (done && ui.openUid === null) card.appendChild(nextCue(session, e));
  return card;
}

function nextCue(session, e) {
  const list = session.exercises;
  const i = list.indexOf(e);
  const next = list.slice(i + 1).find((x) => !A.entryComplete(x) && !x.locked);
  if (!next) return document.createComment('');
  return el('div', { class: 'next-cue' },
    el('span', { class: 'truncate', text: `Next: ${next.name}` }),
    el('button', { class: 'link', onclick: () => { ui.openUid = next.uid; render(); } }, 'Open'));
}

function renderExerciseBody(state, session, e) {
  const sug = (state.suggestions || {})[e.exerciseId];
  const rows = e.sets.map((set, i) => renderSetRow(e, set, i));

  return el('div', { class: 'ex-body' },
    el('div', null, rows),
    e.locked
      ? el('p', { class: 'tiny faint', style: 'margin-top:10px', text: 'These sets were performed on this movement before the swap.' })
      : e.isAnchor
        ? el('p', { class: 'bench', text: benchmarkText(e) })
        : el('p', { class: 'bench bench-quiet', text: 'Rotating slot — this movement changes next week. Work the rep range; the load is not the point here.' }),
    sug ? el('div', { class: 'suggest' },
      el('div', { class: 'suggest-text', text: `Suggestion: ${fmtLoad(sug.to, e.loadConvention)} next time` }),
      el('div', { class: 'btn-row', style: 'margin-top:8px' },
        el('button', {
          class: 'btn btn-sm btn-primary',
          onclick: () => mutate((s) => { A.acceptSuggestion(s, e.exerciseId); }),
        }, 'Accept'),
        el('button', {
          class: 'btn btn-sm btn-quiet',
          onclick: () => mutate((s) => { A.keepCurrentLoad(s, e.exerciseId); }),
        }, 'Keep current'))) : null,
    el('div', { class: 'ex-links' },
      el('button', { class: 'link', onclick: () => openExerciseProgress(e.exerciseId) }, 'History'),
      el('button', { class: 'link', onclick: () => openFamilySheet(state, e) }, 'Movement family'),
      e.restSec ? el('button', {
        class: 'link', onclick: () => startRest(e.restSec, 'Rest'),
      }, `Rest ${e.restSec}s`) : null));
}

function renderSetRow(e, set, i) {
  const unitShort = e.unit === 'yards' ? 'yd' : e.unit === 'seconds' ? 'sec' : 'reps';
  const loadBtn = el('button', {
    class: `field${set.load == null ? ' field-empty' : ''}`,
    'aria-label': `Load for set ${i + 1}`,
    onclick: () => openLoadPicker({
      entry: e, index: i, value: set.load, recommended: e.load,
      onSave: (v, applyRemaining) => mutate((s, session) => {
        A.patchSet(session, e.uid, i, { load: v }, { applyToRemaining: applyRemaining });
      }),
    }),
  }, el('span', { class: 'field-val', text: fmtLoad(set.load, e.loadConvention) }),
    el('span', { class: 'field-unit', text: e.loadConvention === 'stack' ? 'stack' : e.loadConvention === 'per-hand' ? 'each' : 'lb' }));

  const repField = (field, label) => el('button', {
    class: `field${set[field] == null ? ' field-empty' : ''}`,
    'aria-label': `${label} for set ${i + 1}`,
    onclick: () => openRepsPicker({
      entry: e, index: i, set,
      onSave: (patch, applyRemaining) => mutate((s, session) => {
        A.patchSet(session, e.uid, i, patch, { applyToRemaining: applyRemaining });
      }),
    }),
  }, el('span', { class: 'field-val', text: set[field] == null ? '–' : String(set[field]) }),
    el('span', { class: 'field-unit', text: label }));

  const tick = el('button', {
    class: 'tick', 'aria-label': set.done ? `Undo set ${i + 1}` : `Complete set ${i + 1}`,
    onclick: () => toggleSet(e, i, set),
  }, set.done ? '✓' : '○');

  return el('div', {
    class: `setrow${e.unilateral ? ' setrow-uni' : ''}`, dataset: { done: String(!!set.done) },
  },
    el('span', { class: 'set-i', text: String(i + 1) }),
    loadBtn,
    ...(e.unilateral ? [repField('repsL', 'L'), repField('repsR', 'R')] : [repField('reps', unitShort)]),
    tick);
}

function toggleSet(e, i, set) {
  const state = ctx.store.get();
  if (set.done) { mutate((s, session) => { A.uncompleteSet(session, e.uid, i); }); return; }
  const fallback = suggestedReps(e, i);
  const patch = {};
  if (set.load == null) patch.load = e.load;
  if (e.unilateral) {
    if (set.repsL == null) patch.repsL = fallback;
    if (set.repsR == null) patch.repsR = fallback;
  } else if (set.reps == null) patch.reps = fallback;

  mutate((s, session) => {
    A.completeSet(session, e.uid, i, patch);
    const entry = A.entryOf(session, e.uid);
    if (A.entryComplete(entry)) {
      const next = session.exercises.find((x) => !A.entryComplete(x) && !x.locked);
      ui.openUid = next ? next.uid : null;
    }
    if (A.sessionComplete(session) && session.status !== 'completed') {
      A.finishSession(s, session.id);
      setTimeout(() => openCompletionSheet(session.id), 220);
    }
  });

  if (state.settings.autoStartTimer && e.restSec) startRest(e.restSec, 'Rest');
}

// ------------------------------------------------------------------ sheets
function openFamilySheet(state, e) {
  const foundation = A.exerciseById(state, e.foundationId);
  openSheet({
    title: FAMILY_LABELS[e.family] || e.family,
    sub: `${e.group} · this slot rotates within one movement family`,
    build: () => el('div', null,
      el('div', { class: 'list' },
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: foundation ? foundation.name : '—' }),
            el('div', { class: 'list-sub', text: 'Foundation movement' })),
          e.isFoundation ? el('span', { class: 'badge badge-good', text: 'Today' }) : null),
        el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name', text: e.name }),
            el('div', { class: 'list-sub', text: e.isFoundation ? 'Foundation movement' : 'Planned variation' })),
          !e.isFoundation ? el('span', { class: 'badge badge-good', text: 'Today' }) : null)),
      el('p', { class: 'explainer', style: 'margin-top:12px' },
        'Roughly two weeks in three run the foundation movement so load progression stays comparable. The remaining weeks use a planned variation for the same muscles.'),
      el('div', { style: 'margin-top:12px' },
        el('button', { class: 'btn btn-quiet', onclick: () => openExerciseProgress(e.exerciseId) }, 'Open progression'))),
  });
}

function openSessionMenu(session) {
  menuSheet(session.title, [
    { label: 'Add exercise', onClick: () => openAddSheet({ dateKey: ui.dateKey }) },
    { label: 'Session notes', onClick: () => openNotesSheet(session) },
    A.sessionProgress(session).done > 0 && session.status !== 'completed'
      ? { label: 'Finish workout now', onClick: () => finishEarly(session) } : null,
    { label: 'Close workout', onClick: closeWorkout },
  ], `${shortDate(session.dateKey)} · ${A.sessionProgress(session).done}/${A.sessionProgress(session).total} sets`);
}

function openNotesSheet(session) {
  let text = session.notes || '';
  openSheet({
    title: 'Session notes', sub: 'Kept with this session in History.',
    build: ({ close }) => el('div', null,
      el('textarea', { class: 'input', placeholder: 'Anything worth remembering', oninput: (e) => { text = e.target.value; } }, text),
      el('div', { class: 'btn-row', style: 'margin-top:12px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', {
          class: 'btn btn-primary',
          onclick: () => { mutate((s) => { A.setSessionNotes(s, session.id, text); }); close(); },
        }, 'Save'))),
  });
}

async function finishEarly(session) {
  const ok = await confirmSheet({
    title: 'Finish this workout?',
    message: 'Sets you did not log stay unlogged. The session is saved either way.',
    confirm: 'Finish',
  });
  if (!ok) return;
  ctx.store.update((s) => { A.finishSession(s, session.id); });
  stopRest();
  openCompletionSheet(session.id);
}

export function openCompletionSheet(sessionId) {
  stopRest();
  const state = ctx.store.get();
  const session = (state.sessions || []).find((s) => s.id === sessionId);
  if (!session) return;
  const prog = A.sessionProgress(session);
  const earned = (session.exercises || [])
    .map((e) => ({ e, p: evaluateProgression(e) }))
    .filter((x) => x.p.earned);
  let notes = session.notes || '';

  openSheet({
    title: 'Workout logged',
    sub: `${session.title} · ${prog.done} sets`,
    build: ({ rerender, close }) => el('div', null,
      earned.length
        ? el('div', null,
          el('p', { class: 'section-title', text: 'Benchmarks met' }),
          el('div', { class: 'list' }, earned.map(({ e }) => {
            const sug = (ctx.store.get().suggestions || {})[e.exerciseId];
            return el('div', { class: 'list-row' },
              el('div', { class: 'list-row-main' },
                el('div', { class: 'list-name truncate', text: e.name }),
                el('div', { class: 'list-sub', text: sug ? `Suggestion: ${fmtLoad(sug.to, e.loadConvention)} next time` : 'Load updated' })),
              sug ? el('div', { class: 'row' },
                el('button', {
                  class: 'btn btn-sm btn-primary',
                  onclick: () => { ctx.store.update((s) => { A.acceptSuggestion(s, e.exerciseId); }); rerender(); },
                }, 'Accept'),
                el('button', {
                  class: 'btn btn-sm btn-quiet',
                  onclick: () => { ctx.store.update((s) => { A.keepCurrentLoad(s, e.exerciseId); }); rerender(); },
                }, 'Keep')) : null);
          })))
        : el('p', { class: 'small muted', text: 'No load benchmarks met today. Reps carry forward.' }),
      el('label', { class: 'field-label', style: 'margin-top:14px', text: 'Notes (optional)' }),
      el('textarea', { class: 'input', oninput: (e) => { notes = e.target.value; } }, notes),
      el('div', { style: 'margin-top:12px' },
        el('button', {
          class: 'btn btn-primary',
          onclick: () => {
            ctx.store.update((s) => { A.setSessionNotes(s, sessionId, notes); });
            close();
            closeWorkout();
          },
        }, 'Done'))),
  });
}
