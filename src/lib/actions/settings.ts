"use server";

import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth-session";
import { auth } from "@/lib/auth";
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
    .where(eq(preferences.userId, user.id));

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
    .where(eq(preferences.userId, user.id));

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
    .where(eq(preferences.userId, prefs.userId));

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function revokeUserSession(formData: FormData) {
  const { session } = await requireSession();
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Missing session token");
  }
  if (token === session.token) {
    throw new Error("Use Sign Out for this device");
  }
  await auth.api.revokeSession({
    body: { token },
    headers: await headers(),
  });
  revalidatePath("/settings");
}

export async function revokeOtherUserSessions() {
  await requireSession();
  await auth.api.revokeOtherSessions({
    headers: await headers(),
  });
  revalidatePath("/settings");
}

export async function deleteAccount(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const { user } = await requireSession();
  await limitMutation(user.id, "delete-account", 5, "1 h");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (email !== user.email.toLowerCase()) {
    return { error: "Type your account email to confirm deletion" };
  }
  if (password.length < 8) {
    return { error: "Password is required" };
  }
  try {
    await auth.api.deleteUser({
      body: { password },
      headers: await headers(),
    });
  } catch {
    return { error: "Could not delete account. Check your password." };
  }
  redirect("/");
}
