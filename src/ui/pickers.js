// Load / reps pickers, swap and add sheets, and the per-exercise three-dot menu.
import { el, openSheet, menuSheet, confirmSheet, scopeSheet, toast, fmtLoad } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { LOAD_CONVENTION_LABELS, PRIORITY_LABELS, GROUPS, FAMILY_LABELS } from '../data/library.js';
import { FIT_LABELS } from '../core/store.js';
import { rangeText } from '../core/progression.js';

const laterOpenSets = (entry, index) =>
  (entry.sets || []).slice(index + 1).filter((s) => !s.done).length;

function applyRemainingRow(entry, index, state) {
  const n = laterOpenSets(entry, index);
  if (!n) return null;
  const label = `Also apply to the ${n} remaining set${n > 1 ? 's' : ''}`;
  const input = el('input', {
    type: 'checkbox', id: 'apply-rest', 'aria-label': label,
    checked: state.applyRemaining ? true : null,
    onchange: (e) => { state.applyRemaining = e.target.checked; },
  });
  return el('label', { class: 'apply-remaining', for: 'apply-rest' }, input, el('span', { text: label }));
}

// ------------------------------------------------------------------- load
export function openLoadPicker({ entry, index, value, recommended, lastLoad = null, onSave }) {
  const inc = entry.increment || 5;
  const state = { value: Number(value ?? recommended ?? 0), applyRemaining: false };
  const conv = LOAD_CONVENTION_LABELS[entry.loadConvention] || '';

  openSheet({
    title: entry.name,
    sub: `Load for set ${index + 1} · ${conv}`,
    build: ({ rerender, close }) => {
      const chips = [-2, -1, 0, 1, 2].map((k) => {
        const v = Math.max(0, Number(recommended || 0) + k * inc);
        return el('button', {
          class: 'chip-btn', 'aria-pressed': String(v === state.value),
          onclick: () => { state.value = v; rerender(); },
        }, k === 0 ? `${fmtLoad(v, entry.loadConvention)} ·` : fmtLoad(v, entry.loadConvention));
      });
      const lastChip = lastLoad != null && Number(lastLoad) !== Number(recommended)
        ? el('button', {
          class: 'chip-btn', 'aria-pressed': String(Number(lastLoad) === state.value),
          onclick: () => { state.value = Number(lastLoad); rerender(); },
        }, `Last ${fmtLoad(lastLoad, entry.loadConvention)}`)
        : null;
      return el('div', null,
        el('div', { class: 'picker-value' },
          el('div', { class: 'picker-num', text: fmtLoad(state.value, entry.loadConvention) }),
          el('div', { class: 'picker-unit', text: entry.loadConvention === 'stack' ? 'stack' : 'lb' })),
        el('div', { class: 'stepper' },
          el('button', { class: 'btn', 'aria-label': `Minus ${inc}`, onclick: () => { state.value = Math.max(0, state.value - inc); rerender(); } }, '−'),
          el('input', {
            class: 'input num', type: 'number', inputmode: 'decimal', step: String(inc),
            value: String(state.value), 'aria-label': 'Load',
            style: 'text-align:center',
            oninput: (e) => { state.value = Number(e.target.value || 0); },
          }),
          el('button', { class: 'btn', 'aria-label': `Plus ${inc}`, onclick: () => { state.value += inc; rerender(); } }, '+')),
        el('div', { class: 'chips', style: 'margin-top:12px' }, chips, lastChip),
        el('p', { class: 'tiny faint', style: 'margin:8px 0 0' },
          `Recommended ${fmtLoad(recommended, entry.loadConvention)} · steps of ${inc}`),
        applyRemainingRow(entry, index, state),
        el('div', { class: 'btn-row', style: 'margin-top:14px' },
          el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
          el('button', {
            class: 'btn btn-primary',
            onclick: () => { close(); onSave(state.value, state.applyRemaining); },
          }, 'Save')));
    },
  });
}

