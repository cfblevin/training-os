// Anchor lifts and the training block: what stays locked, what rotates, and the
// end-of-block review that decides what changes next.
import { el, openSheet, confirmSheet, toast, fmtLoad } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { shortDate } from '../core/schedule.js';
import { GROUPS, FAMILY_LABELS } from '../data/library.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function blockSummary(state) {
  const b = A.blockState(state, ctx.today());
  if (b.complete) return `Block ${b.number} complete — ready to review`;
  return `Block ${b.number} · week ${b.week} of ${b.weeks} · ends ${shortDate(b.endsOn)}`;
}

export function blockIsDue(state) {
  return A.blockState(state, ctx.today()).complete;
}

/** Quiet Today-screen prompt, only once the block has actually run out. */
export function blockPromptRow() {
  const state = ctx.store.get();
  if (!blockIsDue(state)) return null;
  const b = A.blockState(state, ctx.today());
  return el('button', { class: 'list-row', onclick: () => openBlockReview() },
    el('div', { class: 'list-row-main' },
      el('div', { class: 'list-name', text: `Block ${b.number} is done — review your anchors` }),
      el('div', { class: 'list-sub', text: 'See what moved, keep or swap each lift' })),
    el('span', { class: 'caret', text: '›' }));
}

const VERDICT_CLASS = {
  progressing: 'badge badge-good',
  holding: 'badge badge-quiet',
  'needs review': 'badge',
  'too early': 'badge badge-quiet',
  'no data': 'badge badge-quiet',
};

export function openBlockReview() {
  openSheet({
    title: 'Block review',
    build: ({ rerender, close }) => {
      const state = ctx.store.get();
      const { block, rows } = A.blockReview(state, ctx.today());
      const moved = rows.filter((r) => r.verdict === 'progressing').length;
      return el('div', null,
        el('p', { class: 'sheet-sub', text: `Block ${block.number} · started ${shortDate(block.startedOn)} · ${block.weeks} weeks · ${moved} of ${rows.length} anchors progressing` }),
        el('div', { class: 'list' }, rows.map((r) => el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name truncate', text: r.exercise.name }),
            el('div', { class: 'list-sub', text: r.first && r.last
              ? `${r.dayTitle} · ${fmtLoad(r.first.topLoad, r.exercise.loadConvention)} × ${r.first.topReps} → ${fmtLoad(r.last.topLoad, r.exercise.loadConvention)} × ${r.last.topReps} · ${r.sessions} sessions`
              : `${r.dayTitle} · nothing logged this block` })),
          el('div', { class: 'row', style: 'gap:6px;flex:none' },
            el('span', { class: VERDICT_CLASS[r.verdict] || 'badge badge-quiet', text: r.verdict }),
            el('button', {
              class: 'btn btn-sm btn-quiet',
              onclick: () => openAnchorPicker(r.dayId, r.slotId, () => rerender()),
            }, 'Swap'))))),
        el('p', { class: 'explainer', style: 'margin-top:12px' },
          'A lift that progressed is doing its job — leave it. A lift that held for the whole block is usually a load or recovery problem, not an exercise problem: deload it about 10% and rebuild before changing it. Swap the ones that went backwards or that you have stopped enjoying.'),
        el('div', { class: 'btn-row', style: 'margin-top:14px' },
          el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Later'),
          el('button', {
            class: 'btn btn-primary',
            onclick: async () => {
              const ok = await confirmSheet({
                title: `Start block ${block.number + 1}?`,
                message: `Your anchors lock in again for ${block.weeks} weeks from today. Nothing in your history changes.`,
                confirm: 'Start block',
              });
              if (!ok) return;
              ctx.store.update((s) => { A.startNewBlock(s, ctx.today(), s.block && s.block.weeks); });
              close(); ctx.refresh(); toast(`Block ${block.number + 1} started`);
            },
          }, 'Start next block')));
    },
  });
}

