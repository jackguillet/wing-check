import { NewSpotForm } from "@/components/new-spot-form";
import { UnitsProvider } from "@/components/units-provider";
import { getDisplayUnits } from "@/lib/actions/settings";
import { getUserWindProfile } from "@/lib/actions/spots";
import { getSession } from "@/lib/auth-session";

export default async function NewSpotPage() {
  const [units, session] = await Promise.all([
    getDisplayUnits(),
    getSession(),
  ]);
  const defaultWind = session?.user
    ? await getUserWindProfile(session.user.id)
    : null;

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Add New Spot</h1>
        <NewSpotForm defaultWind={defaultWind} />
      </div>
    </UnitsProvider>
  );
}