// ------------------------------------------------------------------- reps
export function openRepsPicker({ entry, index, set, onSave }) {
  const state = {
    reps: set.reps ?? null,
    repsL: set.repsL ?? null,
    repsR: set.repsR ?? null,
    applyRemaining: false,
  };
  const lo = Math.max(1, entry.repMin - 2);
  const hi = entry.repMax + 3;
  const nums = [];
  for (let n = lo; n <= hi; n++) nums.push(n);
  const unitWord = entry.unit === 'yards' ? 'yards' : entry.unit === 'seconds' ? 'seconds' : 'reps';

  openSheet({
    title: entry.name,
    sub: `Set ${index + 1} · target ${rangeText(entry)} ${unitWord}`,
    build: ({ rerender, close }) => {
      const pad = (field) => el('div', { class: 'numpad' }, nums.map((n) => el('button', {
        class: 'chip-btn', 'aria-pressed': String(state[field] === n),
        onclick: () => { state[field] = n; rerender(); },
      }, String(n))));
      return el('div', null,
        entry.unilateral
          ? el('div', null,
            el('p', { class: 'field-label', text: 'Left' }), pad('repsL'),
            el('p', { class: 'field-label', style: 'margin-top:12px', text: 'Right' }), pad('repsR'),
            el('p', { class: 'tiny faint', style: 'margin:10px 0 0', text: 'Progression is judged on the weaker side.' }))
          : el('div', null,
            el('div', { class: 'picker-value' },
              el('div', { class: 'picker-num', text: state.reps == null ? '—' : String(state.reps) }),
              el('div', { class: 'picker-unit', text: unitWord })),
            pad('reps')),
        applyRemainingRow(entry, index, state),
        el('div', { class: 'btn-row', style: 'margin-top:14px' },
          el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
          el('button', {
            class: 'btn btn-primary',
            onclick: () => {
              close();
              onSave(entry.unilateral
                ? { repsL: state.repsL, repsR: state.repsR }
                : { reps: state.reps }, state.applyRemaining);
            },
          }, 'Save')));
    },
  });
}

// ------------------------------------------------------------------- swap
function exerciseRow(ex, { note, onClick, right }) {
  return el('button', { class: 'list-row', onclick: onClick },
    el('div', { class: 'list-row-main' },
      el('div', { class: 'list-name', text: ex.name }),
      el('div', { class: 'list-sub', text: note || `${ex.group} · ${ex.equipment}` })),
    right || null,
    el('span', { class: 'caret', text: '›' }));
}

export function openSwapSheet({ dateKey, entry, allowScope = true }) {
  const state = ctx.store.get();
  const plan = A.planFor(state, dateKey);
  const present = (plan.exercises || []).map((e) => e.exerciseId);
  const recs = A.swapCandidates(state, entry, present);
  const search = { q: '', group: null };

  const doSwap = async (exId) => {
    let scope = 'today';
    if (allowScope) {
      scope = await scopeSheet({
        title: 'Swap this exercise',
        todayLabel: 'This workout only',
        futureLabel: 'Make it the new foundation',
        note: 'Keep the change on this date, or make it the programmed movement for this slot from now on?',
      });
      if (!scope) return;
    }
    ctx.store.update((s) => { A.swapExercise(s, dateKey, entry.uid, exId, scope); });
    ctx.refresh();
    toast(scope === 'future' ? 'Swapped and updated the plan' : 'Swapped for this workout');
  };

  openSheet({
    title: 'Swap exercise',
    sub: `Replacing ${entry.name} · ${FAMILY_LABELS[entry.family] || entry.family}`,
    build: ({ rerender, close }) => el('div', null,
      el('p', { class: 'section-title', text: 'Recommended' }),
      el('div', { class: 'list' }, recs.length
        ? recs.map(({ ex, inWorkout }) => exerciseRow(ex, {
          note: `${ex.group} · ${ex.equipment}${inWorkout ? ' · already in this workout' : ''}`,
          right: ex.id === entry.foundationId ? el('span', { class: 'badge badge-quiet', text: 'Foundation' }) : null,
          onClick: () => { close(); doSwap(ex.id); },
        }))
        : el('p', { class: 'empty', text: 'No close match in the library.' })),
      el('p', { class: 'section-title', style: 'margin-top:18px', text: 'Full library' }),
      el('input', {
        class: 'input', type: 'search', placeholder: 'Search exercises', 'aria-label': 'Search exercises',
        value: search.q, oninput: (e) => { search.q = e.target.value; rerender(); },
      }),
      el('div', { class: 'chips', style: 'margin:8px 0' },
        [null, ...GROUPS].map((g) => el('button', {
          class: 'chip-btn chip-word', 'aria-pressed': String(search.group === g),
          onclick: () => { search.group = g; rerender(); },
        }, g || 'All'))),
      el('div', { class: 'list' },
        A.searchLibrary(state, search.q, { group: search.group, excludeIds: [entry.exerciseId] })
          .slice(0, 60)
          .map((ex) => exerciseRow(ex, { onClick: () => { close(); doSwap(ex.id); } }))),
      el('div', { style: 'margin-top:14px' },
        el('button', {
          class: 'btn btn-quiet', onclick: () => { close(); openCustomExerciseSheet((ex) => doSwap(ex.id)); },
        }, 'Create a custom exercise'))),
  });
}

