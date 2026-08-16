"use server";

import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, requireSession } from "@/lib/auth-session";
import {
  updatePreferencesSchema,
  updateCriteriaSchema,
  formDataToObject,
} from "@/lib/validations";
import {
  DEFAULT_UNITS,
  formWindsToKnots,
  parseDisplayUnits,
  type DisplayUnits,
} from "@/lib/units";

export async function getDisplayUnits(): Promise<DisplayUnits> {
  const session = await getSession();
  if (!session?.user) return DEFAULT_UNITS;

  const rows = await db
    .select({
      windSpeedUnit: preferences.windSpeedUnit,
      temperatureUnit: preferences.temperatureUnit,
    })
    .from(preferences)
    .where(eq(preferences.userId, session.user.id));

  const row = rows[0];
  if (!row) return DEFAULT_UNITS;
  return parseDisplayUnits(row.windSpeedUnit, row.temperatureUnit);
}

export async function getPreferences() {
  const { user } = await requireSession();

  const rows = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, user.id));

  if (rows.length === 0) {
    const result = await db
      .insert(preferences)
      .values({
        userId: user.id,
        email: user.email,
        alertsEnabled: false,
        checkIntervalHours: 6,
        windSpeedUnit: "knots",
        temperatureUnit: "celsius",
      })
      .returning();
    return result[0];
  }
  return rows[0];
}

export async function updatePreferences(formData: FormData) {
  const { user } = await requireSession();
  const prefs = await getPreferences();

  const parsed = updatePreferencesSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    throw new Error(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  const data = parsed.data;

  await db
    .update(preferences)
    .set({
      email: data.email || null,
      alertsEnabled: data.alertsEnabled === "on",
      checkIntervalHours: data.checkIntervalHours,
      windSpeedUnit: data.windSpeedUnit,
      temperatureUnit: data.temperatureUnit,
    })
    .where(eq(preferences.id, prefs.id));

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function updateWindProfile(formData: FormData) {
  const { user } = await requireSession();
  const prefs = await getPreferences();
  const units = await getDisplayUnits();

  const parsed = updateCriteriaSchema.safeParse(
    formWindsToKnots(formDataToObject(formData), units.windSpeedUnit),
  );
  if (!parsed.success) {
    throw new Error(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  const data = parsed.data;

  await db
    .update(preferences)
    .set({
      minWindSpeed: data.minWindSpeed,
      maxWindSpeed: data.maxWindSpeed,
      maxGustFactor: data.maxGustFactor,
      preferredDirections: data.preferredDirections,
      directionTolerance: data.directionTolerance,
      minConsecutiveHours: data.minConsecutiveHours,
      maxWaveHeight: data.maxWaveHeight ?? null,
    })
    .where(eq(preferences.id, prefs.id));

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function clearWindProfile() {
  const prefs = await getPreferences();
  await db
    .update(preferences)
    .set({
      minWindSpeed: null,
      maxWindSpeed: null,
      maxGustFactor: null,
      preferredDirections: null,
      directionTolerance: null,
      minConsecutiveHours: null,
      maxWaveHeight: null,
    })
    .where(eq(preferences.id, prefs.id));

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
