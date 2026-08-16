import { requireSession } from "@/lib/auth-session";
import { getPreferences, getDisplayUnits, getWings } from "@/lib/data/settings";
import { QuiverCard } from "@/components/quiver-card";
import { windProfileFromPrefs } from "@/lib/criteria";
import { UnitsProvider } from "@/components/units-provider";
import { WindProfileForm } from "@/components/wind-profile-form";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [{ user }, prefs, units, userWings] = await Promise.all([
    requireSession(),
    getPreferences(),
    getDisplayUnits(),
    getWings(),
  ]);
  const profile = windProfileFromPrefs(prefs);

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Set your kit</h1>
          <p className="text-muted-foreground mt-2">
            Two minutes: units, the wind you ride, and the wings you own.
            A light day can still be GO if you have a large wing.
          </p>
        </div>
        <SettingsForm
          prefs={prefs}
          accountEmail={user.email}
          emailVerified={user.emailVerified}
        />
        <WindProfileForm
          profile={profile}
          next="/"
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
      </div>
    </UnitsProvider>
  );
}
