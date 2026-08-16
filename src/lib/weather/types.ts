import { z } from "zod";

export const HourlyWeatherSchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number()),
  wind_speed_10m: z.array(z.number()),
  wind_direction_10m: z.array(z.number()),
  wind_gusts_10m: z.array(z.number()),
  weather_code: z.array(z.number()),
  pressure_msl: z.array(z.number()).optional(),
  precipitation: z.array(z.number()).optional(),
  cloud_cover: z.array(z.number()).optional(),
});

export const DailyWeatherSchema = z.object({
  time: z.array(z.string()),
  sunrise: z.array(z.string()),
  sunset: z.array(z.string()),
});

export const OpenMeteoWeatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  hourly: HourlyWeatherSchema,
  hourly_units: z.record(z.string(), z.string()),
  daily: DailyWeatherSchema.optional(),
  daily_units: z.record(z.string(), z.string()).optional(),
});

export const HourlyMarineSchema = z.object({
  time: z.array(z.string()),
  wave_height: z.array(z.number().nullable()),
  wave_direction: z.array(z.number().nullable()),
  wave_period: z.array(z.number().nullable()),
  swell_wave_height: z.array(z.number().nullable()),
  swell_wave_direction: z.array(z.number().nullable()),
  swell_wave_period: z.array(z.number().nullable()),
});

export const OpenMeteoMarineResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z.number().optional(),
  timezone: z.string().optional(),
  hourly: HourlyMarineSchema,
});

export type OpenMeteoWeatherResponse = z.infer<typeof OpenMeteoWeatherResponseSchema>;
export type OpenMeteoMarineResponse = z.infer<typeof OpenMeteoMarineResponseSchema>;

export interface ForecastHour {
  time: string;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  weatherCode: number;
  waveHeight: number | null;
  waveDirection: number | null;
  wavePeriod: number | null;
  swellHeight: number | null;
  swellDirection: number | null;
  swellPeriod: number | null;
  pressureMsl: number | null;
  precipitation: number | null;
  cloudCover: number | null;
}

export interface SpotForecast {
  spotId: number;
  spotName: string;
  hours: ForecastHour[];
  tides: TidePoint[];
  fetchedAt: string;
  timezone: string;
  utcOffsetSeconds: number;
  sunrise: string[];
  sunset: string[];
  tideStation?: { id: string; name: string; km: number } | null;
}

/** Extract hour (0–23) from an ISO-like time string e.g. "2026-02-14T09:00" */
export function localHour(isoTime: string): number {
  return parseInt(isoTime.substring(11, 13), 10);
}

export const NOAATidePredictionSchema = z.object({
  predictions: z.array(
    z.object({
      t: z.string(),
      v: z.string(),
      type: z.string().optional(),
    })
  ),
});

export type NOAATidePrediction = z.infer<typeof NOAATidePredictionSchema>;

export interface TidePoint {
  time: string;
  height: number;
  type?: "H" | "L";
}

export type WindDirection =
  | "N" | "NNE" | "NE" | "ENE"
  | "E" | "ESE" | "SE" | "SSE"
  | "S" | "SSW" | "SW" | "WSW"
  | "W" | "WNW" | "NW" | "NNW";

export function degreesToCardinal(degrees: number): WindDirection {
  const directions: WindDirection[] = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export function weatherCodeToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] ?? "Unknown";
}

// km/h to knots
export function kmhToKnots(kmh: number): number {
  return Math.round(kmh * 0.539957 * 10) / 10;
}
