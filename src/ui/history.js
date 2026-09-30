// History: completed sessions, per-exercise progression, weekly volume ledger.
import { el, openSheet, menuSheet, confirmSheet, toast, fmtLoad } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { historyFor, performedExercises, weeklyLedger, familyContext, weekStart } from '../core/volume.js';
import { kindOf, describe as describeConditioning, openConditioningSheet } from './conditioning.js';
import { trendOf, rangeText, effectiveReps } from '../core/progression.js';
import { shortDate, relativeLabel } from '../core/schedule.js';
import { FAMILY_LABELS, GROUPS } from '../data/library.js';
import { openLoadPicker, openRepsPicker } from './pickers.js';

const view = { tab: 'sessions', q: '' };

export function renderHistory() {
  const state = ctx.store.get();
  const sessions = [...(state.sessions || [])].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));

  const seg = el('div', { class: 'seg', role: 'tablist' },
    el('button', {
      role: 'tab', 'aria-pressed': String(view.tab === 'sessions'),
      onclick: () => { view.tab = 'sessions'; ctx.refresh(); },
    }, 'Sessions'),
    el('button', {
      role: 'tab', 'aria-pressed': String(view.tab === 'progress'),
      onclick: () => { view.tab = 'progress'; ctx.refresh(); },
    }, 'Exercise progression'));

  return el('div', null, seg,
    el('div', { style: 'margin-top:14px' },
      view.tab === 'sessions' ? sessionsView(state, sessions) : progressView(state)),
    el('section', { class: 'section', style: 'margin-top:24px' },
      el('div', { class: 'section-head' },
        el('h3', { class: 'section-title', text: 'This week’s sets' })),
      ledger(state)));
}

function sessionsView(state, sessions) {
  if (!sessions.length) {
    return el('p', { class: 'empty', text: 'Logged workouts appear here. Nothing yet.' });
  }
  return el('div', { class: 'list' }, sessions.map((s) => {
    const prog = A.sessionProgress(s);
    return el('button', { class: 'list-row', onclick: () => openSessionSheet(s.id) },
      el('div', { class: 'list-row-main' },
        el('div', { class: 'list-name truncate', text: s.title }),
        el('div', { class: 'list-sub', text: s.unlogged
          ? `${shortDate(s.dateKey)} · trained, not logged`
          : `${shortDate(s.dateKey)} · ${prog.done} sets${s.status === 'completed' ? '' : ' · unfinished'}` })),
      s.notes ? el('span', { class: 'badge badge-quiet', text: 'Note' }) : null,
      el('span', { class: 'caret', text: '›' }));
  }));
}

/** Names only: no loads or reps until an exercise is opened. */
function progressView(state) {
  const rows = performedExercises(state.sessions || []);
  if (!rows.length) return el('p', { class: 'empty', text: 'Log a workout and each exercise gets its own graph here.' });
  const q = view.q.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)) : rows;
  return el('div', null,
    el('input', {
      class: 'input', type: 'search', placeholder: 'Find an exercise', 'aria-label': 'Find an exercise',
      value: view.q, oninput: (e) => { view.q = e.target.value; ctx.refresh(); },
    }),
    el('div', { class: 'list', style: 'margin-top:10px' }, filtered.map((r) => el('button', {
      class: 'list-row', onclick: () => openExerciseProgress(r.exerciseId),
    },
      el('div', { class: 'list-row-main' },
        el('div', { class: 'list-name truncate', text: r.name })),
      el('span', { class: 'caret', text: '›' })))));
}

