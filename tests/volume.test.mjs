import test from 'node:test';
import assert from 'node:assert/strict';
import {
  weekStart, weeklyLedger, historyFor, performedExercises, familyContext,
  ledgerGroupOf, defaultTargets, LEDGER_GROUPS,
} from '../src/core/volume.js';
import { trendOf } from '../src/core/progression.js';
import { createInitialState } from '../src/core/store.js';
import * as A from '../src/core/actions.js';

test('the ledger week runs Monday to Sunday', () => {
  assert.equal(weekStart('2026-09-29'), '2026-09-28');
  assert.equal(weekStart('2026-09-28'), '2026-09-28');
  assert.equal(weekStart('2026-10-04'), '2026-09-28', 'Sunday belongs to the week that started Monday');
});

function loggedWeek() {
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  for (const key of ['2026-09-28', '2026-09-29']) {
    const session = A.startSession(s, key);
    for (const e of session.exercises) {
      for (let i = 0; i < e.sets.length; i++) A.completeSet(session, e.uid, i, { reps: e.repMin });
    }
    A.finishSession(s, session.id);
  }
  return s;
}

test('planned and added work are counted separately', () => {
  const s = loggedWeek();
  const before = weeklyLedger(s.sessions, '2026-09-29');
  assert.ok(before.planned > 20);
  assert.equal(before.added, 0);

  const session = A.sessionFor(s, '2026-09-29');
  A.addExercise(s, '2026-09-29', 'cable-fly-mid', 'today');
  const extra = session.exercises[session.exercises.length - 1];
  A.completeSet(session, extra.uid, 0, { reps: 12 });
  A.completeSet(session, extra.uid, 1, { reps: 12 });

  const after = weeklyLedger(s.sessions, '2026-09-29');
  assert.equal(after.planned, before.planned, 'planned volume is unchanged');
  assert.equal(after.added, 2);
  assert.equal(after.total, before.total + 2);
  const chest = after.groups.find((g) => g.group === 'Chest');
  assert.equal(chest.added, 2);
});

test('the ledger separates regions rather than lumping body parts together', () => {
  assert.equal(ledgerGroupOf({ family: 'lateral-raise', group: 'Shoulders' }), 'Lateral delts');
  assert.equal(ledgerGroupOf({ family: 'vertical-press', group: 'Shoulders' }), 'Front delts');
  assert.equal(ledgerGroupOf({ family: 'rear-delt', group: 'Shoulders' }), 'Rear delts');
  assert.equal(ledgerGroupOf({ family: 'vertical-pull', group: 'Back' }), 'Lats');
  assert.equal(ledgerGroupOf({ family: 'horizontal-pull', group: 'Back' }), 'Upper back');
  assert.equal(ledgerGroupOf({ family: 'incline-press', group: 'Chest' }), 'Upper chest');
  assert.equal(ledgerGroupOf({ family: 'flat-press', group: 'Chest' }), 'Chest');
  assert.equal(ledgerGroupOf({ exerciseId: 'cable-fly-low-high', family: 'chest-fly', group: 'Chest' }), 'Upper chest',
    'a low-to-high fly is upper-chest work');
  assert.equal(ledgerGroupOf({ family: 'anti-extension', group: 'Core' }), 'Midsection');
});

test('compound work earns half credit for the regions it also trains', () => {
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  const key = '2026-09-28';                       // Lats & Biceps
  const session = A.startSession(s, key);
  const pulldown = session.exercises.find((e) => e.family === 'vertical-pull');
  for (let i = 0; i < pulldown.sets.length; i++) A.completeSet(session, pulldown.uid, i, { reps: 10 });

  const l = weeklyLedger(s.sessions, key);
  const lats = l.groups.find((g) => g.group === 'Lats');
  const biceps = l.groups.find((g) => g.group === 'Biceps');
  assert.equal(lats.planned, pulldown.sets.length, 'direct work counts in full');
  assert.equal(lats.indirect, 0);
  assert.equal(biceps.planned, 0, 'no direct biceps work was logged');
  assert.equal(biceps.indirect, pulldown.sets.length * 0.5, 'the pulldown pays the biceps half credit');
  assert.equal(biceps.total, pulldown.sets.length * 0.5);
});

test('targets ride on the physique priorities and attach to ledger rows', () => {
  const targets = defaultTargets(['lats', 'quads']);
  assert.deepEqual(targets.Lats, { min: 14, max: 18 });
  assert.deepEqual(targets.Quads, { min: 14, max: 18 });
  assert.ok(targets['Rear delts'].max < 14);
  for (const g of LEDGER_GROUPS) assert.ok(targets[g], `${g} needs a target band`);

  const s = loggedWeek();
  const l = weeklyLedger(s.sessions, '2026-09-29', targets);
  const lats = l.groups.find((g) => g.group === 'Lats');
  assert.deepEqual(lats.target, { min: 14, max: 18 });
});

test('only completed sets count toward the ledger', () => {
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  A.startSession(s, '2026-09-29');
  assert.equal(weeklyLedger(s.sessions, '2026-09-29').total, 0);
});

