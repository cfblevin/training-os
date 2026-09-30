// Athlete profile: measurements, proportions, fit, priorities, constraints, baselines.
import { el, openSheet, menuSheet, confirmSheet, toast, fmtLoad } from './dom.js';
import { ctx } from './ctx.js';
import * as A from '../core/actions.js';
import { MEASUREMENT_FIELDS, PROPORTION_FIELDS, FIT_LABELS, FIT_LEVELS, TENDENCY_OPTIONS } from '../core/store.js';
import { PRIORITY_LABELS, GROUPS } from '../data/library.js';
import { openBaselineSheet, openFitSheet } from './pickers.js';
import { dateKey, shortDate } from '../core/schedule.js';

const set = (fn) => { ctx.store.update(fn); ctx.refresh(); };

function disc(title, summary, ...body) {
  return el('details', { class: 'disc' },
    el('summary', null, el('span', { text: title }),
      el('span', { class: 'small muted truncate', style: 'margin-left:auto;padding-right:8px', text: summary || '' })),
    el('div', { class: 'disc-body' }, ...body));
}

function latestMeasurements(state) {
  const rows = [...(state.measurements || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows[0] || null;
}

export function renderProfile() {
  const state = ctx.store.get();
  const p = state.profile;
  const latest = latestMeasurements(state);
  const fitCount = Object.keys(p.fit || {}).length;

  return el('div', null,
    el('div', { class: 'card' },
      el('div', { class: 'row-between' },
        el('div', { class: 'grow' },
          el('p', { class: 'card-kicker', text: 'Athlete' }),
          el('h2', { class: 'card-title', text: p.name || 'Athlete' }),
          el('p', { class: 'small muted', style: 'margin:6px 0 0', text: latest
            ? `Last measured ${shortDate(latest.date)}`
            : 'No measurements logged yet' })),
        el('button', { class: 'btn btn-sm btn-quiet', onclick: () => openNameSheet(p.name) }, 'Edit')),
      el('div', { class: 'chips', style: 'margin-top:12px' },
        (p.physiquePriorities || []).map((k) => el('span', { class: 'chip chip-accent', text: PRIORITY_LABELS[k] || k })))),

    el('div', { style: 'margin-top:18px' },
      disc('Body measurements', latest && latest.values.weight ? `${latest.values.weight} lb` : 'Not set',
        latest ? el('div', { class: 'list' }, MEASUREMENT_FIELDS
          .filter((f) => latest.values[f.id] != null)
          .map((f) => el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' }, el('div', { class: 'list-name', text: f.label })),
            el('div', { class: 'list-right num', text: `${latest.values[f.id]} ${f.unit}` }))))
          : el('p', { class: 'explainer', text: 'Nothing recorded yet. Log a set of measurements to start tracking.' }),
        el('div', { class: 'btn-row', style: 'margin-top:12px' },
          el('button', { class: 'btn btn-sm btn-quiet', onclick: () => openMeasurementSheet() }, 'Log measurements'),
          (state.measurements || []).length > 1
            ? el('button', { class: 'btn btn-sm btn-quiet', onclick: () => openMeasurementHistory() }, 'History')
            : null)),

      disc('Progress photos', `${(state.photos || []).length} saved`,
        el('p', { class: 'explainer', text: 'Optional. Photos are stored on this device only and are the first thing dropped if storage runs out.' }),
        (state.photos || []).length
          ? el('div', { class: 'photo-grid', style: 'margin-top:10px' },
            [...state.photos].reverse().map((ph) => el('button', {
              onclick: () => openPhotoMenu(ph),
              style: 'padding:0;border:0;background:none',
            }, ph.dataUrl
              ? el('img', { src: ph.dataUrl, alt: `Progress photo ${ph.date}` })
              : el('div', { class: 'card small muted', text: `${shortDate(ph.date)} (image dropped)` }))))
          : null,
        el('div', { style: 'margin-top:10px' },
          el('label', { class: 'btn btn-sm btn-quiet', style: 'display:inline-flex' }, 'Add photo',
            el('input', {
              type: 'file', accept: 'image/*', style: 'display:none',
              onchange: (e) => addPhoto(e.target.files && e.target.files[0]),
            })))),

      disc('Limb and torso proportions', p.proportions && p.proportions.femur ? 'Recorded' : 'Notes only',
        el('div', { class: 'form-grid' }, PROPORTION_FIELDS.map((f) => el('div', null,
          el('label', { class: 'field-label', text: `${f.label} (${f.unit})` }),
          el('input', {
            class: 'input num', type: 'number', inputmode: 'decimal',
            value: p.proportions[f.id] == null ? '' : String(p.proportions[f.id]),
            onchange: (e) => set((s) => {
              s.profile.proportions[f.id] = e.target.value === '' ? null : Number(e.target.value);
            }),
          })))),
        el('label', { class: 'field-label', style: 'margin-top:12px', text: 'Notes' }),
        el('textarea', {
          class: 'input', onchange: (e) => set((s) => { s.profile.proportionNotes = e.target.value; }),
        }, p.proportionNotes || '')),

      disc('Self-reported tendencies', `${(p.tendencies || []).length} selected`,
        el('div', { class: 'chips' }, TENDENCY_OPTIONS.map((t) => el('button', {
          class: 'chip-btn chip-word',
          'aria-pressed': String((p.tendencies || []).includes(t.id)),
          onclick: () => set((s) => {
            const cur = s.profile.tendencies || [];
            s.profile.tendencies = cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id];
          }),
        }, t.label))),
        el('p', { class: 'tiny faint', style: 'margin-top:10px',
          text: 'These are prompts for exercise fit, not diagnoses or fixed performance predictions.' }),
        (p.tendencies || []).length
          ? el('div', { style: 'margin-top:12px' }, TENDENCY_OPTIONS
            .filter((t) => (p.tendencies || []).includes(t.id))
            .map((t) => el('details', { class: 'disc' },
              el('summary', null, el('span', { text: t.label })),
              el('div', { class: 'disc-body' }, el('p', { class: 'explainer', text: t.note })))))
          : null,
        el('details', { class: 'disc' },
          el('summary', null, el('span', { text: 'How this affects programming' })),
          el('div', { class: 'disc-body' },
            el('p', { class: 'explainer' },
              'Proportions change how a lift is set up, not whether it is allowed. A long femur relative to the torso means a free squat folds further forward, which is why the squat slot is a back-supported hack squat rather than a barbell squat. Long arms lengthen every pressing rep, which is why incline and machine pressing carry the upper-chest volume and why pulling strength tends to run ahead of pressing. Nothing here removes a lift on its own: fit is judged on stance, mobility, hip anatomy, injury history, equipment, tolerance and technique.'),
            el('p', { class: 'explainer', style: 'margin-top:10px' },
              'On waist appearance: you cannot reduce fat from one area by training it. A tighter-looking midsection comes from body composition, and from the shoulder-to-waist ratio, which improves fastest by widening the delts and lats — already two of your priorities. Core work here is anti-extension and anti-rotation on purpose; heavy loaded side bends and weighted twists are deliberately not programmed.'))),
        el('div', { style: 'margin-top:10px' },
          el('button', { class: 'btn btn-sm btn-quiet', onclick: () => openTendencySheet(null) }, 'Add your own note')),
        (p.biomechanics || []).length
          ? el('div', { class: 'list', style: 'margin-top:10px' }, p.biomechanics.map((b) => el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name', text: b.label }),
              el('div', { class: 'list-sub', text: b.note })),
            el('button', {
              class: 'btn btn-sm btn-quiet',
              onclick: () => set((s) => { s.profile.biomechanics = s.profile.biomechanics.filter((x) => x.id !== b.id); }),
            }, 'Remove'))))
          : null),

      disc('Exercise compatibility', `${fitCount} rated`,
        el('p', { class: 'explainer', text: 'Preferred movements are recommended first for swaps and additions. Avoid keeps a movement out of recommendations.' }),
        FIT_LEVELS.map((level) => {
          const ids = Object.entries(p.fit || {}).filter(([, v]) => v === level).map(([k]) => k);
          if (!ids.length) return null;
          return el('div', { style: 'margin-top:10px' },
            el('p', { class: 'section-title', text: FIT_LABELS[level] }),
            el('div', { class: 'list' }, ids.map((id) => {
              const ex = A.exerciseById(state, id);
              return el('button', { class: 'list-row', onclick: () => openFitSheet(ex || { id, name: id }) },
                el('div', { class: 'list-row-main' },
                  el('div', { class: 'list-name truncate', text: ex ? ex.name : id })),
                el('span', { class: 'caret', text: '›' }));
            })));
        }),
        el('div', { style: 'margin-top:12px' },
          el('button', { class: 'btn btn-sm btn-quiet', onclick: () => openFitPicker() }, 'Rate an exercise'))),

      disc('Physique priorities', `${(p.physiquePriorities || []).length} areas`,
        el('p', { class: 'explainer', text: 'Priority areas are marked quietly on the exercises that serve them. Editable at any time.' }),
        el('div', { class: 'chips', style: 'margin-top:10px' },
          Object.entries(PRIORITY_LABELS).map(([k, label]) => el('button', {
            class: 'chip-btn chip-word',
            'aria-pressed': String((p.physiquePriorities || []).includes(k)),
            onclick: () => set((s) => {
              const cur = s.profile.physiquePriorities || [];
              s.profile.physiquePriorities = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
            }),
          }, label)))),

      disc('Strength priorities', `${(p.strengthPriorities || []).length} lifts`,
        el('div', { class: 'list' }, (p.strengthPriorities || []).map((id) => {
          const ex = A.exerciseById(state, id);
          return el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: ex ? ex.name : id })),
            el('button', {
              class: 'btn btn-sm btn-quiet',
              onclick: () => set((s) => {
                s.profile.strengthPriorities = (s.profile.strengthPriorities || []).filter((x) => x !== id);
              }),
            }, 'Remove'));
        })),
        el('div', { style: 'margin-top:10px' },
          el('button', {
            class: 'btn btn-sm btn-quiet',
            onclick: () => openExercisePicker('Add a strength priority', (ex) => set((s) => {
              const cur = s.profile.strengthPriorities || [];
              if (!cur.includes(ex.id)) s.profile.strengthPriorities = [...cur, ex.id];
            })),
          }, 'Add lift'))),

      disc('Injuries, mobility and constraints', `${(p.constraints || []).length} noted`,
        (p.constraints || []).length
          ? el('div', { class: 'list' }, p.constraints.map((c) => el('div', { class: 'list-row' },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name', text: c.area }),
              el('div', { class: 'list-sub', text: c.note })),
            el('button', {
              class: 'btn btn-sm btn-quiet',
              onclick: () => set((s) => { s.profile.constraints = s.profile.constraints.filter((x) => x.id !== c.id); }),
            }, 'Remove'))))
          : el('p', { class: 'explainer', text: 'Nothing recorded. Add anything that changes exercise selection or setup.' }),
        el('div', { style: 'margin-top:10px' },
          el('button', { class: 'btn btn-sm btn-quiet', onclick: () => openConstraintSheet() }, 'Add constraint'))),

      disc('Preferred equipment', `${(p.equipment || []).length} items`,
        el('div', { class: 'chips' }, (p.equipment || []).map((item) => el('button', {
          class: 'chip-btn chip-word', 'aria-pressed': 'true',
          onclick: () => set((s) => { s.profile.equipment = s.profile.equipment.filter((x) => x !== item); }),
        }, item))),
        el('div', { style: 'margin-top:10px' },
          el('button', {
            class: 'btn btn-sm btn-quiet',
            onclick: () => openTextSheet('Add equipment', '', (v) => set((s) => {
              if (v.trim()) s.profile.equipment = [...(s.profile.equipment || []), v.trim()];
            })),
          }, 'Add equipment'))),

      disc('Starting baselines', `${Object.values(state.loads || {}).filter((l) => l.established).length} established`,
        el('p', { class: 'explainer', text: 'A baseline is only set once. After that, progression comes from logged sets and the suggestions you accept.' }),
        baselineList(state))));
}

