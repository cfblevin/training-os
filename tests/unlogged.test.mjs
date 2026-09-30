// Closing out a session that happened but was never logged, without inventing data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/core/store.js';
import * as A from '../src/core/actions.js';
import { weeklyLedger } from '../src/core/volume.js';

const TUE = '2026-09-29';   // Upper Chest & Delts
const WED = '2026-09-30';   // Quads & Core
const fresh = () => createInitialState(new Date('2026-09-29T20:00:00'));

test('marking a day as trained records the fact and nothing else', () => {
  const s = fresh();
  const session = A.markDayTrained(s, TUE);
  assert.equal(session.unlogged, true);
  assert.equal(session.status, 'completed');
  assert.equal(session.title, 'Upper Chest & Delts');
  assert.deepEqual(session.exercises, [], 'no sets are invented');
  assert.ok(session.completedAt);
  assert.equal(s.sessions.length, 1);
});

test('it adds no volume and no progression signal', () => {
  const s = fresh();
  A.markDayTrained(s, TUE);
  const l = weeklyLedger(s.sessions, TUE, s.volumeTargets);
  assert.equal(l.total, 0);
  assert.equal(l.groups.length, 0);
  assert.deepEqual(s.suggestions, {}, 'nothing was earned because nothing was measured');
  const { rows } = A.blockReview(s, TUE);
  assert.ok(rows.every((r) => r.sessions === 0), 'the block review sees no data from it');
});

test('the day still shows its scheduled workout, and is not a rest day', () => {
  const s = fresh();
  A.markDayTrained(s, TUE);
  const plan = A.planFor(s, TUE);
  assert.equal(A.isRest(s, TUE), false, 'a trained day must not read as rest');
  assert.ok(plan.exercises.length >= 5, 'the plan that was scheduled is still visible');
  assert.equal(plan.title, 'Upper Chest & Delts');
});

test('tomorrow is untouched and starts normally', () => {
  const s = fresh();
  A.markDayTrained(s, TUE);
  assert.equal(A.sessionFor(s, WED), null);
  const plan = A.planFor(s, WED);
  assert.equal(plan.title, 'Quads & Core');
  assert.equal(plan.exercises[0].exerciseId, 'hack-squat');
  const session = A.startSession(s, WED);
  assert.equal(session.unlogged, undefined);
  assert.equal(session.exercises.length, plan.exercises.length);
});

test('it can be undone', () => {
  const s = fresh();
  A.markDayTrained(s, TUE);
  assert.equal(A.unmarkDayTrained(s, TUE), true);
  assert.equal(s.sessions.length, 0);
  assert.equal(A.unmarkDayTrained(s, TUE), false, 'undoing twice is harmless');
});

test('a day with real logged sets is never overwritten by the mark', () => {
  const s = fresh();
  const session = A.startSession(s, TUE);
  A.completeSet(session, session.exercises[0].uid, 0, { reps: 8, load: 95 });
  const same = A.markDayTrained(s, TUE);
  assert.equal(same.id, session.id);
  assert.notEqual(same.unlogged, true, 'logged work keeps its status');
  assert.equal(same.exercises[0].sets[0].reps, 8, 'the logged set survives');
  assert.equal(A.unmarkDayTrained(s, TUE), false, 'and it cannot be deleted by unmarking');
  assert.equal(s.sessions.length, 1);
});

test('a marked day can still be logged properly afterwards', () => {
  const s = fresh();
  const marked = A.markDayTrained(s, TUE);
  const session = A.startSession(s, TUE);
  assert.equal(session.id, marked.id, 'the same record is reused, not duplicated');
  assert.equal(session.unlogged, false);
  assert.equal(session.status, 'active');
  assert.ok(session.exercises.length >= 5, 'the planned exercises are materialised');
  assert.ok(session.exercises[0].sets.every((x) => x.done === false));
  assert.equal(s.sessions.length, 1);
});
