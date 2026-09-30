import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, migrate, saveState, loadState, createStore,
  exportBundle, importBundle, SCHEMA_VERSION, KEY, BACKUP_KEY,
} from '../src/core/store.js';
import { memoryStorage, tinyStorage } from './helpers.mjs';

test('a fresh state is complete and internally valid', () => {
  const s = createInitialState();
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.settings.mode, 'physique');
  assert.deepEqual(s.sessions, []);
  assert.equal(s.program.physique.days.length, 7);
  assert.ok(Object.keys(s.loads).length > 50);
  assert.deepEqual(s.profile.physiquePriorities,
    ['upper-chest', 'lateral-delts', 'lats', 'upper-back', 'quads']);
  assert.equal(s.measurements.length, 0, 'measurement log starts empty');
  assert.deepEqual(s.conditioning, []);
});

test('no body measurements ship in the source', () => {
  const s = createInitialState();
  for (const [field, value] of Object.entries(s.profile.proportions)) {
    assert.equal(value, null, `${field} must be entered by the athlete, not shipped`);
  }
  assert.equal(s.profile.proportionNotes, '');
  // Tendencies and priorities are programming choices, not personal data.
  assert.deepEqual(s.profile.tendencies, ['long-femurs', 'short-torso', 'long-lower-legs', 'long-arms']);
});

test('the published source contains no measurement figures', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const f of ['src/core/store.js', 'src/ui/profile.js']) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const figure of ['70.2', '16.5 in', '18 in femur', '19 in shoulders', '+1.8 in']) {
      assert.ok(!text.includes(figure), `${f} still contains ${figure}`);
    }
  }
});

test('volume targets are seeded from the physique priorities', () => {
  const s = createInitialState();
  for (const region of ['Upper chest', 'Lateral delts', 'Lats', 'Upper back', 'Quads']) {
    assert.deepEqual(s.volumeTargets[region], { min: 14, max: 18 }, `${region} is a priority region`);
  }
  assert.ok(s.volumeTargets['Rear delts'].max < 14, 'non-priority regions sit lower');
  assert.deepEqual(s.volumeTargets.Power, { min: 0, max: 0 }, 'power work is not a muscle-volume target');
});

test('an untouched default priority set adopts the new default on migration', () => {
  const { state } = migrate({
    schemaVersion: 3, sessions: [], settings: { mode: 'physique' },
    profile: { physiquePriorities: ['upper-chest', 'lateral-delts', 'lats', 'arms', 'calves'] },
  });
  assert.deepEqual(state.profile.physiquePriorities,
    ['upper-chest', 'lateral-delts', 'lats', 'upper-back', 'quads']);
  assert.deepEqual(state.volumeTargets['Upper back'], { min: 14, max: 18 }, 'targets follow the new set');
  assert.deepEqual(state.profile.tendencies, ['long-femurs', 'short-torso', 'long-lower-legs', 'long-arms']);
});

test('a v3 snapshot migrates to the seven-day program without losing records', () => {
  const v3 = {
    schemaVersion: 3,
    settings: { mode: 'physique', theme: 'midnight' },
    profile: {
      proportions: { height: 70, armSpan: 72, femur: 18 },
      biomechanics: [{ id: 'b1', label: 'Long femurs relative to torso', note: 'forward lean' }],
      physiquePriorities: ['lats', 'quads'],
      fit: { 'hack-squat': 'preferred' },
    },
    loads: { 'bb-back-squat': { load: 225, increment: 10, established: true } },
    sessions: [{
      id: 's1', dateKey: '2026-09-01', mode: 'physique', title: 'Old Lower A', status: 'completed',
      exercises: [{ uid: 'u', exerciseId: 'bb-back-squat', name: 'Barbell Back Squat', group: 'Quads',
        family: 'squat', sets: [{ load: 225, reps: 5, done: true }] }],
    }],
  };
  const { state, migratedFrom } = migrate(v3);
  assert.equal(migratedFrom, 3);
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(state.program.physique.days.length, 7, 'the split moved to seven days');
  assert.equal(state.sessions[0].exercises[0].sets[0].reps, 5, 'logged work survives');
  assert.equal(state.loads['bb-back-squat'].load, 225, 'baselines survive');
  assert.equal(state.settings.theme, 'midnight', 'preferences survive');
  assert.equal(state.profile.proportions.wingspan, 72, 'arm span became wingspan');
  assert.equal(state.profile.proportions.height, 70, 'an entered value is never overwritten');
  assert.equal(state.profile.proportions.tibia, null, 'blank stays blank; measurements are entered, not shipped');
  assert.deepEqual(state.profile.tendencies, ['long-femurs'], 'free-text tendencies carried over');
  assert.deepEqual(state.profile.physiquePriorities, ['lats', 'quads'], 'chosen priorities are kept');
  assert.deepEqual(state.volumeTargets.Lats, { min: 14, max: 18 }, 'targets follow those priorities');
  assert.deepEqual(state.conditioning, []);
});

