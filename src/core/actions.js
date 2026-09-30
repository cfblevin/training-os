// All workout/plan mutations. Functions take the state object and mutate it in
// place (they are called inside store.update). Kept free of DOM so they are testable.

import { LIBRARY, libraryById } from '../data/library.js';
import { materializePlan, buildEntry, templateForDate, addDays } from './schedule.js';
import { evaluateProgression, effectiveReps } from './progression.js';
import { deepClone } from './store.js';

export function libMapFor(state) {
  return libraryById(state.customExercises || []);
}

export function exerciseById(state, id) {
  return libMapFor(state).get(id) || null;
}

export function loadFor(state, exerciseId) {
  const rec = (state.loads || {})[exerciseId];
  if (rec && typeof rec.load === 'number') return rec.load;
  const ex = exerciseById(state, exerciseId);
  return ex ? (ex.defaultLoad || 0) : 0;
}

export function incrementFor(state, exerciseId) {
  const rec = (state.loads || {})[exerciseId];
  if (rec && typeof rec.increment === 'number') return rec.increment;
  const ex = exerciseById(state, exerciseId);
  return ex ? ex.increment : 5;
}

export function mode(state) { return state.settings.mode; }

export function programOf(state) { return state.program[mode(state)]; }

export function sessionFor(state, key) {
  return (state.sessions || []).find((s) => s.dateKey === key && s.mode === mode(state)) || null;
}

function refreshLoads(state, plan) {
  for (const e of plan.exercises) {
    e.load = loadFor(state, e.exerciseId);
    e.increment = incrementFor(state, e.exerciseId);
  }
  return plan;
}

/** Session (real, logged) > single-date override > program template.
 *  A day merely marked as trained holds no sets, so the scheduled plan still shows. */
export function planFor(state, key) {
  const s = sessionFor(state, key);
  if (s && !s.unlogged) return s;
  const ov = (state.dayOverrides || {})[key];
  if (ov && ov.mode === mode(state)) return refreshLoads(state, deepClone(ov));
  return materializePlan({
    program: programOf(state), mode: mode(state), key,
    libMap: libMapFor(state), loadFor: (id) => loadFor(state, id),
  });
}

export function isRest(state, key) {
  const p = planFor(state, key);
  return !!p.rest || (p.exercises || []).length === 0;
}

export function nextTrainingDay(state, fromKey, limit = 14) {
  let k = fromKey;
  for (let i = 1; i <= limit; i++) {
    k = addDays(k, 1);
    if (!isRest(state, k)) return k;
  }
  return null;
}

/** The single-date working copy used by "today only" edits. */
export function ensureOverride(state, key) {
  state.dayOverrides = state.dayOverrides || {};
  if (!state.dayOverrides[key] || state.dayOverrides[key].mode !== mode(state)) {
    const base = planFor(state, key);
    state.dayOverrides[key] = deepClone({ ...base, rest: !!base.rest, overridden: true });
  }
  return state.dayOverrides[key];
}

function targetEntries(state, key) {
  const s = sessionFor(state, key);
  if (s) return { list: s.exercises, container: s };
  const ov = ensureOverride(state, key);
  return { list: ov.exercises, container: ov };
}

function templateSlots(state, key) {
  const tpl = templateForDate(programOf(state), key);
  return tpl ? tpl.slots : null;
}

// ------------------------------------------------------------------ sessions

export function newId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Close a day out without logging it. Used when the session genuinely happened
 * but was not recorded set by set. It records that you trained and nothing else:
 * no invented sets, no volume, no progression signal. Honest about the gap.
 */
export function markDayTrained(state, key, note = '') {
  const existing = sessionFor(state, key);
  if (existing && !existing.unlogged) return existing;   // real data already there — leave it alone
  if (existing) {
    if (note) existing.notes = note;
    return existing;
  }
  const plan = planFor(state, key);
  const now = new Date().toISOString();
  const session = {
    id: newId('s'),
    dateKey: key,
    mode: mode(state),
    dayId: plan.dayId,
    title: plan.title,
    why: plan.why,
    status: 'completed',
    unlogged: true,
    startedAt: now,
    completedAt: now,
    notes: note,
    exercises: [],
  };
  state.sessions.push(session);
  return session;
}

