import { db } from "@/lib/db";
import { forecastCache, spots } from "@/lib/db/schema";
import { eq, and, gt, inArray } from "drizzle-orm";
import {
  fetchWeatherForecast,
  fetchMarineForecast,
  mergeForecasts,
} from "@/lib/weather/open-meteo";
import { fetchTidePredictions } from "@/lib/weather/noaa-tides";
import {
  HONEST_TIDE_MAX_KM,
  getTideStationInfo,
} from "@/lib/weather/noaa-stations";
import { OpenMeteoWeatherResponseSchema } from "@/lib/weather/types";
import type {
  ForecastHour,
  SpotForecast,
  TidePoint,
} from "@/lib/weather/types";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { addCivilDays, civilDate, spotLocalNow, toYyyymmdd } from "@/lib/weather/civil-time";

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function honestTides(
  tides: TidePoint[],
  station: SpotForecast["tideStation"],
): { tides: TidePoint[]; tideStation: SpotForecast["tideStation"] } {
  if (!station || Number.isNaN(station.km) || station.km > HONEST_TIDE_MAX_KM) {
    return { tides: [], tideStation: station ?? null };
  }
  return { tides, tideStation: station };
}

async function resolveTideStation(
  spot: { noaaStationId: string | null; latitude: number; longitude: number },
): Promise<SpotForecast["tideStation"]> {
  if (!spot.noaaStationId) return null;
  return getTideStationInfo(spot.noaaStationId, spot.latitude, spot.longitude);
}

function buildForecastFromCache(
  spot: { id: number; name: string; noaaStationId?: string | null; latitude?: number; longitude?: number },
  cached: {
    weatherData: string;
    marineData: string | null;
    tideData: string | null;
    fetchedAt: Date;
  },
  stale = false,
  tideStation: SpotForecast["tideStation"] = null,
): SpotForecast & { stale?: boolean } {
  const weatherData = OpenMeteoWeatherResponseSchema.parse(
    JSON.parse(cached.weatherData),
  );
  const marineData = cached.marineData ? JSON.parse(cached.marineData) : null;
  const hours: ForecastHour[] = mergeForecasts(weatherData, marineData);
  const rawTides: TidePoint[] = cached.tideData ? JSON.parse(cached.tideData) : [];
  const { tides, tideStation: shown } = honestTides(rawTides, tideStation);
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
    tideStation: shown,
    ...(stale ? { stale: true } : {}),
  };
}

export async function getSpotForecast(
  spotId: number,
  options: { allowLive?: boolean } = {},
): Promise<(SpotForecast & { stale?: boolean }) | null> {
  const allowLive = options.allowLive !== false;
  const spotRows = await db.select().from(spots).where(eq(spots.id, spotId));
  const spot = spotRows[0];
  if (!spot) return null;

  // Check fresh cache
  const now = new Date();
  const cachedRows = await db
    .select()
    .from(forecastCache)
    .where(
      and(eq(forecastCache.spotId, spotId), gt(forecastCache.expiresAt, now)),
    );
  const cached = cachedRows[0];

  if (cached) {
    const station = await resolveTideStation(spot);
    return buildForecastFromCache(spot, cached, false, station);
  }

  if (!allowLive) {
    const staleRows = await db
      .select()
      .from(forecastCache)
      .where(eq(forecastCache.spotId, spotId));
    const stale = staleRows[0];
    if (!stale) return null;
    const station = await resolveTideStation(spot);
    return buildForecastFromCache(spot, stale, true, station);
  }

  // Fetch fresh data
  try {
    const [weather, marine] = await Promise.all([
      fetchWeatherForecast(spot.latitude, spot.longitude),
      fetchMarineForecast(spot.latitude, spot.longitude),
    ]);

    const tideStation = await resolveTideStation(spot);
    let tides: TidePoint[] = [];
    if (tideStation && tideStation.km <= HONEST_TIDE_MAX_KM) {
      const localToday = civilDate(
        spotLocalNow(weather.utc_offset_seconds),
      );
      tides = await fetchTidePredictions(
        tideStation.id,
        toYyyymmdd(localToday),
        toYyyymmdd(addCivilDays(localToday, 14)),
      );
    }

    const hours = mergeForecasts(weather, marine);

    // Cache the raw API responses
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + CACHE_DURATION_MS);

    // Delete old cache entries for this spot
    await db.delete(forecastCache).where(eq(forecastCache.spotId, spotId));

    await db.insert(forecastCache).values({
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
      tideStation,
    };
  } catch (error) {
    logger.error(
      { err: error, spotId },
      "Fresh forecast fetch failed, checking stale cache",
    );
    Sentry.captureException(error);

    // Stale-while-error: fall back to expired cache if available
    const staleRows = await db
      .select()
      .from(forecastCache)
      .where(eq(forecastCache.spotId, spotId));
    const stale = staleRows[0];

    if (stale) {
      logger.info({ spotId }, "Serving stale forecast from cache");
      const station = await resolveTideStation(spot);
      return buildForecastFromCache(spot, stale, true, station);
    }

    throw error;
  }
}

export type CachedSpotForecast = SpotForecast & { stale?: boolean };

/**
 * Batch-read cached forecasts. Does not hit weather APIs.
 * Expired rows are returned with `stale: true` so the dashboard can
 * rank spots without a thundering herd of live fetches.
 */
export async function getCachedForecastsBySpotIds(
  spotIds: number[],
): Promise<Map<number, CachedSpotForecast>> {
  const result = new Map<number, CachedSpotForecast>();
  if (spotIds.length === 0) return result;

  const [spotRows, cacheRows] = await Promise.all([
    db.select().from(spots).where(inArray(spots.id, spotIds)),
    db
      .select()
      .from(forecastCache)
      .where(inArray(forecastCache.spotId, spotIds)),
  ]);

  const spotsById = new Map(spotRows.map((s) => [s.id, s]));
  const now = Date.now();

  // Latest row per spot wins if duplicates exist
  const latestBySpot = new Map<(typeof cacheRows)[number]["spotId"], (typeof cacheRows)[number]>();
  for (const row of cacheRows) {
    const existing = latestBySpot.get(row.spotId);
    if (!existing || row.fetchedAt > existing.fetchedAt) {
      latestBySpot.set(row.spotId, row);
    }
  }

  await Promise.all(
    [...latestBySpot.entries()].map(async ([spotId, cached]) => {
      const spot = spotsById.get(spotId);
      if (!spot) return;
      try {
        const stale = cached.expiresAt.getTime() <= now;
        const station = await resolveTideStation(spot);
        result.set(spotId, buildForecastFromCache(spot, cached, stale, station));
      } catch (error) {
        logger.warn({ err: error, spotId }, "Skipping unreadable forecast cache row");
      }
    }),
  );

  return result;
}
