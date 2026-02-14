"use server";

import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";

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

  await db.update(preferences)
    .set({
      email: (formData.get("email") as string) || null,
      alertsEnabled: formData.get("alertsEnabled") === "on",
      checkIntervalHours: parseInt(
        (formData.get("checkIntervalHours") as string) || "6"
      ),
      windSpeedUnit: (formData.get("windSpeedUnit") as string) || "knots",
      temperatureUnit:
        (formData.get("temperatureUnit") as string) || "celsius",
    })
    .where(eq(preferences.id, prefs.id));

  revalidatePath("/settings");
}
