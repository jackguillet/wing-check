import { getPreferences } from "@/lib/actions/settings";
import { SettingsForm } from "@/components/settings-form";
import { WindProfileForm } from "@/components/wind-profile-form";
import { UnitsProvider } from "@/components/units-provider";
import { windProfileFromPrefs } from "@/lib/criteria";
import { parseDisplayUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getPreferences();
  const units = parseDisplayUnits(prefs.windSpeedUnit, prefs.temperatureUnit);
  const profile = windProfileFromPrefs(prefs);

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <SettingsForm prefs={prefs} />
        <WindProfileForm profile={profile} />
      </div>
    </UnitsProvider>
  );
}
