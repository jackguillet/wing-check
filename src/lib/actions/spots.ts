"use server";

import { db } from "@/lib/db";
import {
  spots,
  alertCriteria,
  userAlertCriteria,
  userSpots,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { findNearestStation } from "@/lib/weather/noaa-stations";
import { generateUniqueSlug } from "@/lib/slugify";
import {
  createSpotSchema,
  updateCriteriaSchema,
  spotNotesSchema,
  formDataToObject,
} from "@/lib/validations";
import { getDisplayUnits } from "@/lib/data/settings";
import { formWindsToKnots } from "@/lib/units";
import { limitMutation } from "@/lib/rate-limit";

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

export async function createSpot(
  _prev: SpotFormState,
  formData: FormData,
): Promise<SpotFormState> {
  const { user } = await requireSession();
  const limited = await limitMutation(user.id, "create-spot", 20, "1 h");
  if (!limited.ok) {
    return { error: "Too many spots created. Try again later." };
  }
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
      visibility: formData.get("visibility") === "public" ? "public" : "private",
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
  revalidatePath(`/spots/${slug}`);
  redirect(`/spots/${slug}`);
}

export async function deleteSpot(id: number) {
  const { user } = await requireSession();
  const rows = await db.select().from(spots).where(eq(spots.id, id));
  const spot = rows[0];
  if (!spot || spot.userId !== user.id) {
    throw new Error("Spot not found");
  }
  if (spot.visibility === "public") {
    throw new Error("Unpublish this catalog spot before deleting it");
  }
  await db
    .delete(spots)
    .where(and(eq(spots.id, id), eq(spots.userId, user.id)));
  revalidatePath("/");
  revalidatePath("/spots");
  redirect("/spots");
}

export async function updateSpotVisibility(spotId: number, formData: FormData) {
  const { user } = await requireSession();
  const next = formData.get("visibility") === "public" ? "public" : "private";
  const rows = await db.select().from(spots).where(eq(spots.id, spotId));
  const spot = rows[0];
  if (!spot || spot.userId !== user.id) {
    throw new Error("Spot not found");
  }
  await db
    .update(spots)
    .set({ visibility: next })
    .where(and(eq(spots.id, spotId), eq(spots.userId, user.id)));
  revalidatePath("/");
  revalidatePath("/spots");
  if (spot.slug) revalidatePath(`/spots/${spot.slug}`);
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
  const parsed = spotNotesSchema.safeParse(notes);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((i) => i.message).join(", ") || "Notes too long",
    );
  }

  const spotRows = await db
    .select()
    .from(spots)
    .where(and(eq(spots.id, spotId), eq(spots.userId, user.id)));
  if (spotRows.length === 0) throw new Error("Spot not found");

  await db
    .update(spots)
    .set({ notes: parsed.data.trim() || null })
    .where(eq(spots.id, spotId));

  revalidatePath(`/spots/${spotRows[0].slug}`);
  revalidatePath("/");
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

  const enabling = existing[0] ? !existing[0].alertsEnabled : true;
  if (enabling && !user.emailVerified) {
    throw new Error("Verify your email before enabling alerts");
  }

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
  revalidatePath("/");
}