function ledger(state) {
  const l = weeklyLedger(state.sessions || [], ctx.today(), state.volumeTargets || {});
  const cond = A.weeklyConditioning(state, weekStart(ctx.today()));
  const rows = l.groups.filter((g) => g.group !== 'Power' && g.total > 0);

  const body = rows.length
    ? el('div', null, rows.map((g) => {
      const t = g.target;
      const scale = Math.max(t ? t.max : 0, g.total, 1);
      const pct = (v) => `${(v / scale) * 100}%`;
      const under = t && g.total < t.min;
      return el('div', { class: 'ledger-row' },
        el('span', { class: 'ledger-name truncate', text: g.group }),
        el('span', { class: 'ledger-bar' },
          el('i', { class: 'ledger-planned', style: `width:${pct(g.planned)}` }),
          el('i', { class: 'ledger-added', style: `width:${pct(g.added)}` }),
          el('i', { class: 'ledger-indirect', style: `width:${pct(g.indirect)}` }),
          t && t.min ? el('i', { class: 'ledger-tick', style: `left:${pct(t.min)}` }) : null),
        el('span', {
          class: `ledger-count${under ? ' ledger-under' : ''}`,
          text: t && t.max ? `${g.total} / ${t.min}\u2013${t.max}` : String(g.total),
        }));
    }))
    : el('p', { class: 'empty', text: 'No sets logged this week yet.' });

  return el('div', null,
    el('div', { class: 'chart-legend', style: 'margin-bottom:8px' },
      el('span', null, el('i', { class: 'swatch', style: 'background:var(--accent)' }), 'Planned'),
      el('span', null, el('i', { class: 'swatch', style: 'background:var(--accent-soft)' }), 'Added'),
      el('span', null, el('i', { class: 'swatch swatch-indirect' }), 'Indirect')),
    body,
    rows.length
      ? el('p', { class: 'tiny faint', style: 'margin-top:8px',
        text: `${l.planned} planned · ${l.added} added · indirect work counts half · week of ${shortDate(l.weekStart)}` })
      : null,
    el('button', {
      class: 'list-row', style: 'margin-top:10px',
      onclick: () => openConditioningSheet(ctx.today()),
    },
      el('div', { class: 'list-row-main' },
        el('div', { class: 'list-name', text: 'Conditioning this week' }),
        el('div', { class: 'list-sub', text: cond.sessions
          ? cond.kinds.map((k) => `${kindOf(k.kind).label} ${k.distance ? k.distance + ' ' + k.unit : ''} ${k.minutes ? k.minutes + ' min' : ''}`.trim()).join(' · ')
          : 'Nothing logged' })),
      el('span', { class: 'caret', text: '›' })));
}

// ------------------------------------------------------------------- charts
function lineChart(points, pick, { label }) {
  const w = 300, h = 168, padL = 30, padR = 8, padT = 12, padB = 22;
  const vals = points.map(pick);
  const min = Math.min(...vals), max = Math.max(...vals);
  const lo = min === max ? Math.max(0, min - 5) : min - (max - min) * 0.15;
  const hi = min === max ? max + 5 : max + (max - min) * 0.15;
  const x = (i) => padL + (points.length === 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (points.length - 1));
  const y = (v) => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo || 1));

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${h - padB} L${x(0).toFixed(1)},${h - padB} Z`;
  const svgNS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('class', 'chart');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `${label}: ${vals.join(', ')}`);
  const ticks = [hi, (hi + lo) / 2, lo];
  s.innerHTML = [
    ...ticks.map((t) => `<line class="chart-grid" x1="${padL}" x2="${w - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>`),
    ...ticks.map((t) => `<text class="chart-axis" x="2" y="${(y(t) + 3).toFixed(1)}">${Math.round(t)}</text>`),
    points.length > 1 ? `<path class="chart-area" d="${area}"/>` : '',
    points.length > 1 ? `<path class="chart-line" d="${d}"/>` : '',
    ...points.map((p, i) => `<circle class="chart-dot" cx="${x(i).toFixed(1)}" cy="${y(pick(p)).toFixed(1)}" r="3"/>`),
    `<text class="chart-axis" x="${padL}" y="${h - 6}">${points[0].date.slice(5)}</text>`,
    points.length > 1 ? `<text class="chart-axis" x="${w - padR}" y="${h - 6}" text-anchor="end">${points[points.length - 1].date.slice(5)}</text>` : '',
  ].join('');
  return s;
}