// ------------------------------------------------------------------- add
export function openAddSheet({ dateKey, allowScope = true }) {
  const state = ctx.store.get();
  const plan = A.planFor(state, dateKey);
  const present = (plan.exercises || []).map((e) => e.exerciseId);
  const recs = A.addCandidates(state, dateKey);
  const search = { q: '', group: null };

  const doAdd = async (exId) => {
    let scope = 'today';
    if (allowScope) {
      scope = await scopeSheet({
        title: 'Add this exercise',
        todayLabel: 'This workout only',
        futureLabel: 'Add it to the weekly plan',
      });
      if (!scope) return;
    }
    ctx.store.update((s) => { A.addExercise(s, dateKey, exId, scope); });
    ctx.refresh();
    toast(scope === 'future' ? 'Added to the plan' : 'Added to this workout');
  };

  openSheet({
    title: 'Add exercise',
    sub: 'Movements for the muscle groups already trained today come first.',
    build: ({ rerender, close }) => el('div', null,
      el('p', { class: 'section-title', text: 'Recommended today' }),
      el('div', { class: 'list' }, recs.length
        ? recs.map(({ ex }) => exerciseRow(ex, {
          note: `${ex.group} · ${ex.equipment}`,
          right: (ex.tags || []).length ? el('span', { class: 'badge', text: PRIORITY_LABELS[ex.tags[0]] || '' }) : null,
          onClick: () => { close(); doAdd(ex.id); },
        }))
        : el('p', { class: 'empty', text: 'Nothing else fits today’s muscle groups.' })),
      el('p', { class: 'section-title', style: 'margin-top:18px', text: 'Full library' }),
      el('input', {
        class: 'input', type: 'search', placeholder: 'Search exercises', 'aria-label': 'Search exercises',
        value: search.q, oninput: (e) => { search.q = e.target.value; rerender(); },
      }),
      el('div', { class: 'chips', style: 'margin:8px 0' },
        [null, ...GROUPS].map((g) => el('button', {
          class: 'chip-btn chip-word', 'aria-pressed': String(search.group === g),
          onclick: () => { search.group = g; rerender(); },
        }, g || 'All'))),
      el('div', { class: 'list' },
        A.searchLibrary(state, search.q, { group: search.group, excludeIds: present })
          .slice(0, 60)
          .map((ex) => exerciseRow(ex, { onClick: () => { close(); doAdd(ex.id); } }))),
      el('div', { style: 'margin-top:14px' },
        el('button', {
          class: 'btn btn-quiet', onclick: () => { close(); openCustomExerciseSheet((ex) => doAdd(ex.id)); },
        }, 'Create a custom exercise'))),
  });
}

