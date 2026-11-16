// Seeded pseudo-random number generator (Mulberry32) for deterministic simulation and AI.
// Exports: RngFn, createSeededRng, createDefaultRng. Depends on: none.

export type RngFn = () => number;

export function createSeededRng(seed: number): RngFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDefaultRng(): RngFn {
  return createSeededRng(Date.now() ^ 0x9e3779b9);
}
