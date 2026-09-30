import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY, EXCLUDED, libraryById, GROUPS, FAMILY_LABELS } from '../src/data/library.js';

const byId = libraryById();

test('required approved movements are present', () => {
  const required = [
    'rope-overhead-cable-triceps-extension',
    'single-arm-overhead-triceps-extension',
    'ez-bar-skull-crusher',
    'one-arm-db-row',
    'machine-chest-press',
    'ez-bar-curl',
    'db-bulgarian-split-squat',
    'back-extension-45',
    'cable-pull-through',
  ];
  for (const id of required) assert.ok(byId.has(id), `missing ${id}`);
});

test('back-extension variations exist alongside the 45-degree foundation', () => {
  const fam = LIBRARY.filter((e) => e.family === 'hip-extension' && e.name.includes('Back Extension'));
  assert.ok(fam.length >= 3, 'expected 45-degree plus variations');
});

test('excluded movements are not in the approved library', () => {
  const names = LIBRARY.map((e) => e.name.toLowerCase());
  for (const bad of ['assisted pull-up', 'machine pullover', 'pendulum squat', 'belt squat']) {
    assert.ok(!names.includes(bad), `${bad} should not be approved`);
  }
  for (const id of EXCLUDED) assert.ok(!byId.has(id));
});

test('metadata matches the equipment each movement actually uses', () => {
  const expect = {
    'one-arm-db-row': { equipment: 'Dumbbell / bench', loadConvention: 'per-hand', unilateral: true },
    'ez-bar-skull-crusher': { equipment: 'EZ-bar', loadConvention: 'total', unilateral: false },
    'machine-chest-press': { equipment: 'Machine', loadConvention: 'stack', unilateral: false },
    'back-extension-45': { equipment: 'Back-extension bench', loadConvention: 'bodyweight-plus' },
    'cable-pull-through': { equipment: 'Cable', loadConvention: 'stack' },
    'cable-pressdown-bar': { equipment: 'Cable', loadConvention: 'stack' },
    'cable-pressdown-rope': { equipment: 'Cable / rope', loadConvention: 'stack' },
    'db-bulgarian-split-squat': { equipment: 'Dumbbells / bench', loadConvention: 'per-hand', unilateral: true },
  };
  for (const [id, want] of Object.entries(expect)) {
    const ex = byId.get(id);
    for (const [k, v] of Object.entries(want)) assert.equal(ex[k], v, `${id}.${k}`);
  }
});

test('every exercise is internally consistent', () => {
  const ids = new Set();
  for (const ex of LIBRARY) {
    assert.ok(!ids.has(ex.id), `duplicate id ${ex.id}`);
    ids.add(ex.id);
    assert.ok(GROUPS.includes(ex.group), `${ex.id} unknown group ${ex.group}`);
    assert.ok(FAMILY_LABELS[ex.family], `${ex.id} unknown family ${ex.family}`);
    assert.ok(ex.name.length > 2 && ex.equipment.length > 1);
    if (ex.loadConvention !== 'bodyweight') assert.ok(ex.increment >= 0);
  }
});
