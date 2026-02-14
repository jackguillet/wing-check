"use server";

import { db } from "@/lib/db";
import { spots, alertCriteria } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";

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
    (formData.get("minWindSpeed") as string) || "15"
  );
  const maxWind = parseFloat(
    (formData.get("maxWindSpeed") as string) || "25"
  );
  const maxGust = parseFloat(
    (formData.get("maxGustFactor") as string) || "1.5"
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
      (formData.get("minWindSpeed") as string) || "15"
    ),
    maxWindSpeed: parseFloat(
      (formData.get("maxWindSpeed") as string) || "25"
    ),
    maxGustFactor: parseFloat(
      (formData.get("maxGustFactor") as string) || "1.5"
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