export function unmarkDayTrained(state, key) {
  const s = sessionFor(state, key);
  if (!s || !s.unlogged) return false;
  deleteSession(state, s.id);
  return true;
}

export function isUnlogged(session) {
  return !!(session && session.unlogged);
}

/** The load a session should open at: the baseline, or what was actually lifted
 *  last time if that is higher. Working above baseline without accepting a
 *  suggestion is normal, and the app should not keep proposing the old number. */
export function workingLoad(state, exerciseId, beforeKey) {
  const base = Number(loadFor(state, exerciseId)) || 0;
  const last = lastPerformance(state, exerciseId, beforeKey);
  return last && Number(last.topLoad) > base ? Number(last.topLoad) : base;
}

function openingEntries(state, plan, key) {
  return plan.exercises.map((e) => {
    const load = workingLoad(state, e.exerciseId, key);
    return {
      ...deepClone(e),
      load,
      sets: Array.from({ length: e.plannedSets }, () => ({
        load, reps: null, repsL: null, repsR: null, done: false, at: null,
      })),
    };
  });
}

export function startSession(state, key) {
  const existing = sessionFor(state, key);
  // A day marked as trained can still be logged properly afterwards.
  if (existing && existing.unlogged) {
    const plan = planFor(state, key);
    existing.unlogged = false;
    existing.status = 'active';
    existing.completedAt = null;
    existing.exercises = openingEntries(state, plan, key);
    return existing;
  }
  if (existing) return existing;
  const plan = planFor(state, key);
  const session = {
    id: newId('s'),
    dateKey: key,
    mode: mode(state),
    dayId: plan.dayId,
    title: plan.title,
    why: plan.why,
    status: 'active',
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: '',
    exercises: openingEntries(state, plan, key),
  };
  state.sessions.push(session);
  return session;
}

export function entryOf(session, uid) {
  return (session.exercises || []).find((e) => e.uid === uid) || null;
}

/**
 * Edit one set. By default this touches only that set; applying to the
 * remaining sets is an explicit, separate choice made in the UI.
 */
export function patchSet(session, uid, index, patch, { applyToRemaining = false } = {}) {
  const e = entryOf(session, uid);
  if (!e) return null;
  const set = e.sets[index];
  if (!set) return null;
  Object.assign(set, patch);
  if (applyToRemaining) {
    for (let i = index + 1; i < e.sets.length; i++) {
      if (e.sets[i].done) continue;
      if (patch.load !== undefined) e.sets[i].load = patch.load;
      if (patch.reps !== undefined) e.sets[i].reps = patch.reps;
      if (patch.repsL !== undefined) e.sets[i].repsL = patch.repsL;
      if (patch.repsR !== undefined) e.sets[i].repsR = patch.repsR;
    }
  }
  return e;
}

export function completeSet(session, uid, index, patch = {}) {
  const e = entryOf(session, uid);
  if (!e) return null;
  const set = e.sets[index];
  if (!set) return null;
  Object.assign(set, patch);
  if (e.unilateral) {
    if (set.repsL == null && set.reps != null) set.repsL = set.reps;
    if (set.repsR == null && set.reps != null) set.repsR = set.reps;
  }
  set.done = true;
  set.at = new Date().toISOString();
  return e;
}

export function uncompleteSet(session, uid, index) {
  const e = entryOf(session, uid);
  if (!e) return null;
  const set = e.sets[index];
  if (!set) return null;
  set.done = false;
  set.at = null;
  return e;
}

export function entryComplete(e) {
  return (e.sets || []).length > 0 && e.sets.every((s) => s.done);
}