// --------------------------------------------------------- custom exercise
export function openCustomExerciseSheet(onCreated) {
  const draft = {
    name: '', group: 'Chest', family: 'incline-press', equipment: '',
    loadConvention: 'total', increment: 5, defaultLoad: 0, unilateral: false,
  };
  openSheet({
    title: 'Custom exercise',
    sub: 'For equipment the approved library does not cover.',
    build: ({ close }) => el('div', null,
      el('label', { class: 'field-label', text: 'Name' }),
      el('input', { class: 'input', placeholder: 'e.g. Incline press (home rack)', oninput: (e) => { draft.name = e.target.value; } }),
      el('div', { class: 'form-grid', style: 'margin-top:10px' },
        el('div', null, el('label', { class: 'field-label', text: 'Muscle group' }),
          el('select', { class: 'input', onchange: (e) => { draft.group = e.target.value; } },
            GROUPS.map((g) => el('option', { value: g, text: g })))),
        el('div', null, el('label', { class: 'field-label', text: 'Movement family' }),
          el('select', { class: 'input', onchange: (e) => { draft.family = e.target.value; } },
            Object.entries(FAMILY_LABELS).map(([k, v]) => el('option', { value: k, text: v })))),
        el('div', null, el('label', { class: 'field-label', text: 'Equipment' }),
          el('input', { class: 'input', placeholder: 'Machine, dumbbells…', oninput: (e) => { draft.equipment = e.target.value; } })),
        el('div', null, el('label', { class: 'field-label', text: 'Load reads as' }),
          el('select', { class: 'input', onchange: (e) => { draft.loadConvention = e.target.value; } },
            Object.entries(LOAD_CONVENTION_LABELS).map(([k, v]) => el('option', { value: k, text: v })))),
        el('div', null, el('label', { class: 'field-label', text: 'Increment (lb)' }),
          el('input', { class: 'input num', type: 'number', inputmode: 'decimal', value: '5', oninput: (e) => { draft.increment = Number(e.target.value || 5); } })),
        el('div', null, el('label', { class: 'field-label', text: 'Starting load' }),
          el('input', { class: 'input num', type: 'number', inputmode: 'decimal', value: '0', oninput: (e) => { draft.defaultLoad = Number(e.target.value || 0); } }))),
      el('label', { class: 'apply-remaining', style: 'margin-top:10px' },
        el('input', { type: 'checkbox', onchange: (e) => { draft.unilateral = e.target.checked; } }),
        el('span', { text: 'One side at a time (track left and right)' })),
      el('div', { class: 'btn-row', style: 'margin-top:14px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', {
          class: 'btn btn-primary',
          onclick: () => {
            if (!draft.name.trim()) { toast('Give the exercise a name'); return; }
            let created = null;
            ctx.store.update((s) => { created = A.createCustomExercise(s, draft); });
            close();
            toast('Custom exercise saved');
            if (onCreated && created) onCreated(created);
            ctx.refresh();
          },
        }, 'Save exercise'))),
  });
}

