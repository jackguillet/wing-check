import type { AlertCriteria } from "@/lib/db/schema";
import { defaultCriteria } from "@/lib/alerts/evaluator";

export type CriteriaFields = Omit<AlertCriteria, "id" | "spotId">;

export function asAlertCriteria(
  spotId: number,
  source: CriteriaFields | null | undefined,
): AlertCriteria {
  return {
    id: 0,
    spotId,
    ...(source ?? defaultCriteria),
  };
}

/**
 * Spot override → rider default kit → catalog default → app default.
 */
export function resolveCriteria(
  spotId: number,
  spotOverride: CriteriaFields | null | undefined,
  userDefault: CriteriaFields | null | undefined,
  spotCriteria: CriteriaFields | null | undefined,
): AlertCriteria {
  return asAlertCriteria(
    spotId,
    spotOverride ?? userDefault ?? spotCriteria ?? null,
  );
}

export function windProfileFromPrefs(prefs: {
  minWindSpeed: number | null;
  maxWindSpeed: number | null;
  maxGustFactor: number | null;
  preferredDirections: string | null;
  directionTolerance: number | null;
  minConsecutiveHours: number | null;
  maxWaveHeight: number | null;
}): CriteriaFields | null {
  if (prefs.minWindSpeed == null || prefs.maxWindSpeed == null) return null;
  return {
    minWindSpeed: prefs.minWindSpeed,
    maxWindSpeed: prefs.maxWindSpeed,
    maxGustFactor: prefs.maxGustFactor ?? defaultCriteria.maxGustFactor,
    preferredDirections:
      prefs.preferredDirections ?? defaultCriteria.preferredDirections,
    directionTolerance:
      prefs.directionTolerance ?? defaultCriteria.directionTolerance,
    minConsecutiveHours:
      prefs.minConsecutiveHours ?? defaultCriteria.minConsecutiveHours,
    maxWaveHeight: prefs.maxWaveHeight,
  };
}
