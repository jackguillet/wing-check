import { NewSpotForm } from "@/components/new-spot-form";

export default function NewSpotPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Add New Spot</h1>
      <NewSpotForm />
    </div>
  );
}
