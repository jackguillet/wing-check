"use client";

import { useEffect, useMemo, useState } from "react";
import { SpotCard } from "@/components/spot-card";
import { haversineDistance } from "@/lib/geo";
import type { Spot } from "@/lib/db/schema";
import type { SpotEvaluation } from "@/lib/alerts/evaluator";
import { MapPin, TrendingUp } from "lucide-react";

interface SpotData {
  spot: Spot;
  evaluation: SpotEvaluation | null;
  isFavorite: boolean;
}

interface DashboardShellProps {
  spotData: SpotData[];
}

export function DashboardShell({ spotData }: DashboardShellProps) {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, // silently ignore denial
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }, []);

  const { favorites, nearYou, bestForecast } = useMemo(() => {
    const favorites: SpotData[] = [];
    const rest: SpotData[] = [];

    for (const item of spotData) {
      if (item.isFavorite) {
        favorites.push(item);
      } else {
        rest.push(item);
      }
    }

    let nearYou: SpotData[] = [];
    let remaining = rest;

    if (userLocation) {
      const sorted = [...rest].sort(
        (a, b) =>
          haversineDistance(userLocation.lat, userLocation.lon, a.spot.latitude, a.spot.longitude) -
          haversineDistance(userLocation.lat, userLocation.lon, b.spot.latitude, b.spot.longitude),
      );
      nearYou = sorted.slice(0, 3);
      const nearIds = new Set(nearYou.map((s) => s.spot.id));
      remaining = sorted.filter((s) => !nearIds.has(s.spot.id));
    }

    const bestForecast = [...remaining]
      .sort((a, b) => (b.evaluation?.overallScore ?? 0) - (a.evaluation?.overallScore ?? 0))
      .slice(0, 3);

    return { favorites, nearYou, bestForecast };
  }, [spotData, userLocation]);

  return (
    <div className="space-y-8">
      {favorites.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Favorites</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map(({ spot, evaluation, isFavorite }) => (
              <SpotCard key={spot.id} spot={spot} evaluation={evaluation} isFavorite={isFavorite} />
            ))}
          </div>
        </section>
      )}

      {nearYou.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-1.5">
            <MapPin className="h-5 w-5" />
            Near You
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nearYou.map(({ spot, evaluation, isFavorite }) => (
              <SpotCard key={spot.id} spot={spot} evaluation={evaluation} isFavorite={isFavorite} />
            ))}
          </div>
        </section>
      )}

      {bestForecast.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-5 w-5" />
            Best Forecast
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bestForecast.map(({ spot, evaluation, isFavorite }) => (
              <SpotCard key={spot.id} spot={spot} evaluation={evaluation} isFavorite={isFavorite} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
