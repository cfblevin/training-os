// Today screen: today's workout, the next workout, and a two-week carousel.
import { el, openSheet, menuSheet, confirmSheet, toast, fmtLoad } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { addDays, relativeLabel, weekdayLabel, dayNumber, shortDate, dateHeading } from '../core/schedule.js';
import { PRIORITY_LABELS } from '../data/library.js';
import { openAddSheet, openSwapSheet, openExerciseMenu } from './pickers.js';
import { conditioningRow } from './conditioning.js';
import { blockPromptRow } from './blocks.js';

function planStats(plan) {
  const sets = (plan.exercises || []).reduce((a, e) => a + (e.plannedSets || 0), 0);
  const secs = (plan.exercises || []).reduce((a, e) => a + (e.plannedSets || 0) * ((e.restSec || 60) + 40), 0);
  return { exercises: (plan.exercises || []).length, sets, minutes: Math.round(secs / 60 / 5) * 5 };
}

function priorityChips(plan) {
  const seen = [];
  for (const e of plan.exercises || []) {
    if (e.priority && PRIORITY_LABELS[e.priority] && !seen.includes(e.priority)) seen.push(e.priority);
  }
  if (!seen.length) return null;
  return el('div', { class: 'chips', style: 'margin-top:10px' },
    seen.map((p) => el('span', { class: 'chip chip-accent', text: PRIORITY_LABELS[p] })));
}

function completedFor(state, key) {
  const s = A.sessionFor(state, key);
  return s && s.status === 'completed' ? s : null;
}

/** A day the athlete trained but did not log, set by set. */
function unloggedCard(state, key, plan) {
  return el('section', { class: 'card card-lead' },
    el('div', { class: 'card-head' },
      el('div', { class: 'grow' },
        el('p', { class: 'card-kicker', text: shortDate(key) }),
        el('h2', { class: 'card-title', text: plan.title })),
      el('span', { class: 'badge badge-good', text: 'Trained' })),
    el('p', { class: 'small muted', style: 'margin:8px 0 0',
      text: 'Marked as trained. Nothing was logged for this session, so it adds no sets to the week.' }),
    el('div', { class: 'btn-row', style: 'margin-top:14px' },
      el('button', {
        class: 'btn btn-quiet',
        onclick: async () => {
          const ok = await confirmSheet({
            title: 'Log this session after all?',
            message: 'The day opens as a normal workout with the planned exercises, ready to log.',
            confirm: 'Open it',
          });
          if (!ok) return;
          ctx.openWorkout(key);
        },
      }, 'Log it anyway'),
      el('button', {
        class: 'btn btn-quiet',
        onclick: () => { ctx.store.update((s) => { A.unmarkDayTrained(s, key); }); ctx.refresh(); toast('Unmarked'); },
      }, 'Undo')));
}

