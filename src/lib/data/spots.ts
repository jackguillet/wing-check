import { db } from "@/lib/db";
import {
  spots,
  alertCriteria,
  userAlertCriteria,
  userSpots,
  preferences,
  alertHistory,
} from "@/lib/db/schema";
import type { Spot, AlertCriteria, UserAlertCriteria } from "@/lib/db/schema";
import {
  resolveCriteria,
  resolveCriteriaWithSource,
  windProfileFromPrefs,
  type CriteriaSource,
} from "@/lib/criteria";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth-session";
import {
  toClientSpot,
  visibleSpotsFilter,
  type ClientSpot,
} from "@/lib/spots/visibility";

export async function getSpots() {
  return db.select().from(spots);
}

export async function getSpot(id: number) {
  const rows = await db.select().from(spots).where(eq(spots.id, id));
  return rows[0] ?? null;
}

export async function getVisibleSpot(id: number, viewerId?: string | null) {
  const rows = await db
    .select()
    .from(spots)
    .where(and(eq(spots.id, id), visibleSpotsFilter(viewerId)));
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

export async function getVisibleSpotBySlug(
  slug: string,
  viewerId?: string | null,
) {
  const rows = await db
    .select()
    .from(spots)
    .where(and(eq(spots.slug, slug), visibleSpotsFilter(viewerId)));
  return rows[0] ?? null;
}

export async function getSpotWithCriteriaBySlug(
  slug: string,
  viewerId?: string | null,
) {
  const spot = await getVisibleSpotBySlug(slug, viewerId);
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

export async function getLatestSpotAlert(spotId: number) {
  const session = await getSession();
  if (!session?.user) return null;
  const rows = await db
    .select()
    .from(alertHistory)
    .where(
      and(
        eq(alertHistory.spotId, spotId),
        eq(alertHistory.userId, session.user.id),
      ),
    )
    .orderBy(desc(alertHistory.sentAt))
    .limit(1);
  return rows[0] ?? null;
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
  spots: ClientSpot[];
  favoriteIds: Set<number>;
}> {
  const session = await getSession();
  const [visible, favoriteIds] = await Promise.all([
    db
      .select()
      .from(spots)
      .where(visibleSpotsFilter(session?.user?.id)),
    getUserFavoriteSpotIds(),
  ]);

  visible.sort((a, b) => {
    const aFav = favoriteIds.has(a.id) ? 0 : 1;
    const bFav = favoriteIds.has(b.id) ? 0 : 1;
    return aFav - bFav;
  });

  return { spots: visible.map(toClientSpot), favoriteIds };
}
