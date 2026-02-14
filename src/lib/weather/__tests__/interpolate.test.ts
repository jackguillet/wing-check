import { describe, it, expect } from "vitest";
import { interpolateForecasts } from "../interpolate";
import type { ForecastHour } from "../types";

function makeHour(overrides: Partial<ForecastHour> = {}): ForecastHour {
  return {
    time: "2026-02-14T12:00",
    temperature: 18,
    windSpeed: 20,
    windDirection: 270,
    windGusts: 25,
    weatherCode: 1,
    waveHeight: 1.0,
    waveDirection: 270,
    wavePeriod: 8,
    swellHeight: 0.8,
    swellDirection: 270,
    swellPeriod: 10,
    ...overrides,
  };
}

describe("interpolateForecasts", () => {
  it("returns empty array for empty input", () => {
    expect(interpolateForecasts([], 30)).toEqual([]);
  });

  it("returns single point unchanged for single-hour input", () => {
    const hours = [makeHour({ time: "2026-02-14T12:00", windSpeed: 15, windDirection: 90, windGusts: 20 })];
    const result = interpolateForecasts(hours, 30);

    expect(result).toHaveLength(1);
    expect(result[0].windSpeed).toBe(15);
    expect(result[0].windDirection).toBe(90);
    expect(result[0].windGusts).toBe(20);
  });

  it("produces 3 points from 2 hourly points at 30-min intervals", () => {
    const hours = [
      makeHour({ time: "2026-02-14T12:00", windSpeed: 10 }),
      makeHour({ time: "2026-02-14T13:00", windSpeed: 20 }),
    ];
    const result = interpolateForecasts(hours, 30);

    expect(result).toHaveLength(3);
  });

  it("linearly interpolates windSpeed at midpoint", () => {
    const hours = [
      makeHour({ time: "2026-02-14T12:00", windSpeed: 10, windGusts: 14 }),
      makeHour({ time: "2026-02-14T13:00", windSpeed: 20, windGusts: 28 }),
    ];
    const result = interpolateForecasts(hours, 30);

    expect(result[1].windSpeed).toBeCloseTo(15, 5);
    expect(result[1].windGusts).toBeCloseTo(21, 5);
  });

  it("interpolates direction across 0°/360° boundary: 350° → 10°", () => {
    const hours = [
      makeHour({ time: "2026-02-14T12:00", windDirection: 350 }),
      makeHour({ time: "2026-02-14T13:00", windDirection: 10 }),
    ];
    const result = interpolateForecasts(hours, 30);

    // Midpoint should be ~0° (or 360°), NOT 180°
    expect(result[1].windDirection).toBeCloseTo(0, 0);
  });

  it("interpolates direction across 0°/360° boundary: 10° → 350°", () => {
    const hours = [
      makeHour({ time: "2026-02-14T12:00", windDirection: 10 }),
      makeHour({ time: "2026-02-14T13:00", windDirection: 350 }),
    ];
    const result = interpolateForecasts(hours, 30);

    // Midpoint should be ~0° (or 360°), NOT 180°
    const mid = result[1].windDirection;
    expect(mid < 5 || mid > 355).toBe(true);
  });

  it("produces 49 points from 25 hourly points at 30-min intervals", () => {
    const hours = Array.from({ length: 25 }, (_, i) =>
      makeHour({
        time: `2026-02-14T${String(i).padStart(2, "0")}:00`,
        windSpeed: 10 + i,
      }),
    );
    const result = interpolateForecasts(hours, 30);

    // 24 segments × 2 steps + 1 final = 49
    expect(result).toHaveLength(49);
  });

  it("preserves exact values at original hour boundaries", () => {
    const hours = [
      makeHour({ time: "2026-02-14T12:00", windSpeed: 10, windDirection: 90, windGusts: 14 }),
      makeHour({ time: "2026-02-14T13:00", windSpeed: 20, windDirection: 180, windGusts: 28 }),
      makeHour({ time: "2026-02-14T14:00", windSpeed: 30, windDirection: 270, windGusts: 42 }),
    ];
    const result = interpolateForecasts(hours, 30);

    // First point
    expect(result[0].windSpeed).toBe(10);
    // Second hour boundary (index 2)
    expect(result[2].windSpeed).toBe(20);
    // Last point
    expect(result[4].windSpeed).toBe(30);
  });
});
