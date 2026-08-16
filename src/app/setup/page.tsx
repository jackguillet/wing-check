import { requireSession } from "@/lib/auth-session";
import { getPreferences, getDisplayUnits } from "@/lib/data/settings";
import { windProfileFromPrefs } from "@/lib/criteria";
import { UnitsProvider } from "@/components/units-provider";
import { WindProfileForm } from "@/components/wind-profile-form";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [{ user }, prefs, units] = await Promise.all([
    requireSession(),
    getPreferences(),
    getDisplayUnits(),
  ]);
  const profile = windProfileFromPrefs(prefs);

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Set your kit</h1>
          <p className="text-muted-foreground mt-2">
            Two minutes: units and the wind you ride. Every spot will score
            against this unless you override it.
          </p>
        </div>
        <SettingsForm
          prefs={prefs}
          accountEmail={user.email}
          emailVerified={user.emailVerified}
        />
        <WindProfileForm profile={profile} next="/" />
      </div>
    </UnitsProvider>
  );
}
