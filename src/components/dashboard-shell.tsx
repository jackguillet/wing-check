"use client";

import { useEffect, useMemo, useState } from "react";
import { SpotCard } from "@/components/spot-card";
import { haversineDistance } from "@/lib/geo";
import type { Spot } from "@/lib/db/schema";
import type { SpotEvaluation } from "@/lib/alerts/evaluator";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, // silently ignore denial
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }, []);

  const { searchResults, favorites, nearYou, allSpots } = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query) {
      const searchResults = spotData.filter((item) =>
        item.spot.name.toLowerCase().includes(query),
      );
      return { searchResults, favorites: [], nearYou: [], allSpots: [] };
    }

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
    let allSpots = rest;

    if (userLocation) {
      const sorted = [...rest].sort(
        (a, b) =>
          haversineDistance(userLocation.lat, userLocation.lon, a.spot.latitude, a.spot.longitude) -
          haversineDistance(userLocation.lat, userLocation.lon, b.spot.latitude, b.spot.longitude),
      );
      nearYou = sorted.slice(0, 3);
      const nearIds = new Set(nearYou.map((s) => s.spot.id));
      allSpots = sorted.filter((s) => !nearIds.has(s.spot.id));
    }

    return { searchResults: [], favorites, nearYou, allSpots };
  }, [spotData, userLocation, search]);

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search spots..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {searchResults.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Results</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {searchResults.map(({ spot, evaluation, isFavorite }) => (
              <SpotCard key={spot.id} spot={spot} evaluation={evaluation} isFavorite={isFavorite} />
            ))}
          </div>
        </section>
      )}

      {search.trim() && searchResults.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No spots found</p>
      )}

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

      {allSpots.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">All Spots</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allSpots.map(({ spot, evaluation, isFavorite }) => (
              <SpotCard key={spot.id} spot={spot} evaluation={evaluation} isFavorite={isFavorite} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