function baselineList(state) {
  const q = { text: '' };
  const wrap = el('div');
  const draw = () => {
    wrap.replaceChildren();
    const rows = A.searchLibrary(state, q.text).filter((ex) => {
      const rec = state.loads[ex.id];
      return q.text ? true : rec && rec.established;
    }).slice(0, 40);
    wrap.appendChild(el('div', { class: 'list' }, rows.length ? rows.map((ex) => {
      const rec = state.loads[ex.id] || {};
      return el('button', {
        class: 'list-row',
        onclick: () => openBaselineSheet({
          exerciseId: ex.id, name: ex.name, loadConvention: ex.loadConvention, increment: ex.increment,
        }),
      },
        el('div', { class: 'list-row-main' },
          el('div', { class: 'list-name truncate', text: ex.name }),
          el('div', { class: 'list-sub', text: rec.established ? 'Established' : 'Estimate' })),
        el('div', { class: 'list-right num', text: fmtLoad(rec.load, ex.loadConvention) }),
        el('span', { class: 'caret', text: '›' }));
    }) : el('p', { class: 'empty', text: 'Search for an exercise to set its baseline.' })));
  };
  const search = el('input', {
    class: 'input', type: 'search', placeholder: 'Search exercises',
    oninput: (e) => { q.text = e.target.value; draw(); },
  });
  draw();
  return el('div', null, search, el('div', { style: 'margin-top:10px' }, wrap));
}

