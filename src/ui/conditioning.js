// Running, swimming and other conditioning. Logged only — never programmed,
// never part of a strength session, never counted as muscle volume.
import { el, openSheet, toast } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { CONDITIONING_KINDS } from '../data/program.js';
import { shortDate } from '../core/schedule.js';

export const kindOf = (id) => CONDITIONING_KINDS.find((k) => k.id === id) || CONDITIONING_KINDS[0];

export function describe(row) {
  const k = kindOf(row.kind);
  const bits = [];
  if (row.distance) bits.push(`${row.distance} ${row.unit || k.unit}`);
  if (row.minutes) bits.push(`${row.minutes} min`);
  return bits.length ? bits.join(' · ') : 'logged';
}

/** Quiet Today-screen row: what was done today, plus a way to add. */
export function conditioningRow(key) {
  const rows = A.conditioningFor(ctx.store.get(), key);
  return el('button', {
    class: 'list-row', style: 'border-top:1px solid var(--line)',
    onclick: () => openConditioningSheet(key),
  },
    el('div', { class: 'list-row-main' },
      el('div', { class: 'list-name', text: rows.length ? 'Conditioning logged' : 'Log a run or swim' }),
      el('div', { class: 'list-sub', text: rows.length
        ? rows.map((r) => `${kindOf(r.kind).label} ${describe(r)}`).join(' · ')
        : 'Kept separate from the split and from muscle volume' })),
    el('span', { class: 'caret', text: '›' }));
}

export function openConditioningSheet(key) {
  const draft = { kind: 'run', distance: '', minutes: '', note: '' };
  openSheet({
    title: 'Conditioning',
    sub: `${shortDate(key)} · recorded on its own, outside the training split`,
    build: ({ rerender, close }) => {
      const state = ctx.store.get();
      const existing = A.conditioningFor(state, key);
      const k = kindOf(draft.kind);
      return el('div', null,
        existing.length
          ? el('div', { class: 'list', style: 'margin-bottom:14px' }, existing.map((r) => el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name', text: kindOf(r.kind).label }),
              el('div', { class: 'list-sub', text: describe(r) + (r.note ? ` · ${r.note}` : '') })),
            el('button', {
              class: 'btn btn-sm btn-quiet',
              onclick: () => { ctx.store.update((s) => { A.deleteConditioning(s, r.id); }); rerender(); ctx.refresh(); },
            }, 'Remove'))))
          : null,
        el('p', { class: 'field-label', text: 'Type' }),
        el('div', { class: 'chips' }, CONDITIONING_KINDS.map((c) => el('button', {
          class: 'chip-btn chip-word', 'aria-pressed': String(draft.kind === c.id),
          onclick: () => { draft.kind = c.id; rerender(); },
        }, c.label))),
        el('div', { class: 'form-grid', style: 'margin-top:12px' },
          el('div', null,
            el('label', { class: 'field-label', text: `Distance (${k.unit})` }),
            el('input', {
              class: 'input num', type: 'number', inputmode: 'decimal', value: draft.distance,
              oninput: (e) => { draft.distance = e.target.value; },
            })),
          el('div', null,
            el('label', { class: 'field-label', text: 'Time (min)' }),
            el('input', {
              class: 'input num', type: 'number', inputmode: 'numeric', value: draft.minutes,
              oninput: (e) => { draft.minutes = e.target.value; },
            }))),
        el('label', { class: 'field-label', style: 'margin-top:10px', text: 'Note (optional)' }),
        el('input', { class: 'input', value: draft.note, oninput: (e) => { draft.note = e.target.value; } }),
        el('p', { class: 'tiny faint', style: 'margin-top:10px',
          text: 'Conditioning shows in History on its own. It never counts toward weekly muscle volume.' }),
        el('div', { class: 'btn-row', style: 'margin-top:14px' },
          el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Close'),
          el('button', {
            class: 'btn btn-primary',
            onclick: () => {
              if (!draft.distance && !draft.minutes) { toast('Add a distance or a time'); return; }
              ctx.store.update((s) => {
                A.logConditioning(s, { ...draft, dateKey: key, unit: kindOf(draft.kind).unit });
              });
              draft.distance = ''; draft.minutes = ''; draft.note = '';
              rerender(); ctx.refresh(); toast('Conditioning logged');
            },
          }, 'Log it')));
    },
  });
}
