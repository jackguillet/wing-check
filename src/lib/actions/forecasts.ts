"use server";

import { db } from "@/lib/db";
import { forecastCache, spots } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  fetchWeatherForecast,
  fetchMarineForecast,
  mergeForecasts,
} from "@/lib/weather/open-meteo";
import { fetchTidePredictions } from "@/lib/weather/noaa-tides";
import { OpenMeteoWeatherResponseSchema } from "@/lib/weather/types";
import type { ForecastHour, SpotForecast, TidePoint } from "@/lib/weather/types";

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function getSpotForecast(
  spotId: number
): Promise<SpotForecast | null> {
  const spotRows = await db
    .select()
    .from(spots)
    .where(eq(spots.id, spotId));
  const spot = spotRows[0];
  if (!spot) return null;

  // Check cache
  const now = new Date();
  const cachedRows = await db
    .select()
    .from(forecastCache)
    .where(
      and(eq(forecastCache.spotId, spotId), gt(forecastCache.expiresAt, now))
    );
  const cached = cachedRows[0];

  if (cached) {
    const weatherData = OpenMeteoWeatherResponseSchema.parse(JSON.parse(cached.weatherData));
    const marineData = cached.marineData ? JSON.parse(cached.marineData) : null;
    const hours: ForecastHour[] = mergeForecasts(weatherData, marineData);
    const tides: TidePoint[] = cached.tideData ? JSON.parse(cached.tideData) : [];
    return {
      spotId: spot.id,
      spotName: spot.name,
      hours,
      tides,
      fetchedAt: cached.fetchedAt.toISOString(),
      timezone: weatherData.timezone,
      utcOffsetSeconds: weatherData.utc_offset_seconds,
      sunrise: weatherData.daily?.sunrise ?? [],
      sunset: weatherData.daily?.sunset ?? [],
    };
  }

  // Fetch fresh data
  const fetches: [
    Promise<Awaited<ReturnType<typeof fetchWeatherForecast>>>,
    Promise<Awaited<ReturnType<typeof fetchMarineForecast>>>,
    Promise<TidePoint[]>,
  ] = [
    fetchWeatherForecast(spot.latitude, spot.longitude),
    fetchMarineForecast(spot.latitude, spot.longitude),
    (async () => {
      if (!spot.noaaStationId) return [];
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      const fmt = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      return fetchTidePredictions(spot.noaaStationId, fmt(today), fmt(end));
    })(),
  ];

  const [weather, marine, tides] = await Promise.all(fetches);

  const hours = mergeForecasts(weather, marine);

  // Cache the raw API responses
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + CACHE_DURATION_MS);

  // Delete old cache entries for this spot
  await db.delete(forecastCache)
    .where(eq(forecastCache.spotId, spotId));

  await db.insert(forecastCache)
    .values({
      spotId,
      fetchedAt,
      expiresAt,
      weatherData: JSON.stringify(weather),
      marineData: marine ? JSON.stringify(marine) : null,
      tideData: tides.length > 0 ? JSON.stringify(tides) : null,
    });

  return {
    spotId: spot.id,
    spotName: spot.name,
    hours,
    tides,
    fetchedAt: fetchedAt.toISOString(),
    timezone: weather.timezone,
    utcOffsetSeconds: weather.utc_offset_seconds,
    sunrise: weather.daily?.sunrise ?? [],
    sunset: weather.daily?.sunset ?? [],
  };
}