export function sessionComplete(session) {
  const list = session.exercises || [];
  return list.length > 0 && list.every(entryComplete);
}

export function sessionProgress(session) {
  let done = 0, total = 0;
  for (const e of session.exercises || []) {
    total += e.sets.length;
    done += e.sets.filter((s) => s.done).length;
  }
  return { done, total };
}

/** Records earned suggestions. Never changes a load on its own. */
export function computeSuggestions(state, session) {
  state.suggestions = state.suggestions || {};
  for (const e of session.exercises || []) {
    const p = evaluateProgression(e);
    if (!p.earned) continue;
    const current = loadFor(state, e.exerciseId);
    const inc = incrementFor(state, e.exerciseId);
    if (!inc) continue;
    state.suggestions[e.exerciseId] = {
      from: current, to: current + inc, earnedOn: session.dateKey, name: e.name,
    };
  }
  return state.suggestions;
}

export function finishSession(state, sessionId) {
  const s = (state.sessions || []).find((x) => x.id === sessionId);
  if (!s) return null;
  s.status = 'completed';
  s.completedAt = new Date().toISOString();
  computeSuggestions(state, s);
  return s;
}

export function acceptSuggestion(state, exerciseId) {
  const sug = (state.suggestions || {})[exerciseId];
  if (!sug) return;
  state.loads[exerciseId] = {
    ...(state.loads[exerciseId] || {}),
    load: sug.to,
    increment: incrementFor(state, exerciseId),
    established: true,
  };
  delete state.suggestions[exerciseId];
}

export function keepCurrentLoad(state, exerciseId) {
  if (state.suggestions) delete state.suggestions[exerciseId];
}

export function setBaseline(state, exerciseId, load, increment) {
  state.loads[exerciseId] = {
    load: Number(load),
    increment: increment != null ? Number(increment) : incrementFor(state, exerciseId),
    established: true,
  };
}

// ------------------------------------------------------------------ plan edits
// scope: 'today' (this date only) | 'future' (the weekly program template)

function applyToTemplate(state, key, fn) {
  const slots = templateSlots(state, key);
  if (!slots) return false;
  fn(slots);
  return true;
}

export function swapExercise(state, key, uid, newExerciseId, scope = 'today') {
  const ex = exerciseById(state, newExerciseId);
  if (!ex) return null;
  const { list } = targetEntries(state, key);
  const idx = list.findIndex((e) => e.uid === uid);
  if (idx < 0) return null;
  const old = list[idx];
  const performed = (old.sets || []).filter((s) => s.done);

  const fresh = {
    ...old,
    uid: performed.length ? newId('e') : old.uid,
    exerciseId: ex.id,
    name: ex.name,
    equipment: ex.equipment,
    unilateral: ex.unilateral,
    loadConvention: ex.loadConvention,
    increment: incrementFor(state, ex.id),
    load: loadFor(state, ex.id),
    isFoundation: ex.id === old.foundationId,
    swappedFrom: old.exerciseId,
  };
  if (old.sets) {
    const remaining = Math.max(1, (old.plannedSets || old.sets.length) - performed.length);
    fresh.sets = Array.from({ length: performed.length ? remaining : old.sets.length }, () => ({
      load: fresh.load, reps: null, repsL: null, repsR: null, done: false, at: null,
    }));
    fresh.plannedSets = fresh.sets.length;
  }

  if (performed.length) {
    // Keep what was actually performed under the exercise that was performed.
    old.sets = performed;
    old.plannedSets = performed.length;
    old.locked = true;
    list.splice(idx + 1, 0, fresh);
  } else {
    list[idx] = fresh;
  }

  if (scope === 'future') {
    applyToTemplate(state, key, (slots) => {
      const slot = slots.find((s) => s.id === old.slotId);
      if (!slot) return;
      slot.foundation = ex.id;
      slot.variations = (slot.variations || []).filter((v) => v !== ex.id);
    });
  }
  return fresh;
}

