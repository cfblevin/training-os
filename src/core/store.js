// State shape, versioned migrations, persistence with a recoverable backup copy.
// Storage is injected so the same code runs under node:test.

import { PROGRAMS } from '../data/program.js';
import { LIBRARY } from '../data/library.js';
import { dateKey } from './schedule.js';
import { defaultTargets } from './volume.js';

export const SCHEMA_VERSION = 5;
export const KEY = 'trainingos.state';
export const BACKUP_KEY = 'trainingos.state.backup';

export const MEASUREMENT_FIELDS = [
  { id: 'weight', label: 'Body weight', unit: 'lb' },
  { id: 'chest', label: 'Chest', unit: 'in' },
  { id: 'shoulders', label: 'Shoulders', unit: 'in' },
  { id: 'waist', label: 'Waist', unit: 'in' },
  { id: 'hips', label: 'Hips', unit: 'in' },
  { id: 'armL', label: 'Upper arm (L)', unit: 'in' },
  { id: 'armR', label: 'Upper arm (R)', unit: 'in' },
  { id: 'forearm', label: 'Forearm', unit: 'in' },
  { id: 'thighL', label: 'Thigh (L)', unit: 'in' },
  { id: 'thighR', label: 'Thigh (R)', unit: 'in' },
  { id: 'calfL', label: 'Calf (L)', unit: 'in' },
  { id: 'calfR', label: 'Calf (R)', unit: 'in' },
  { id: 'neck', label: 'Neck', unit: 'in' },
];

export const PROPORTION_FIELDS = [
  { id: 'height', label: 'Height', unit: 'in' },
  { id: 'wingspan', label: 'Wingspan', unit: 'in' },
  { id: 'torso', label: 'Torso length', unit: 'in' },
  { id: 'femur', label: 'Femur length', unit: 'in' },
  { id: 'tibia', label: 'Tibia length', unit: 'in' },
  { id: 'inseam', label: 'Inseam', unit: 'in' },
  { id: 'armLength', label: 'Arm length', unit: 'in' },
  { id: 'shoulderWidth', label: 'Shoulder width', unit: 'in' },
  { id: 'hipWidth', label: 'Hip width', unit: 'in' },
];

/** Self-reported tendencies. Prompts for exercise fit, not diagnoses. */
export const TENDENCY_OPTIONS = [
  { id: 'long-femurs', label: 'Long femurs relative to torso',
    note: 'A bilateral squat will sit with more forward lean. Stance width, a heel lift and back-supported patterns keep the quads loaded without chasing a depth target.' },
  { id: 'short-torso', label: 'Short torso',
    note: 'Bracing is easier and hinging is well tolerated. It also means the waist looks narrower quickly when the shoulders and lats grow.' },
  { id: 'long-lower-legs', label: 'Long lower legs',
    note: 'Long shins move the knee further forward in a squat. Elevating the heel or using a hack squat restores an upright torso.' },
  { id: 'long-arms', label: 'Long arms',
    note: 'A longer range on presses and rows: expect lower press numbers relative to pulls, and more benefit from pressing over a shorter effective range (incline, machine).' },
  { id: 'long-torso', label: 'Long torso', note: 'Hinging has a longer moment arm; squats sit more upright.' },
  { id: 'short-femurs', label: 'Short femurs', note: 'Bilateral squatting tends to be comfortable and upright.' },
  { id: 'short-arms', label: 'Short arms', note: 'Pressing range is shorter; pulling range is longer.' },
  { id: 'broad-shoulders', label: 'Broad shoulders', note: 'Shoulder-to-waist ratio is already favourable; delt work compounds it.' },
  { id: 'narrow-hips', label: 'Narrow hips', note: 'Waist looks narrower for the same body fat; lats and delts do the rest.' },
];

export const FIT_LEVELS = ['preferred', 'neutral', 'poor', 'avoid'];
export const FIT_LABELS = {
  preferred: 'Preferred',
  neutral: 'Neutral',
  poor: 'Poor fit',
  avoid: 'Avoid unless necessary',
};