test('a v1 snapshot migrates forward without losing training records', () => {
  const v1 = {
    schemaVersion: 1,
    settings: { mode: 'physique', theme: 'alpine' },
    baselines: { 'bb-bench-press': 155 },
    exerciseFit: { 'hack-squat': 'preferred' },
    sessions: [{
      id: 's1', dateKey: '2026-01-06', mode: 'physique', title: 'Old session',
      exercises: [{ uid: 'x', exerciseId: 'bb-bench-press', name: 'Barbell Bench Press', group: 'Chest',
        sets: [{ load: 155, reps: 5, done: true }] }],
    }],
  };
  const { state, migratedFrom } = migrate(v1);
  assert.equal(migratedFrom, 1);
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].exercises[0].sets[0].reps, 5);
  assert.equal(state.sessions[0].exercises[0].added, false);
  assert.deepEqual(state.loads['bb-bench-press'], { load: 155, increment: 5, established: true });
  assert.equal(state.profile.fit['hack-squat'], 'preferred', 'fit moved onto the profile');
  assert.equal(state.settings.theme, 'alpine', 'preferences survive');
  assert.ok(state.program.physique, 'a program is seeded for a snapshot that had none');
});

test('a partial or hand-edited snapshot is repaired rather than rejected', () => {
  const { state } = migrate({ schemaVersion: SCHEMA_VERSION, sessions: [], settings: { mode: 'strength' } });
  assert.equal(state.settings.mode, 'strength');
  assert.ok(state.profile.name);
  assert.ok(state.loads['bb-back-squat']);
});

test('saving rotates the previous snapshot into the backup slot', () => {
  const storage = memoryStorage();
  const a = createInitialState();
  a.profile.name = 'first';
  saveState(storage, a);
  const b = createInitialState();
  b.profile.name = 'second';
  saveState(storage, b);
  assert.match(storage.getItem(KEY), /"second"/);
  assert.match(storage.getItem(BACKUP_KEY), /"first"/);
});

test('a corrupt primary snapshot falls back to the backup copy', () => {
  const storage = memoryStorage();
  const s = createInitialState();
  s.profile.name = 'good';
  saveState(storage, s);
  saveState(storage, { ...createInitialState(), profile: { ...s.profile, name: 'newer' } });
  storage.setItem(KEY, '{ this is not json');
  const loaded = loadState(storage);
  assert.equal(loaded.source, 'backup');
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.state.profile.name, 'good');
});

test('an empty store starts fresh instead of throwing', () => {
  const loaded = loadState(memoryStorage());
  assert.equal(loaded.source, 'new');
  assert.equal(loaded.state.sessions.length, 0);
});

test('a quota failure drops progress photos, never training data', () => {
  const storage = tinyStorage(40000);
  const s = createInitialState();
  s.sessions.push({ id: 'k', dateKey: '2026-09-29', mode: 'physique', exercises: [], status: 'completed' });
  s.photos.push({ id: 'p', date: '2026-09-29', dataUrl: 'x'.repeat(60000), note: 'front' });
  const res = saveState(storage, s);
  assert.equal(res.ok, true);
  assert.equal(res.trimmed, true);
  const back = loadState(storage);
  assert.equal(back.state.sessions.length, 1);
  assert.equal(back.state.photos[0].dataUrl, null);
  assert.equal(back.state.photos[0].note, 'front');
});

test('export and import round-trip preserves everything', () => {
  const s = createInitialState();
  s.sessions.push({ id: 'z', dateKey: '2026-09-29', mode: 'physique', status: 'completed', exercises: [] });
  s.measurements.push({ id: 'm', date: '2026-09-01', values: { weight: 190 } });
  const back = importBundle(exportBundle(s));
  assert.equal(back.sessions[0].id, 'z');
  assert.equal(back.measurements[0].values.weight, 190);
  assert.throws(() => importBundle('{"nope":true}'), /Training OS backup/);
});

test('the store autosaves and survives a reload of the same storage', async () => {
  const storage = memoryStorage();
  const store = createStore(storage, { debounceMs: 1 });
  store.update((s) => { s.profile.name = 'Athlete A'; });
  store.flush();
  const reopened = createStore(storage, { debounceMs: 1 });
  assert.equal(reopened.get().profile.name, 'Athlete A');
  assert.equal(reopened.source, 'primary');
  assert.equal(reopened.status().state, 'saved');
});