export function openExerciseProgress(exerciseId) {
  const metric = { key: 'topLoad' };
  openSheet({
    title: '',
    build: ({ rerender }) => {
      const state = ctx.store.get();
      const ex = A.exerciseById(state, exerciseId);
      const pts = historyFor(state.sessions || [], exerciseId);
      const name = ex ? ex.name : (pts[0] && pts[0].name) || exerciseId;
      if (!pts.length) {
        return el('div', null,
          el('h3', { text: name }),
          el('p', { class: 'sheet-sub', text: ex ? `${ex.group} · ${ex.equipment}` : '' }),
          el('p', { class: 'empty', text: 'No sets logged for this movement yet. Its graph starts with the first logged set.' }),
          el('div', { class: 'list' },
            el('div', { class: 'list-row' },
              el('div', { class: 'list-row-main' },
                el('div', { class: 'list-name', text: 'Current load' }),
                el('div', { class: 'list-sub', text: (state.loads[exerciseId] || {}).established ? 'Established' : 'Estimate until confirmed once' })),
              el('div', { class: 'list-right num', text: fmtLoad(A.loadFor(state, exerciseId), ex && ex.loadConvention) }))));
      }
      const last = pts[pts.length - 1];
      const trend = trendOf(pts);
      const ctxFam = familyContext(state.sessions || [], last.family, exerciseId);
      const picker = metric.key === 'topLoad' ? (p) => p.topLoad
        : metric.key === 'topReps' ? (p) => p.topReps : (p) => p.sets;

      return el('div', null,
        el('h3', { text: name }),
        el('p', { class: 'sheet-sub', text: `${ex ? ex.group : ''} · ${FAMILY_LABELS[last.family] || last.family}` }),
        el('div', { class: 'seg', style: 'margin-bottom:10px' },
          ...[['topLoad', 'Load'], ['topReps', 'Reps'], ['sets', 'Sets']].map(([k, lab]) => el('button', {
            'aria-pressed': String(metric.key === k), onclick: () => { metric.key = k; rerender(); },
          }, lab))),
        lineChart(pts, picker, { label: `${name} ${metric.key}` }),
        el('div', { class: 'row', style: 'gap:8px;margin:6px 0 12px;flex-wrap:wrap' },
          el('span', { class: 'badge badge-quiet', text: last.isFoundation ? 'Anchor lift' : 'Rotating movement' }),
          el('span', {
            class: `badge ${trend === 'progressing' ? 'badge-good' : 'badge-quiet'}`,
            text: `Trend: ${trend}`,
          }),
          el('span', { class: 'badge badge-quiet', text: `${pts.length} session${pts.length > 1 ? 's' : ''}` })),
        el('div', { class: 'list' }, [...pts].reverse().slice(0, 12).map((p) => el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name num', text: `${fmtLoad(p.topLoad, ex && ex.loadConvention)} × ${p.topReps}` }),
            el('div', { class: 'list-sub', text: `${shortDate(p.date)} · ${p.sets} set${p.sets > 1 ? 's' : ''}` })),
          el('div', { class: 'list-right num', text: `${Math.round(p.volume)}` })))),
        el('p', { class: 'tiny faint', style: 'margin-top:6px', text: 'Right column is set volume (reps × load).' }),
        ctxFam.siblings.length
          ? el('div', { style: 'margin-top:16px' },
            el('p', { class: 'section-title', text: 'Same movement family' }),
            el('div', { class: 'list' }, ctxFam.siblings.map((r) => el('button', {
              class: 'list-row', onclick: () => openExerciseProgress(r.exerciseId),
            },
              el('div', { class: 'list-row-main' },
                el('div', { class: 'list-name truncate', text: r.name }),
                el('div', { class: 'list-sub', text: r.isFoundation ? 'Anchor' : 'Rotating' })),
              el('span', { class: 'caret', text: '›' })))))
          : null);
    },
  });
}