// ------------------------------------------------- small numeric edit sheets
function numberSheet({ title, sub, label, value, min, max, step = 1, onSave }) {
  const state = { v: Number(value) };
  openSheet({
    title, sub,
    build: ({ rerender, close }) => el('div', null,
      el('div', { class: 'picker-value' },
        el('div', { class: 'picker-num', text: String(state.v) }),
        el('div', { class: 'picker-unit', text: label })),
      el('div', { class: 'stepper' },
        el('button', { class: 'btn', onclick: () => { state.v = Math.max(min, state.v - step); rerender(); } }, '−'),
        el('input', {
          class: 'input num', type: 'number', inputmode: 'numeric', value: String(state.v),
          style: 'text-align:center', oninput: (e) => { state.v = Number(e.target.value || 0); },
        }),
        el('button', { class: 'btn', onclick: () => { state.v = Math.min(max, state.v + step); rerender(); } }, '+')),
      el('div', { class: 'btn-row', style: 'margin-top:14px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => { close(); onSave(state.v); } }, 'Save'))),
  });
}

async function askScope(title) {
  const scope = await scopeSheet({ title, todayLabel: 'This workout only', futureLabel: 'Every week from now on' });
  return scope;
}

export function openExerciseMenu({ dateKey, entry, inWorkout = false }) {
  const rerun = () => { ctx.refresh(); };
  menuSheet(entry.name, [
    { label: 'Swap exercise', note: 'Recommended alternatives first', onClick: () => openSwapSheet({ dateKey, entry }) },
    {
      label: 'Edit sets', note: `${entry.plannedSets} planned`,
      onClick: () => numberSheet({
        title: 'Sets', sub: entry.name, label: 'sets', value: entry.plannedSets, min: 1, max: 12,
        onSave: async (v) => {
          const scope = await askScope('Change sets');
          if (!scope) return;
          ctx.store.update((s) => { A.editEntry(s, dateKey, entry.uid, { plannedSets: v }, scope); });
          rerun();
        },
      }),
    },
    {
      label: 'Edit rep range', note: `${rangeText(entry)} reps`,
      onClick: () => openSheet({
        title: 'Rep range', sub: entry.name,
        build: ({ close }) => {
          const st = { min: entry.repMin, max: entry.repMax };
          return el('div', null,
            el('div', { class: 'form-grid' },
              el('div', null, el('label', { class: 'field-label', text: 'Minimum' }),
                el('input', { class: 'input num', type: 'number', inputmode: 'numeric', value: String(st.min), oninput: (e) => { st.min = Number(e.target.value || 1); } })),
              el('div', null, el('label', { class: 'field-label', text: 'Maximum' }),
                el('input', { class: 'input num', type: 'number', inputmode: 'numeric', value: String(st.max), oninput: (e) => { st.max = Number(e.target.value || 1); } }))),
            el('p', { class: 'tiny faint', style: 'margin-top:8px', text: 'The top of the range is the benchmark that earns a load increase.' }),
            el('div', { class: 'btn-row', style: 'margin-top:14px' },
              el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
              el('button', {
                class: 'btn btn-primary',
                onclick: async () => {
                  close();
                  const scope = await askScope('Change rep range');
                  if (!scope) return;
                  ctx.store.update((s) => { A.editEntry(s, dateKey, entry.uid, { repMin: st.min, repMax: st.max }, scope); });
                  rerun();
                },
              }, 'Save')));
        },
      }),
    },
    {
      label: 'Edit current load', note: `${fmtLoad(entry.load, entry.loadConvention)} · baseline`,
      onClick: () => openBaselineSheet(entry),
    },
    {
      label: 'Edit rest', note: `${Math.round(entry.restSec / 15) * 15}s`,
      onClick: () => numberSheet({
        title: 'Rest', sub: entry.name, label: 'seconds', value: entry.restSec, min: 0, max: 600, step: 15,
        onSave: async (v) => {
          const scope = await askScope('Change rest');
          if (!scope) return;
          ctx.store.update((s) => { A.editEntry(s, dateKey, entry.uid, { restSec: v }, scope); });
          rerun();
        },
      }),
    },
    { label: 'Add another exercise', onClick: () => openAddSheet({ dateKey }) },
    {
      label: 'Duplicate exercise',
      onClick: () => { ctx.store.update((s) => { A.duplicateExercise(s, dateKey, entry.uid, 'today'); }); rerun(); toast('Duplicated for this workout'); },
    },
    {
      label: inWorkout ? 'Delete from this workout' : 'Remove from today', danger: true,
      note: 'Today only — the weekly plan is untouched',
      onClick: async () => {
        const ok = await confirmSheet({
          title: 'Remove exercise?', message: `${entry.name} will be removed from this workout only.`,
          confirm: 'Remove', danger: true,
        });
        if (!ok) return;
        ctx.store.update((s) => { A.removeExercise(s, dateKey, entry.uid, 'today'); });
        rerun();
      },
    },
  ], `${entry.group} · ${FAMILY_LABELS[entry.family] || entry.family}`);
}

export function openBaselineSheet(entry) {
  const state = ctx.store.get();
  const rec = state.loads[entry.exerciseId] || {};
  const st = { load: A.loadFor(state, entry.exerciseId), increment: A.incrementFor(state, entry.exerciseId) };
  openSheet({
    title: 'Current load', sub: `${entry.name} · ${LOAD_CONVENTION_LABELS[entry.loadConvention] || ''}`,
    build: ({ close }) => el('div', null,
      el('div', { class: 'form-grid' },
        el('div', null, el('label', { class: 'field-label', text: 'Working load' }),
          el('input', { class: 'input num', type: 'number', inputmode: 'decimal', value: String(st.load), oninput: (e) => { st.load = Number(e.target.value || 0); } })),
        el('div', null, el('label', { class: 'field-label', text: 'Increment' }),
          el('input', { class: 'input num', type: 'number', inputmode: 'decimal', value: String(st.increment), oninput: (e) => { st.increment = Number(e.target.value || 0); } }))),
      el('p', { class: 'tiny faint', style: 'margin-top:8px' },
        rec.established ? 'Baseline established. Editing it sets the load used for future sessions.'
          : 'No history yet, so this is an estimate. Set it once and progression takes over.'),
      el('div', { class: 'btn-row', style: 'margin-top:14px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', {
          class: 'btn btn-primary',
          onclick: () => {
            ctx.store.update((s) => { A.setBaseline(s, entry.exerciseId, st.load, st.increment); });
            close(); ctx.refresh(); toast('Baseline saved');
          },
        }, 'Save'))),
  });
}

export function openFitSheet(exercise) {
  const current = (ctx.store.get().profile.fit || {})[exercise.id] || 'neutral';
  menuSheet(exercise.name, Object.entries(FIT_LABELS).map(([k, label]) => ({
    label: `${label}${k === current ? '  ·' : ''}`,
    onClick: () => {
      ctx.store.update((s) => { s.profile.fit = { ...(s.profile.fit || {}), [exercise.id]: k }; });
      ctx.refresh();
    },
  })), 'How well does this movement fit you?');
}
