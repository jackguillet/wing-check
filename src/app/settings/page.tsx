import { headers } from "next/headers";
import { getKitPresets, getPreferences, getWings } from "@/lib/data/settings";
import { QuiverCard } from "@/components/quiver-card";
import { getUserAlertHistory } from "@/lib/data/spots";
import { AlertHistoryList } from "@/components/alert-history-list";
import { requireSession } from "@/lib/auth-session";
import { auth } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";
import { WindProfileForm } from "@/components/wind-profile-form";
import { KitPresetsCard } from "@/components/kit-presets-card";
import { ChangePasswordForm } from "@/components/change-password-form";
import { SessionList, type SessionRow } from "@/components/session-list";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { UnitsProvider } from "@/components/units-provider";
import { windProfileFromPrefs } from "@/lib/criteria";
import { parseDisplayUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const headerStore = await headers();
  const [{ user, session }, prefs, listed, alerts, presets, userWings] =
    await Promise.all([
      requireSession(),
      getPreferences(),
      auth.api.listSessions({ headers: headerStore }),
      getUserAlertHistory(20),
      getKitPresets(),
      getWings(),
    ]);
  const units = parseDisplayUnits(prefs.windSpeedUnit, prefs.temperatureUnit);
  const profile = windProfileFromPrefs(prefs);
  const sessions: SessionRow[] = (listed ?? []).map((s) => ({
    token: s.token,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    current: s.token === session.token,
  }));

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <SettingsForm
          prefs={prefs}
          accountEmail={user.email}
          emailVerified={user.emailVerified}
        />
        <WindProfileForm
          profile={profile}
          skill={prefs.skill}
          sessionStartHour={prefs.sessionStartHour}
          sessionEndHour={prefs.sessionEndHour}
          preferredTide={prefs.preferredTide}
          activeKitName={prefs.activeKitName}
        />
        <QuiverCard
          wings={userWings}
          riderWeightKg={prefs.riderWeightKg}
        />
        <KitPresetsCard
          presets={presets}
          activeKitName={prefs.activeKitName}
          hasProfile={!!profile}
        />
        <ChangePasswordForm />
        <AlertHistoryList items={alerts} />
        <SessionList sessions={sessions} />
        <DeleteAccountForm email={user.email} />
      </div>
    </UnitsProvider>
  );
}