export function addExercise(state, key, exerciseId, scope = 'today', opts = {}) {
  const ex = exerciseById(state, exerciseId);
  if (!ex) return null;
  const slot = {
    id: opts.slotId || newId('slot'),
    family: ex.family,
    group: ex.group,
    foundation: ex.id,
    variations: [],
    rotation: 'F',
    sets: opts.sets ?? 3,
    repMin: opts.repMin ?? 8,
    repMax: opts.repMax ?? 12,
    restSec: opts.restSec ?? 90,
    priority: (ex.tags && ex.tags[0]) || null,
    unit: 'reps',
  };
  const entry = buildEntry({
    slot, exerciseId: ex.id, isFoundation: true,
    libMap: libMapFor(state), loadFor: (id) => loadFor(state, id),
    uid: newId('e'), added: scope !== 'future',
  });
  const { list } = targetEntries(state, key);
  list.push({
    ...entry,
    sets: Array.from({ length: slot.sets }, () => ({
      load: entry.load, reps: null, repsL: null, repsR: null, done: false, at: null,
    })),
  });
  if (scope === 'future') applyToTemplate(state, key, (slots) => slots.push(slot));
  return entry;
}

export function removeExercise(state, key, uid, scope = 'today') {
  const { list } = targetEntries(state, key);
  const idx = list.findIndex((e) => e.uid === uid);
  if (idx < 0) return false;
  const [removed] = list.splice(idx, 1);
  if (scope === 'future') {
    applyToTemplate(state, key, (slots) => {
      const i = slots.findIndex((s) => s.id === removed.slotId);
      if (i >= 0) slots.splice(i, 1);
    });
  }
  return true;
}

export function duplicateExercise(state, key, uid, scope = 'today') {
  const { list } = targetEntries(state, key);
  const idx = list.findIndex((e) => e.uid === uid);
  if (idx < 0) return null;
  const src = list[idx];
  const copy = deepClone(src);
  copy.uid = newId('e');
  copy.slotId = newId('slot');
  copy.added = true;
  copy.locked = false;
  copy.sets = Array.from({ length: src.plannedSets || (src.sets || []).length || 3 }, () => ({
    load: src.load, reps: null, repsL: null, repsR: null, done: false, at: null,
  }));
  list.splice(idx + 1, 0, copy);
  if (scope === 'future') {
    applyToTemplate(state, key, (slots) => {
      const slot = slots.find((s) => s.id === src.slotId);
      if (slot) slots.push({ ...deepClone(slot), id: copy.slotId });
    });
  }
  return copy;
}

/** patch may contain plannedSets, repMin, repMax, restSec. */
export function editEntry(state, key, uid, patch, scope = 'today') {
  const { list } = targetEntries(state, key);
  const e = list.find((x) => x.uid === uid);
  if (!e) return null;
  if (patch.plannedSets != null) {
    const n = Math.max(1, Math.min(12, Number(patch.plannedSets)));
    e.plannedSets = n;
    if (e.sets) {
      while (e.sets.length < n) e.sets.push({ load: e.load, reps: null, repsL: null, repsR: null, done: false, at: null });
      while (e.sets.length > n && !e.sets[e.sets.length - 1].done) e.sets.pop();
    }
  }
  if (patch.repMin != null) e.repMin = Math.max(1, Number(patch.repMin));
  if (patch.repMax != null) e.repMax = Math.max(e.repMin, Number(patch.repMax));
  if (patch.restSec != null) e.restSec = Math.max(0, Number(patch.restSec));
  if (scope === 'future') {
    applyToTemplate(state, key, (slots) => {
      const slot = slots.find((s) => s.id === e.slotId);
      if (!slot) return;
      if (patch.plannedSets != null) slot.sets = e.plannedSets;
      if (patch.repMin != null) slot.repMin = e.repMin;
      if (patch.repMax != null) slot.repMax = e.repMax;
      if (patch.restSec != null) slot.restSec = e.restSec;
    });
  }
  return e;
}