/** The one place every anchor lift can be seen and changed. */
export function openAnchorsSheet() {
  openSheet({
    title: 'Anchor lifts',
    sub: 'Locked for the block. These are the lifts progression is measured on.',
    build: ({ rerender }) => {
      const state = ctx.store.get();
      const anchors = A.anchorSlots(state);
      const byDay = new Map();
      for (const a of anchors) {
        if (!byDay.has(a.dayId)) byDay.set(a.dayId, { title: a.dayTitle, weekday: a.weekday, rows: [] });
        byDay.get(a.dayId).rows.push(a);
      }
      return el('div', null,
        el('p', { class: 'tiny faint', style: 'margin:0 0 10px', text: blockSummary(state) }),
        [...byDay.entries()].map(([dayId, day]) => el('div', { style: 'margin-bottom:14px' },
          el('p', { class: 'section-title', text: `${WEEKDAYS[day.weekday]} · ${day.title}` }),
          el('div', { class: 'list' }, day.rows.map((a) => el('button', {
            class: 'list-row',
            onclick: () => openAnchorPicker(dayId, a.slot.id, () => rerender()),
          },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: a.exercise ? a.exercise.name : a.slot.foundation }),
              el('div', { class: 'list-sub', text: `${FAMILY_LABELS[a.slot.family] || a.slot.family} · ${a.slot.sets}×${a.slot.repMin}–${a.slot.repMax}` })),
            el('div', { class: 'list-right num', text: fmtLoad(A.loadFor(state, a.slot.foundation), a.exercise && a.exercise.loadConvention) }),
            el('span', { class: 'caret', text: '›' })))))),
        el('div', { style: 'margin-top:8px' },
          el('button', { class: 'btn btn-quiet', onclick: () => openRotationSheet() }, 'See what rotates')));
    },
  });
}

function openAnchorPicker(dayId, slotId, onDone) {
  const state = ctx.store.get();
  const day = state.program[state.settings.mode].days.find((d) => d.id === dayId);
  const slot = day && day.slots.find((x) => x.id === slotId);
  if (!slot) return;
  const current = A.exerciseById(state, slot.foundation);
  const entry = {
    exerciseId: slot.foundation, family: slot.family, group: slot.group,
    foundationId: slot.foundation, name: current ? current.name : slot.foundation,
  };
  const recs = A.swapCandidates(state, entry, []);
  const search = { q: '' };

  const apply = async (exId) => {
    const ok = await confirmSheet({
      title: 'Change this anchor?',
      message: 'It becomes the tracked lift for this slot from the next session on. Everything already logged against the old lift is kept, and its history stays under its own name.',
      confirm: 'Change anchor',
    });
    if (!ok) return;
    ctx.store.update((s) => { A.setAnchorExercise(s, dayId, slotId, exId); });
    ctx.refresh();
    if (onDone) onDone();
    toast('Anchor changed');
  };

  openSheet({
    title: 'Choose the anchor',
    sub: `${day.title} · currently ${entry.name}`,
    build: ({ rerender, close }) => el('div', null,
      el('p', { class: 'section-title', text: 'Same pattern' }),
      el('div', { class: 'list' }, recs.map(({ ex }) => el('button', {
        class: 'list-row', onclick: () => { close(); apply(ex.id); },
      },
        el('div', { class: 'list-row-main' },
          el('div', { class: 'list-name truncate', text: ex.name }),
          el('div', { class: 'list-sub', text: `${ex.group} · ${ex.equipment}` })),
        ex.id === slot.foundation ? el('span', { class: 'badge badge-good', text: 'Current' }) : null,
        el('span', { class: 'caret', text: '›' })))),
      el('p', { class: 'section-title', style: 'margin-top:16px', text: 'Full library' }),
      el('input', {
        class: 'input', type: 'search', placeholder: 'Search exercises', value: search.q,
        oninput: (e) => { search.q = e.target.value; rerender(); },
      }),
      el('div', { class: 'list', style: 'margin-top:8px' },
        A.searchLibrary(state, search.q).slice(0, 40).map((ex) => el('button', {
          class: 'list-row', onclick: () => { close(); apply(ex.id); },
        },
          el('div', { class: 'list-row-main' },
            el('div', { class: 'list-name truncate', text: ex.name }),
            el('div', { class: 'list-sub', text: `${ex.group} · ${ex.equipment}` })),
          el('span', { class: 'caret', text: '›' }))))),
  });
}

