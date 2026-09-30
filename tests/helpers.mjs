export function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

/** Storage that refuses writes over a byte budget, to exercise the quota path. */
export function tinyStorage(limit = 500) {
  const s = memoryStorage();
  return {
    ...s,
    setItem: (k, v) => {
      if (String(v).length > limit) throw new Error('QuotaExceededError');
      s.map.set(k, String(v));
    },
  };
}
