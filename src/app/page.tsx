import {
  getSpotsWithFavorites,
  getResolvedCriteriaMap,
} from "@/lib/data/spots";
import {
  getSpotForecast,
  getCachedForecastsBySpotIds,
} from "@/lib/data/forecasts";
import { evaluateSpot, defaultCriteria } from "@/lib/alerts/evaluator";
import { spotLocalNow } from "@/lib/weather/civil-time";
import { DashboardShell } from "@/components/dashboard-shell";
import { UnitsProvider } from "@/components/units-provider";
import { getDisplayUnits } from "@/lib/data/settings";
import { getUserWindProfile } from "@/lib/data/spots";
import { getPreferences } from "@/lib/data/settings";
import { riderScheduleFromPrefs } from "@/lib/criteria";
import { getSession } from "@/lib/auth-session";
import type { AlertCriteria } from "@/lib/db/schema";
import type { SpotForecast } from "@/lib/weather/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [session, { spots, favoriteIds }, units] = await Promise.all([
    getSession(),
    getSpotsWithFavorites(),
    getDisplayUnits(),
  ]);
  const isAuthenticated = !!session?.user;

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

  const spotIds = spots.map((s) => s.id);
  const [criteriaMap, cachedForecasts] = await Promise.all([
    getResolvedCriteriaMap(spotIds, session?.user?.id),
    getCachedForecastsBySpotIds(spotIds),
  ]);

  const favoriteIdsNeedingFetch = session
    ? spots
        .filter((spot) => favoriteIds.has(spot.id))
        .filter((spot) => {
          const cached = cachedForecasts.get(spot.id);
          return !cached || cached.stale;
        })
        .map((spot) => spot.id)
    : [];

  const liveFavorites = await Promise.all(
    favoriteIdsNeedingFetch.map(async (id) => {
      try {
        return [id, await getSpotForecast(id)] as const;
      } catch {
        return [id, cachedForecasts.get(id) ?? null] as const;
      }
    }),
  );
  const liveById = new Map(liveFavorites);

  const [kit, riderPrefs] = session?.user
    ? await Promise.all([
        getUserWindProfile(session.user.id),
        getPreferences(),
      ])
    : [null, null];
  const rider = riderPrefs ? riderScheduleFromPrefs(riderPrefs) : null;

  const spotData = spots.map((spot) => {
    const isFavorite = favoriteIds.has(spot.id);
    let forecast: (SpotForecast & { stale?: boolean }) | null | undefined =
      liveById.has(spot.id)
        ? liveById.get(spot.id)
        : cachedForecasts.get(spot.id);

    if (!forecast) {
      return { spot, evaluation: null, isFavorite, stale: false };
    }

    const criteria: AlertCriteria = criteriaMap.get(spot.id) ?? {
      id: 0,
      spotId: spot.id,
      ...defaultCriteria,
    };

    try {
      const evaluation = evaluateSpot(
        forecast.hours,
        criteria,
        forecast.sunrise,
        forecast.sunset,
        spotLocalNow(forecast.utcOffsetSeconds),
        rider,
        forecast.tides,
      );
      return { spot, evaluation, isFavorite, stale: !!forecast.stale };
    } catch {
      return { spot, evaluation: null, isFavorite, stale: false };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      <UnitsProvider units={units}>
        <DashboardShell
          spotData={spotData}
          isAuthenticated={isAuthenticated}
          hasKit={!!kit}
        />
      </UnitsProvider>
    </div>
  );
}
