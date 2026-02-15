"use server";

import { db } from "@/lib/db";
import { spots, alertCriteria, userSpots } from "@/lib/db/schema";
import type { Spot } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireSession } from "@/lib/auth-session";

export async function getSpots() {
  return db.select().from(spots);
}

export async function getSpot(id: number) {
  const rows = await db
    .select()
    .from(spots)
    .where(eq(spots.id, id));
  return rows[0] ?? null;
}

export async function getSpotWithCriteria(id: number) {
  const spotRows = await db
    .select()
    .from(spots)
    .where(eq(spots.id, id));
  const spot = spotRows[0];
  if (!spot) return null;
  const criteriaRows = await db
    .select()
    .from(alertCriteria)
    .where(eq(alertCriteria.spotId, id));
  return { spot, criteria: criteriaRows[0] ?? null };
}

export async function createSpot(formData: FormData) {
  const { user } = await requireSession();

  const name = formData.get("name") as string;
  const latitude = parseFloat(formData.get("latitude") as string);
  const longitude = parseFloat(formData.get("longitude") as string);
  const noaaStationId = (formData.get("noaaStationId") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  const preferredDirs = formData.get("preferredDirections") as string;
  const minWind = parseFloat(
    (formData.get("minWindSpeed") as string) || "10"
  );
  const maxWind = parseFloat(
    (formData.get("maxWindSpeed") as string) || "25"
  );
  const maxGust = parseFloat(
    (formData.get("maxGustFactor") as string) || "2.5"
  );
  const dirTolerance = parseFloat(
    (formData.get("directionTolerance") as string) || "45"
  );
  const minHours = parseInt(
    (formData.get("minConsecutiveHours") as string) || "2"
  );
  const maxWaveStr = formData.get("maxWaveHeight") as string;
  const maxWave = maxWaveStr ? parseFloat(maxWaveStr) : null;

  const insertResult = await db
    .insert(spots)
    .values({ name, latitude, longitude, noaaStationId, notes, userId: user.id })
    .returning();
  const inserted = insertResult[0];

  await db.insert(alertCriteria)
    .values({
      spotId: inserted.id,
      minWindSpeed: minWind,
      maxWindSpeed: maxWind,
      maxGustFactor: maxGust,
      preferredDirections: preferredDirs || "[]",
      directionTolerance: dirTolerance,
      minConsecutiveHours: minHours,
      maxWaveHeight: maxWave,
    });

  await db.insert(userSpots).values({
    userId: user.id,
    spotId: inserted.id,
    isFavorite: true,
    alertsEnabled: true,
  });

  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function deleteSpot(id: number) {
  const { user } = await requireSession();
  await db.delete(spots).where(and(eq(spots.id, id), eq(spots.userId, user.id)));
  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function updateSpotCriteria(spotId: number, formData: FormData) {
  const { user } = await requireSession();

  // Verify ownership
  const spotRows = await db
    .select()
    .from(spots)
    .where(and(eq(spots.id, spotId), eq(spots.userId, user.id)));
  if (spotRows.length === 0) throw new Error("Spot not found");

  const existingRows = await db
    .select()
    .from(alertCriteria)
    .where(eq(alertCriteria.spotId, spotId));
  const existing = existingRows[0];

  const values = {
    spotId,
    minWindSpeed: parseFloat(
      (formData.get("minWindSpeed") as string) || "10"
    ),
    maxWindSpeed: parseFloat(
      (formData.get("maxWindSpeed") as string) || "25"
    ),
    maxGustFactor: parseFloat(
      (formData.get("maxGustFactor") as string) || "2.5"
    ),
    preferredDirections: (formData.get("preferredDirections") as string) || "[]",
    directionTolerance: parseFloat(
      (formData.get("directionTolerance") as string) || "45"
    ),
    minConsecutiveHours: parseInt(
      (formData.get("minConsecutiveHours") as string) || "2"
    ),
    maxWaveHeight: formData.get("maxWaveHeight")
      ? parseFloat(formData.get("maxWaveHeight") as string)
      : null,
  };

  if (existing) {
    await db.update(alertCriteria)
      .set(values)
      .where(eq(alertCriteria.id, existing.id));
  } else {
    await db.insert(alertCriteria).values(values);
  }

  revalidatePath(`/spots/${spotId}`);
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

  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/");
}

export async function getUserSpotPrefs(spotId: number) {
  const session = await getSession();
  if (!session?.user) return null;
  const rows = await db
    .select()
    .from(userSpots)
    .where(and(eq(userSpots.userId, session.user.id), eq(userSpots.spotId, spotId)));
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

  revalidatePath("/");
  revalidatePath("/spots");
  revalidatePath(`/spots/${spotId}`);
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

  revalidatePath(`/spots/${spotId}`);
}

export async function getUserFavoriteSpotIds(): Promise<Set<number>> {
  const session = await getSession();
  if (!session?.user) return new Set();
  const rows = await db
    .select({ spotId: userSpots.spotId })
    .from(userSpots)
    .where(and(eq(userSpots.userId, session.user.id), eq(userSpots.isFavorite, true)));
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
