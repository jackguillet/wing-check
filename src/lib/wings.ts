import type { AlertCriteria } from "@/lib/db/schema";
import type { CriteriaSource } from "@/lib/criteria";

/** Assumed rider weight when none is saved. ~176 lb. */
export const DEFAULT_RIDER_WEIGHT_KG = 80;

/** sweet-spot × this = min rideable wind for that wing. */
export const WING_BAND_MIN_FACTOR = 0.75;

/** sweet-spot × this = max rideable wind for that wing. */
export const WING_BAND_MAX_FACTOR = 1.4;

export const MIN_WING_SIZE_M2 = 2.5;
export const MAX_WING_SIZE_M2 = 8;
export const MAX_WINGS = 8;

export const COMMON_WING_SIZES = [
  7, 6.5, 6, 5.5, 5, 4.5, 4.2, 4, 3.5, 3,
] as const;

export interface WingBand {
  sizeM2: number;
  minWindSpeed: number;
  maxWindSpeed: number;
}

/** Mid-band wind (kt) for this rider + wing. 80 kg on a 5m → 16 kt. */
export function sweetSpotKt(
  sizeM2: number,
  weightKg: number = DEFAULT_RIDER_WEIGHT_KG,
): number {
  if (sizeM2 <= 0) return 0;
  return weightKg / sizeM2;
}

function roundHalfKt(n: number): number {
  return Math.round(n * 2) / 2;
}

export function bandForWing(
  sizeM2: number,
  weightKg: number | null | undefined = DEFAULT_RIDER_WEIGHT_KG,
): WingBand {
  const weight =
    weightKg != null && weightKg > 0 ? weightKg : DEFAULT_RIDER_WEIGHT_KG;
  const sweet = sweetSpotKt(sizeM2, weight);
  return {
    sizeM2,
    minWindSpeed: roundHalfKt(sweet * WING_BAND_MIN_FACTOR),
    maxWindSpeed: roundHalfKt(sweet * WING_BAND_MAX_FACTOR),
  };
}

export function resolveQuiver(
  sizes: number[],
  weightKg: number | null | undefined,
): WingBand[] {
  return [...sizes]
    .sort((a, b) => b - a)
    .map((size) => bandForWing(size, weightKg));
}

export function quiverEnvelope(
  quiver: WingBand[],
): { minWindSpeed: number; maxWindSpeed: number } | null {
  if (quiver.length === 0) return null;
  return {
    minWindSpeed: Math.min(...quiver.map((w) => w.minWindSpeed)),
    maxWindSpeed: Math.max(...quiver.map((w) => w.maxWindSpeed)),
  };
}

/** Spot override stays a single band. Everywhere else, a quiver replaces min/max. */
export function quiverForScoring(
  source: CriteriaSource,
  quiver: WingBand[],
): WingBand[] | null {
  if (source === "spot-override" || quiver.length === 0) return null;
  return quiver;
}

export function quiverPair(
  source: CriteriaSource,
  sizes: number[],
  weightKg: number | null | undefined,
): { quiver: WingBand[] | null; missing: WingBand[] | null } {
  const owned = resolveQuiver(sizes, weightKg);
  const quiver = quiverForScoring(source, owned);
  if (!quiver) return { quiver: null, missing: null };
  return { quiver, missing: missingQuiver(sizes, weightKg) };
}

export function criteriaWithQuiverEnvelope(
  criteria: AlertCriteria,
  quiver: WingBand[] | null | undefined,
): AlertCriteria {
  if (!quiver || quiver.length === 0) return criteria;
  const env = quiverEnvelope(quiver);
  if (!env) return criteria;
  return {
    ...criteria,
    minWindSpeed: env.minWindSpeed,
    maxWindSpeed: env.maxWindSpeed,
  };
}

export function formatWingSize(sizeM2: number): string {
  const label = sizeM2 % 1 === 0 ? String(sizeM2) : sizeM2.toFixed(1);
  return `${label}m`;
}

export function formatQuiverLabel(sizes: number[]): string {
  if (sizes.length === 0) return "";
  const sorted = [...sizes].sort((a, b) => b - a);
  const parts = sorted.map((s) => (s % 1 === 0 ? String(s) : s.toFixed(1)));
  return `${parts.join(" / ")}m`;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.2046226218;
}

export function kgToLbs(kg: number): number {
  return kg * 2.2046226218;
}

const OWNED_SIZE_EPSILON = 0.25;

export function ownsNearby(ownedSizes: number[], sizeM2: number): boolean {
  return ownedSizes.some((owned) => Math.abs(owned - sizeM2) < OWNED_SIZE_EPSILON);
}

/** Common sizes the rider does not already own, with bands for their weight. */
export function missingQuiver(
  ownedSizes: number[],
  weightKg: number | null | undefined,
): WingBand[] {
  return COMMON_WING_SIZES.filter((size) => !ownsNearby(ownedSizes, size)).map(
    (size) => bandForWing(size, weightKg),
  );
}

/** Snap weight/wind to the nearest common wing size. */
export function idealWingSize(
  windKt: number,
  weightKg: number | null | undefined = DEFAULT_RIDER_WEIGHT_KG,
): number | null {
  if (windKt <= 0) return null;
  const weight =
    weightKg != null && weightKg > 0 ? weightKg : DEFAULT_RIDER_WEIGHT_KG;
  const raw = weight / windKt;
  let best: number = COMMON_WING_SIZES[0];
  let bestDist = Math.abs(best - raw);
  for (const size of COMMON_WING_SIZES) {
    const dist = Math.abs(size - raw);
    if (dist < bestDist) {
      best = size;
      bestDist = dist;
    }
  }
  return best;
}

/** Missing wings that could cover this wind, biased larger when light. */
export function relevantMissingWings(
  windKt: number,
  owned: WingBand[],
  missing: WingBand[],
): WingBand[] {
  if (owned.length === 0) return missing;
  const envMin = Math.min(...owned.map((w) => w.minWindSpeed));
  const envMax = Math.max(...owned.map((w) => w.maxWindSpeed));
  if (windKt < envMin) {
    const biggest = Math.max(...owned.map((w) => w.sizeM2));
    return missing.filter((w) => w.sizeM2 > biggest);
  }
  if (windKt > envMax) {
    const smallest = Math.min(...owned.map((w) => w.sizeM2));
    return missing.filter((w) => w.sizeM2 < smallest);
  }
  return missing;
}

export function formatWouldBeGo(sizeM2: number): string {
  return `Would be GO on a ${formatWingSize(sizeM2)}`;
}

/** Most common recommended wing in a window; ties go to the larger size. */
export function dominantWing(sizes: Array<number | null | undefined>): number | null {
  const counts = new Map<number, number>();
  for (const size of sizes) {
    if (size == null) continue;
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: number | null = null;
  let bestN = -1;
  for (const [size, n] of counts) {
    if (n > bestN || (n === bestN && (best == null || size > best))) {
      best = size;
      bestN = n;
    }
  }
  return best;
}
