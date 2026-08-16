import { NewSpotForm } from "@/components/new-spot-form";
import { UnitsProvider } from "@/components/units-provider";
import { getDisplayUnits } from "@/lib/actions/settings";

export default async function NewSpotPage() {
  const units = await getDisplayUnits();

  return (
    <UnitsProvider units={units}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Add New Spot</h1>
        <NewSpotForm />
      </div>
    </UnitsProvider>
  );
}
