import { getSpots } from "@/lib/actions/spots";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { getSpotWithCriteria } from "@/lib/actions/spots";
import { evaluateSpot, defaultCriteria } from "@/lib/alerts/evaluator";
import { SpotCard } from "@/components/spot-card";
import { getSession } from "@/lib/auth-session";
import type { AlertCriteria } from "@/lib/db/schema";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const isAuthenticated = !!session?.user;
  const spots = await getSpots();

  if (spots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <h1 className="text-3xl font-bold">Welcome to Wing Check</h1>
        <p className="text-muted-foreground text-lg">
          {isAuthenticated
            ? "Add your first wing foil spot to get started."
            : "Sign up to add your own spots and get alerts."}
        </p>
        <Link href={isAuthenticated ? "/spots/new" : "/sign-up"}>
          <Button size="lg">
            {isAuthenticated ? "Add Your First Spot" : "Sign Up to Add Spots"}
          </Button>
        </Link>
      </div>
    );
  }

  const spotEvaluations = await Promise.all(
    spots.map(async (spot) => {
      try {
        const [forecast, spotData] = await Promise.all([
          getSpotForecast(spot.id),
          getSpotWithCriteria(spot.id),
        ]);

        if (!forecast) return { spot, evaluation: null };

        const criteria: AlertCriteria = spotData?.criteria ?? {
          id: 0,
          spotId: spot.id,
          ...defaultCriteria,
        };

        const evaluation = evaluateSpot(forecast.hours, criteria);
        return { spot, evaluation };
      } catch {
        return { spot, evaluation: null };
      }
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {isAuthenticated && (
          <Link href="/spots/new">
            <Button>Add Spot</Button>
          </Link>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {spotEvaluations.map(({ spot, evaluation }) => (
          <SpotCard key={spot.id} spot={spot} evaluation={evaluation} />
        ))}
      </div>
    </div>
  );
}
