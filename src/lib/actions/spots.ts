"use server";

import { db } from "@/lib/db";
import {
  spots,
  alertCriteria,
  userAlertCriteria,
  userSpots,
  preferences,
} from "@/lib/db/schema";
import type { Spot, AlertCriteria, UserAlertCriteria } from "@/lib/db/schema";
import {
  resolveCriteria,
  resolveCriteriaWithSource,
  windProfileFromPrefs,
  type CriteriaSource,
} from "@/lib/criteria";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireSession } from "@/lib/auth-session";
import { findNearestStation } from "@/lib/weather/noaa-stations";
import { generateUniqueSlug } from "@/lib/slugify";
import {
  createSpotSchema,
  updateCriteriaSchema,
  formDataToObject,
} from "@/lib/validations";
import { getDisplayUnits } from "@/lib/actions/settings";
import { formWindsToKnots } from "@/lib/units";

export type SpotFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  ok?: boolean;
};

function flattenFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

export async function getSpots() {
  return db.select().from(spots);
}

export async function getSpot(id: number) {
  const rows = await db.select().from(spots).where(eq(spots.id, id));
  return rows[0] ?? null;
}

export async function getSpotWithCriteria(id: number) {
  const spotRows = await db.select().from(spots).where(eq(spots.id, id));
  const spot = spotRows[0];
  if (!spot) return null;
  const criteriaRows = await db
    .select()
    .from(alertCriteria)
    .where(eq(alertCriteria.spotId, id));
  return { spot, criteria: criteriaRows[0] ?? null };
}

export async function getSpotBySlug(slug: string) {
  const rows = await db.select().from(spots).where(eq(spots.slug, slug));
  return rows[0] ?? null;
}

export async function getSpotWithCriteriaBySlug(slug: string) {
  const spotRows = await db.select().from(spots).where(eq(spots.slug, slug));
  const spot = spotRows[0];
  if (!spot) return null;
  const criteriaRows = await db
    .select()
    .from(alertCriteria)
    .where(eq(alertCriteria.spotId, spot.id));
  return { spot, criteria: criteriaRows[0] ?? null };
}

export async function getUserCriteriaMap(
  userId: string,
  spotIds: number[],
): Promise<Map<number, UserAlertCriteria>> {
  if (spotIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(userAlertCriteria)
    .where(
      and(
        eq(userAlertCriteria.userId, userId),
        inArray(userAlertCriteria.spotId, spotIds),
      ),
    );
  return new Map(rows.map((row) => [row.spotId, row]));
}

export async function getResolvedCriteriaMap(
  spotIds: number[],
  userId?: string | null,
): Promise<Map<number, AlertCriteria>> {
  const details = await getResolvedCriteriaDetailsMap(spotIds, userId);
  const result = new Map<number, AlertCriteria>();
  for (const [id, row] of details) {
    result.set(id, row.criteria);
  }
  return result;
}

export async function getResolvedCriteriaDetails(
  spotId: number,
  userId?: string | null,
): Promise<{ criteria: AlertCriteria; source: CriteriaSource }> {
  const map = await getResolvedCriteriaDetailsMap([spotId], userId);
  return (
    map.get(spotId) ?? {
      criteria: resolveCriteria(spotId, null, null, null),
      source: "app",
    }
  );
}

export async function getResolvedCriteriaDetailsMap(
  spotIds: number[],
  userId?: string | null,
): Promise<Map<number, { criteria: AlertCriteria; source: CriteriaSource }>> {
  const [spotMap, userMap, userDefault] = await Promise.all([
    getSpotsWithCriteria(spotIds),
    userId ? getUserCriteriaMap(userId, spotIds) : Promise.resolve(new Map()),
    userId ? getUserWindProfile(userId) : Promise.resolve(null),
  ]);

  const result = new Map<
    number,
    { criteria: AlertCriteria; source: CriteriaSource }
  >();
  for (const id of spotIds) {
    result.set(
      id,
      resolveCriteriaWithSource(
        id,
        userMap.get(id),
        userDefault,
        spotMap.get(id)?.criteria,
      ),
    );
  }
  return result;
}

export async function getUserWindProfile(userId: string) {
  const rows = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId));
  const row = rows[0];
  if (!row) return null;
  return windProfileFromPrefs(row);
}