export function resetDay(state, key) {
  if (state.dayOverrides) delete state.dayOverrides[key];
}

// ------------------------------------------------------------- recommendations

const FAMILY_NEIGHBOURS = {
  'incline-press': ['flat-press', 'chest-fly'],
  'flat-press': ['incline-press', 'chest-fly'],
  'chest-fly': ['incline-press', 'flat-press'],
  'vertical-press': ['lateral-raise', 'incline-press'],
  'lateral-raise': ['rear-delt', 'vertical-press'],
  'rear-delt': ['lateral-raise', 'upper-back'],
  'horizontal-pull': ['vertical-pull', 'upper-back'],
  'vertical-pull': ['horizontal-pull', 'upper-back'],
  'upper-back': ['horizontal-pull', 'rear-delt'],
  squat: ['unilateral-squat', 'knee-extension'],
  'unilateral-squat': ['squat', 'knee-extension'],
  'knee-extension': ['squat', 'unilateral-squat'],
  hinge: ['hip-extension', 'knee-flexion'],
  'hip-extension': ['hinge', 'knee-flexion'],
  'knee-flexion': ['hinge', 'hip-extension'],
  calf: [],
  'elbow-flexion': [],
  'elbow-extension': [],
  'anti-extension': ['core-flexion', 'carry'],
  'core-flexion': ['anti-extension'],
  carry: ['anti-extension'],
};

function fitScore(state, ex) {
  const fit = (state.profile.fit || {})[ex.id];
  if (fit === 'preferred') return 3;
  if (fit === 'poor') return -3;
  if (fit === 'avoid') return -10;
  return 0;
}

function priorityScore(state, ex) {
  const prios = state.profile.physiquePriorities || [];
  return (ex.tags || []).some((t) => prios.includes(t)) ? 2 : 0;
}

/** Swap candidates: same stimulus first. Never unrelated movements. */
export function swapCandidates(state, entry, presentIds = []) {
  const map = libMapFor(state);
  const all = [...map.values()];
  const neighbours = FAMILY_NEIGHBOURS[entry.family] || [];
  const scored = [];
  for (const ex of all) {
    if (ex.id === entry.exerciseId) continue;
    if ((ex.modes || []).length && !ex.modes.includes(mode(state))) continue;
    let score = 0;
    if (ex.family === entry.family) score += 10;
    else if (neighbours.includes(ex.family) && ex.group === entry.group) score += 6;
    else if (neighbours.includes(ex.family)) score += 4;
    else if (ex.group === entry.group) score += 3;
    else continue; // unrelated: not a recommendation
    if (ex.id === entry.foundationId) score += 2;
    score += fitScore(state, ex) + priorityScore(state, ex);
    if (presentIds.includes(ex.id)) score -= 5;
    scored.push({ ex, score, inWorkout: presentIds.includes(ex.id) });
  }
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return scored.filter((s) => s.score > 0).slice(0, 8);
}

/** Add candidates: muscle groups already trained today, excluding what is in the workout. */
export function addCandidates(state, key) {
  const plan = planFor(state, key);
  const present = new Set((plan.exercises || []).map((e) => e.exerciseId));
  const groups = new Set((plan.exercises || []).map((e) => e.group));
  const families = new Set((plan.exercises || []).map((e) => e.family));
  const map = libMapFor(state);
  const scored = [];
  for (const ex of map.values()) {
    if (present.has(ex.id)) continue;
    if ((ex.modes || []).length && !ex.modes.includes(mode(state))) continue;
    if (!groups.has(ex.group)) continue;
    let score = 4;
    if (families.has(ex.family)) score += 2;
    score += fitScore(state, ex) + priorityScore(state, ex);
    if (score <= 0) continue;
    scored.push({ ex, score });
  }
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return scored.slice(0, 10);
}

