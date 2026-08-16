import {
  OpenMeteoWeatherResponseSchema,
  OpenMeteoMarineResponseSchema,
  type OpenMeteoWeatherResponse,
  type OpenMeteoMarineResponse,
  type ForecastHour,
  kmhToKnots,
} from "./types";
import { civilMinute } from "./civil-time";
import { logger } from "@/lib/logger";

const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
const MARINE_BASE = "https://marine-api.open-meteo.com/v1/marine";

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number
): Promise<OpenMeteoWeatherResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly:
      "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,pressure_msl,precipitation,cloud_cover",
    daily: "sunrise,sunset",
    wind_speed_unit: "kmh",
    timezone: "auto",
    forecast_days: "14",
  });

  const res = await fetch(`${WEATHER_BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo weather API error: ${res.status}`);
  }
  const data = await res.json();
  return OpenMeteoWeatherResponseSchema.parse(data);
}

export async function fetchMarineForecast(
  latitude: number,
  longitude: number
): Promise<OpenMeteoMarineResponse | null> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly:
      "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period",
    timezone: "auto",
    forecast_days: "14",
  });

  try {
    const res = await fetch(`${MARINE_BASE}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return OpenMeteoMarineResponseSchema.parse(data);
  } catch {
    return null;
  }
}

export function mergeForecasts(
  weather: OpenMeteoWeatherResponse,
  marine: OpenMeteoMarineResponse | null
): ForecastHour[] {
  const marineIndex = new Map<string, number>();
  if (marine) {
    for (let i = 0; i < marine.hourly.time.length; i++) {
      marineIndex.set(civilMinute(marine.hourly.time[i]), i);
    }
  }

  let unmatched = 0;
  const hours = weather.hourly.time.map((time, i) => {
    const mi = marine ? marineIndex.get(civilMinute(time)) : undefined;
    if (marine && mi === undefined) unmatched += 1;
    const m = marine?.hourly;
    return {
      time,
      temperature: weather.hourly.temperature_2m[i],
      windSpeed: kmhToKnots(weather.hourly.wind_speed_10m[i]),
      windDirection: weather.hourly.wind_direction_10m[i],
      windGusts: kmhToKnots(weather.hourly.wind_gusts_10m[i]),
      weatherCode: weather.hourly.weather_code[i],
      waveHeight: mi != null ? (m?.wave_height[mi] ?? null) : null,
      waveDirection: mi != null ? (m?.wave_direction[mi] ?? null) : null,
      wavePeriod: mi != null ? (m?.wave_period[mi] ?? null) : null,
      swellHeight: mi != null ? (m?.swell_wave_height[mi] ?? null) : null,
      swellDirection: mi != null ? (m?.swell_wave_direction[mi] ?? null) : null,
      swellPeriod: mi != null ? (m?.swell_wave_period[mi] ?? null) : null,
      pressureMsl: weather.hourly.pressure_msl?.[i] ?? null,
      precipitation: weather.hourly.precipitation?.[i] ?? null,
      cloudCover: weather.hourly.cloud_cover?.[i] ?? null,
    };
  });

  if (
    !process.env.VITEST &&
    marine &&
    hours.length > 0 &&
    unmatched / hours.length > 0.2
  ) {
    logger.warn(
      {
        unmatched,
        total: hours.length,
        missRate: Math.round((unmatched / hours.length) * 100) / 100,
      },
      "Marine hours failed to join weather by timestamp",
    );
  }

  return hours;
}
