import { describe, it, expect } from "vitest";
import { forecastHourAt } from "../match-hour";
import type { ForecastHour } from "../types";

function hour(time: string): ForecastHour {
  return {
    time,
    temperature: 20,
    windSpeed: 16,
    windDirection: 90,
    windGusts: 20,
    weatherCode: 1,
    waveHeight: null,
    waveDirection: null,
    wavePeriod: null,
    swellHeight: null,
    swellDirection: null,
    swellPeriod: null,
    pressureMsl: 1013,
    precipitation: 0,
    cloudCover: 20,
    visibility: 20000,
  };
}

describe("forecastHourAt", () => {
  const hours = [hour("2026-08-16T15:00"), hour("2026-08-16T16:00")];

  it("matches the floor hour of an observation clock", () => {
    expect(forecastHourAt(hours, "2026-08-16T16:47")?.time).toBe(
      "2026-08-16T16:00",
    );
  });

  it("returns null when that hour is not in the series", () => {
    expect(forecastHourAt(hours, "2026-08-16T14:10")).toBeNull();
  });
});
