// The logging workflow an athlete actually performs on a phone, driven through
// the same action layer the UI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/core/store.js';
import * as A from '../src/core/actions.js';
import { evaluateProgression } from '../src/core/progression.js';

const MON = '2026-09-28'; // Lats & Biceps
const TUE = '2026-09-29'; // Upper Chest & Delts
const WED = '2026-09-30'; // Quads & Core
const NEXT_MON = '2026-10-05';

function fresh() { return createInitialState(new Date('2026-09-29T08:00:00')); }

function A_addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

test('starting today’s workout creates one session with every planned set queued', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  assert.equal(s.sessions.length, 1);
  assert.equal(session.status, 'active');
  assert.equal(session.exercises.length, A.planFor(s, MON).exercises.length);
  assert.ok(session.exercises.length >= 5);
  const first = session.exercises[0];
  assert.equal(first.sets.length, first.plannedSets);
  assert.ok(first.sets.every((x) => x.done === false && x.load === first.load));
  assert.equal(A.startSession(s, MON).id, session.id, 'reopening does not duplicate');
});

test('editing one set changes only that set', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  const e = session.exercises[0];
  A.patchSet(session, e.uid, 1, { load: e.load + 20 });
  assert.equal(e.sets[0].load, e.load);
  assert.equal(e.sets[1].load, e.load + 20);
  assert.equal(e.sets[2].load, e.load);
});

test('apply-to-remaining is explicit and never touches completed sets', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  const e = session.exercises[0];
  A.completeSet(session, e.uid, 0, { reps: 8, load: 95 });
  A.patchSet(session, e.uid, 1, { load: 115 }, { applyToRemaining: true });
  assert.equal(e.sets[0].load, 95, 'the completed set is left alone');
  assert.equal(e.sets[1].load, 115);
  assert.equal(e.sets[2].load, 115);
  assert.equal(e.sets[3].load, 115);
});

test('a set completes in one call, and unilateral reps fill both sides', () => {
  const s = fresh();
  const session = A.startSession(s, WED);
  const uni = session.exercises.find((x) => x.unilateral);
  assert.ok(uni, 'the quad day includes a unilateral movement');
  A.completeSet(session, uni.uid, 0, { reps: 10 });
  assert.equal(uni.sets[0].done, true);
  assert.equal(uni.sets[0].repsL, 10);
  assert.equal(uni.sets[0].repsR, 10);
  assert.ok(uni.sets[0].at, 'completion is timestamped');
  A.uncompleteSet(session, uni.uid, 0);
  assert.equal(uni.sets[0].done, false);
});

test('there is a workout on every day of the week', () => {
  const s = fresh();
  for (let i = 0; i < 7; i++) {
    const key = A_addDays(MON, i);
    assert.equal(A.isRest(s, key), false, `${key} should be a training day`);
    assert.ok(A.planFor(s, key).exercises.length >= 4);
  }
  assert.equal(A.nextTrainingDay(s, MON), A_addDays(MON, 1), 'the next training day is simply tomorrow');
});

test('a session finishes only when every planned set is logged', () => {
  const s = fresh();
  const session = A.startSession(s, TUE);
  for (const e of session.exercises) {
    for (let i = 0; i < e.sets.length; i++) {
      assert.equal(A.sessionComplete(session), false);
      A.completeSet(session, e.uid, i, { reps: e.repMax });
    }
  }
  assert.equal(A.sessionComplete(session), true);
  const done = A.finishSession(s, session.id);
  assert.equal(done.status, 'completed');
  assert.ok(done.completedAt);
});

