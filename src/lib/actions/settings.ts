"use server";

import { db } from "@/lib/db";
import { kitPresets, preferences } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth-session";
import { auth } from "@/lib/auth";
import {
  updatePreferencesSchema,
  updateCriteriaSchema,
  formDataToObject,
  kitPresetNameSchema,
  MAX_KIT_PRESETS,
} from "@/lib/validations";
import { formWindsToKnots } from "@/lib/units";
import { getDisplayUnits, getPreferences } from "@/lib/data/settings";
import { limitMutation } from "@/lib/rate-limit";
import { kitsMatch, windProfileFromPrefs, type KitWindFields } from "@/lib/criteria";

function revalidateKitSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/setup");
  revalidatePath("/", "layout");
}

function kitFieldsFromProfile(profile: KitWindFields): KitWindFields {
  return {
    minWindSpeed: profile.minWindSpeed,
    maxWindSpeed: profile.maxWindSpeed,
    maxGustFactor: profile.maxGustFactor,
    preferredDirections: profile.preferredDirections,
    directionTolerance: profile.directionTolerance,
    minConsecutiveHours: profile.minConsecutiveHours,
    maxWaveHeight: profile.maxWaveHeight,
  };
}

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
  const hour = (key: string) => {
    const raw = formData.get(key);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 23) return null;
    return n;
  };
  const skillRaw = String(formData.get("skill") ?? "");
  const skill =
    skillRaw === "beginner" ||
    skillRaw === "intermediate" ||
    skillRaw === "advanced"
      ? skillRaw
      : null;
  const tideRaw = String(formData.get("preferredTide") ?? "");
  const preferredTide =
    tideRaw === "rising" || tideRaw === "falling" || tideRaw === "mid"
      ? tideRaw
      : null;

  const nextKit: KitWindFields = {
    minWindSpeed: data.minWindSpeed,
    maxWindSpeed: data.maxWindSpeed,
    maxGustFactor: data.maxGustFactor,
    preferredDirections: data.preferredDirections,
    directionTolerance: data.directionTolerance,
    minConsecutiveHours: data.minConsecutiveHours,
    maxWaveHeight: data.maxWaveHeight ?? null,
  };
  const activeName = prefs.activeKitName?.trim() || null;
  let keepName = activeName;
  if (activeName) {
    const [preset] = await db
      .select()
      .from(kitPresets)
      .where(
        and(eq(kitPresets.userId, user.id), eq(kitPresets.name, activeName)),
      );
    if (!preset || !kitsMatch(nextKit, kitFieldsFromProfile(preset))) {
      keepName = null;
    }
  }

  await db
    .update(preferences)
    .set({
      ...nextKit,
      skill,
      sessionStartHour: hour("sessionStartHour"),
      sessionEndHour: hour("sessionEndHour"),
      preferredTide,
      activeKitName: keepName,
    })
    .where(eq(preferences.userId, user.id));

  revalidateKitSurfaces();

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
      skill: null,
      sessionStartHour: null,
      sessionEndHour: null,
      preferredTide: null,
      activeKitName: null,
    })
    .where(eq(preferences.userId, prefs.userId));

  revalidateKitSurfaces();
}

export async function saveKitPreset(formData: FormData) {
  const { user } = await requireSession();
  await limitMutation(user.id, "save-kit-preset", 30, "1 h");
  const prefs = await getPreferences();
  const profile = windProfileFromPrefs(prefs);
  if (!profile) {
    throw new Error("Save a default kit before naming it");
  }
  const parsed = kitPresetNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) {
    throw new Error(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  const name = parsed.data;
  const fields = kitFieldsFromProfile(profile);
  const [existing] = await db
    .select({ id: kitPresets.id })
    .from(kitPresets)
    .where(and(eq(kitPresets.userId, user.id), eq(kitPresets.name, name)));
  if (!existing) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(kitPresets)
      .where(eq(kitPresets.userId, user.id));
    if (Number(n) >= MAX_KIT_PRESETS) {
      throw new Error(`You can save at most ${MAX_KIT_PRESETS} kit presets`);
    }
  }

  await db
    .insert(kitPresets)
    .values({ userId: user.id, name, ...fields })
    .onConflictDoUpdate({
      target: [kitPresets.userId, kitPresets.name],
      set: fields,
    });

  await db
    .update(preferences)
    .set({ activeKitName: name })
    .where(eq(preferences.userId, user.id));

  revalidateKitSurfaces();
}

export async function activateKitPreset(formData: FormData) {
  const { user } = await requireSession();
  await limitMutation(user.id, "activate-kit-preset", 30, "1 h");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Missing kit preset");
  }
  const [preset] = await db
    .select()
    .from(kitPresets)
    .where(and(eq(kitPresets.id, id), eq(kitPresets.userId, user.id)));
  if (!preset) {
    throw new Error("Kit preset not found");
  }

  await db
    .update(preferences)
    .set({
      ...kitFieldsFromProfile(preset),
      activeKitName: preset.name,
    })
    .where(eq(preferences.userId, user.id));

  revalidateKitSurfaces();
}

export async function deleteKitPreset(formData: FormData) {
  const { user } = await requireSession();
  await limitMutation(user.id, "delete-kit-preset", 30, "1 h");
  const prefs = await getPreferences();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Missing kit preset");
  }
  const [preset] = await db
    .select()
    .from(kitPresets)
    .where(and(eq(kitPresets.id, id), eq(kitPresets.userId, user.id)));
  if (!preset) {
    throw new Error("Kit preset not found");
  }

  await db
    .delete(kitPresets)
    .where(and(eq(kitPresets.id, id), eq(kitPresets.userId, user.id)));

  if (prefs.activeKitName === preset.name) {
    await db
      .update(preferences)
      .set({ activeKitName: null })
      .where(eq(preferences.userId, user.id));
  }

  revalidateKitSurfaces();
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
