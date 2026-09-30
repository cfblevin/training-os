// Pure date + rotation + plan-materialisation logic. No DOM, no storage.

export const ROTATION_ANCHOR = '2026-01-05'; // a Monday

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function weekdayOf(key) {
  return parseKey(key).getDay();
}

const DAY_MS = 86400000;

/** Whole weeks elapsed since the rotation anchor. Negative dates floor correctly. */
export function weekIndex(key, anchor = ROTATION_ANCHOR) {
  const days = Math.round((parseKey(key) - parseKey(anchor)) / DAY_MS);
  return Math.floor(days / 7);
}

export function shortDate(key) {
  const d = parseKey(key);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function weekdayLabel(key) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short' });
}

export function dayNumber(key) {
  return String(parseKey(key).getDate());
}

export function relativeLabel(key, today = dateKey()) {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return shortDate(key);
}

/** "Today · Tue, Sep 29" without repeating itself for ordinary dates. */
export function dateHeading(key, today = dateKey()) {
  const rel = relativeLabel(key, today);
  const full = shortDate(key);
  return rel === full ? full : `${rel} · ${full}`;
}

/**
 * Which exercise a slot uses in a given week.
 * An anchor slot runs the same movement every week — that is the whole point of it.
 * A rotating slot cycles one movement per week through its pool, so variety arrives
 * on a schedule rather than on a whim.
 */
export function pickSlotExercise(slot, wIdx) {
  const pool = [slot.foundation, ...(slot.variations || [])];
  if (slot.anchor || pool.length === 1) {
    return { exerciseId: slot.foundation, isFoundation: true, isAnchor: !!slot.anchor };
  }
  const i = ((wIdx % pool.length) + pool.length) % pool.length;
  return { exerciseId: pool[i], isFoundation: i === 0, isAnchor: false };
}

/** How often a slot runs its headline movement. 1 for anchors. */
export function foundationShare(slot) {
  const pool = [slot.foundation, ...(slot.variations || [])];
  if (slot.anchor || pool.length === 1) return 1;
  return 1 / pool.length;
}

/** Share of a program's weekly sets performed on anchor lifts. */
export function anchorShare(program, { includeLight = true } = {}) {
  let anchor = 0, total = 0;
  for (const day of program.days) {
    if (!includeLight && day.light) continue;
    for (const slot of day.slots) {
      total += slot.sets;
      if (slot.anchor) anchor += slot.sets;
    }
  }
  return total ? anchor / total : 0;
}

export function templateForDate(program, key) {
  const wd = weekdayOf(key);
  return program.days.find((d) => d.weekday === wd) || null;
}

/**
 * Build the concrete exercise list for a date from the program template.
 * loadFor(exerciseId) supplies the current working load.
 */
export function materializePlan({ program, mode, key, libMap, loadFor }) {
  const tpl = templateForDate(program, key);
  if (!tpl) return { dateKey: key, mode, dayId: null, title: 'Rest', why: '', rest: true, exercises: [] };
  const wIdx = weekIndex(key);
  const exercises = tpl.slots.map((slot) => {
    const { exerciseId, isFoundation } = pickSlotExercise(slot, wIdx);
    return buildEntry({ slot, exerciseId, isFoundation, libMap, loadFor, uid: slot.id });
  }).filter(Boolean);
  return {
    dateKey: key, mode, dayId: tpl.id, title: tpl.title, why: tpl.why,
    rest: false, light: !!tpl.light, exercises,
  };
}

export function buildEntry({ slot, exerciseId, isFoundation, libMap, loadFor, uid, added = false }) {
  const ex = libMap.get(exerciseId);
  if (!ex) return null;
  return {
    uid: uid || `${slot.id}-${exerciseId}-${Math.random().toString(36).slice(2, 7)}`,
    slotId: slot.id,
    family: slot.family,
    group: slot.group || ex.group,
    exerciseId,
    name: ex.name,
    equipment: ex.equipment,
    unilateral: ex.unilateral,
    loadConvention: ex.loadConvention,
    increment: ex.increment,
    secondary: ex.secondary || [],
    priority: slot.priority || (ex.tags && ex.tags[0]) || null,
    foundationId: slot.foundation,
    isFoundation,
    isAnchor: !!slot.anchor,
    plannedSets: slot.sets,
    repMin: slot.repMin,
    repMax: slot.repMax,
    restSec: slot.restSec,
    unit: slot.unit || 'reps',
    load: loadFor ? loadFor(exerciseId) : (ex.defaultLoad || 0),
    added,
  };
}