test('hitting the benchmark suggests a load but never applies it', () => {
  const s = fresh();
  const session = A.startSession(s, TUE);
  const squat = session.exercises[0];
  const before = A.loadFor(s, squat.exerciseId);
  for (let i = 0; i < squat.sets.length; i++) A.completeSet(session, squat.uid, i, { reps: squat.repMax });
  A.finishSession(s, session.id);
  const sug = s.suggestions[squat.exerciseId];
  assert.ok(sug, 'a suggestion was recorded');
  assert.equal(sug.from, before);
  assert.equal(sug.to, before + squat.increment);
  assert.equal(A.loadFor(s, squat.exerciseId), before, 'the working load did not move on its own');

  A.acceptSuggestion(s, squat.exerciseId);
  assert.equal(A.loadFor(s, squat.exerciseId), before + squat.increment);
  assert.equal(s.suggestions[squat.exerciseId], undefined);
  assert.equal(s.loads[squat.exerciseId].established, true);
});

test('keeping the current load clears the suggestion and leaves the load alone', () => {
  const s = fresh();
  const session = A.startSession(s, TUE);
  const e = session.exercises[2];
  for (let i = 0; i < e.sets.length; i++) A.completeSet(session, e.uid, i, { reps: e.repMax });
  A.computeSuggestions(s, session);
  const before = A.loadFor(s, e.exerciseId);
  A.keepCurrentLoad(s, e.exerciseId);
  assert.equal(s.suggestions[e.exerciseId], undefined);
  assert.equal(A.loadFor(s, e.exerciseId), before);
});

test('one short set holds the load where it is', () => {
  const s = fresh();
  const session = A.startSession(s, TUE);
  const e = session.exercises[0];
  for (let i = 0; i < e.sets.length; i++) {
    A.completeSet(session, e.uid, i, { reps: i === 1 ? e.repMax - 1 : e.repMax });
  }
  assert.equal(evaluateProgression(e).earned, false);
  A.finishSession(s, session.id);
  assert.equal(s.suggestions[e.exerciseId], undefined);
});

// Pick a swap target in the same family that is not what is already programmed.
function otherInFamily(state, entry) {
  const c = A.swapCandidates(state, entry, []).find((x) => x.ex.family === entry.family);
  assert.ok(c, 'expected a same-family alternative');
  return c.ex.id;
}

test('a today-only swap leaves next week’s plan untouched', () => {
  const s = fresh();
  const before = A.planFor(s, NEXT_MON).exercises[1].exerciseId;
  const entry = A.planFor(s, MON).exercises[1];
  const target = otherInFamily(s, entry);
  assert.notEqual(target, entry.exerciseId);
  A.swapExercise(s, MON, entry.uid, target, 'today');
  assert.equal(A.planFor(s, MON).exercises[1].exerciseId, target);
  assert.equal(A.planFor(s, NEXT_MON).exercises[1].exerciseId, before);
  assert.ok(s.dayOverrides[MON], 'the change is held on that date only');
});

test('a future swap changes the weekly plan from that day on', () => {
  const s = fresh();
  const entry = A.planFor(s, MON).exercises[1];
  const target = otherInFamily(s, entry);
  A.swapExercise(s, MON, entry.uid, target, 'future');
  assert.equal(A.planFor(s, NEXT_MON).exercises[1].exerciseId, target);
});

test('swapping mid-workout keeps the sets already performed under the old exercise', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  const e = session.exercises[0];
  A.completeSet(session, e.uid, 0, { reps: 8, load: 95 });
  A.completeSet(session, e.uid, 1, { reps: 8, load: 95 });
  const performedId = e.exerciseId;
  const planned = e.plannedSets;
  const target = otherInFamily(s, e);
  A.swapExercise(s, MON, e.uid, target, 'today');

  const kept = session.exercises[0];
  assert.equal(kept.exerciseId, performedId, 'identity of what was performed is preserved');
  assert.equal(kept.sets.length, 2);
  assert.ok(kept.sets.every((x) => x.done));
  assert.equal(kept.locked, true);

  const added = session.exercises[1];
  assert.equal(added.exerciseId, target);
  assert.equal(added.sets.length, planned - 2, 'only the remaining sets carry over');
  assert.equal(added.swappedFrom, performedId);
});