export function searchLibrary(state, query, { excludeIds = [], group = null } = {}) {
  const q = (query || '').trim().toLowerCase();
  const map = libMapFor(state);
  const out = [];
  for (const ex of map.values()) {
    if (excludeIds.includes(ex.id)) continue;
    if (group && ex.group !== group) continue;
    if (q) {
      const hay = `${ex.name} ${ex.group} ${ex.family} ${ex.equipment}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(ex);
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

export function createCustomExercise(state, def) {
  const id = `custom-${(def.name || 'exercise').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 5)}`;
  const ex = {
    id,
    name: def.name.trim(),
    group: def.group,
    family: def.family,
    equipment: def.equipment || 'Custom',
    unilateral: !!def.unilateral,
    loadConvention: def.loadConvention || 'total',
    increment: Number(def.increment || 5),
    defaultLoad: Number(def.defaultLoad || 0),
    tags: [],
    fit: '',
    modes: ['physique', 'strength', 'athletic'],
    custom: true,
  };
  state.customExercises = state.customExercises || [];
  state.customExercises.push(ex);
  state.loads[id] = { load: ex.defaultLoad, increment: ex.increment, established: false };
  return ex;
}

// ------------------------------------------------------------- past corrections

export function editPastSet(state, sessionId, uid, index, patch) {
  const s = (state.sessions || []).find((x) => x.id === sessionId);
  if (!s) return null;
  const e = entryOf(s, uid);
  if (!e || !e.sets[index]) return null;
  Object.assign(e.sets[index], patch);
  return e;
}

export function addPastSet(state, sessionId, uid) {
  const s = (state.sessions || []).find((x) => x.id === sessionId);
  const e = s && entryOf(s, uid);
  if (!e) return null;
  const last = e.sets[e.sets.length - 1];
  e.sets.push({
    load: last ? last.load : e.load, reps: last ? last.reps : null,
    repsL: last ? last.repsL : null, repsR: last ? last.repsR : null,
    done: true, at: new Date().toISOString(),
  });
  e.plannedSets = Math.max(e.plannedSets || 0, e.sets.length);
  return e;
}

export function removePastSet(state, sessionId, uid, index) {
  const s = (state.sessions || []).find((x) => x.id === sessionId);
  const e = s && entryOf(s, uid);
  if (!e) return null;
  e.sets.splice(index, 1);
  return e;
}

/** Correct which exercise a completed entry actually was. */
export function reassignPastExercise(state, sessionId, uid, exerciseId) {
  const s = (state.sessions || []).find((x) => x.id === sessionId);
  const e = s && entryOf(s, uid);
  const ex = exerciseById(state, exerciseId);
  if (!e || !ex) return null;
  e.exerciseId = ex.id;
  e.name = ex.name;
  e.unilateral = ex.unilateral;
  e.loadConvention = ex.loadConvention;
  e.equipment = ex.equipment;
  e.family = ex.family;
  e.group = ex.group;
  e.isFoundation = ex.id === e.foundationId;
  e.corrected = true;
  return e;
}

export function setSessionNotes(state, sessionId, notes) {
  const s = (state.sessions || []).find((x) => x.id === sessionId);
  if (s) s.notes = notes;
  return s;
}

export function deleteSession(state, sessionId) {
  const i = (state.sessions || []).findIndex((x) => x.id === sessionId);
  if (i >= 0) state.sessions.splice(i, 1);
}

/** Last comparable performance for an exercise before a given date. */
export function lastPerformance(state, exerciseId, beforeKey) {
  const rows = [];
  for (const s of state.sessions || []) {
    if (beforeKey && s.dateKey >= beforeKey) continue;
    for (const e of s.exercises || []) {
      if (e.exerciseId !== exerciseId) continue;
      const done = (e.sets || []).filter((x) => x.done);
      if (!done.length) continue;
      let topLoad = 0, topReps = 0;
      for (const set of done) {
        const reps = effectiveReps(set, e.unilateral);
        if (Number(set.load || 0) > topLoad || (Number(set.load || 0) === topLoad && reps > topReps)) {
          topLoad = Number(set.load || 0); topReps = reps;
        }
      }
      rows.push({ dateKey: s.dateKey, sets: done.length, topLoad, topReps });
    }
  }
  rows.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  return rows[0] || null;
}

// ------------------------------------------------------------------- blocks
// Anchors stay put for the length of a block so their numbers mean something.
// At the end of the block the app reports what moved and asks what to change.

export function blockState(state, today) {
  const b = state.block || { startedOn: today, weeks: 6, number: 1 };
  const days = Math.max(0, Math.round((parseKeyLocal(today) - parseKeyLocal(b.startedOn)) / 86400000));
  const week = Math.floor(days / 7) + 1;
  const endsOn = addDays(b.startedOn, b.weeks * 7 - 1);
  return {
    ...b,
    week: Math.min(week, b.weeks + 99),
    daysIn: days,
    endsOn,
    complete: today > endsOn,
    daysLeft: Math.max(0, Math.round((parseKeyLocal(endsOn) - parseKeyLocal(today)) / 86400000)),
  };
}

function parseKeyLocal(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function startNewBlock(state, today, weeks) {
  const prev = state.block || {};
  state.block = {
    id: `blk_${Date.now().toString(36)}`,
    startedOn: today,
    weeks: Number(weeks || prev.weeks || 6),
    number: Number(prev.number || 0) + 1,
    reviewedOn: today,
  };
  return state.block;
}

export function setBlockLength(state, weeks) {
  state.block = { ...(state.block || {}), weeks: Math.max(1, Math.min(16, Number(weeks) || 6)) };
  return state.block;
}

/** Every anchor slot across the current mode's week. */
export function anchorSlots(state) {
  const program = programOf(state);
  const map = libMapFor(state);
  const out = [];
  for (const day of program.days) {
    for (const slot of day.slots) {
      if (!slot.anchor) continue;
      out.push({
        dayId: day.id, dayTitle: day.title, weekday: day.weekday,
        slot, exercise: map.get(slot.foundation) || null,
      });
    }
  }
  return out;
}

/** Rotating pools, for showing what variety is scheduled. */
export function rotatingSlots(state) {
  const program = programOf(state);
  const map = libMapFor(state);
  const out = [];
  for (const day of program.days) {
    for (const slot of day.slots) {
      if (slot.anchor) continue;
      out.push({
        dayId: day.id, dayTitle: day.title,
        slot,
        pool: [slot.foundation, ...(slot.variations || [])].map((id) => map.get(id)).filter(Boolean),
      });
    }
  }
  return out;
}

/** Change which movement an anchor slot uses from here on. */
export function setAnchorExercise(state, dayId, slotId, exerciseId) {
  const ex = exerciseById(state, exerciseId);
  if (!ex) return null;
  const day = programOf(state).days.find((d) => d.id === dayId);
  const slot = day && day.slots.find((x) => x.id === slotId);
  if (!slot) return null;
  const previous = slot.foundation;
  slot.foundation = ex.id;
  slot.family = ex.family;
  slot.group = ex.group;
  slot.variations = (slot.variations || []).filter((v) => v !== ex.id);
  if (previous && previous !== ex.id && !slot.variations.includes(previous)) {
    // The old anchor is still a decent movement; keep it available as a swap option.
    slot.retired = previous;
  }
  return slot;
}

export function addRotationOption(state, dayId, slotId, exerciseId) {
  const day = programOf(state).days.find((d) => d.id === dayId);
  const slot = day && day.slots.find((x) => x.id === slotId);
  if (!slot || slot.foundation === exerciseId) return null;
  slot.variations = [...new Set([...(slot.variations || []), exerciseId])];
  return slot;
}

export function removeRotationOption(state, dayId, slotId, exerciseId) {
  const day = programOf(state).days.find((d) => d.id === dayId);
  const slot = day && day.slots.find((x) => x.id === slotId);
  if (!slot) return null;
  slot.variations = (slot.variations || []).filter((v) => v !== exerciseId);
  return slot;
}

/**
 * How each anchor moved across the current block: first logged top set against
 * the most recent one. Only completed sets count.
 */
export function blockReview(state, today) {
  const b = blockState(state, today);
  const rows = [];
  for (const { dayId, dayTitle, slot, exercise } of anchorSlots(state)) {
    if (!exercise) continue;
    const points = [];
    for (const s of state.sessions || []) {
      if (s.dateKey < b.startedOn || s.dateKey > today) continue;
      for (const e of s.exercises || []) {
        if (e.exerciseId !== exercise.id) continue;
        const done = (e.sets || []).filter((x) => x.done);
        if (!done.length) continue;
        let topLoad = 0, topReps = 0;
        for (const set of done) {
          const load = Number(set.load || 0);
          const reps = effectiveReps(set, e.unilateral);
          if (load > topLoad || (load === topLoad && reps > topReps)) { topLoad = load; topReps = reps; }
        }
        points.push({ date: s.dateKey, topLoad, topReps });
      }
    }
    points.sort((a, b2) => (a.date < b2.date ? -1 : 1));
    const first = points[0] || null;
    const last = points[points.length - 1] || null;
    const loadChange = first && last ? last.topLoad - first.topLoad : 0;
    const repChange = first && last ? last.topReps - first.topReps : 0;
    let verdict = 'no data';
    if (points.length >= 2) {
      if (loadChange > 0) verdict = 'progressing';
      else if (loadChange === 0 && repChange > 0) verdict = 'progressing';
      else if (loadChange === 0 && repChange === 0) verdict = 'holding';
      else if (loadChange < 0) verdict = 'needs review';
      else verdict = 'holding';
    } else if (points.length === 1) verdict = 'too early';
    rows.push({
      dayId, dayTitle, slotId: slot.id,
      exercise, sessions: points.length, first, last, loadChange, repChange, verdict,
    });
  }
  return { block: b, rows };
}

// ------------------------------------------------------------- conditioning
// Running and swimming sit outside the split entirely: never prescribed, never
// part of a strength session, just recorded on the day they happened.

export function logConditioning(state, entry) {
  state.conditioning = state.conditioning || [];
  const row = {
    id: newId('cond'),
    dateKey: entry.dateKey,
    kind: entry.kind,
    distance: entry.distance == null || entry.distance === '' ? null : Number(entry.distance),
    unit: entry.unit || 'mi',
    minutes: entry.minutes == null || entry.minutes === '' ? null : Number(entry.minutes),
    note: entry.note || '',
    at: new Date().toISOString(),
  };
  state.conditioning.push(row);
  return row;
}

export function updateConditioning(state, id, patch) {
  const row = (state.conditioning || []).find((c) => c.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  return row;
}

export function deleteConditioning(state, id) {
  const i = (state.conditioning || []).findIndex((c) => c.id === id);
  if (i >= 0) state.conditioning.splice(i, 1);
}

export function conditioningFor(state, key) {
  return (state.conditioning || []).filter((c) => c.dateKey === key);
}

export function weeklyConditioning(state, weekStartKey) {
  const end = addDays(weekStartKey, 6);
  const rows = (state.conditioning || []).filter((c) => c.dateKey >= weekStartKey && c.dateKey <= end);
  const byKind = new Map();
  let minutes = 0;
  for (const r of rows) {
    const k = byKind.get(r.kind) || { kind: r.kind, sessions: 0, distance: 0, unit: r.unit, minutes: 0 };
    k.sessions += 1;
    k.distance += r.distance || 0;
    k.minutes += r.minutes || 0;
    minutes += r.minutes || 0;
    byKind.set(r.kind, k);
  }
  return { rows, kinds: [...byKind.values()], sessions: rows.length, minutes };
}

export { LIBRARY };
