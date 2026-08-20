// Deterministic randomness helpers shared by the seed and the vision mock.
//
// The mulberry32 PRNG is what makes the seed reproducible: the same seed value
// produces the same stream everywhere, so demo and live data agree. hashString
// turns an id into a stable PRNG seed.

export type Random = () => number;

export function mulberry32(seed: number): Random {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small string hash so an id can seed a stable PRNG. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