export function deepClone(v) {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

export function defaultProfile() {
  return {
    name: 'Athlete',
    // Left empty on purpose: measurements are the athlete's data and are entered in
    // Profile, not baked into source that ships to a host.
    proportions: {
      height: null, wingspan: null, torso: null, femur: null, tibia: null,
      inseam: null, armLength: null, shoulderWidth: null, hipWidth: null,
    },
    proportionNotes: '',
    tendencies: ['long-femurs', 'short-torso', 'long-lower-legs', 'long-arms'],
    biomechanics: [],
    fit: {
      'db-bulgarian-split-squat': 'preferred',
      'heel-elevated-squat': 'preferred',
      'hack-squat': 'preferred',
      'trap-bar-deadlift': 'preferred',
      'back-extension-45': 'preferred',
      'machine-incline-press': 'preferred',
    },
    physiquePriorities: ['upper-chest', 'lateral-delts', 'lats', 'upper-back', 'quads'],
    strengthPriorities: ['bb-bench-press', 'bb-back-squat', 'bb-deadlift', 'bb-overhead-press'],
    constraints: [],
    equipment: ['Barbell', 'Dumbbells', 'Cables', 'Machines', 'EZ-bar', 'Back-extension bench', 'Trap bar'],
    notes: '',
  };
}

export const DEFAULT_BLOCK_WEEKS = 6;

export function defaultBlock(now = new Date()) {
  return {
    id: `blk_${now.getTime().toString(36)}`,
    startedOn: dateKey(now),
    weeks: DEFAULT_BLOCK_WEEKS,
    number: 1,
    reviewedOn: null,
  };
}

export function defaultSettings() {
  return {
    mode: 'physique',
    theme: 'analog',
    units: 'lb',
    autoStartTimer: true,
    carouselDays: 13,
    showWhy: true,
  };
}

export function seedLoads() {
  const loads = {};
  for (const ex of LIBRARY) {
    loads[ex.id] = { load: ex.defaultLoad || 0, increment: ex.increment, established: false };
  }
  return loads;
}

export function createInitialState(now = new Date()) {
  const profile = defaultProfile();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    settings: defaultSettings(),
    profile,
    measurements: [],
    photos: [],
    customExercises: [],
    program: deepClone(PROGRAMS),
    volumeTargets: defaultTargets(profile.physiquePriorities),
    block: defaultBlock(now),
    loads: seedLoads(),
    suggestions: {},
    dayOverrides: {},
    sessions: [],
    conditioning: [],
    lastOpened: dateKey(now),
  };
}

// ---------------------------------------------------------------- migrations

function m1to2(s) {
  s.schemaVersion = 2;
  s.loads = s.loads || s.baselines || {};
  delete s.baselines;
  for (const [id, v] of Object.entries(s.loads)) {
    if (typeof v === 'number') s.loads[id] = { load: v, increment: 5, established: true };
  }
  s.sessions = (s.sessions || []).map((sess) => ({
    ...sess,
    exercises: (sess.exercises || []).map((e) => ({ ...e, added: !!e.added, sets: e.sets || [] })),
  }));
  return s;
}

function m2to3(s) {
  s.schemaVersion = 3;
  s.settings = { ...defaultSettings(), ...(s.settings || {}) };
  s.profile = { ...defaultProfile(), ...(s.profile || {}) };
  if (s.exerciseFit) { s.profile.fit = { ...s.profile.fit, ...s.exerciseFit }; delete s.exerciseFit; }
  s.measurements = s.measurements || [];
  s.photos = s.photos || [];
  s.customExercises = s.customExercises || [];
  s.dayOverrides = s.dayOverrides || {};
  s.suggestions = s.suggestions || {};
  s.program = s.program || deepClone(PROGRAMS);
  return s;
}

/** v4: region-based volume targets, conditioning log, finer proportion fields,
 *  tendency checkboxes, and the seven-day pattern-paired program. */
function m3to4(s) {
  s.schemaVersion = 4;
  const base = defaultProfile();
  s.profile = s.profile || base;
  const prop = s.profile.proportions || {};
  const carried = {
    height: prop.height ?? null,
    wingspan: prop.wingspan ?? prop.armSpan ?? null,
    torso: prop.torso ?? null,
    femur: prop.femur ?? null,
    tibia: prop.tibia ?? null,
    inseam: prop.inseam ?? null,
    armLength: prop.armLength ?? null,
    shoulderWidth: prop.shoulderWidth ?? null,
    hipWidth: prop.hipWidth ?? null,
  };
  // Fill blanks from the recorded profile; never overwrite a value already entered.
  s.profile.proportions = {};
  for (const [k, v] of Object.entries(carried)) {
    s.profile.proportions[k] = v == null ? base.proportions[k] ?? null : v;
  }
  if (!s.profile.proportionNotes) s.profile.proportionNotes = base.proportionNotes;

  // The default priority set changed; adopt the new one only if the old default
  // was never edited.
  const OLD_DEFAULT = ['upper-chest', 'lateral-delts', 'lats', 'arms', 'calves'];
  const current = s.profile.physiquePriorities || [];
  if (current.length === OLD_DEFAULT.length && OLD_DEFAULT.every((x) => current.includes(x))) {
    s.profile.physiquePriorities = [...base.physiquePriorities];
    delete s.volumeTargets;
  }

  if (!Array.isArray(s.profile.tendencies)) {
    // Carry the old free-text biomechanics list over to the checkbox model.
    const text = (s.profile.biomechanics || []).map((b) => `${b.label} ${b.note}`).join(' ').toLowerCase();
    const carriedTendencies = [];
    if (text.includes('long femur')) carriedTendencies.push('long-femurs');
    if (text.includes('short torso')) carriedTendencies.push('short-torso');
    s.profile.tendencies = carriedTendencies;
    s.profile.biomechanics = (s.profile.biomechanics || []).filter((b) => !['b1', 'b2', 'b3'].includes(b.id));
  }
  if (!s.profile.tendencies.length) s.profile.tendencies = [...base.tendencies];
  s.conditioning = s.conditioning || [];
  s.volumeTargets = s.volumeTargets || defaultTargets(s.profile.physiquePriorities || []);
  // The weekly split moved from five days plus rest to seven paired days.
  // Logged sessions, baselines, custom exercises and single-day edits are untouched.
  s.program = deepClone(PROGRAMS);
  return s;
}

