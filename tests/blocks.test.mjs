// Anchor lifts stay put for a block; rotating slots change weekly; the review
// at the end of the block reports what actually moved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/core/store.js';
import * as A from '../src/core/actions.js';
import { addDays } from '../src/core/schedule.js';

const START = '2026-09-28';
const fresh = () => createInitialState(new Date('2026-09-28T08:00:00'));

test('a block starts at week one and counts up in sevens', () => {
  const s = fresh();
  assert.equal(A.blockState(s, START).week, 1);
  assert.equal(A.blockState(s, addDays(START, 6)).week, 1);
  assert.equal(A.blockState(s, addDays(START, 7)).week, 2);
  assert.equal(A.blockState(s, addDays(START, 35)).week, 6);
  assert.equal(A.blockState(s, addDays(START, 41)).complete, false, 'the last day still counts');
  assert.equal(A.blockState(s, addDays(START, 42)).complete, true);
  assert.equal(A.blockState(s, START).weeks, 6);
});

test('starting a new block advances the number and keeps the length', () => {
  const s = fresh();
  const next = addDays(START, 42);
  A.startNewBlock(s, next);
  assert.equal(s.block.number, 2);
  assert.equal(s.block.startedOn, next);
  assert.equal(s.block.weeks, 6);
  assert.equal(A.blockState(s, next).week, 1);
  A.setBlockLength(s, 4);
  assert.equal(A.blockState(s, next).weeks, 4);
  A.setBlockLength(s, 999);
  assert.ok(s.block.weeks <= 16, 'block length is clamped to something sane');
});

test('anchors hold their movement across an entire block', () => {
  const s = fresh();
  const anchorIds = (key) => A.planFor(s, key).exercises.filter((e) => e.isAnchor).map((e) => e.exerciseId);
  const week1 = anchorIds(START);
  assert.equal(week1.length, 3);
  for (const w of [1, 2, 3, 4, 5]) {
    assert.deepEqual(anchorIds(addDays(START, w * 7)), week1, `week ${w + 1} changed an anchor`);
  }
});

test('rotating slots serve a different movement each week', () => {
  const s = fresh();
  const rotating = (key) => A.planFor(s, key).exercises.filter((e) => !e.isAnchor).map((e) => e.exerciseId);
  const w1 = rotating(START);
  const w2 = rotating(addDays(START, 7));
  assert.ok(w1.length >= 3);
  assert.notDeepEqual(w1, w2, 'the rotating half of the session changed');
  const changed = w1.filter((id, i) => id !== w2[i]).length;
  assert.ok(changed >= 2, 'more than one slot moved on');
});

test('every anchor is listed once and can be changed in place', () => {
  const s = fresh();
  const anchors = A.anchorSlots(s);
  assert.equal(anchors.length, 18, 'three anchors on each of six working days');
  assert.ok(anchors.every((a) => a.exercise), 'each anchor resolves to a real exercise');

  const squat = anchors.find((a) => a.slot.family === 'squat');
  assert.equal(squat.exercise.id, 'hack-squat');
  A.setAnchorExercise(s, squat.dayId, squat.slot.id, 'leg-press');
  assert.equal(A.anchorSlots(s).find((a) => a.slot.id === squat.slot.id).exercise.id, 'leg-press');
  assert.equal(A.planFor(s, addDays(START, 2)).exercises[0].exerciseId, 'leg-press', 'the change reaches the plan');
});

test('a rotation pool can be widened or trimmed', () => {
  const s = fresh();
  const slot = A.rotatingSlots(s).find((r) => r.slot.family === 'lateral-raise');
  const before = slot.pool.length;
  A.addRotationOption(s, slot.dayId, slot.slot.id, 'lean-away-lateral-raise');
  const after = A.rotatingSlots(s).find((r) => r.slot.id === slot.slot.id);
  assert.equal(after.pool.length, before + 1);
  A.removeRotationOption(s, slot.dayId, slot.slot.id, 'lean-away-lateral-raise');
  assert.equal(A.rotatingSlots(s).find((r) => r.slot.id === slot.slot.id).pool.length, before);
});

test('the block review reports load movement per anchor', () => {
  const s = fresh();
  // Log the Wednesday quad anchor three weeks running, adding load each time.
  const weeks = [0, 7, 14];
  weeks.forEach((offset, i) => {
    const key = addDays(START, offset + 2);
    const session = A.startSession(s, key);
    const anchor = session.exercises[0];
    for (let n = 0; n < anchor.sets.length; n++) {
      A.completeSet(session, anchor.uid, n, { reps: 8, load: 180 + i * 20 });
    }
    A.finishSession(s, session.id);
  });

  const { rows, block } = A.blockReview(s, addDays(START, 20));
  assert.equal(block.number, 1);
  const quad = rows.find((r) => r.exercise.id === 'hack-squat');
  assert.equal(quad.sessions, 3);
  assert.equal(quad.first.topLoad, 180);
  assert.equal(quad.last.topLoad, 220);
  assert.equal(quad.loadChange, 40);
  assert.equal(quad.verdict, 'progressing');

  const untouched = rows.find((r) => r.sessions === 0);
  assert.ok(untouched, 'anchors with nothing logged are still reported');
  assert.equal(untouched.verdict, 'no data');
});

test('a stalled anchor reads as holding, a regression as needing review', () => {
  const s = fresh();
  const log = (offset, load) => {
    const key = addDays(START, offset + 2);
    const session = A.startSession(s, key);
    const anchor = session.exercises[0];
    for (let n = 0; n < anchor.sets.length; n++) A.completeSet(session, anchor.uid, n, { reps: 8, load });
    A.finishSession(s, session.id);
  };
  log(0, 200); log(7, 200);
  let quad = A.blockReview(s, addDays(START, 14)).rows.find((r) => r.exercise.id === 'hack-squat');
  assert.equal(quad.verdict, 'holding');

  log(14, 185);
  quad = A.blockReview(s, addDays(START, 20)).rows.find((r) => r.exercise.id === 'hack-squat');
  assert.equal(quad.verdict, 'needs review');
  assert.equal(quad.loadChange, -15);
});

test('sessions logged before this block are left out of its review', () => {
  const s = fresh();
  const key = addDays(START, 2);
  const session = A.startSession(s, key);
  const anchor = session.exercises[0];
  A.completeSet(session, anchor.uid, 0, { reps: 8, load: 180 });
  A.finishSession(s, session.id);

  A.startNewBlock(s, addDays(START, 42));
  const { rows } = A.blockReview(s, addDays(START, 45));
  assert.equal(rows.find((r) => r.exercise.id === 'hack-squat').sessions, 0,
    'the previous block’s work does not count toward the new one');
});