test('add, duplicate and delete work on today without disturbing the program', () => {
  const s = fresh();
  const before = A.planFor(s, NEXT_MON).exercises.length;
  const n = A.planFor(s, MON).exercises.length;
  A.addExercise(s, MON, 'cable-fly-mid', 'today');
  let plan = A.planFor(s, MON);
  assert.equal(plan.exercises.length, n + 1);
  assert.equal(plan.exercises[n].added, true, 'hand-added work is flagged as added');
  assert.equal(A.planFor(s, NEXT_MON).exercises.length, before);

  const dup = A.duplicateExercise(s, MON, plan.exercises[0].uid, 'today');
  assert.equal(A.planFor(s, MON).exercises.length, n + 2);
  assert.notEqual(dup.uid, plan.exercises[0].uid);

  A.removeExercise(s, MON, dup.uid, 'today');
  A.removeExercise(s, MON, plan.exercises[n].uid, 'today');
  assert.equal(A.planFor(s, MON).exercises.length, n);
  assert.equal(A.planFor(s, NEXT_MON).exercises.length, before);
});

test('editing sets, rep range and rest can be kept to today or pushed forward', () => {
  const s = fresh();
  const uid = A.planFor(s, MON).exercises[0].uid;
  const original = A.planFor(s, MON).exercises[0].plannedSets;
  A.editEntry(s, MON, uid, { plannedSets: original + 1, repMin: 5, repMax: 8, restSec: 210 }, 'today');
  const t = A.planFor(s, MON).exercises[0];
  assert.equal(t.plannedSets, original + 1);
  assert.equal(t.repMax, 8);
  assert.equal(t.restSec, 210);
  assert.equal(A.planFor(s, NEXT_MON).exercises[0].plannedSets, original, 'future weeks unchanged');

  A.editEntry(s, MON, uid, { plannedSets: original + 2 }, 'future');
  assert.equal(A.planFor(s, NEXT_MON).exercises[0].plannedSets, original + 2);
});

test('resetting a day restores the programmed workout', () => {
  const s = fresh();
  const n = A.planFor(s, MON).exercises.length;
  A.addExercise(s, MON, 'cable-fly-mid', 'today');
  assert.equal(A.planFor(s, MON).exercises.length, n + 1);
  A.resetDay(s, MON);
  assert.equal(A.planFor(s, MON).exercises.length, n);
});

test('recommendations stay relevant and skip what is already in the workout', () => {
  const s = fresh();
  const plan = A.planFor(s, MON);
  const present = plan.exercises.map((e) => e.exerciseId);
  const add = A.addCandidates(s, MON);
  assert.ok(add.length > 0);
  for (const c of add) {
    assert.ok(!present.includes(c.ex.id), 'already-programmed movements are not recommended');
    assert.ok(plan.exercises.some((e) => e.group === c.ex.group), 'recommendations train a muscle group already on today');
  }
  const entry = plan.exercises[0];
  const swaps = A.swapCandidates(s, entry, present);
  assert.ok(swaps.length >= 3);
  assert.equal(swaps[0].ex.family, entry.family, 'same movement family comes first');
  for (const c of A.swapCandidates(s, entry, [])) {
    const related = c.ex.family === entry.family || c.ex.group === entry.group;
    assert.ok(related, `${c.ex.name} is unrelated to ${entry.name}`);
  }
});

test('physique priorities are marked on the exercises that serve them', () => {
  const s = fresh();
  const week = Array.from({ length: 7 }, (_, i) => A.planFor(s, A_addDays(MON, i)));
  const marked = new Set(week.flatMap((p) => p.exercises.map((e) => e.priority)).filter(Boolean));
  for (const p of s.profile.physiquePriorities) {
    assert.ok(marked.has(p), `${p} should be marked somewhere in the week`);
  }
});