test('a previous week is not mixed into this week', () => {
  const s = loggedWeek();
  assert.equal(weeklyLedger(s.sessions, '2026-10-06').total, 0);
});

test('exercise history builds one chronological point per session', () => {
  // Strength mode repeats the same primary lift weekly, so it gives a clean series.
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  s.settings.mode = 'strength';
  const id = A.planFor(s, '2026-09-28').exercises[0].exerciseId;
  ['2026-09-28', '2026-10-05', '2026-10-12'].forEach((key, w) => {
    const session = A.startSession(s, key);
    const e = session.exercises.find((x) => x.exerciseId === id);
    for (let i = 0; i < e.sets.length; i++) A.completeSet(session, e.uid, i, { reps: 5, load: 185 + w * 10 });
    A.finishSession(s, session.id);
  });
  const pts = historyFor(s.sessions, id);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts.map((p) => p.date), ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.equal(pts[0].topLoad, 185);
  assert.equal(pts[2].topLoad, 205);
  assert.equal(trendOf(pts), 'progressing');
  assert.ok(pts[0].sets > 0 && pts[0].volume > 0);
});

test('a rotated variation keeps its own history series', () => {
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  const pick = (key) => A.planFor(s, key).exercises.find((e) => !e.isAnchor && e.family === 'lateral-raise');
  const a = pick('2026-09-28');   // this week's rotating pick
  const b = pick('2026-10-05');   // next week's
  assert.notEqual(a.exerciseId, b.exerciseId, 'rotation moved the slot to another movement');
  for (const [key, entryId] of [['2026-09-28', a.exerciseId], ['2026-10-05', b.exerciseId]]) {
    const session = A.startSession(s, key);
    const e = session.exercises.find((x) => x.exerciseId === entryId);
    A.completeSet(session, e.uid, 0, { reps: 8, load: 100 });
    A.finishSession(s, session.id);
  }
  assert.equal(historyFor(s.sessions, a.exerciseId).length, 1);
  assert.equal(historyFor(s.sessions, b.exerciseId).length, 1);
  assert.equal(performedExercises(s.sessions).length, 2);
});

test('history graphs update as new sessions are logged', () => {
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  const key = '2026-09-29';
  const id = A.planFor(s, key).exercises[0].exerciseId;
  assert.equal(historyFor(s.sessions, id).length, 0, 'no history before logging');
  const session = A.startSession(s, key);
  const e = session.exercises[0];
  A.completeSet(session, e.uid, 0, { reps: 5, load: 185 });
  assert.equal(historyFor(s.sessions, id).length, 1, 'a logged set shows up immediately');
  A.completeSet(session, e.uid, 1, { reps: 5, load: 195 });
  assert.equal(historyFor(s.sessions, id)[0].topLoad, 195);
});

test('the exercise list for progression is names only, deduped, newest first', () => {
  const s = loggedWeek();
  const rows = performedExercises(s.sessions);
  const ids = rows.map((r) => r.exerciseId);
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');
  assert.ok(rows.every((r) => r.name && r.group && r.last));
  assert.ok(rows[0].last >= rows[rows.length - 1].last);
});

test('family context separates the foundation movement from siblings', () => {
  const s = loggedWeek();
  const rows = performedExercises(s.sessions);
  const row = rows.find((r) => r.family === 'vertical-pull');
  const ctx = familyContext(s.sessions, 'vertical-pull', row.exerciseId);
  assert.equal(ctx.family, 'vertical-pull');
  assert.equal(ctx.self.exerciseId, row.exerciseId);
  assert.ok(!ctx.siblings.some((x) => x.exerciseId === row.exerciseId));
});

test('conditioning is logged on its own and never becomes muscle volume', () => {
  const s = createInitialState(new Date('2026-09-29T08:00:00'));
  A.logConditioning(s, { dateKey: '2026-09-29', kind: 'run', distance: 3.1, unit: 'mi', minutes: 26 });
  A.logConditioning(s, { dateKey: '2026-10-01', kind: 'swim', distance: 1000, unit: 'yd', minutes: 30 });
  A.logConditioning(s, { dateKey: '2026-10-20', kind: 'run', distance: 5, unit: 'mi' });

  const week = A.weeklyConditioning(s, weekStart('2026-09-29'));
  assert.equal(week.sessions, 2, 'only this week counts');
  assert.equal(week.minutes, 56);
  assert.equal(week.kinds.length, 2);
  assert.equal(A.conditioningFor(s, '2026-09-29').length, 1);

  const l = weeklyLedger(s.sessions, '2026-09-29');
  assert.equal(l.total, 0, 'a run adds no hard sets');
  assert.equal(l.groups.length, 0);

  const id = s.conditioning[0].id;
  A.updateConditioning(s, id, { minutes: 31 });
  assert.equal(s.conditioning[0].minutes, 31);
  A.deleteConditioning(s, id);
  assert.equal(s.conditioning.length, 2);
});
