import { getSpotsWithFavorites } from "@/lib/actions/spots";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { getSpotWithCriteria } from "@/lib/actions/spots";
import { evaluateSpot, defaultCriteria } from "@/lib/alerts/evaluator";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/lib/auth-session";
import type { AlertCriteria } from "@/lib/db/schema";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const isAuthenticated = !!session?.user;
  const { spots, favoriteIds } = await getSpotsWithFavorites();

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

  const spotData = await Promise.all(
    spots.map(async (spot) => {
      try {
        const [forecast, spotWithCriteria] = await Promise.all([
          getSpotForecast(spot.id),
          getSpotWithCriteria(spot.id),
        ]);

        if (!forecast) return { spot, evaluation: null, isFavorite: favoriteIds.has(spot.id) };

        const criteria: AlertCriteria = spotWithCriteria?.criteria ?? {
          id: 0,
          spotId: spot.id,
          ...defaultCriteria,
        };

        const evaluation = evaluateSpot(forecast.hours, criteria, forecast.sunrise, forecast.sunset);
        return { spot, evaluation, isFavorite: favoriteIds.has(spot.id) };
      } catch {
        return { spot, evaluation: null, isFavorite: favoriteIds.has(spot.id) };
      }
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      <DashboardShell spotData={spotData} />
    </div>
  );
}