export function renderToday() {
  const state = ctx.store.get();
  const today = ctx.today();
  const plan = A.planFor(state, today);
  const session = A.sessionFor(state, today);
  const stats = planStats(plan);
  const nextKey = A.nextTrainingDay(state, today);
  const pending = Object.entries(state.suggestions || {});

  const todayCard = session && session.unlogged
    ? unloggedCard(state, today, plan)
    : plan.rest
    ? el('section', { class: 'card card-lead' },
      el('p', { class: 'card-kicker', text: `Rest · ${shortDate(today)}` }),
      el('h2', { class: 'card-title', text: 'Rest day' }),
      el('p', { class: 'why', text: nextKey
        ? `Next up ${relativeLabel(nextKey, today).toLowerCase()}: ${A.planFor(state, nextKey).title}.`
        : 'Nothing scheduled.' }))
    : el('section', { class: 'card card-lead' },
      el('div', { class: 'card-head' },
        el('div', { class: 'grow' },
          el('p', { class: 'card-kicker', text: shortDate(today) }),
          el('h2', { class: 'card-title', text: plan.title })),
        session && session.status === 'completed'
          ? el('span', { class: 'badge badge-good', text: 'Done' })
          : plan.light ? el('span', { class: 'badge badge-quiet', text: 'Light' }) : null),
      el('p', { class: 'small muted', style: 'margin:8px 0 0' },
        `${stats.exercises} exercises · ${stats.sets} sets · about ${stats.minutes} min`),
      priorityChips(plan),
      state.settings.showWhy && plan.why ? el('p', { class: 'why', text: plan.why }) : null,
      el('div', { style: 'margin-top:14px' },
        el('button', {
          class: 'btn btn-primary',
          onclick: () => ctx.openWorkout(today),
        }, session
          ? (session.status === 'completed' ? 'Review workout' : `Continue · ${A.sessionProgress(session).done}/${A.sessionProgress(session).total} sets`)
          : 'Start workout')),
      el('div', { style: 'margin-top:8px' },
        el('button', { class: 'btn btn-quiet', onclick: () => openPreview(today) }, 'Preview and edit')));

  const nextCard = nextKey
    ? el('button', { class: 'card', style: 'width:100%;text-align:left', onclick: () => openPreview(nextKey) },
      el('div', { class: 'row-between' },
        el('div', { class: 'grow' },
          el('p', { class: 'card-kicker', text: `Next · ${relativeLabel(nextKey, today)}` }),
          el('div', { class: 'card-title truncate', text: A.planFor(state, nextKey).title }),
          el('p', { class: 'small muted', style: 'margin:6px 0 0', text: `${planStats(A.planFor(state, nextKey)).exercises} exercises` })),
        el('span', { class: 'caret', text: '›' })))
    : null;

  return el('div', null,
    el('div', { class: 'stack' }, todayCard, nextCard),
    blockPromptRow(),
    conditioningRow(today),
    pending.length
      ? el('button', {
        class: 'list-row', style: 'margin-top:14px;border-top:1px solid var(--line)',
        onclick: () => openSuggestions(),
      },
        el('div', { class: 'list-row-main' },
          el('div', { class: 'list-name', text: `${pending.length} load suggestion${pending.length > 1 ? 's' : ''} waiting` }),
          el('div', { class: 'list-sub', text: 'Earned from completed benchmarks' })),
        el('span', { class: 'caret', text: '›' }))
      : null,
    el('section', { class: 'section', style: 'margin-top:20px' },
      el('div', { class: 'section-head' },
        el('h3', { class: 'section-title', text: 'Next two weeks' })),
      renderCarousel(state, today)));
}

function renderCarousel(state, today) {
  const days = [];
  const n = state.settings.carouselDays || 13;
  for (let i = 0; i < n; i++) {
    const key = addDays(today, i);
    const plan = A.planFor(state, key);
    const done = completedFor(state, key);
    const prios = new Set((plan.exercises || []).map((e) => e.priority).filter(Boolean));
    days.push(el('button', {
      class: `day${plan.rest ? ' day-rest' : ''}`,
      'aria-current': key === today ? 'date' : null,
      onclick: () => openPreview(key),
    },
      el('span', { class: 'day-dow', text: weekdayLabel(key) }),
      el('span', { class: 'day-num num', text: dayNumber(key) }),
      el('span', { class: 'day-title', text: plan.rest ? 'Rest' : plan.title.replace(/ — .*/, '') }),
      el('span', { class: 'day-title tiny faint', text: plan.rest ? '' : plan.title.split(' — ')[1] || '' }),
      done ? el('span', { class: 'day-mark', text: done.unlogged ? 'TRAINED' : 'LOGGED' }) : null,
      el('span', { class: 'day-dots' }, [...prios].slice(0, 5).map(() => el('i', { class: 'day-dot day-dot-p' })))));
  }
  return el('div', { class: 'carousel', role: 'list', 'aria-label': 'Upcoming workouts' }, days);
}

/** Compact future preview: names only, no loads or set detail. */
export function openPreview(key) {
  const state = ctx.store.get();
  const plan = A.planFor(state, key);
  const today = ctx.today();
  const isToday = key === today;
  const session = A.sessionFor(state, key);

  openSheet({
    title: plan.rest ? 'Rest day' : plan.title,
    sub: dateHeading(key, today),
    build: ({ close }) => el('div', null,
      plan.rest
        ? el('p', { class: 'empty', text: 'No workout scheduled.' })
        : el('div', null,
          el('div', { class: 'list' }, plan.exercises.map((e) => el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: e.name }),
              e.added ? el('div', { class: 'list-sub', text: 'Added' }) : null),
            e.priority && PRIORITY_LABELS[e.priority]
              ? el('span', { class: 'badge', text: 'Priority' }) : null))),
          plan.why ? el('p', { class: 'why', text: plan.why }) : null,
          el('div', { class: 'btn-row', style: 'margin-top:16px' },
            isToday || session
              ? el('button', { class: 'btn btn-primary', onclick: () => { close(); ctx.openWorkout(key); } },
                session ? 'Open workout' : 'Start workout')
              : null,
            el('button', {
              class: 'btn btn-quiet',
              onclick: () => { close(); openWorkoutMenu(key); },
            }, 'Edit workout')))),
  });
}