/** Batch fetch spots with criteria — avoids N+1 for dashboard */
export async function getSpotsWithCriteria(
  spotIds: number[],
): Promise<Map<number, { spot: Spot; criteria: AlertCriteria | null }>> {
  if (spotIds.length === 0) return new Map();

  const allSpots = await db
    .select()
    .from(spots)
    .where(inArray(spots.id, spotIds));

  const allCriteria = await db
    .select()
    .from(alertCriteria)
    .where(inArray(alertCriteria.spotId, spotIds));

  const criteriaBySpot = new Map(allCriteria.map((c) => [c.spotId, c]));
  const result = new Map<
    number,
    { spot: Spot; criteria: AlertCriteria | null }
  >();

  for (const spot of allSpots) {
    result.set(spot.id, {
      spot,
      criteria: criteriaBySpot.get(spot.id) ?? null,
    });
  }

  return result;
}

export async function createSpot(
  _prev: SpotFormState,
  formData: FormData,
): Promise<SpotFormState> {
  const { user } = await requireSession();
  const units = await getDisplayUnits();

  const parsed = createSpotSchema.safeParse(
    formWindsToKnots(formDataToObject(formData), units.windSpeedUnit),
  );
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
      fieldErrors: flattenFieldErrors(parsed.error.issues),
    };
  }
  const data = parsed.data;

  let noaaStationId = data.noaaStationId || null;
  if (!noaaStationId) {
    noaaStationId = await findNearestStation(data.latitude, data.longitude);
  }

  // Generate unique slug
  const existingRows = await db.select({ slug: spots.slug }).from(spots);
  const existingSlugs = new Set(
    existingRows.map((r) => r.slug).filter(Boolean) as string[],
  );
  const slug = generateUniqueSlug(data.name, existingSlugs);

  const insertResult = await db
    .insert(spots)
    .values({
      name: data.name,
      slug,
      latitude: data.latitude,
      longitude: data.longitude,
      noaaStationId,
      notes: data.notes || null,
      userId: user.id,
    })
    .returning();
  const inserted = insertResult[0];

  await db.insert(alertCriteria).values({
    spotId: inserted.id,
    minWindSpeed: data.minWindSpeed,
    maxWindSpeed: data.maxWindSpeed,
    maxGustFactor: data.maxGustFactor,
    preferredDirections: data.preferredDirections,
    directionTolerance: data.directionTolerance,
    minConsecutiveHours: data.minConsecutiveHours,
    maxWaveHeight: data.maxWaveHeight ?? null,
  });

  await db.insert(userSpots).values({
    userId: user.id,
    spotId: inserted.id,
    isFavorite: true,
    alertsEnabled: true,
  });

  await db.insert(userAlertCriteria).values({
    userId: user.id,
    spotId: inserted.id,
    minWindSpeed: data.minWindSpeed,
    maxWindSpeed: data.maxWindSpeed,
    maxGustFactor: data.maxGustFactor,
    preferredDirections: data.preferredDirections,
    directionTolerance: data.directionTolerance,
    minConsecutiveHours: data.minConsecutiveHours,
    maxWaveHeight: data.maxWaveHeight ?? null,
  });

  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function deleteSpot(id: number) {
  const { user } = await requireSession();
  await db
    .delete(spots)
    .where(and(eq(spots.id, id), eq(spots.userId, user.id)));
  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function updateSpotCriteria(
  spotId: number,
  _prev: SpotFormState,
  formData: FormData,
): Promise<SpotFormState> {
  const { user } = await requireSession();

  const spotRows = await db.select().from(spots).where(eq(spots.id, spotId));
  if (spotRows.length === 0) {
    return { error: "Spot not found" };
  }

  const units = await getDisplayUnits();
  const parsed = updateCriteriaSchema.safeParse(
    formWindsToKnots(formDataToObject(formData), units.windSpeedUnit),
  );
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
      fieldErrors: flattenFieldErrors(parsed.error.issues),
    };
  }
  const data = parsed.data;

  const values = {
    userId: user.id,
    spotId,
    minWindSpeed: data.minWindSpeed,
    maxWindSpeed: data.maxWindSpeed,
    maxGustFactor: data.maxGustFactor,
    preferredDirections: data.preferredDirections,
    directionTolerance: data.directionTolerance,
    minConsecutiveHours: data.minConsecutiveHours,
    maxWaveHeight: data.maxWaveHeight ?? null,
  };

  const existingRows = await db
    .select()
    .from(userAlertCriteria)
    .where(
      and(
        eq(userAlertCriteria.userId, user.id),
        eq(userAlertCriteria.spotId, spotId),
      ),
    );
  const existing = existingRows[0];

  if (existing) {
    await db
      .update(userAlertCriteria)
      .set(values)
      .where(eq(userAlertCriteria.id, existing.id));
  } else {
    await db.insert(userAlertCriteria).values(values);
  }

  revalidatePath(`/spots/${spotRows[0].slug}`);
  revalidatePath("/");
  return { ok: true };
}

