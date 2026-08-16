"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SpotCard } from "@/components/spot-card";
import { haversineDistance } from "@/lib/geo";
import type { ClientSpot } from "@/lib/spots/visibility";
import {
  bestUpcomingWindowScore,
  type SpotEvaluation,
} from "@/lib/alerts/evaluator";
import { MapPin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardSpotData {
  spot: ClientSpot;
  evaluation: SpotEvaluation | null;
  isFavorite: boolean;
  stale?: boolean;
}

interface DashboardShellProps {
  spotData: DashboardSpotData[];
  isAuthenticated: boolean;
  hasKit: boolean;
}

export function DashboardShell({
  spotData,
  isAuthenticated,
  hasKit,
}: DashboardShellProps) {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      () => setGeoDenied(true),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const { favorites, nearYou, next72h } = useMemo(() => {
    const favorites: DashboardSpotData[] = [];
    const rest: DashboardSpotData[] = [];

    for (const item of spotData) {
      if (item.isFavorite) favorites.push(item);
      else rest.push(item);
    }

    let nearYou: { item: DashboardSpotData; km: number }[] = [];
    if (userLocation) {
      nearYou = [...spotData]
        .map((item) => ({
          item,
          km: haversineDistance(
            userLocation.lat,
            userLocation.lon,
            item.spot.latitude,
            item.spot.longitude,
          ),
        }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
    }

    const next72h = [...rest]
      .sort(
        (a, b) =>
          bestUpcomingWindowScore(b.evaluation ?? emptyEval) -
          bestUpcomingWindowScore(a.evaluation ?? emptyEval),
      )
      .slice(0, isAuthenticated ? 6 : 3);

    return { favorites, nearYou, next72h };
  }, [spotData, userLocation, isAuthenticated]);

  return (
    <div className="space-y-8">
      {isAuthenticated && !hasKit && (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm">
          Set your kit and the wings you own so a light day can still be
          GO.{" "}
          <Link href="/setup" className="underline font-medium">
            Set my kit
          </Link>
        </div>
      )}

      {!isAuthenticated && (
        <div className="rounded-md border px-4 py-3 text-sm">
          Scores below use the app default (10–25 kt, any direction).{" "}
          <Link href="/sign-up" className="underline font-medium">
            Sign up
          </Link>{" "}
          to save your kit and get alerts.
        </div>
      )}

      {favorites.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Favorites</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map((item) => (
              <SpotCard
                key={item.spot.id}
                spot={item.spot}
                evaluation={item.evaluation}
                isFavorite
                stale={item.stale}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-5 w-5" />
          Next 72 hours
        </h2>
        {next72h.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming windows in the cached forecast.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {next72h.map((item) => (
              <SpotCard
                key={item.spot.id}
                spot={item.spot}
                evaluation={item.evaluation}
                isFavorite={item.isFavorite}
                stale={item.stale}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-1.5">
          <MapPin className="h-5 w-5" />
          Near you
        </h2>
        {userLocation ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nearYou.map(({ item, km }) => (
              <SpotCard
                key={item.spot.id}
                spot={item.spot}
                evaluation={item.evaluation}
                isFavorite={item.isFavorite}
                stale={item.stale}
                distanceKm={km}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Uses your browser location only to rank nearby spots. It is not
              stored.
            </p>
            {geoDenied ? (
              <p>Location is blocked. You can still browse All spots.</p>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={requestLocation}>
                Show nearby spots
              </Button>
            )}
          </div>
        )}
      </section>

      <p className="text-sm">
        <Link href="/spots" className="underline font-medium">
          All spots
        </Link>{" "}
        — every catalog pin, including those not shown above.{" "}
        <Link href="/compare" className="underline font-medium">
          Compare spots
        </Link>{" "}
        to see two or three weeks side by side.
      </p>
    </div>
  );
}

const emptyEval: SpotEvaluation = {
  overallScore: 0,
  goNoGo: "no-go",
  hourScores: [],
  rideableWindows: [],
  bestWindow: null,
  dayEvaluations: [],
  todayDate: null,
  suggestedWindows: [],
};
