"use server";

import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import {
  updatePreferencesSchema,
  updateCriteriaSchema,
  formDataToObject,
} from "@/lib/validations";
import { formWindsToKnots } from "@/lib/units";
import { getDisplayUnits, getPreferences } from "@/lib/data/settings";
import { limitMutation } from "@/lib/rate-limit";

export async function updatePreferences(formData: FormData) {
  const { user } = await requireSession();
  await limitMutation(user.id, "update-preferences", 30, "1 h");
  const prefs = await getPreferences();

  const parsed = updatePreferencesSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    throw new Error(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  const data = parsed.data;

  const alertsEnabled = data.alertsEnabled === "on";
  if (alertsEnabled && !user.emailVerified) {
    throw new Error("Verify your email before enabling alerts");
  }

  await db
    .update(preferences)
    .set({
      email: user.email,
      alertsEnabled,
      windSpeedUnit: data.windSpeedUnit,
      temperatureUnit: data.temperatureUnit,
    })
    .where(eq(preferences.id, prefs.id));

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function updateWindProfile(formData: FormData) {
  const { user } = await requireSession();
  await limitMutation(user.id, "update-wind-profile", 30, "1 h");
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

  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }
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
