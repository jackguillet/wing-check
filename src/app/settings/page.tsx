import { getPreferences } from "@/lib/actions/settings";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getPreferences();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <SettingsForm prefs={prefs} />
    </div>
  );
}
