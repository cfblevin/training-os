import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey, parseKey, addDays, weekIndex, pickSlotExercise, foundationShare,
  templateForDate, materializePlan, relativeLabel, dateHeading, shortDate, anchorShare,
} from '../src/core/schedule.js';
import { PROGRAMS } from '../src/data/program.js';
import { libraryById } from '../src/data/library.js';

const libMap = libraryById();

test('date helpers stay in local time and do not drift', () => {
  assert.equal(dateKey(new Date(2026, 8, 29)), '2026-09-29');
  assert.equal(addDays('2026-09-29', 1), '2026-09-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-08', -1), '2026-03-07', 'DST boundary');
  assert.equal(parseKey('2026-09-29').getDate(), 29);
  assert.equal(relativeLabel('2026-09-29', '2026-09-29'), 'Today');
  assert.equal(relativeLabel('2026-09-30', '2026-09-29'), 'Tomorrow');
  assert.equal(dateHeading('2026-09-29', '2026-09-29'), `Today · ${shortDate('2026-09-29')}`);
  assert.equal(dateHeading('2026-10-08', '2026-09-29'), shortDate('2026-10-08'), 'no repeated date');
});

test('week index advances every 7 days and floors before the anchor', () => {
  assert.equal(weekIndex('2026-01-05'), 0);
  assert.equal(weekIndex('2026-01-11'), 0);
  assert.equal(weekIndex('2026-01-12'), 1);
  assert.equal(weekIndex('2026-01-04'), -1);
});

test('an anchor slot runs the same movement every single week', () => {
  const anchor = { id: 'a', foundation: 'F', variations: ['V1', 'V2'], anchor: true };
  for (const w of [0, 1, 2, 3, 17, -4]) {
    const pick = pickSlotExercise(anchor, w);
    assert.equal(pick.exerciseId, 'F');
    assert.equal(pick.isAnchor, true);
  }
  assert.equal(foundationShare(anchor), 1);
});

test('a rotating slot cycles its pool one movement per week', () => {
  const slot = { id: 's', foundation: 'F', variations: ['V1', 'V2'], anchor: false };
  const picks = [0, 1, 2, 3, 4, 5, 6].map((w) => pickSlotExercise(slot, w).exerciseId);
  assert.deepEqual(picks, ['F', 'V1', 'V2', 'F', 'V1', 'V2', 'F'], 'never the same movement twice running');
  assert.equal(pickSlotExercise(slot, -1).exerciseId, 'V2', 'negative weeks wrap cleanly');
  assert.equal(foundationShare(slot), 1 / 3);
  const single = { foundation: 'F', variations: [], anchor: false };
  assert.equal(pickSlotExercise(single, 5).exerciseId, 'F', 'a pool of one cannot rotate');
});

test('three anchors a working day, and the light day rotates everything', () => {
  for (const day of PROGRAMS.physique.days) {
    const anchors = day.slots.filter((s) => s.anchor);
    if (day.light) {
      assert.equal(anchors.length, 0, 'the light day is all rotation');
    } else {
      assert.equal(anchors.length, 3, `${day.id} should have exactly three anchors`);
      assert.deepEqual(day.slots.slice(0, 3).map((s) => s.anchor), [true, true, true],
        'anchors come first, while you are fresh');
    }
    for (const slot of day.slots) {
      if (slot.anchor) assert.equal(slot.variations.length, 0, `${slot.id} is an anchor and must not rotate`);
      else assert.ok(slot.variations.length >= 1, `${slot.id} rotates and needs a pool`);
    }
  }
});

test('most weekly work sits on tracked anchor lifts', () => {
  const all = anchorShare(PROGRAMS.physique);
  const working = anchorShare(PROGRAMS.physique, { includeLight: false });
  assert.ok(working >= 0.55 && working <= 0.65, `working-day anchor share was ${working.toFixed(3)}`);
  assert.ok(all >= 0.5, `overall anchor share was ${all.toFixed(3)}`);
});

