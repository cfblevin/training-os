import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProgression, benchmarkText, effectiveReps, trendOf, rangeText, suggestedReps,
} from '../src/core/progression.js';

const entry = (over = {}) => ({
  plannedSets: 3, repMin: 8, repMax: 12, load: 120, increment: 5, unilateral: false,
  sets: [], ...over,
});
const set = (reps, done = true, load = 120) => ({ reps, done, load });

test('no increase until every planned set hits the top of the range', () => {
  assert.equal(evaluateProgression(entry({ sets: [set(12), set(12), set(11)] })).earned, false);
  assert.equal(evaluateProgression(entry({ sets: [set(12), set(12)] })).earned, false, 'a set short');
  const ok = evaluateProgression(entry({ sets: [set(12), set(12), set(12)] }));
  assert.equal(ok.earned, true);
  assert.equal(ok.from, 120);
  assert.equal(ok.to, 125);
});

test('reps above the top of the range still count', () => {
  assert.equal(evaluateProgression(entry({ sets: [set(14), set(13), set(12)] })).earned, true);
});

test('incomplete sets are ignored', () => {
  const p = evaluateProgression(entry({ sets: [set(12), set(12), set(12, false)] }));
  assert.equal(p.setsDone, 2);
  assert.equal(p.earned, false);
});

test('unilateral progression is based on the weaker side', () => {
  const uni = entry({ unilateral: true, sets: [
    { repsL: 12, repsR: 12, done: true }, { repsL: 12, repsR: 10, done: true }, { repsL: 12, repsR: 12, done: true },
  ] });
  assert.equal(effectiveReps(uni.sets[1], true), 10);
  assert.equal(evaluateProgression(uni).earned, false);
  uni.sets[1].repsR = 12;
  assert.equal(evaluateProgression(uni).earned, true);
});

test('a zero increment never produces a suggestion', () => {
  const bw = entry({ increment: 0, sets: [set(12), set(12), set(12)] });
  const p = evaluateProgression(bw);
  assert.equal(p.earned, false);
  assert.equal(p.to, p.from);
});

test('the benchmark line states the exact requirement', () => {
  assert.equal(benchmarkText(entry()), 'Complete all 3 sets at 12 reps to earn the next load increase.');
  assert.match(benchmarkText(entry({ sets: [set(12)] })), /^1 of 3 sets at 12 reps — 2 to go/);
  assert.match(benchmarkText(entry({ unilateral: true })), /per side/);
  assert.match(benchmarkText(entry({ sets: [set(12), set(12), set(12)] })), /^Benchmark met/);
});

test('range and rep suggestions read correctly', () => {
  assert.equal(rangeText(entry()), '8–12');
  assert.equal(rangeText(entry({ repMin: 5, repMax: 5 })), '5');
  assert.equal(suggestedReps(entry(), 0), 8, 'first set falls back to the range minimum');
  assert.equal(suggestedReps(entry({ sets: [set(10)] }), 1), 10, 'later sets hold the previous reps');
});

test('trend reads the last three data points', () => {
  assert.equal(trendOf([]), 'needs review');
  assert.equal(trendOf([{ topLoad: 100, topReps: 8 }, { topLoad: 105, topReps: 8 }]), 'progressing');
  assert.equal(trendOf([{ topLoad: 100, topReps: 8 }, { topLoad: 100, topReps: 8 }]), 'holding');
  assert.equal(trendOf([{ topLoad: 110, topReps: 8 }, { topLoad: 100, topReps: 8 }]), 'needs review');
});
