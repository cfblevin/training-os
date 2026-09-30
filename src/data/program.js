// Weekly plans per training mode. Seven training days — no scheduled rest days —
// with systemic load deliberately uneven across the week.
//
// Two kinds of slot:
//   anchor: true   the same movement every session for the whole block. This is
//                  where load progression is tracked and where the benchmark lives.
//   anchor: false  a rotating slot. It cycles through its pool one movement per
//                  week, for variety and for stimulus spread — not for load chasing.
//
// Three anchors per working day; the light day rotates everything.
// weekday: 0 = Sunday .. 6 = Saturday

const S = (id, family, group, foundation, opts = {}) => ({
  id, family, group, foundation,
  variations: opts.v || [],
  anchor: opts.anchor ?? ((opts.v || []).length === 0),
  sets: opts.sets ?? 3,
  repMin: opts.min ?? 8,
  repMax: opts.max ?? 12,
  restSec: opts.rest ?? 90,
  priority: opts.priority || null,
  unit: opts.unit || 'reps',
});

const A = (id, family, group, foundation, opts = {}) => S(id, family, group, foundation, { ...opts, anchor: true });

export const PROGRAMS = {
  physique: {
    label: 'Physique',
    blurb: 'Seven days, paired movement patterns. Three anchor lifts a day carry progression; everything else rotates weekly for variety.',
    days: [
      {
        id: 'p-lats-biceps', weekday: 1, title: 'Lats & Biceps',
        why: 'Vertical pulling while the lats are freshest, then the biceps the pulls already warmed up.',
        slots: [
          A('l1', 'vertical-pull', 'Back', 'lat-pulldown', {
            sets: 5, min: 8, max: 12, rest: 150, priority: 'lats' }),
          A('l2', 'horizontal-pull', 'Back', 'one-arm-db-row', {
            sets: 4, min: 8, max: 12, rest: 120, priority: 'upper-back' }),
          A('l3', 'elbow-flexion', 'Biceps', 'ez-bar-curl', {
            sets: 3, min: 8, max: 12, rest: 90, priority: 'arms' }),
          S('l4', 'vertical-pull', 'Back', 'cable-straight-arm-pulldown', {
            v: ['single-arm-pulldown'], sets: 2, min: 12, max: 15, rest: 75, priority: 'lats' }),
          S('l5', 'rear-delt', 'Shoulders', 'db-rear-delt-fly', {
            v: ['reverse-pec-deck', 'cable-face-pull'], sets: 2, min: 12, max: 16, rest: 60 }),
          S('l6', 'lateral-raise', 'Shoulders', 'cable-lateral-raise', {
            v: ['db-lateral-raise', 'machine-lateral-raise'],
            sets: 3, min: 12, max: 16, rest: 60, priority: 'lateral-delts' }),
          S('l7', 'anti-extension', 'Core', 'ab-wheel', {
            v: ['plank-weighted', 'pallof-press'], sets: 2, min: 8, max: 12, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 'p-chest-delts', weekday: 2, title: 'Upper Chest & Delts',
        why: 'Incline pressing first, then the lateral delts that do most of the work for shoulder width.',
        slots: [
          A('c1', 'incline-press', 'Chest', 'bb-incline-press', {
            sets: 4, min: 6, max: 9, rest: 180, priority: 'upper-chest' }),
          A('c2', 'flat-press', 'Chest', 'machine-chest-press', {
            sets: 4, min: 8, max: 12, rest: 150 }),
          A('c3', 'lateral-raise', 'Shoulders', 'db-lateral-raise', {
            sets: 4, min: 12, max: 16, rest: 60, priority: 'lateral-delts' }),
          S('c4', 'chest-fly', 'Chest', 'cable-fly-low-high', {
            v: ['cable-fly-incline'], sets: 3, min: 12, max: 15, rest: 75, priority: 'upper-chest' }),
          S('c5', 'elbow-extension', 'Triceps', 'rope-overhead-cable-triceps-extension', {
            v: ['single-arm-overhead-triceps-extension', 'db-overhead-triceps-extension'],
            sets: 3, min: 10, max: 14, rest: 90, priority: 'triceps' }),
          S('c6', 'rear-delt', 'Shoulders', 'reverse-pec-deck', {
            v: ['db-rear-delt-fly'], sets: 2, min: 12, max: 16, rest: 60 }),
        ],
      },
      {
        id: 'p-quads-core', weekday: 3, title: 'Quads & Core',
        why: 'Back-supported squatting so femur length stops dictating the setup, then direct quad work.',
        slots: [
          A('q1', 'squat', 'Quads', 'hack-squat', {
            sets: 5, min: 6, max: 10, rest: 180, priority: 'quads' }),
          A('q2', 'unilateral-squat', 'Quads', 'db-bulgarian-split-squat', {
            sets: 3, min: 8, max: 12, rest: 120, priority: 'quads' }),
          A('q3', 'knee-extension', 'Quads', 'leg-extension', {
            sets: 4, min: 12, max: 15, rest: 75, priority: 'quads' }),
          S('q4', 'knee-flexion', 'Hamstrings', 'seated-leg-curl', {
            v: ['lying-leg-curl'], sets: 3, min: 10, max: 14, rest: 90 }),
          S('q5', 'calf', 'Calves', 'standing-calf-raise', {
            v: ['leg-press-calf-raise', 'single-leg-calf-raise'], sets: 3, min: 8, max: 12, rest: 75 }),
          S('q6', 'core-flexion', 'Core', 'cable-crunch', {
            v: ['hanging-leg-raise', 'ab-wheel'], sets: 2, min: 10, max: 15, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 'p-back-triceps', weekday: 4, title: 'Upper Back & Triceps',
        why: 'Heavy rowing for back thickness paired with triceps, which the rows leave completely fresh.',
        slots: [
          A('b1', 'horizontal-pull', 'Back', 'bb-row', {
            sets: 4, min: 6, max: 10, rest: 180, priority: 'upper-back' }),
          A('b2', 'vertical-pull', 'Back', 'neutral-pulldown', {
            sets: 4, min: 8, max: 12, rest: 120, priority: 'lats' }),
          A('b3', 'elbow-extension', 'Triceps', 'ez-bar-skull-crusher', {
            sets: 4, min: 8, max: 12, rest: 120, priority: 'triceps' }),
          S('b4', 'rear-delt', 'Shoulders', 'cable-face-pull', {
            v: ['reverse-pec-deck', 'db-rear-delt-fly'], sets: 3, min: 12, max: 16, rest: 60 }),
          S('b5', 'elbow-extension', 'Triceps', 'cable-pressdown-rope', {
            v: ['cable-pressdown-bar', 'dip-triceps'], sets: 2, min: 10, max: 14, rest: 75, priority: 'triceps' }),
          S('b6', 'lateral-raise', 'Shoulders', 'machine-lateral-raise', {
            v: ['lean-away-lateral-raise', 'cable-lateral-raise'],
            sets: 2, min: 12, max: 18, rest: 60, priority: 'lateral-delts' }),
          S('b7', 'horizontal-pull', 'Back', 'chest-supported-row', {
            v: ['machine-row', 'seated-cable-row'], sets: 2, min: 10, max: 14, rest: 90, priority: 'upper-back' }),
        ],
      },
      {
        id: 'p-delts-chest', weekday: 5, title: 'Delts & Upper Chest',
        why: 'Overhead pressing for shoulder size, then a second upper-chest exposure at lighter loads.',
        slots: [
          A('d1', 'vertical-press', 'Shoulders', 'machine-shoulder-press', {
            sets: 4, min: 8, max: 12, rest: 150 }),
          A('d2', 'incline-press', 'Chest', 'db-incline-press', {
            sets: 4, min: 8, max: 12, rest: 150, priority: 'upper-chest' }),
          A('d3', 'lateral-raise', 'Shoulders', 'cable-lateral-raise', {
            sets: 4, min: 12, max: 18, rest: 60, priority: 'lateral-delts' }),
          S('d4', 'chest-fly', 'Chest', 'pec-deck', {
            v: ['cable-fly-mid'], sets: 3, min: 12, max: 15, rest: 75 }),
          S('d5', 'elbow-flexion', 'Biceps', 'db-hammer-curl', {
            v: ['cable-curl', 'preacher-curl', 'db-incline-curl'],
            sets: 3, min: 10, max: 14, rest: 75, priority: 'arms' }),
          S('d6', 'anti-extension', 'Core', 'pallof-press', {
            v: ['plank-weighted'], sets: 2, min: 10, max: 14, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 'p-hinge-legs', weekday: 6, title: 'Hinge & Legs',
        why: 'Trap-bar pulling for the posterior chain plus a second quad exposure that is not a squat pattern.',
        slots: [
          A('h1', 'hinge', 'Hamstrings', 'trap-bar-deadlift', {
            sets: 4, min: 5, max: 8, rest: 210 }),
          A('h2', 'squat', 'Quads', 'leg-press', {
            sets: 4, min: 10, max: 14, rest: 150, priority: 'quads' }),
          A('h3', 'knee-flexion', 'Hamstrings', 'lying-leg-curl', {
            sets: 4, min: 10, max: 14, rest: 90 }),
          S('h4', 'hip-extension', 'Glutes', 'back-extension-45', {
            v: ['cable-pull-through', 'back-extension-horizontal'], sets: 3, min: 10, max: 15, rest: 90 }),
          S('h5', 'calf', 'Calves', 'seated-calf-raise', {
            v: ['single-leg-calf-raise', 'standing-calf-raise'], sets: 3, min: 10, max: 15, rest: 60 }),
          S('h6', 'core-flexion', 'Core', 'hanging-leg-raise', {
            v: ['cable-crunch', 'suitcase-carry'], sets: 2, min: 8, max: 12, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 'p-priority-light', weekday: 0, title: 'Priority & Conditioning',
        why: 'A deliberately light day: priority areas only, everything rotating, and the natural slot for a run or swim.',
        light: true,
        slots: [
          S('r1', 'lateral-raise', 'Shoulders', 'lean-away-lateral-raise', {
            v: ['machine-lateral-raise', 'cable-lateral-raise', 'db-lateral-raise'],
            sets: 4, min: 12, max: 18, rest: 60, priority: 'lateral-delts' }),
          S('r2', 'vertical-pull', 'Back', 'single-arm-pulldown', {
            v: ['cable-straight-arm-pulldown', 'neutral-pulldown'],
            sets: 2, min: 12, max: 15, rest: 60, priority: 'lats' }),
          S('r3', 'incline-press', 'Chest', 'machine-incline-press', {
            v: ['smith-incline-press', 'cable-fly-incline'],
            sets: 3, min: 12, max: 15, rest: 60, priority: 'upper-chest' }),
          S('r4', 'anti-extension', 'Core', 'plank-weighted', {
            v: ['pallof-press', 'suitcase-carry'], sets: 2, min: 10, max: 14, rest: 45, priority: 'midsection' }),
        ],
      },
    ],
  },

  strength: {
    label: 'Strength',
    blurb: 'Four heavy primaries across seven days. One lift per heavy day at low reps and long rest, with lighter support days between them.',
    days: [
      {
        id: 's-squat', weekday: 1, title: 'Squat Strength',
        why: 'Practice the competition squat heavy and repeat it weekly for skill as well as load.',
        slots: [
          S('ss1', 'squat', 'Quads', 'bb-back-squat', { sets: 5, min: 3, max: 5, rest: 240 }),
          S('ss2', 'squat', 'Quads', 'heel-elevated-squat', { sets: 3, min: 6, max: 8, rest: 180 }),
          S('ss3', 'unilateral-squat', 'Quads', 'db-bulgarian-split-squat', { sets: 2, min: 8, max: 10, rest: 120 }),
          S('ss4', 'knee-flexion', 'Hamstrings', 'seated-leg-curl', { sets: 3, min: 8, max: 12, rest: 90 }),
          S('ss5', 'calf', 'Calves', 'standing-calf-raise', { sets: 3, min: 8, max: 12, rest: 75 }),
        ],
      },
      {
        id: 's-bench', weekday: 2, title: 'Bench Strength',
        why: 'Heavy flat bench for the pressing pattern, incline kept in for upper-chest carryover.',
        slots: [
          S('sb1', 'flat-press', 'Chest', 'bb-bench-press', { sets: 5, min: 3, max: 5, rest: 240 }),
          S('sb2', 'incline-press', 'Chest', 'bb-incline-press', { sets: 3, min: 6, max: 8, rest: 180, priority: 'upper-chest' }),
          S('sb3', 'horizontal-pull', 'Back', 'one-arm-db-row', { sets: 3, min: 8, max: 10, rest: 120, priority: 'upper-back' }),
          S('sb4', 'elbow-extension', 'Triceps', 'cable-pressdown-bar', { sets: 3, min: 8, max: 12, rest: 90, priority: 'triceps' }),
          S('sb5', 'lateral-raise', 'Shoulders', 'db-lateral-raise', { sets: 3, min: 12, max: 15, rest: 60, priority: 'lateral-delts' }),
        ],
      },
      {
        id: 's-support-a', weekday: 3, title: 'Support & Conditioning',
        why: 'A light day between heavy sessions: pulling volume, delts and trunk work, then conditioning if you want it.',
        light: true,
        slots: [
          S('sa1', 'vertical-pull', 'Back', 'lat-pulldown', { sets: 3, min: 10, max: 12, rest: 90, priority: 'lats' }),
          S('sa2', 'lateral-raise', 'Shoulders', 'cable-lateral-raise', { sets: 3, min: 12, max: 16, rest: 60, priority: 'lateral-delts' }),
          S('sa3', 'rear-delt', 'Shoulders', 'cable-face-pull', { sets: 3, min: 12, max: 16, rest: 60 }),
          S('sa4', 'hip-extension', 'Glutes', 'back-extension-45', { sets: 3, min: 10, max: 12, rest: 75 }),
          S('sa5', 'anti-extension', 'Core', 'pallof-press', { sets: 2, min: 10, max: 14, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 's-deadlift', weekday: 4, title: 'Deadlift Strength',
        why: 'Low-rep pulls with full rest, then an RDL to keep the hamstrings under long tension.',
        slots: [
          S('sd1', 'hinge', 'Hamstrings', 'bb-deadlift', { sets: 4, min: 3, max: 5, rest: 300 }),
          S('sd2', 'hinge', 'Hamstrings', 'bb-romanian-deadlift', { sets: 3, min: 6, max: 8, rest: 180 }),
          S('sd3', 'vertical-pull', 'Back', 'lat-pulldown', { sets: 3, min: 8, max: 10, rest: 120, priority: 'lats' }),
          S('sd4', 'hip-extension', 'Glutes', 'back-extension-45', { sets: 3, min: 10, max: 12, rest: 90 }),
          S('sd5', 'core-flexion', 'Core', 'hanging-leg-raise', { sets: 3, min: 8, max: 12, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 's-press', weekday: 5, title: 'Press & Upper Strength',
        why: 'Overhead strength plus heavy rowing, the two things that hold up bench numbers.',
        slots: [
          S('sp1', 'vertical-press', 'Shoulders', 'bb-overhead-press', { sets: 5, min: 3, max: 5, rest: 240 }),
          S('sp2', 'elbow-extension', 'Triceps', 'close-grip-bench', { sets: 3, min: 6, max: 8, rest: 180, priority: 'triceps' }),
          S('sp3', 'horizontal-pull', 'Back', 'bb-row', { sets: 3, min: 6, max: 8, rest: 150, priority: 'upper-back' }),
          S('sp4', 'elbow-flexion', 'Biceps', 'ez-bar-curl', { sets: 3, min: 8, max: 10, rest: 90, priority: 'arms' }),
          S('sp5', 'lateral-raise', 'Shoulders', 'machine-lateral-raise', { sets: 3, min: 12, max: 15, rest: 60, priority: 'lateral-delts' }),
        ],
      },
      {
        id: 's-hypertrophy', weekday: 6, title: 'Hypertrophy Support',
        why: 'Moderate-rep machine work that adds muscle without spending recovery the heavy days need.',
        slots: [
          S('sh1', 'flat-press', 'Chest', 'machine-chest-press', { sets: 3, min: 10, max: 12, rest: 90 }),
          S('sh2', 'horizontal-pull', 'Back', 'chest-supported-row', { sets: 3, min: 10, max: 12, rest: 90, priority: 'upper-back' }),
          S('sh3', 'squat', 'Quads', 'leg-press', { sets: 3, min: 10, max: 14, rest: 120, priority: 'quads' }),
          S('sh4', 'lateral-raise', 'Shoulders', 'db-lateral-raise', { sets: 3, min: 12, max: 16, rest: 60, priority: 'lateral-delts' }),
          S('sh5', 'elbow-flexion', 'Biceps', 'db-incline-curl', { sets: 2, min: 10, max: 14, rest: 60, priority: 'arms' }),
          S('sh6', 'elbow-extension', 'Triceps', 'cable-pressdown-rope', { sets: 2, min: 10, max: 14, rest: 60, priority: 'triceps' }),
        ],
      },
      {
        id: 's-recovery', weekday: 0, title: 'Recovery & Conditioning',
        why: 'The lightest day of the week. Blood flow, trunk work and a run or swim if you want one.',
        light: true,
        slots: [
          S('sr1', 'vertical-pull', 'Back', 'cable-straight-arm-pulldown', { sets: 2, min: 12, max: 15, rest: 60, priority: 'lats' }),
          S('sr2', 'lateral-raise', 'Shoulders', 'cable-lateral-raise', { sets: 3, min: 12, max: 18, rest: 60, priority: 'lateral-delts' }),
          S('sr3', 'hip-extension', 'Glutes', 'cable-pull-through', { sets: 3, min: 12, max: 15, rest: 60 }),
          S('sr4', 'anti-extension', 'Core', 'plank-weighted', { sets: 2, min: 10, max: 14, rest: 45, priority: 'midsection' }),
        ],
      },
    ],
  },

  athletic: {
    label: 'Athletic',
    blurb: 'Power and movement quality first every day, low volume, full recovery between efforts.',
    days: [
      {
        id: 'a-lower-power', weekday: 1, title: 'Lower Power',
        why: 'Jumps while fresh, then one heavy squat pattern to back the power up with force.',
        slots: [
          S('ap1', 'jump', 'Power', 'box-jump', { sets: 4, min: 3, max: 3, rest: 120 }),
          S('ap2', 'jump', 'Power', 'trap-bar-jump', { sets: 4, min: 3, max: 3, rest: 150 }),
          S('ap3', 'squat', 'Quads', 'heel-elevated-squat', { sets: 3, min: 5, max: 5, rest: 180, priority: 'quads' }),
          S('ap4', 'hinge', 'Hamstrings', 'single-leg-rdl', { sets: 2, min: 8, max: 8, rest: 90 }),
          S('ap5', 'pogo', 'Power', 'pogo-hop', { sets: 3, min: 10, max: 10, rest: 60 }),
        ],
      },
      {
        id: 'a-upper-power', weekday: 2, title: 'Upper Power & Throws',
        why: 'Throws train fast upper-body force; the press and row keep the strength base under it.',
        slots: [
          S('au1', 'throw', 'Power', 'med-ball-chest-pass', { sets: 4, min: 4, max: 4, rest: 90 }),
          S('au2', 'throw', 'Power', 'med-ball-rotational-throw', { sets: 3, min: 5, max: 5, rest: 90 }),
          S('au3', 'incline-press', 'Chest', 'bb-incline-press', { sets: 4, min: 5, max: 5, rest: 180, priority: 'upper-chest' }),
          S('au4', 'horizontal-pull', 'Back', 'one-arm-db-row', { sets: 3, min: 8, max: 8, rest: 120, priority: 'upper-back' }),
          S('au5', 'anti-extension', 'Core', 'pallof-press', { sets: 2, min: 10, max: 10, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 'a-tempo', weekday: 3, title: 'Tempo & Carries',
        why: 'Submaximal running and loaded carries: work capacity without the joint cost of sprinting.',
        light: true,
        slots: [
          S('at1', 'sprint', 'Power', 'a-skip', { sets: 3, min: 20, max: 20, rest: 60, unit: 'yards' }),
          S('at2', 'sprint', 'Power', 'sled-push', { sets: 4, min: 20, max: 20, rest: 120, unit: 'yards' }),
          S('at3', 'carry', 'Core', 'suitcase-carry', { sets: 2, min: 20, max: 20, rest: 60, unit: 'yards', priority: 'midsection' }),
          S('at4', 'hip-extension', 'Glutes', 'back-extension-45', { sets: 2, min: 10, max: 12, rest: 60 }),
        ],
      },
      {
        id: 'a-speed', weekday: 4, title: 'Speed & Elastic',
        why: 'Short maximal runs and bounds for elasticity, kept well away from fatigue.',
        slots: [
          S('as1', 'sprint', 'Power', 'a-skip', { sets: 3, min: 20, max: 20, rest: 60, unit: 'yards' }),
          S('as2', 'sprint', 'Power', 'hill-sprint', { sets: 6, min: 20, max: 20, rest: 180, unit: 'yards' }),
          S('as3', 'jump', 'Power', 'lateral-bound', { sets: 3, min: 6, max: 6, rest: 90 }),
          S('as4', 'unilateral-squat', 'Quads', 'db-bulgarian-split-squat', { sets: 2, min: 8, max: 8, rest: 90, priority: 'quads' }),
        ],
      },
      {
        id: 'a-strength', weekday: 5, title: 'Strength Support',
        why: 'A jump to prime the nervous system, then the heavy lifts that raise the ceiling on power.',
        slots: [
          S('ag1', 'jump', 'Power', 'db-jump-squat', { sets: 3, min: 3, max: 3, rest: 120 }),
          S('ag2', 'squat', 'Quads', 'bb-back-squat', { sets: 4, min: 5, max: 5, rest: 210, priority: 'quads' }),
          S('ag3', 'flat-press', 'Chest', 'bb-bench-press', { sets: 3, min: 5, max: 5, rest: 180 }),
          S('ag4', 'vertical-pull', 'Back', 'lat-pulldown', { sets: 3, min: 8, max: 8, rest: 120, priority: 'lats' }),
          S('ag5', 'lateral-raise', 'Shoulders', 'db-lateral-raise', { sets: 3, min: 12, max: 12, rest: 60, priority: 'lateral-delts' }),
        ],
      },
      {
        id: 'a-power-endurance', weekday: 6, title: 'Power Endurance',
        why: 'Repeat efforts with short rest: the quality that fades last in a long game or session.',
        slots: [
          S('ae1', 'throw', 'Power', 'med-ball-slam', { sets: 4, min: 6, max: 6, rest: 75 }),
          S('ae2', 'jump', 'Power', 'broad-jump', { sets: 3, min: 4, max: 4, rest: 90 }),
          S('ae3', 'sprint', 'Power', 'sled-push', { sets: 4, min: 20, max: 20, rest: 120, unit: 'yards' }),
          S('ae4', 'unilateral-squat', 'Quads', 'db-step-up', { sets: 3, min: 8, max: 8, rest: 90, priority: 'quads' }),
          S('ae5', 'core-flexion', 'Core', 'hanging-leg-raise', { sets: 3, min: 8, max: 8, rest: 60, priority: 'midsection' }),
        ],
      },
      {
        id: 'a-easy', weekday: 0, title: 'Easy Movement',
        why: 'The lightest day: skips, hops and hip work to stay springy, plus a run or swim if you want one.',
        light: true,
        slots: [
          S('ay1', 'sprint', 'Power', 'a-skip', { sets: 2, min: 20, max: 20, rest: 60, unit: 'yards' }),
          S('ay2', 'pogo', 'Power', 'pogo-hop', { sets: 2, min: 12, max: 12, rest: 60 }),
          S('ay3', 'hip-extension', 'Glutes', 'cable-pull-through', { sets: 2, min: 12, max: 15, rest: 60 }),
          S('ay4', 'anti-extension', 'Core', 'pallof-press', { sets: 2, min: 10, max: 12, rest: 45, priority: 'midsection' }),
        ],
      },
    ],
  },
};

export const MODES = ['physique', 'strength', 'athletic'];

/** Conditioning is logged, never prescribed: it sits outside the split entirely. */
export const CONDITIONING_KINDS = [
  { id: 'run', label: 'Run', metric: 'distance', unit: 'mi' },
  { id: 'swim', label: 'Swim', metric: 'distance', unit: 'yd' },
  { id: 'bike', label: 'Bike', metric: 'distance', unit: 'mi' },
  { id: 'row', label: 'Row', metric: 'distance', unit: 'm' },
  { id: 'walk', label: 'Walk / ruck', metric: 'distance', unit: 'mi' },
  { id: 'other', label: 'Other', metric: 'time', unit: 'min' },
];