test('the athlete\u2019s chosen anchors are the ones programmed', () => {
  const anchorFor = (dayId, family) => {
    const day = PROGRAMS.physique.days.find((d) => d.id === dayId);
    return day.slots.find((s) => s.anchor && s.family === family).foundation;
  };
  assert.equal(anchorFor('p-quads-core', 'squat'), 'hack-squat');
  assert.equal(anchorFor('p-quads-core', 'unilateral-squat'), 'db-bulgarian-split-squat');
  assert.equal(anchorFor('p-hinge-legs', 'hinge'), 'trap-bar-deadlift');
  assert.equal(anchorFor('p-lats-biceps', 'vertical-pull'), 'lat-pulldown');
  assert.equal(anchorFor('p-chest-delts', 'incline-press'), 'bb-incline-press');
  assert.equal(anchorFor('p-back-triceps', 'horizontal-pull'), 'bb-row');
  assert.equal(anchorFor('p-delts-chest', 'vertical-press'), 'machine-shoulder-press');
  const squats = PROGRAMS.physique.days.flatMap((d) => d.slots)
    .flatMap((s) => [s.foundation, ...(s.variations || [])]);
  assert.ok(!squats.includes('bb-back-squat'), 'no barbell back squat anywhere in the physique plan');
  assert.ok(!squats.includes('heel-elevated-squat'), 'no barbell squatting variants either');
});

test('every slot in every mode points at real, mode-appropriate exercises', () => {
  for (const [mode, program] of Object.entries(PROGRAMS)) {
    for (const day of program.days) {
      assert.ok(day.why && day.why.length > 10, `${day.id} needs a why sentence`);
      for (const slot of day.slots) {
        const ids = [slot.foundation, ...(slot.variations || [])];
        for (const id of ids) {
          const ex = libMap.get(id);
          assert.ok(ex, `${day.id}/${slot.id} references unknown ${id}`);
          assert.ok(ex.modes.includes(mode), `${id} is not a ${mode} movement`);
        }
        assert.ok(slot.repMin <= slot.repMax && slot.sets > 0);
      }
    }
  }
});

test('strength is structurally different from physique, not just heavier', () => {
  const avg = (p) => {
    const slots = p.days.flatMap((d) => d.slots);
    return {
      reps: slots.reduce((a, s) => a + (s.repMin + s.repMax) / 2, 0) / slots.length,
      rest: slots.reduce((a, s) => a + s.restSec, 0) / slots.length,
    };
  };
  const phys = avg(PROGRAMS.physique);
  const str = avg(PROGRAMS.strength);
  assert.ok(str.reps < phys.reps - 1.5, `strength reps ${str.reps} vs physique ${phys.reps}`);
  assert.ok(str.rest > phys.rest + 15, `strength rest ${str.rest} vs physique ${phys.rest}`);

  // Four heavy primaries, each low-rep, long-rest and repeated every week.
  const primaries = PROGRAMS.strength.days
    .filter((d) => !d.light)
    .map((d) => d.slots[0])
    .filter((s) => s.repMax <= 5);
  assert.equal(primaries.length, 4, 'four heavy primaries a week');
  for (const p of primaries) {
    assert.ok(p.restSec >= 240, 'strength primaries rest long');
    assert.equal(p.anchor, true, 'strength primaries repeat the same lift');
  }
  assert.ok(!PROGRAMS.physique.days.some((d) => d.slots[0].repMax <= 5 && d.slots[0].restSec >= 240),
    'physique has no heavy low-rep primary');
});

