// Weekly volume ledger and per-exercise history. Pure.
//
// The ledger counts *hard sets per region*, not per coarse body part: lateral delts
// are tracked apart from pressing delts, lats apart from upper back, upper chest
// apart from the rest of the chest. That is the language the physique priorities
// are written in, so the numbers answer the question actually being asked.
// A set counts 1.0 toward the region it trains directly and 0.5 toward each region
// the movement trains meaningfully but not primarily.

import { parseKey, dateKey, addDays } from './schedule.js';
import { effectiveReps } from './progression.js';

export const LEDGER_GROUPS = [
  'Upper chest', 'Chest', 'Front delts', 'Lateral delts', 'Rear delts',
  'Lats', 'Upper back', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Midsection', 'Power',
];

const FAMILY_LEDGER = {
  'incline-press': 'Upper chest',
  'flat-press': 'Chest',
  'chest-fly': 'Chest',
  'vertical-press': 'Front delts',
  'lateral-raise': 'Lateral delts',
  'rear-delt': 'Rear delts',
  'vertical-pull': 'Lats',
  'horizontal-pull': 'Upper back',
  'upper-back': 'Upper back',
  squat: 'Quads',
  'unilateral-squat': 'Quads',
  'knee-extension': 'Quads',
  hinge: 'Hamstrings',
  'knee-flexion': 'Hamstrings',
  'hip-extension': 'Glutes',
  calf: 'Calves',
  'elbow-flexion': 'Biceps',
  'elbow-extension': 'Triceps',
  'anti-extension': 'Midsection',
  'core-flexion': 'Midsection',
  carry: 'Midsection',
  jump: 'Power',
  throw: 'Power',
  sprint: 'Power',
  pogo: 'Power',
};

// A low-to-high fly is an upper-chest movement even though its family is chest-fly.
const EXERCISE_LEDGER = {
  'cable-fly-low-high': 'Upper chest',
  'cable-fly-incline': 'Upper chest',
};

/** Which region a logged entry (or library exercise) counts toward. */
export function ledgerGroupOf(entry) {
  if (!entry) return 'Other';
  if (EXERCISE_LEDGER[entry.exerciseId || entry.id]) return EXERCISE_LEDGER[entry.exerciseId || entry.id];
  return FAMILY_LEDGER[entry.family] || entry.group || 'Other';
}

export const PRIORITY_LEDGER = {
  'upper-chest': 'Upper chest',
  'lateral-delts': 'Lateral delts',
  lats: 'Lats',
  'upper-back': 'Upper back',
  arms: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  glutes: 'Glutes',
  calves: 'Calves',
  midsection: 'Midsection',
};

/** Default weekly hard-set band for a region. Priority regions get the higher band. */
export function defaultTargets(priorities = []) {
  const priorityGroups = new Set(priorities.map((p) => PRIORITY_LEDGER[p]).filter(Boolean));
  const base = {
    'Upper chest': [10, 14], Chest: [6, 10], 'Front delts': [6, 10],
    'Lateral delts': [12, 16], 'Rear delts': [6, 10],
    Lats: [10, 14], 'Upper back': [10, 14],
    // Arms collect a lot of half-credit from the pulls and presses, so their band sits higher.
    Biceps: [12, 18], Triceps: [12, 18],
    Quads: [10, 14], Hamstrings: [10, 14], Glutes: [8, 12], Calves: [6, 10],
    Midsection: [8, 12], Power: [0, 0],
  };
  const out = {};
  for (const g of LEDGER_GROUPS) {
    out[g] = priorityGroups.has(g) ? { min: 14, max: 18 } : { min: base[g][0], max: base[g][1] };
  }
  return out;
}

/** Monday of the week containing key. */
export function weekStart(key) {
  const d = parseKey(key);
  const wd = d.getDay();            // 0 Sun .. 6 Sat
  const back = wd === 0 ? 6 : wd - 1;
  return addDays(dateKey(d), -back);
}

export function inWeek(key, start) {
  return key >= start && key <= addDays(start, 6);
}

/**
 * Completed sets for the week containing `key`, by region, split into planned work
 * (came from the program) and added work (put in by hand that day).
 * Secondary regions earn half credit.
 */
export function weeklyLedger(sessions, key, targets = null) {
  const start = weekStart(key);
  const map = new Map();
  const row = (g) => {
    if (!map.has(g)) map.set(g, { group: g, planned: 0, added: 0, indirect: 0 });
    return map.get(g);
  };
  let planned = 0, added = 0;
  for (const s of sessions) {
    if (!inWeek(s.dateKey, start)) continue;
    for (const e of s.exercises || []) {
      const done = (e.sets || []).filter((x) => x.done).length;
      if (!done) continue;
      const g = ledgerGroupOf(e);
      if (e.added) { row(g).added += done; added += done; } else { row(g).planned += done; planned += done; }
      for (const sec of e.secondary || []) row(sec).indirect += done * 0.5;
    }
  }
  const groups = [...map.values()]
    .map((r) => ({
      ...r,
      indirect: Math.round(r.indirect * 10) / 10,
      total: Math.round((r.planned + r.added + r.indirect) * 10) / 10,
      target: targets ? targets[r.group] || null : null,
    }))
    .sort((a, b) => b.total - a.total);
  return { weekStart: start, groups, planned, added, total: planned + added };
}

/** One point per session in which the exercise was actually performed. */
export function historyFor(sessions, exerciseId) {
  const pts = [];
  for (const s of sessions) {
    for (const e of s.exercises || []) {
      if (e.exerciseId !== exerciseId) continue;
      const done = (e.sets || []).filter((x) => x.done);
      if (!done.length) continue;
      let topLoad = 0, topReps = 0, volume = 0;
      for (const set of done) {
        const reps = effectiveReps(set, e.unilateral);
        const load = Number(set.load || 0);
        volume += reps * (load || 1);
        if (load > topLoad || (load === topLoad && reps > topReps)) { topLoad = load; topReps = reps; }
      }
      pts.push({
        date: s.dateKey, sessionId: s.id, exerciseId,
        sets: done.length, topLoad, topReps, volume,
        isFoundation: !!e.isFoundation, family: e.family, name: e.name,
      });
    }
  }
  return pts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Every exercise that has at least one completed set, newest first by last performed. */
export function performedExercises(sessions) {
  const map = new Map();
  for (const s of sessions) {
    for (const e of s.exercises || []) {
      const done = (e.sets || []).filter((x) => x.done).length;
      if (!done) continue;
      const row = map.get(e.exerciseId) || {
        exerciseId: e.exerciseId, name: e.name, group: e.group, family: e.family,
        sessions: 0, last: '', isFoundation: !!e.isFoundation,
      };
      row.sessions += 1;
      if (s.dateKey > row.last) { row.last = s.dateKey; row.isFoundation = !!e.isFoundation; }
      map.set(e.exerciseId, row);
    }
  }
  return [...map.values()].sort((a, b) => (b.last < a.last ? -1 : b.last > a.last ? 1 : a.name.localeCompare(b.name)));
}

/** Sibling movements in the same family that have history, for family context. */
export function familyContext(sessions, entryFamily, exerciseId) {
  const rows = performedExercises(sessions).filter((r) => r.family === entryFamily);
  return {
    family: entryFamily,
    siblings: rows.filter((r) => r.exerciseId !== exerciseId),
    self: rows.find((r) => r.exerciseId === exerciseId) || null,
  };
}