test('a custom exercise can be created and used like any other', () => {
  const s = fresh();
  const ex = A.createCustomExercise(s, {
    name: 'Incline Smith Press (Home)', group: 'Chest', family: 'incline-press',
    equipment: 'Smith machine', increment: 5, defaultLoad: 65,
  });
  assert.ok(ex.custom);
  assert.equal(A.loadFor(s, ex.id), 65);
  A.addExercise(s, MON, ex.id, 'today');
  assert.ok(A.planFor(s, MON).exercises.some((e) => e.exerciseId === ex.id));
  assert.ok(A.searchLibrary(s, 'home').some((e) => e.id === ex.id));
});

test('search finds movements by name, equipment and group', () => {
  const s = fresh();
  assert.ok(A.searchLibrary(s, 'skull').some((e) => e.id === 'ez-bar-skull-crusher'));
  assert.ok(A.searchLibrary(s, 'ez-bar').length >= 3);
  assert.ok(A.searchLibrary(s, '', { group: 'Calves' }).every((e) => e.group === 'Calves'));
  assert.ok(!A.searchLibrary(s, 'pendulum').length);
});

test('past sessions can be corrected without losing their date or identity', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  const e = session.exercises[0];
  A.completeSet(session, e.uid, 0, { reps: 9, load: 95 });
  A.finishSession(s, session.id);

  A.editPastSet(s, session.id, e.uid, 0, { reps: 8, load: 100 });
  assert.equal(s.sessions[0].exercises[0].sets[0].reps, 8);
  assert.equal(s.sessions[0].exercises[0].sets[0].load, 100);

  const n = s.sessions[0].exercises[0].sets.length;
  A.addPastSet(s, session.id, e.uid);
  assert.equal(s.sessions[0].exercises[0].sets.length, n + 1);
  A.removePastSet(s, session.id, e.uid, n);
  assert.equal(s.sessions[0].exercises[0].sets.length, n);

  A.reassignPastExercise(s, session.id, e.uid, 'smith-incline-press');
  assert.equal(s.sessions[0].exercises[0].name, 'Smith Machine Incline Press');
  assert.equal(s.sessions[0].exercises[0].sets[0].reps, 8, 'logged work survives the correction');
  assert.equal(s.sessions[0].dateKey, MON, 'the historical date is preserved');

  A.setSessionNotes(s, session.id, 'Shoulder felt fine.');
  assert.equal(s.sessions[0].notes, 'Shoulder felt fine.');
});

test('an unfinished session with no logged sets is still kept', () => {
  const s = fresh();
  A.startSession(s, MON);
  assert.equal(s.sessions.length, 1);
  assert.equal(A.sessionProgress(s.sessions[0]).done, 0);
  assert.equal(s.sessions[0].status, 'active');
});

test('last comparable performance is found from history only', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  const e = session.exercises[0];
  assert.equal(A.lastPerformance(s, e.exerciseId, MON), null, 'no history means nothing to show');
  A.completeSet(session, e.uid, 0, { reps: 9, load: 95 });
  A.finishSession(s, session.id);
  const last = A.lastPerformance(s, e.exerciseId, NEXT_MON);
  assert.deepEqual({ ...last }, { dateKey: MON, sets: 1, topLoad: 95, topReps: 9 });
});

test('switching mode changes the plan without touching physique history', () => {
  const s = fresh();
  const session = A.startSession(s, MON);
  A.completeSet(session, session.exercises[0].uid, 0, { reps: 8 });
  s.settings.mode = 'strength';
  const plan = A.planFor(s, MON);
  assert.equal(plan.title, 'Squat Strength');
  assert.equal(plan.exercises[0].exerciseId, 'bb-back-squat');
  assert.equal(A.sessionFor(s, MON), null, 'the physique session is not shown under strength');
  s.settings.mode = 'physique';
  assert.equal(A.sessionFor(s, MON).id, session.id);
});