/** What the rotating slots will serve up, week by week. */
export function openRotationSheet() {
  openSheet({
    title: 'Rotating slots',
    sub: 'These change movement every week. Variety, not load targets.',
    build: ({ rerender }) => {
      const state = ctx.store.get();
      const rows = A.rotatingSlots(state);
      const byDay = new Map();
      for (const r of rows) {
        if (!byDay.has(r.dayId)) byDay.set(r.dayId, { title: r.dayTitle, rows: [] });
        byDay.get(r.dayId).rows.push(r);
      }
      return el('div', null,
        [...byDay.values()].map((day) => el('div', { style: 'margin-bottom:14px' },
          el('p', { class: 'section-title', text: day.title }),
          el('div', { class: 'list' }, day.rows.map((r) => el('button', {
            class: 'list-row',
            onclick: () => openPoolEditor(r, rerender),
          },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: FAMILY_LABELS[r.slot.family] || r.slot.family }),
              el('div', { class: 'list-sub truncate', text: r.pool.map((e) => e.name).join(' → ') })),
            el('span', { class: 'caret', text: '›' })))))),
        el('p', { class: 'explainer', style: 'margin-top:8px' },
          'Each rotating slot serves the next movement in its pool every week, so the same variation never lands twice in a row.'));
    },
  });
}

function openPoolEditor(row, onDone) {
  const search = { q: '' };
  openSheet({
    title: FAMILY_LABELS[row.slot.family] || row.slot.family,
    sub: `${row.dayTitle} · ${row.slot.sets}×${row.slot.repMin}–${row.slot.repMax}`,
    build: ({ rerender, close }) => {
      const state = ctx.store.get();
      const day = state.program[state.settings.mode].days.find((d) => d.id === row.dayId);
      const slot = day.slots.find((x) => x.id === row.slot.id);
      const pool = [slot.foundation, ...(slot.variations || [])];
      return el('div', null,
        el('p', { class: 'section-title', text: 'In the rotation' }),
        el('div', { class: 'list' }, pool.map((id, i) => {
          const ex = A.exerciseById(state, id);
          return el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: ex ? ex.name : id }),
              el('div', { class: 'list-sub', text: i === 0 ? 'First in the cycle' : `Week ${i + 1} of the cycle` })),
            pool.length > 1 && i > 0
              ? el('button', {
                class: 'btn btn-sm btn-quiet',
                onclick: () => {
                  ctx.store.update((s) => { A.removeRotationOption(s, row.dayId, row.slot.id, id); });
                  rerender(); ctx.refresh();
                },
              }, 'Remove')
              : null);
        })),
        el('p', { class: 'section-title', style: 'margin-top:16px', text: 'Add to the rotation' }),
        el('input', {
          class: 'input', type: 'search', placeholder: 'Search exercises', value: search.q,
          oninput: (e) => { search.q = e.target.value; rerender(); },
        }),
        el('div', { class: 'list', style: 'margin-top:8px' },
          A.searchLibrary(state, search.q, { excludeIds: pool }).slice(0, 30).map((ex) => el('button', {
            class: 'list-row',
            onclick: () => {
              ctx.store.update((s) => { A.addRotationOption(s, row.dayId, row.slot.id, ex.id); });
              rerender(); ctx.refresh(); if (onDone) onDone();
            },
          },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: ex.name }),
              el('div', { class: 'list-sub', text: `${ex.group} · ${ex.equipment}` })),
            el('span', { class: 'caret', text: '+' })))));
    },
  });
}
