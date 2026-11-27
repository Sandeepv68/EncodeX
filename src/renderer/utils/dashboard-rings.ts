/**
 * @fileoverview Deterministic concentric-ring backgrounds for dashboard cards.
 *
 * Each route seeds a small PRNG so a card always renders the same decorative
 * rings while different routes get different placements. Results are cached by
 * route because the grid rerenders on every edit-mode interaction.
 */

import type { RingGroup } from '../pages/types';

/** Hashes a string into a 32-bit seed for the deterministic PRNG. */
function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Mulberry32 PRNG yielding floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the ring clusters for one route key. */
function buildCardRings(key: string): RingGroup[] {
  const rand = mulberry32(hashSeed(key));
  const groupCount = 2 + Math.floor(rand() * 3);
  const groups: RingGroup[] = [];
  for (let i = 0; i < groupCount; i += 1) {
    const cx = 20 + Math.round(rand() * 160);
    const cy = 20 + Math.round(rand() * 160);
    const ringCount = 3 + Math.floor(rand() * 3);
    const base = 10 + rand() * 12;
    const step = 9 + rand() * 6;
    const radii: number[] = [];
    for (let r = 0; r < ringCount; r += 1) {
      radii.push(Math.round(base + r * step));
    }
    groups.push({ id: i, cx, cy, radii });
  }
  return groups;
}

/** Ring clusters cached by route. */
const ringCache = new Map<string, RingGroup[]>();

/** Returns the cached ring clusters for a route. */
export function cardRings(key: string): RingGroup[] {
  const cached = ringCache.get(key);
  if (cached) return cached;
  const rings = buildCardRings(key);
  ringCache.set(key, rings);
  return rings;
}