// ------------------------------------------------------------------- sheets
function openNameSheet(current) {
  openTextSheet('Athlete name', current || '', (v) => set((s) => { s.profile.name = v.trim() || 'Athlete'; }));
}

function openTextSheet(title, value, onSave, multiline = false) {
  let v = value;
  openSheet({
    title,
    build: ({ close }) => el('div', null,
      multiline
        ? el('textarea', { class: 'input', oninput: (e) => { v = e.target.value; } }, value)
        : el('input', { class: 'input', value, oninput: (e) => { v = e.target.value; } }),
      el('div', { class: 'btn-row', style: 'margin-top:12px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => { close(); onSave(v); } }, 'Save'))),
  });
}

function openMeasurementSheet() {
  const state = ctx.store.get();
  const last = latestMeasurements(state);
  const values = {};
  openSheet({
    title: 'Log measurements',
    sub: 'Leave anything blank that you did not measure.',
    build: ({ close }) => el('div', null,
      el('label', { class: 'field-label', text: 'Date' }),
      el('input', { class: 'input', type: 'date', value: dateKey(), onchange: (e) => { values.__date = e.target.value; } }),
      el('div', { class: 'form-grid', style: 'margin-top:12px' }, MEASUREMENT_FIELDS.map((f) => el('div', null,
        el('label', { class: 'field-label', text: `${f.label} (${f.unit})` }),
        el('input', {
          class: 'input num', type: 'number', inputmode: 'decimal',
          placeholder: last && last.values[f.id] != null ? String(last.values[f.id]) : '',
          oninput: (e) => { values[f.id] = e.target.value === '' ? null : Number(e.target.value); },
        })))),
      el('div', { class: 'btn-row', style: 'margin-top:14px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', {
          class: 'btn btn-primary',
          onclick: () => {
            const date = values.__date || dateKey();
            const clean = {};
            for (const f of MEASUREMENT_FIELDS) if (values[f.id] != null) clean[f.id] = values[f.id];
            if (!Object.keys(clean).length) { toast('Nothing to save'); return; }
            set((s) => {
              s.measurements = [...(s.measurements || []), { id: `m_${Date.now()}`, date, values: clean }];
            });
            close(); toast('Measurements saved');
          },
        }, 'Save'))),
  });
}

function openMeasurementHistory() {
  openSheet({
    title: 'Measurement history',
    build: ({ rerender }) => {
      const rows = [...(ctx.store.get().measurements || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
      return el('div', { class: 'list' }, rows.map((m) => el('div', { class: 'list-row' },
        el('div', { class: 'list-row-main' },
          el('div', { class: 'list-name', text: shortDate(m.date) }),
          el('div', { class: 'list-sub', text: MEASUREMENT_FIELDS.filter((f) => m.values[f.id] != null)
            .map((f) => `${f.label} ${m.values[f.id]}`).join(' · ') })),
        el('button', {
          class: 'btn btn-sm btn-quiet',
          onclick: () => { set((s) => { s.measurements = s.measurements.filter((x) => x.id !== m.id); }); rerender(); },
        }, 'Delete'))));
    },
  });
}

function openTendencySheet(existing) {
  const draft = { label: existing ? existing.label : '', note: existing ? existing.note : '' };
  openSheet({
    title: existing ? 'Edit tendency' : 'Add tendency',
    build: ({ close }) => el('div', null,
      el('label', { class: 'field-label', text: 'Tendency' }),
      el('input', { class: 'input', value: draft.label, oninput: (e) => { draft.label = e.target.value; } }),
      el('label', { class: 'field-label', style: 'margin-top:10px', text: 'How this affects programming' }),
      el('textarea', { class: 'input', oninput: (e) => { draft.note = e.target.value; } }, draft.note),
      el('div', { class: 'btn-row', style: 'margin-top:12px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', {
          class: 'btn btn-primary',
          onclick: () => {
            if (!draft.label.trim()) { toast('Add a short label'); return; }
            set((s) => {
              const list = s.profile.biomechanics || [];
              if (existing) {
                s.profile.biomechanics = list.map((x) => (x.id === existing.id ? { ...x, ...draft } : x));
              } else {
                s.profile.biomechanics = [...list, { id: `b_${Date.now()}`, ...draft }];
              }
            });
            close();
          },
        }, 'Save'))),
  });
}

function openConstraintSheet() {
  const draft = { area: '', note: '' };
  openSheet({
    title: 'Add constraint',
    sub: 'Injury, mobility limit or movement you need to work around.',
    build: ({ close }) => el('div', null,
      el('label', { class: 'field-label', text: 'Area' }),
      el('input', { class: 'input', placeholder: 'Left shoulder, low back…', oninput: (e) => { draft.area = e.target.value; } }),
      el('label', { class: 'field-label', style: 'margin-top:10px', text: 'Notes' }),
      el('textarea', { class: 'input', oninput: (e) => { draft.note = e.target.value; } }),
      el('div', { class: 'btn-row', style: 'margin-top:12px' },
        el('button', { class: 'btn btn-quiet', onclick: () => close() }, 'Cancel'),
        el('button', {
          class: 'btn btn-primary',
          onclick: () => {
            if (!draft.area.trim()) { toast('Name the area'); return; }
            set((s) => {
              s.profile.constraints = [...(s.profile.constraints || []), { id: `c_${Date.now()}`, ...draft }];
            });
            close();
          },
        }, 'Save'))),
  });
}

function openExercisePicker(title, onPick) {
  const search = { q: '', group: null };
  openSheet({
    title,
    build: ({ rerender, close }) => {
      const state = ctx.store.get();
      return el('div', null,
        el('input', {
          class: 'input', type: 'search', placeholder: 'Search exercises', value: search.q,
          oninput: (e) => { search.q = e.target.value; rerender(); },
        }),
        el('div', { class: 'chips', style: 'margin:8px 0' },
          [null, ...GROUPS].map((g) => el('button', {
            class: 'chip-btn chip-word', 'aria-pressed': String(search.group === g),
            onclick: () => { search.group = g; rerender(); },
          }, g || 'All'))),
        el('div', { class: 'list' }, A.searchLibrary(state, search.q, { group: search.group })
          .slice(0, 60).map((ex) => el('button', {
            class: 'list-row', onclick: () => { close(); onPick(ex); },
          },
            el('div', { class: 'list-row-main' },
              el('div', { class: 'list-name truncate', text: ex.name }),
              el('div', { class: 'list-sub', text: `${ex.group} · ${ex.equipment}` })),
            el('span', { class: 'caret', text: '›' })))));
    },
  });
}

function openFitPicker() {
  openExercisePicker('Rate an exercise', (ex) => openFitSheet(ex));
}

function openPhotoMenu(photo) {
  menuSheet(shortDate(photo.date), [
    photo.note ? { label: photo.note, note: 'Note' } : null,
    {
      label: 'Delete photo', danger: true,
      onClick: async () => {
        const ok = await confirmSheet({ title: 'Delete photo?', message: 'This cannot be undone.', confirm: 'Delete', danger: true });
        if (!ok) return;
        set((s) => { s.photos = (s.photos || []).filter((p) => p.id !== photo.id); });
      },
    },
  ]);
}

function addPhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 720;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/jpeg', 0.72);
      set((s) => {
        s.photos = [...(s.photos || []), { id: `p_${Date.now()}`, date: dateKey(), dataUrl, note: '' }];
      });
      toast('Photo saved to this device');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
