"use server";

import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getPreferences() {
  const prefs = db.select().from(preferences).get();
  if (!prefs) {
    // Create default preferences
    const result = db
      .insert(preferences)
      .values({
        email: null,
        alertsEnabled: false,
        checkIntervalHours: 6,
        windSpeedUnit: "knots",
        temperatureUnit: "celsius",
      })
      .returning()
      .all();
    return result[0];
  }
  return prefs;
}

export async function updatePreferences(formData: FormData) {
  const prefs = await getPreferences();

  db.update(preferences)
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
    .where(eq(preferences.id, prefs.id))
    .run();

  revalidatePath("/settings");
}
