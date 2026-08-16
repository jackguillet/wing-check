import { describe, it, expect } from "vitest";
import { mergeForecasts } from "../open-meteo";
import type {
  OpenMeteoWeatherResponse,
  OpenMeteoMarineResponse,
} from "../types";

function weatherTimes(times: string[]): OpenMeteoWeatherResponse {
  const n = times.length;
  const zeros = Array.from({ length: n }, () => 0);
  const winds = Array.from({ length: n }, () => 20);
  return {
    latitude: 20.9,
    longitude: -156.4,
    utc_offset_seconds: -36000,
    timezone: "Pacific/Honolulu",
    hourly: {
      time: times,
      temperature_2m: zeros,
      wind_speed_10m: winds,
      wind_direction_10m: zeros,
      wind_gusts_10m: winds,
      weather_code: zeros,
      pressure_msl: zeros,
    },
    hourly_units: { time: "iso8601" },
  };
}

function marineAt(
  times: string[],
  swellByTime: Record<string, number>,
): OpenMeteoMarineResponse {
  return {
    latitude: 20.9,
    longitude: -156.4,
    timezone: "Pacific/Honolulu",
    utc_offset_seconds: -36000,
    hourly: {
      time: times,
      wave_height: times.map((t) => swellByTime[t] ?? null),
      wave_direction: times.map(() => 90),
      wave_period: times.map(() => 8),
      swell_wave_height: times.map((t) => swellByTime[t] ?? null),
      swell_wave_direction: times.map(() => 90),
      swell_wave_period: times.map(() => 12),
    },
  };
}

describe("mergeForecasts", () => {
  it("joins marine hours by timestamp, not array index", () => {
    const weather = weatherTimes([
      "2026-08-16T00:00",
      "2026-08-16T01:00",
      "2026-08-16T15:00",
    ]);
    // GMT-indexed marine: index 0 is 10:00 UTC = 00:00 HST the previous
    // scheme. After timezone=auto both sides share local labels.
    const marine = marineAt(
      [
        "2026-08-16T00:00",
        "2026-08-16T01:00",
        "2026-08-16T15:00",
        "2026-08-16T16:00",
      ],
      {
        "2026-08-16T00:00": 0.4,
        "2026-08-16T01:00": 0.5,
        "2026-08-16T15:00": 1.8,
        "2026-08-16T16:00": 1.9,
      },
    );

    const hours = mergeForecasts(weather, marine);
    expect(hours).toHaveLength(3);
    expect(hours[0].swellHeight).toBe(0.4);
    expect(hours[1].swellHeight).toBe(0.5);
    expect(hours[2].time).toBe("2026-08-16T15:00");
    expect(hours[2].swellHeight).toBe(1.8);
    expect(hours[2].waveHeight).toBe(1.8);
  });

  it("does not pair local midnight with a GMT marine row at the same index", () => {
    const weather = weatherTimes(["2026-08-16T00:00", "2026-08-16T15:00"]);
    // Old bug: marine defaulted to GMT, so index 0 was 00:00 UTC swell
    // sitting on 00:00 HST wind. Join by time must leave 00:00 HST unmatched.
    const marine = marineAt(["2026-08-16T10:00", "2026-08-16T15:00"], {
      "2026-08-16T10:00": 9.9,
      "2026-08-16T15:00": 1.2,
    });

    const hours = mergeForecasts(weather, marine);
    expect(hours[0].swellHeight).toBeNull();
    expect(hours[0].waveHeight).toBeNull();
    expect(hours[1].swellHeight).toBe(1.2);
  });

  it("returns null waves when marine is missing", () => {
    const weather = weatherTimes(["2026-08-16T12:00"]);
    const hours = mergeForecasts(weather, null);
    expect(hours).toHaveLength(1);
    expect(hours[0].waveHeight).toBeNull();
    expect(hours[0].swellHeight).toBeNull();
    expect(hours[0].windSpeed).toBeGreaterThan(0);
  });
});
