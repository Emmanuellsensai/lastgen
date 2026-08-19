import type { MeterReading } from '../types/api.js';

// Deterministic meter simulator.
//
// Reproduces the frontend reference curve (frontend/src/mocks/seed.ts) so demo
// and live data agree reading-for-reading: a solar day collapsed to six
// readings at fixed hours, a capacity-scaled generation curve, randomised
// cloud cover and a battery SOC that swings within safe bounds.
//
// Randomness is injectable. The default is a mulberry32 PRNG seeded from the
// asset id, so repeated calls for the same asset return identical data.

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

/** Small string hash so an asset id can seed a stable PRNG. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const SLOTS = [6, 9, 12, 15, 18, 21];
const CURVE = [0.18, 0.72, 1.0, 0.81, 0.24, 0.0];
const DAY_MS = 86_400_000;

export interface SimulateReadingsInput {
  assetId: string;
  capacityKw: number;
  days: number;
  now?: Date;
  rand?: Random;
}

/** A full solar-day history for an asset, six readings per day. */
export function simulateReadings(input: SimulateReadingsInput): MeterReading[] {
  const rand = input.rand ?? mulberry32(hashString(input.assetId));
  const now = input.now ?? new Date();
  const readings: MeterReading[] = [];
  let n = 0;

  for (let d = input.days; d > 0; d -= 1) {
    const cloud = between(rand, 0.72, 1.0);
    let soc = between(rand, 38, 62);
    for (let s = 0; s < SLOTS.length; s += 1) {
      const ts = daysAgo(now, d);
      ts.setUTCHours(SLOTS[s], 0, 0, 0);
      const whGenerated = Math.round(input.capacityKw * 1000 * CURVE[s] * cloud * 3);
      const whConsumed = Math.round(input.capacityKw * 1000 * between(rand, 0.28, 0.62) * 3);
      soc = Math.max(14, Math.min(100, soc + (whGenerated - whConsumed) / (input.capacityKw * 260)));

      readings.push({
        id: `mr_${input.assetId}_${pad(n, 4)}`,
        assetId: input.assetId,
        ts: ts.toISOString(),
        whGenerated,
        whConsumed,
        batterySocPct: Math.round(soc),
      });
      n += 1;
    }
  }

  return readings.sort((a, b) => a.ts.localeCompare(b.ts));
}

export interface TickInput {
  assetId: string;
  capacityKw: number;
  ts: Date;
  rand?: Random;
}

/** A single forward reading for the nearest sample slot. */
export function tick(input: TickInput): MeterReading {
  const rand = input.rand ?? mulberry32(hashString(`${input.assetId}-${input.ts.getTime()}`));
  const hour = input.ts.getUTCHours();
  const slot = SLOTS[0] + Math.round((hour - SLOTS[0]) / 3) * 3;
  const curve = CURVE[Math.max(0, Math.min(SLOTS.length - 1, Math.round((hour - 6) / 3)))];
  const cloud = between(rand, 0.72, 1.0);
  const whGenerated = Math.round(input.capacityKw * 1000 * curve * cloud * 3);
  const whConsumed = Math.round(input.capacityKw * 1000 * between(rand, 0.28, 0.62) * 3);

  const ts = new Date(input.ts);
  ts.setUTCHours(slot, 0, 0, 0);

  return {
    id: `mr_${input.assetId}_tick`,
    assetId: input.assetId,
    ts: ts.toISOString(),
    whGenerated,
    whConsumed,
    batterySocPct: Math.round(between(rand, 38, 62)),
  };
}

function between(rand: Random, min: number, max: number): number {
  return min + rand() * (max - min);
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from.getTime() - days * DAY_MS);
  return d;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}