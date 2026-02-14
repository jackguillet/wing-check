"use server";

import { db } from "@/lib/db";
import { forecastCache, spots } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  fetchWeatherForecast,
  fetchMarineForecast,
  mergeForecasts,
} from "@/lib/weather/open-meteo";
import type { ForecastHour, SpotForecast } from "@/lib/weather/types";

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function getSpotForecast(
  spotId: number
): Promise<SpotForecast | null> {
  const spot = db.select().from(spots).where(eq(spots.id, spotId)).get();
  if (!spot) return null;

  // Check cache
  const now = new Date();
  const cached = db
    .select()
    .from(forecastCache)
    .where(
      and(eq(forecastCache.spotId, spotId), gt(forecastCache.expiresAt, now))
    )
    .get();

  if (cached) {
    const weatherData = JSON.parse(cached.weatherData);
    const marineData = cached.marineData ? JSON.parse(cached.marineData) : null;
    const hours: ForecastHour[] = mergeForecasts(weatherData, marineData);
    return {
      spotId: spot.id,
      spotName: spot.name,
      hours,
      fetchedAt: cached.fetchedAt.toISOString(),
    };
  }

  // Fetch fresh data
  const [weather, marine] = await Promise.all([
    fetchWeatherForecast(spot.latitude, spot.longitude),
    fetchMarineForecast(spot.latitude, spot.longitude),
  ]);

  const hours = mergeForecasts(weather, marine);

  // Cache the raw API responses
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + CACHE_DURATION_MS);

  // Delete old cache entries for this spot
  db.delete(forecastCache)
    .where(eq(forecastCache.spotId, spotId))
    .run();

  db.insert(forecastCache)
    .values({
      spotId,
      fetchedAt,
      expiresAt,
      weatherData: JSON.stringify(weather),
      marineData: marine ? JSON.stringify(marine) : null,
    })
    .run();

  return {
    spotId: spot.id,
    spotName: spot.name,
    hours,
    fetchedAt: fetchedAt.toISOString(),
  };
}