// ------------------------------------------------------------ session editing
export function openSessionSheet(sessionId) {
  const open = { uid: null };
  openSheet({
    title: '',
    build: ({ rerender, close }) => {
      const state = ctx.store.get();
      const s = (state.sessions || []).find((x) => x.id === sessionId);
      if (!s) { return el('p', { class: 'empty', text: 'Session not found.' }); }
      const prog = A.sessionProgress(s);
      return el('div', null,
        el('h3', { text: s.title }),
        el('p', { class: 'sheet-sub', text: s.unlogged
          ? `${shortDate(s.dateKey)} · trained, not logged set by set`
          : `${shortDate(s.dateKey)} · ${prog.done} sets logged${s.status === 'completed' ? '' : ' · unfinished'}` }),
        s.unlogged
          ? el('p', { class: 'explainer', style: 'margin-bottom:12px',
            text: 'This session was recorded as done without set data, so it contributes nothing to weekly volume or progression.' })
          : null,
        el('div', null, s.exercises.map((e) => {
          const isOpen = open.uid === e.uid;
          return el('div', { class: 'ex', dataset: { open: String(isOpen) } },
            el('div', { class: 'ex-head' },
              el('button', {
                class: 'grow', style: 'text-align:left;min-width:0',
                onclick: () => { open.uid = isOpen ? null : e.uid; rerender(); },
              },
                el('div', { class: 'ex-name-row' },
                  el('span', { class: 'ex-name', text: e.name }),
                  e.added ? el('span', { class: 'badge badge-quiet', text: 'Added' }) : null,
                  e.corrected ? el('span', { class: 'badge badge-quiet', text: 'Corrected' }) : null),
                el('div', { class: 'ex-meta' },
                  el('span', null, el('b', { class: 'num', text: String((e.sets || []).filter((x) => x.done).length) }), ' sets'),
                  el('span', { class: 'faint', text: rangeText(e) + ' target' }))),
              el('button', {
                class: 'icon-btn', 'aria-label': `Correct ${e.name}`,
                onclick: () => openCorrectionMenu(s, e, rerender),
              }, '⋯')),
            isOpen ? el('div', { class: 'ex-body' }, (e.sets || []).map((set, i) => el('div', {
              class: `setrow${e.unilateral ? ' setrow-uni' : ''}`, dataset: { done: String(!!set.done) },
            },
              el('span', { class: 'set-i', text: String(i + 1) }),
              el('button', {
                class: 'field', 'aria-label': `Edit load for set ${i + 1}`,
                onclick: () => openLoadPicker({
                  entry: e, index: i, value: set.load, recommended: set.load || e.load,
                  onSave: (v, rest) => {
                    ctx.store.update((st) => {
                      A.editPastSet(st, s.id, e.uid, i, { load: v });
                      if (rest) for (let j = i + 1; j < e.sets.length; j++) A.editPastSet(st, s.id, e.uid, j, { load: v });
                    });
                    rerender(); ctx.refresh();
                  },
                }),
              }, el('span', { class: 'field-val', text: fmtLoad(set.load, e.loadConvention) }),
                el('span', { class: 'field-unit', text: 'lb' })),
              ...(e.unilateral ? ['repsL', 'repsR'] : ['reps']).map((f) => el('button', {
                class: 'field', 'aria-label': `Edit ${f} for set ${i + 1}`,
                onclick: () => openRepsPicker({
                  entry: e, index: i, set,
                  onSave: (patch) => {
                    ctx.store.update((st) => { A.editPastSet(st, s.id, e.uid, i, patch); });
                    rerender(); ctx.refresh();
                  },
                }),
              }, el('span', { class: 'field-val', text: set[f] == null ? '–' : String(set[f]) }),
                el('span', { class: 'field-unit', text: e.unilateral ? f.slice(-1) : 'reps' }))),
              el('button', {
                class: 'tick', 'aria-label': set.done ? 'Mark not performed' : 'Mark performed',
                onclick: () => {
                  ctx.store.update((st) => { A.editPastSet(st, s.id, e.uid, i, { done: !set.done }); });
                  rerender(); ctx.refresh();
                },
              }, set.done ? '✓' : '○'))),
              el('div', { class: 'btn-row', style: 'margin-top:10px' },
                el('button', {
                  class: 'btn btn-sm btn-quiet',
                  onclick: () => { ctx.store.update((st) => { A.addPastSet(st, s.id, e.uid); }); rerender(); ctx.refresh(); },
                }, 'Add set'),
                (e.sets || []).length > 1 ? el('button', {
                  class: 'btn btn-sm btn-quiet',
                  onclick: () => { ctx.store.update((st) => { A.removePastSet(st, s.id, e.uid, e.sets.length - 1); }); rerender(); ctx.refresh(); },
                }, 'Remove last set') : null)) : null);
        })),
        el('label', { class: 'field-label', style: 'margin-top:14px', text: 'Notes' }),
        el('textarea', {
          class: 'input',
          oninput: (ev) => { ctx.store.update((st) => { A.setSessionNotes(st, s.id, ev.target.value); }); },
        }, s.notes || ''),
        el('div', { class: 'btn-row', style: 'margin-top:14px' },
          el('button', { class: 'btn btn-quiet', onclick: () => { close(); ctx.refresh(); } }, 'Close'),
          el('button', {
            class: 'btn btn-danger',
            onclick: async () => {
              const ok = await confirmSheet({
                title: 'Delete this session?',
                message: 'The logged sets are removed from history. This cannot be undone.',
                confirm: 'Delete', danger: true,
              });
              if (!ok) return;
              ctx.store.update((st) => { A.deleteSession(st, s.id); });
              close(); ctx.refresh(); toast('Session deleted');
            },
          }, 'Delete')));
    },
  });
}