/** v5: anchor lifts and the fixed-length training block. */
function m4to5(s) {
  s.schemaVersion = 5;
  // Slots gained an `anchor` flag and the rotation patterns were replaced by
  // pools, so the program is reseeded. Logged sessions and baselines are untouched.
  s.program = deepClone(PROGRAMS);
  if (!s.block) s.block = defaultBlock(new Date());
  return s;
}

const STEPS = { 1: m1to2, 2: m2to3, 3: m3to4, 4: m4to5 };

/** Migrate any older snapshot forward. Never throws away unknown keys. */
export function migrate(input) {
  let s = deepClone(input);
  const from = Number(s.schemaVersion || 1);
  let v = from;
  while (v < SCHEMA_VERSION) {
    const step = STEPS[v];
    if (!step) { s.schemaVersion = SCHEMA_VERSION; break; }
    s = step(s);
    v = Number(s.schemaVersion);
  }
  // Fill anything a hand-edited or partial snapshot is missing.
  const base = createInitialState();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.loads = { ...seedLoads(), ...(s.loads || {}) };
  s.schemaVersion = SCHEMA_VERSION;
  return { state: s, migratedFrom: from };
}

// ---------------------------------------------------------------- persistence

function validShape(s) {
  return !!s && typeof s === 'object' && Array.isArray(s.sessions) && !!s.settings;
}

export function readSnapshot(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const wrap = JSON.parse(raw);
    const state = wrap && wrap.state ? wrap.state : wrap;
    if (!validShape(state)) return null;
    return { state, savedAt: wrap.savedAt || null };
  } catch { return null; }
}

/** Primary first, backup second, fresh state last. Reports which one was used. */
export function loadState(storage) {
  const primary = readSnapshot(storage, KEY);
  if (primary) {
    const { state, migratedFrom } = migrate(primary.state);
    return { state, source: 'primary', savedAt: primary.savedAt, migratedFrom };
  }
  const backup = readSnapshot(storage, BACKUP_KEY);
  if (backup) {
    const { state, migratedFrom } = migrate(backup.state);
    return { state, source: 'backup', savedAt: backup.savedAt, migratedFrom, recovered: true };
  }
  return { state: createInitialState(), source: 'new', savedAt: null, migratedFrom: SCHEMA_VERSION };
}

/** Write the new snapshot, rotating the previous good one into the backup slot. */
export function saveState(storage, state) {
  const savedAt = new Date().toISOString();
  state.updatedAt = savedAt;
  state.schemaVersion = SCHEMA_VERSION;
  const payload = JSON.stringify({ v: SCHEMA_VERSION, savedAt, state });
  try {
    const prev = storage.getItem(KEY);
    if (prev && prev !== payload) storage.setItem(BACKUP_KEY, prev);
    storage.setItem(KEY, payload);
    return { ok: true, savedAt };
  } catch (err) {
    // Quota is the realistic failure. Drop progress photos (the only bulky data)
    // and retry so training records are never the thing that gets lost.
    try {
      const lean = { ...state, photos: (state.photos || []).map((p) => ({ ...p, dataUrl: null })) };
      storage.setItem(KEY, JSON.stringify({ v: SCHEMA_VERSION, savedAt, state: lean, trimmed: true }));
      return { ok: true, savedAt, trimmed: true };
    } catch (err2) {
      return { ok: false, error: String(err2 || err) };
    }
  }
}

export function exportBundle(state) {
  return JSON.stringify({
    app: 'training-os', v: SCHEMA_VERSION, exportedAt: new Date().toISOString(), state,
  }, null, 2);
}

export function importBundle(text) {
  const parsed = JSON.parse(text);
  const raw = parsed && parsed.state ? parsed.state : parsed;
  if (!validShape(raw)) throw new Error('That file does not look like a Training OS backup.');
  return migrate(raw).state;
}

// ---------------------------------------------------------------- tiny store

export function createStore(storage, { debounceMs = 250, onStatus = () => {} } = {}) {
  const loaded = loadState(storage);
  let state = loaded.state;
  const subs = new Set();
  let timer = null;
  let status = { state: loaded.recovered ? 'recovered' : 'saved', savedAt: loaded.savedAt };

  const setStatus = (s) => { status = { ...status, ...s }; onStatus(status); };

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    const res = saveState(storage, state);
    setStatus(res.ok
      ? { state: res.trimmed ? 'trimmed' : 'saved', savedAt: res.savedAt }
      : { state: 'error', error: res.error });
    return res;
  }

  function schedule() {
    setStatus({ state: 'saving' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  return {
    get: () => state,
    status: () => status,
    source: loaded.source,
    migratedFrom: loaded.migratedFrom,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    update(fn, { silent = false } = {}) {
      const next = fn(state);
      if (next) state = next;
      schedule();
      if (!silent) for (const fn2 of subs) fn2(state);
      return state;
    },
    replace(next) {
      state = next;
      flush();
      for (const fn of subs) fn(state);
      return state;
    },
    flush,
  };
}
