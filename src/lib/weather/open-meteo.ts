import {
  OpenMeteoWeatherResponseSchema,
  OpenMeteoMarineResponseSchema,
  type OpenMeteoWeatherResponse,
  type OpenMeteoMarineResponse,
  type ForecastHour,
  kmhToKnots,
} from "./types";

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
      "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code",
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
  return weather.hourly.time.map((time, i) => ({
    time,
    temperature: weather.hourly.temperature_2m[i],
    windSpeed: kmhToKnots(weather.hourly.wind_speed_10m[i]),
    windDirection: weather.hourly.wind_direction_10m[i],
    windGusts: kmhToKnots(weather.hourly.wind_gusts_10m[i]),
    weatherCode: weather.hourly.weather_code[i],
    waveHeight: marine?.hourly.wave_height[i] ?? null,
    waveDirection: marine?.hourly.wave_direction[i] ?? null,
    wavePeriod: marine?.hourly.wave_period[i] ?? null,
    swellHeight: marine?.hourly.swell_wave_height[i] ?? null,
    swellDirection: marine?.hourly.swell_wave_direction[i] ?? null,
    swellPeriod: marine?.hourly.swell_wave_period[i] ?? null,
  }));
}
