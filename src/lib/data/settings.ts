import { db } from "@/lib/db";
import { kitPresets, preferences } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { getSession, requireSession } from "@/lib/auth-session";
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
    await db
      .insert(preferences)
      .values({
        userId: user.id,
        email: user.email,
        alertsEnabled: false,
        checkIntervalHours: 6,
        windSpeedUnit: "knots",
        temperatureUnit: "celsius",
      })
      .onConflictDoNothing({ target: preferences.userId });
    const created = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, user.id));
    return created[0];
  }
  return rows[0];
}

export async function getKitPresets() {
  const { user } = await requireSession();
  return db
    .select()
    .from(kitPresets)
    .where(eq(kitPresets.userId, user.id))
    .orderBy(asc(kitPresets.name));
}
