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

/** Prefer the rider's saved numbers; fall back to the spot default. */
export function resolveCriteria(
  spotId: number,
  userCriteria: CriteriaFields | null | undefined,
  spotCriteria: CriteriaFields | null | undefined,
): AlertCriteria {
  return asAlertCriteria(spotId, userCriteria ?? spotCriteria ?? null);
}
