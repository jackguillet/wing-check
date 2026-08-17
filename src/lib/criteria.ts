import type { AlertCriteria } from "@/lib/db/schema";
import { defaultCriteria } from "@/lib/alerts/evaluator";

export type CriteriaFields = Omit<AlertCriteria, "id" | "spotId">;

export const SKILL_KITS = {
  beginner: { minWindSpeed: 14, maxWindSpeed: 22 },
  intermediate: { minWindSpeed: 10, maxWindSpeed: 25 },
  advanced: { minWindSpeed: 8, maxWindSpeed: 30 },
} as const;

export type RiderSkill = keyof typeof SKILL_KITS;

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

export function criteriaKitLabel(
  source: CriteriaSource,
  criteria: Pick<AlertCriteria, "minWindSpeed" | "maxWindSpeed">,
  activeKitName?: string | null,
  quiverSizes?: number[] | null,
): string {
  const band = `${Math.round(criteria.minWindSpeed)}–${Math.round(criteria.maxWindSpeed)} kt`;
  const quiver =
    source !== "spot-override" && quiverSizes && quiverSizes.length > 0
      ? [...quiverSizes]
          .sort((a, b) => b - a)
          .map((s) => (s % 1 === 0 ? String(s) : s.toFixed(1)))
          .join(" / ") + "m"
      : null;
  switch (source) {
    case "spot-override":
      return `Custom window · ${band}`;
    case "user-default": {
      const name = activeKitName?.trim();
      if (quiver) {
        return name ? `${name} · ${quiver}` : `Your quiver · ${quiver}`;
      }
      return name ? `${name} · ${band}` : `Your default kit · ${band}`;
    }
    case "catalog":
      return quiver ? `Your quiver · ${quiver}` : `Catalog default · ${band}`;
    case "app":
      return quiver ? `Your quiver · ${quiver}` : `App default · ${band}`;
  }
}

export type KitWindFields = Pick<
  CriteriaFields,
  | "minWindSpeed"
  | "maxWindSpeed"
  | "maxGustFactor"
  | "minConsecutiveHours"
  | "maxWaveHeight"
>;

export function kitsMatch(a: KitWindFields, b: KitWindFields): boolean {
  return (
    a.minWindSpeed === b.minWindSpeed &&
    a.maxWindSpeed === b.maxWindSpeed &&
    a.maxGustFactor === b.maxGustFactor &&
    a.minConsecutiveHours === b.minConsecutiveHours &&
    a.maxWaveHeight === b.maxWaveHeight
  );
}

function withPlaceDirections(
  rider: CriteriaFields,
  place: CriteriaFields,
): CriteriaFields {
  return {
    ...rider,
    preferredDirections: place.preferredDirections,
    directionTolerance: place.directionTolerance,
  };
}

/**
 * Rider wind (min/max, gusts, hours, waves): override → user kit → catalog → app.
 * Directions belong to the location: override → catalog → app. Never the user kit.
 */
export function resolveCriteria(
  spotId: number,
  spotOverride: CriteriaFields | null | undefined,
  userDefault: CriteriaFields | null | undefined,
  spotCriteria: CriteriaFields | null | undefined,
): AlertCriteria {
  const rider = spotOverride ?? userDefault ?? spotCriteria ?? defaultCriteria;
  const place = spotOverride ?? spotCriteria ?? defaultCriteria;
  return asAlertCriteria(spotId, withPlaceDirections(rider, place));
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

export function riderScheduleFromPrefs(prefs: {
  sessionStartHour: number | null;
  sessionEndHour: number | null;
  preferredTide: string | null;
}): import("@/lib/alerts/evaluator").RiderSchedule {
  const tide =
    prefs.preferredTide === "rising" ||
    prefs.preferredTide === "falling" ||
    prefs.preferredTide === "mid"
      ? prefs.preferredTide
      : null;
  return {
    sessionStartHour: prefs.sessionStartHour,
    sessionEndHour: prefs.sessionEndHour,
    preferredTide: tide,
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
    preferredDirections: defaultCriteria.preferredDirections,
    directionTolerance: defaultCriteria.directionTolerance,
    minConsecutiveHours:
      prefs.minConsecutiveHours ?? defaultCriteria.minConsecutiveHours,
    maxWaveHeight: prefs.maxWaveHeight,
  };
}
