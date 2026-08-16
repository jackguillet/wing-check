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

export type CriteriaSource =
  | "spot-override"
  | "user-default"
  | "catalog"
  | "app";

export function criteriaSource(
  spotOverride: CriteriaFields | null | undefined,
  userDefault: CriteriaFields | null | undefined,
  spotCriteria: CriteriaFields | null | undefined,
): CriteriaSource {
  if (spotOverride) return "spot-override";
  if (userDefault) return "user-default";
  if (spotCriteria) return "catalog";
  return "app";
}

export function criteriaSourceLabel(source: CriteriaSource): string {
  switch (source) {
    case "spot-override":
      return "Using a custom window for this spot";
    case "user-default":
      return "Using your default kit from Settings";
    case "catalog":
      return "Using this spot's catalog default";
    case "app":
      return "Using the app default window";
  }
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

export function resolveCriteriaWithSource(
  spotId: number,
  spotOverride: CriteriaFields | null | undefined,
  userDefault: CriteriaFields | null | undefined,
  spotCriteria: CriteriaFields | null | undefined,
): { criteria: AlertCriteria; source: CriteriaSource } {
  return {
    criteria: resolveCriteria(
      spotId,
      spotOverride,
      userDefault,
      spotCriteria,
    ),
    source: criteriaSource(spotOverride, userDefault, spotCriteria),
  };
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