test('every mode trains seven days with the load deliberately uneven', () => {
  for (const [mode, program] of Object.entries(PROGRAMS)) {
    assert.equal(program.days.length, 7, `${mode} should cover every day`);
    const weekdays = program.days.map((d) => d.weekday).sort();
    assert.deepEqual(weekdays, [0, 1, 2, 3, 4, 5, 6], `${mode} has one day per weekday`);
    const light = program.days.filter((d) => d.light);
    assert.ok(light.length >= 1, `${mode} needs at least one deliberately light day`);
    const setsPerDay = program.days.map((d) => d.slots.reduce((a, s) => a + s.sets, 0));
    const lightSets = program.days.filter((d) => d.light).map((d) => d.slots.reduce((a, s) => a + s.sets, 0));
    assert.ok(Math.min(...lightSets) < Math.max(...setsPerDay) * 0.8, 'light days carry clearly less work');
  }
});

test('athletic mode is power-led and stays low volume', () => {
  for (const day of PROGRAMS.athletic.days) {
    assert.ok(['jump', 'throw', 'sprint'].includes(day.slots[0].family), `${day.id} should open with a power quality`);
    assert.ok(day.slots.length <= 5);
  }
});

test('plan materialisation covers every day of the week', () => {
  const plan = materializePlan({
    program: PROGRAMS.physique, mode: 'physique', key: '2026-09-28', libMap, loadFor: () => 100,
  });
  assert.equal(plan.title, 'Lats & Biceps');
  assert.equal(plan.exercises.length, 7);
  assert.equal(plan.exercises[0].load, 100);
  assert.equal(plan.exercises[0].added, false);
  assert.equal(plan.rest, false);
  assert.ok(plan.exercises[0].secondary, 'entries carry their secondary regions for the ledger');

  for (let i = 0; i < 7; i++) {
    const key = addDays('2026-09-28', i);
    const p = materializePlan({ program: PROGRAMS.physique, mode: 'physique', key, libMap, loadFor: () => 0 });
    assert.equal(p.rest, false, `${key} should be a training day`);
    assert.ok(p.exercises.length >= 4);
  }
  const light = materializePlan({
    program: PROGRAMS.physique, mode: 'physique', key: '2026-10-04', libMap, loadFor: () => 0,
  });
  assert.equal(light.light, true, 'Sunday is the light day');
});

test('a mode with a missing day still renders as rest rather than breaking', () => {
  const trimmed = { ...PROGRAMS.physique, days: PROGRAMS.physique.days.filter((d) => d.weekday !== 3) };
  const rest = materializePlan({ program: trimmed, mode: 'physique', key: '2026-09-30', libMap, loadFor: () => 0 });
  assert.equal(rest.rest, true);
  assert.equal(rest.exercises.length, 0);
  assert.equal(templateForDate(trimmed, '2026-09-30'), null);
});

test('the physique week covers every stated priority area', () => {
  const plans = Array.from({ length: 7 }, (_, i) => materializePlan({
    program: PROGRAMS.physique, mode: 'physique', key: addDays('2026-09-28', i), libMap, loadFor: () => 0,
  }));
  const priorities = new Set(plans.flatMap((p) => p.exercises.map((e) => e.priority)).filter(Boolean));
  for (const p of ['upper-chest', 'lateral-delts', 'lats', 'upper-back', 'quads', 'midsection']) {
    assert.ok(priorities.has(p), `week is missing ${p} priority work`);
  }
  const calfSets = plans.flatMap((p) => p.exercises).filter((e) => e.family === 'calf');
  assert.equal(calfSets.length, 2, 'calves trained twice a week');
  const families = plans.map((p) => p.exercises[0].family);
  assert.equal(new Set(families).size, families.length, 'no two days lead with the same pattern');
});

test('each physique day pairs a lead compound with work it left fresh', () => {
  for (const day of PROGRAMS.physique.days) {
    if (day.light) continue;
    const lead = day.slots[0];
    assert.ok(lead.sets >= 3 && lead.repMax <= 14, `${day.id} should lead with a real compound`);
    const groups = new Set(day.slots.map((s) => s.group));
    assert.ok(groups.size >= 3, `${day.id} should pair more than one area`);
  }
});