export function openWorkoutMenu(key) {
  const state = ctx.store.get();
  const plan = A.planFor(state, key);
  const overridden = !!(state.dayOverrides || {})[key];
  const session = A.sessionFor(state, key);
  const logged = session && !session.unlogged && A.sessionProgress(session).done > 0;
  menuSheet(plan.title, [
    !logged && !(session && session.unlogged) ? {
      label: 'Mark as trained, no log',
      note: 'For a session you did but did not record',
      onClick: async () => {
        const ok = await confirmSheet({
          title: 'Mark as trained?',
          message: 'It records that you trained this day. No sets are invented, so it adds nothing to your weekly volume or progression.',
          confirm: 'Mark as trained',
        });
        if (!ok) return;
        ctx.store.update((s) => { A.markDayTrained(s, key); });
        ctx.refresh();
        toast('Marked as trained');
      },
    } : null,
    session && session.unlogged ? {
      label: 'Undo \u201cmarked as trained\u201d',
      onClick: () => { ctx.store.update((s) => { A.unmarkDayTrained(s, key); }); ctx.refresh(); toast('Unmarked'); },
    } : null,
    { label: 'Add exercise', onClick: () => openAddSheet({ dateKey: key }) },
    {
      label: 'Swap an exercise',
      onClick: () => menuSheet('Swap which exercise?', plan.exercises.map((e) => ({
        label: e.name, onClick: () => openSwapSheet({ dateKey: key, entry: e }),
      }))),
    },
    {
      label: 'Edit an exercise',
      note: 'Sets, rep range, load, rest',
      onClick: () => menuSheet('Edit which exercise?', plan.exercises.map((e) => ({
        label: e.name, onClick: () => openExerciseMenu({ dateKey: key, entry: e }),
      }))),
    },
    {
      label: 'Remove an exercise', danger: true,
      onClick: () => menuSheet('Remove which exercise?', plan.exercises.map((e) => ({
        label: e.name, danger: true,
        onClick: async () => {
          const ok = await confirmSheet({
            title: 'Remove exercise?', message: `${e.name} will be removed from ${relativeLabel(key, ctx.today()).toLowerCase()} only.`,
            confirm: 'Remove', danger: true,
          });
          if (!ok) return;
          ctx.store.update((s) => { A.removeExercise(s, key, e.uid, 'today'); });
          ctx.refresh();
        },
      }))),
    },
    overridden ? {
      label: 'Reset to the programmed workout',
      onClick: async () => {
        const ok = await confirmSheet({
          title: 'Reset this day?', message: 'Edits made for this date are discarded. Logged sets are kept.',
          confirm: 'Reset',
        });
        if (!ok) return;
        ctx.store.update((s) => { A.resetDay(s, key); });
        ctx.refresh();
        toast('Day reset');
      },
    } : null,
  ], shortDate(key));
}

export function openSuggestions() {
  const render = ({ rerender, close }) => {
    const state = ctx.store.get();
    const items = Object.entries(state.suggestions || {});
    if (!items.length) return el('p', { class: 'empty', text: 'No suggestions waiting.' });
    return el('div', { class: 'list' }, items.map(([id, sug]) => {
      const ex = A.exerciseById(state, id);
      return el('div', { class: 'list-row' },
        el('div', { class: 'list-row-main' },
          el('div', { class: 'list-name truncate', text: sug.name || (ex && ex.name) || id }),
          el('div', { class: 'list-sub', text: `Suggestion: ${fmtLoad(sug.to, ex && ex.loadConvention)} next time` })),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn btn-sm btn-primary',
            onclick: () => { ctx.store.update((s) => { A.acceptSuggestion(s, id); }); ctx.refresh(); rerender(); },
          }, 'Accept'),
          el('button', {
            class: 'btn btn-sm btn-quiet',
            onclick: () => { ctx.store.update((s) => { A.keepCurrentLoad(s, id); }); ctx.refresh(); rerender(); },
          }, 'Keep')));
    }));
  };
  openSheet({ title: 'Load suggestions', sub: 'Nothing changes until you accept it.', build: render });
}
