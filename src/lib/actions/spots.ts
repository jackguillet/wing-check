"use server";

import { db } from "@/lib/db";
import { spots, alertCriteria } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getSpots() {
  return db.select().from(spots).all();
}

export async function getSpot(id: number) {
  const result = db.select().from(spots).where(eq(spots.id, id)).get();
  return result ?? null;
}

export async function getSpotWithCriteria(id: number) {
  const spot = db.select().from(spots).where(eq(spots.id, id)).get();
  if (!spot) return null;
  const criteria = db
    .select()
    .from(alertCriteria)
    .where(eq(alertCriteria.spotId, id))
    .get();
  return { spot, criteria: criteria ?? null };
}

export async function createSpot(formData: FormData) {
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

  const insertResult = db
    .insert(spots)
    .values({ name, latitude, longitude, noaaStationId, notes })
    .returning()
    .all();
  const inserted = insertResult[0];

  db.insert(alertCriteria)
    .values({
      spotId: inserted.id,
      minWindSpeed: minWind,
      maxWindSpeed: maxWind,
      maxGustFactor: maxGust,
      preferredDirections: preferredDirs || "[]",
      directionTolerance: dirTolerance,
      minConsecutiveHours: minHours,
      maxWaveHeight: maxWave,
    })
    .run();

  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function deleteSpot(id: number) {
  db.delete(spots).where(eq(spots.id, id)).run();
  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function updateSpotCriteria(spotId: number, formData: FormData) {
  const existing = db
    .select()
    .from(alertCriteria)
    .where(eq(alertCriteria.spotId, spotId))
    .get();

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
    db.update(alertCriteria)
      .set(values)
      .where(eq(alertCriteria.id, existing.id))
      .run();
  } else {
    db.insert(alertCriteria).values(values).run();
  }

  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/");
}