export async function clearSpotWindOverride(spotId: number) {
  const { user } = await requireSession();
  const spotRows = await db.select().from(spots).where(eq(spots.id, spotId));
  await db
    .delete(userAlertCriteria)
    .where(
      and(
        eq(userAlertCriteria.userId, user.id),
        eq(userAlertCriteria.spotId, spotId),
      ),
    );
  revalidatePath(`/spots/${spotRows[0]?.slug}`);
  revalidatePath("/");
}

export async function updateSpotNotes(spotId: number, notes: string) {
  const { user } = await requireSession();

  const spotRows = await db
    .select()
    .from(spots)
    .where(and(eq(spots.id, spotId), eq(spots.userId, user.id)));
  if (spotRows.length === 0) throw new Error("Spot not found");

  await db
    .update(spots)
    .set({ notes: notes.trim() || null })
    .where(eq(spots.id, spotId));

  revalidatePath(`/spots/${spotRows[0].slug}`);
  revalidatePath("/");
}

export async function getUserSpotPrefs(spotId: number) {
  const session = await getSession();
  if (!session?.user) return null;
  const rows = await db
    .select()
    .from(userSpots)
    .where(
      and(eq(userSpots.userId, session.user.id), eq(userSpots.spotId, spotId)),
    );
  return rows[0] ?? null;
}

export async function toggleFavorite(spotId: number) {
  const { user } = await requireSession();

  const existing = await db
    .select()
    .from(userSpots)
    .where(and(eq(userSpots.userId, user.id), eq(userSpots.spotId, spotId)));

  if (existing[0]) {
    await db
      .update(userSpots)
      .set({ isFavorite: !existing[0].isFavorite })
      .where(eq(userSpots.id, existing[0].id));
  } else {
    await db.insert(userSpots).values({
      userId: user.id,
      spotId,
      isFavorite: true,
      alertsEnabled: false,
    });
  }

  const spotRow = await db
    .select({ slug: spots.slug })
    .from(spots)
    .where(eq(spots.id, spotId));
  revalidatePath("/");
  revalidatePath("/spots");
  revalidatePath(`/spots/${spotRow[0]?.slug}`);
}

export async function toggleSpotAlerts(spotId: number) {
  const { user } = await requireSession();

  const existing = await db
    .select()
    .from(userSpots)
    .where(and(eq(userSpots.userId, user.id), eq(userSpots.spotId, spotId)));

  if (existing[0]) {
    await db
      .update(userSpots)
      .set({ alertsEnabled: !existing[0].alertsEnabled })
      .where(eq(userSpots.id, existing[0].id));
  } else {
    await db.insert(userSpots).values({
      userId: user.id,
      spotId,
      isFavorite: false,
      alertsEnabled: true,
    });
  }

  const spotRow = await db
    .select({ slug: spots.slug })
    .from(spots)
    .where(eq(spots.id, spotId));
  revalidatePath(`/spots/${spotRow[0]?.slug}`);
}

export async function getUserFavoriteSpotIds(): Promise<Set<number>> {
  const session = await getSession();
  if (!session?.user) return new Set();
  const rows = await db
    .select({ spotId: userSpots.spotId })
    .from(userSpots)
    .where(
      and(
        eq(userSpots.userId, session.user.id),
        eq(userSpots.isFavorite, true),
      ),
    );
  return new Set(rows.map((r) => r.spotId));
}

export async function getSpotsWithFavorites(): Promise<{
  spots: Spot[];
  favoriteIds: Set<number>;
}> {
  const [allSpots, favoriteIds] = await Promise.all([
    db.select().from(spots),
    getUserFavoriteSpotIds(),
  ]);

  // Sort favorites first
  allSpots.sort((a, b) => {
    const aFav = favoriteIds.has(a.id) ? 0 : 1;
    const bFav = favoriteIds.has(b.id) ? 0 : 1;
    return aFav - bFav;
  });

  return { spots: allSpots, favoriteIds };
}