function openCorrectionMenu(session, entry, rerender) {
  menuSheet(entry.name, [
    {
      label: 'This was a different exercise',
      note: 'Corrects the identity while keeping the logged sets',
      onClick: () => openReassignSheet(session, entry, rerender),
    },
    {
      label: 'Open progression for this exercise',
      onClick: () => openExerciseProgress(entry.exerciseId),
    },
  ], shortDate(session.dateKey));
}

function openReassignSheet(session, entry, rerender) {
  const search = { q: '', group: null };
  openSheet({
    title: 'What was actually performed?',
    sub: `Replacing the record of ${entry.name} on ${shortDate(session.dateKey)}`,
    build: ({ rerender: re, close }) => {
      const state = ctx.store.get();
      return el('div', null,
        el('input', {
          class: 'input', type: 'search', placeholder: 'Search exercises', value: search.q,
          oninput: (e) => { search.q = e.target.value; re(); },
        }),
        el('div', { class: 'chips', style: 'margin:8px 0' },
          [null, ...GROUPS].map((g) => el('button', {
            class: 'chip-btn chip-word', 'aria-pressed': String(search.group === g),
            onclick: () => { search.group = g; re(); },
          }, g || 'All'))),
        el('div', { class: 'list' },
          A.searchLibrary(state, search.q, { group: search.group, excludeIds: [entry.exerciseId] })
            .slice(0, 50).map((ex) => el('button', {
              class: 'list-row',
              onclick: () => {
                ctx.store.update((st) => { A.reassignPastExercise(st, session.id, entry.uid, ex.id); });
                close(); rerender(); ctx.refresh(); toast('Record corrected');
              },
            },
              el('div', { class: 'list-row-main' },
                el('div', { class: 'list-name', text: ex.name }),
                el('div', { class: 'list-sub', text: `${ex.group} · ${ex.equipment}` })),
              el('span', { class: 'caret', text: '›' })))));
    },
  });
}
