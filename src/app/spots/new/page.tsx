import { NewSpotForm } from "@/components/new-spot-form";
import { UnitsProvider } from "@/components/units-provider";
import { getDisplayUnits } from "@/lib/data/settings";
import { getUserWindProfile } from "@/lib/data/spots";
import { requireSession } from "@/lib/auth-session";

export default async function NewSpotPage() {
  const [units, { user }] = await Promise.all([
    getDisplayUnits(),
    requireSession(),
  ]);
  const defaultWind = await getUserWindProfile(user.id);

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Add New Spot</h1>
        <NewSpotForm defaultWind={defaultWind} />
      </div>
    </UnitsProvider>
  );
}
