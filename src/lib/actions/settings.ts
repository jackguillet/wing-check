"use server";

import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, requireSession } from "@/lib/auth-session";
import { updatePreferencesSchema, formDataToObject } from "@/lib/validations";
import {
  DEFAULT_UNITS,
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
