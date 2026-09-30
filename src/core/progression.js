// Benchmark-driven double progression. No RIR, no effort scores, never silent.

export const ROUND_TO = 0.5;

export function roundLoad(v, inc = 5) {
  if (!inc) return Math.round(v * 2) / 2;
  return Math.round(v / ROUND_TO) * ROUND_TO;
}

/** Reps that count for an entry's set: the weaker side for unilateral work. */
export function effectiveReps(set, unilateral) {
  if (!set) return 0;
  if (unilateral) {
    const l = Number(set.repsL ?? set.reps ?? 0);
    const r = Number(set.repsR ?? set.reps ?? 0);
    if (!l && !r) return 0;
    if (!l || !r) return Math.max(l, r); // one side logged only
    return Math.min(l, r);
  }
  return Number(set.reps ?? 0);
}

export function completedSets(entry) {
  return (entry.sets || []).filter((s) => s.done);
}

/**
 * Has the athlete earned a load increase?
 * Benchmark: every planned set completed, and every completed set at or above
 * the top of the assigned rep range (weaker side for unilateral movements).
 */
export function evaluateProgression(entry) {
  const done = completedSets(entry);
  const planned = entry.plannedSets ?? done.length;
  const top = entry.repMax;
  const atTop = done.filter((s) => effectiveReps(s, entry.unilateral) >= top).length;
  const earned = done.length >= planned && planned > 0 && atTop >= planned;
  const current = Number(entry.load || 0);
  const inc = entry.increment || 0;
  return {
    earned: earned && inc > 0,
    setsDone: done.length,
    setsAtTop: atTop,
    planned,
    from: current,
    to: earned && inc > 0 ? roundLoad(current + inc, inc) : current,
  };
}

/** The quiet checkpoint line shown inside an expanded exercise. */
export function benchmarkText(entry) {
  const p = evaluateProgression(entry);
  const side = entry.unilateral ? ' per side' : '';
  if (p.earned) return `Benchmark met: all ${p.planned} sets at ${entry.repMax} reps${side}.`;
  const left = Math.max(0, p.planned - p.setsAtTop);
  if (p.setsAtTop > 0) {
    return `${p.setsAtTop} of ${p.planned} sets at ${entry.repMax} reps${side} — ${left} to go for the next load increase.`;
  }
  return `Complete all ${p.planned} sets at ${entry.repMax} reps${side} to earn the next load increase.`;
}

export function rangeText(entry) {
  return entry.repMin === entry.repMax ? `${entry.repMin}` : `${entry.repMin}–${entry.repMax}`;
}

/** Suggested reps for the next set: hold the last set's reps, floor at the range minimum. */
export function suggestedReps(entry, index) {
  const prev = (entry.sets || [])[index - 1];
  if (prev && prev.done) {
    const r = effectiveReps(prev, entry.unilateral);
    if (r) return Math.max(entry.repMin, Math.min(entry.repMax, r));
  }
  return entry.repMin;
}

/** Trend for an exercise from its chronological history points. */
export function trendOf(points) {
  if (!points || points.length < 2) return 'needs review';
  const score = (p) => Number(p.topLoad || 0) * 100 + Number(p.topReps || 0);
  const recent = points.slice(-3);
  const first = score(recent[0]);
  const last = score(recent[recent.length - 1]);
  if (last > first) return 'progressing';
  if (last === first) return 'holding';
  return 'needs review';
}
