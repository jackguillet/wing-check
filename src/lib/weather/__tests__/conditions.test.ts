import { describe, it, expect } from "vitest";
import {
  computeTidePhases,
  computePressureTrend,
  computeSwellQuality,
  computeWaveAmplification,
  computeConditionsInsight,
} from "../conditions";
import type { ForecastHour, TidePoint } from "../types";
import type { TidePhase, SwellQuality } from "../conditions";

// ── Helpers ────────────────────────────────────────────────────────

function makeTide(time: string, height: number): TidePoint {
  return { time, height };
}

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
    pressureMsl: 1013,
    precipitation: 0,
    cloudCover: 20,
    visibility: 20000,
    ...overrides,
  };
}

// ── computeTidePhases ──────────────────────────────────────────────

describe("computeTidePhases", () => {
  it("returns empty array for empty input", () => {
    expect(computeTidePhases([])).toEqual([]);
  });

  it("uses NOAA published H/L instead of derivative peaks", () => {
    const tides = [
      makeTide("2026-02-14T06:00", 0.5),
      makeTide("2026-02-14T07:00", 1.0),
      makeTide("2026-02-14T08:00", 1.5),
      { time: "2026-02-14T08:30", height: 1.7, type: "H" as const },
      makeTide("2026-02-14T09:00", 1.6),
      makeTide("2026-02-14T10:00", 1.2),
    ];
    const phases = computeTidePhases(tides);
    const highs = phases.filter((p) => p.phase === "high");
    expect(highs).toHaveLength(1);
    expect(highs[0].time).toBe("2026-02-14T08:30");
  });

  it("detects a high tide at the peak", () => {
    const tides = [
      makeTide("2026-02-14T06:00", 0.5),
      makeTide("2026-02-14T07:00", 1.0),
      makeTide("2026-02-14T08:00", 1.5),
      makeTide("2026-02-14T09:00", 1.8),
      makeTide("2026-02-14T10:00", 1.5),
      makeTide("2026-02-14T11:00", 1.0),
      makeTide("2026-02-14T12:00", 0.5),
    ];

    const phases = computeTidePhases(tides);
    const highTide = phases.find((p) => p.phase === "high");

    expect(highTide).toBeDefined();
    expect(highTide!.time).toBe("2026-02-14T09:00");
    expect(highTide!.height).toBe(1.8);
  });

  it("detects a low tide at the trough", () => {
    const tides = [
      makeTide("2026-02-14T06:00", 1.5),
      makeTide("2026-02-14T07:00", 1.0),
      makeTide("2026-02-14T08:00", 0.5),
      makeTide("2026-02-14T09:00", 0.2),
      makeTide("2026-02-14T10:00", 0.5),
      makeTide("2026-02-14T11:00", 1.0),
      makeTide("2026-02-14T12:00", 1.5),
    ];

    const phases = computeTidePhases(tides);
    const lowTide = phases.find((p) => p.phase === "low");

    expect(lowTide).toBeDefined();
    expect(lowTide!.time).toBe("2026-02-14T09:00");
  });

  it("marks rising phases before high", () => {
    const tides = [
      makeTide("2026-02-14T06:00", 0.2),
      makeTide("2026-02-14T07:00", 0.5),
      makeTide("2026-02-14T08:00", 1.0),
      makeTide("2026-02-14T09:00", 1.5),
      makeTide("2026-02-14T10:00", 1.0),
    ];

    const phases = computeTidePhases(tides);
    expect(phases[1].phase).toBe("rising");
    expect(phases[1].rateOfChange).toBeGreaterThan(0);
  });

  it("marks falling phases after high", () => {
    const tides = [
      makeTide("2026-02-14T08:00", 1.0),
      makeTide("2026-02-14T09:00", 1.5),
      makeTide("2026-02-14T10:00", 1.0),
      makeTide("2026-02-14T11:00", 0.5),
      makeTide("2026-02-14T12:00", 0.3),
    ];

    const phases = computeTidePhases(tides);
    expect(phases[3].phase).toBe("falling");
    expect(phases[3].rateOfChange).toBeLessThan(0);
  });

  it("computes hoursToNextExtreme", () => {
    const tides = [
      makeTide("2026-02-14T06:00", 0.5),
      makeTide("2026-02-14T07:00", 1.0),
      makeTide("2026-02-14T08:00", 1.5),
      makeTide("2026-02-14T09:00", 1.8),
      makeTide("2026-02-14T10:00", 1.5),
    ];

    const phases = computeTidePhases(tides);
    // First point, next extreme is at index 3 (high) which is 3 hours away
    expect(phases[0].hoursToNextExtreme).toBe(3);
    expect(phases[0].nextExtremeType).toBe("H");
  });

  it("handles single tide point", () => {
    const phases = computeTidePhases([makeTide("2026-02-14T12:00", 1.0)]);
    expect(phases).toHaveLength(1);
    expect(phases[0].rateOfChange).toBe(0);
  });
});

// ── computePressureTrend ───────────────────────────────────────────

describe("computePressureTrend", () => {
  it("returns steady for insufficient history", () => {
    const hours = [makeHour({ time: "2026-02-14T12:00", pressureMsl: 1013 })];
    const trends = computePressureTrend(hours);

    expect(trends).toHaveLength(1);
    expect(trends[0].direction).toBe("steady");
    expect(trends[0].change3h).toBeNull();
  });

  it("detects falling pressure", () => {
    const hours = Array.from({ length: 4 }, (_, i) =>
      makeHour({
        time: `2026-02-14T${String(9 + i).padStart(2, "0")}:00`,
        pressureMsl: 1015 - i * 1.5, // -4.5 over 3h
      }),
    );

    const trends = computePressureTrend(hours);
    expect(trends[3].direction).toBe("falling");
    expect(trends[3].change3h).toBeCloseTo(-4.5, 1);
  });

  it("detects falling-fast pressure", () => {
    const hours = Array.from({ length: 4 }, (_, i) =>
      makeHour({
        time: `2026-02-14T${String(9 + i).padStart(2, "0")}:00`,
        pressureMsl: 1015 - i * 3, // -9 over 3h
      }),
    );

    const trends = computePressureTrend(hours);
    expect(trends[3].direction).toBe("falling-fast");
    expect(trends[3].label).toContain("Storm");
  });

  it("detects rising pressure", () => {
    const hours = Array.from({ length: 4 }, (_, i) =>
      makeHour({
        time: `2026-02-14T${String(9 + i).padStart(2, "0")}:00`,
        pressureMsl: 1005 + i * 1.5, // +4.5 over 3h
      }),
    );

    const trends = computePressureTrend(hours);
    expect(trends[3].direction).toBe("rising");
    expect(trends[3].label).toContain("stabilizing");
  });

  it("computes 6h change when enough data", () => {
    const hours = Array.from({ length: 7 }, (_, i) =>
      makeHour({
        time: `2026-02-14T${String(6 + i).padStart(2, "0")}:00`,
        pressureMsl: 1015 - i,
      }),
    );

    const trends = computePressureTrend(hours);
    expect(trends[6].change6h).toBeCloseTo(-6, 1);
  });

  it("handles null pressure gracefully", () => {
    const hours = [
      makeHour({ time: "2026-02-14T09:00", pressureMsl: null }),
      makeHour({ time: "2026-02-14T10:00", pressureMsl: null }),
    ];

    const trends = computePressureTrend(hours);
    expect(trends[0].pressure).toBe(0);
    expect(trends[0].change3h).toBeNull();
  });
});

// ── computeSwellQuality ────────────────────────────────────────────

describe("computeSwellQuality", () => {
  it("rates excellent for long-period groundswell", () => {
    const q = computeSwellQuality(
      makeHour({ swellPeriod: 15, swellHeight: 1.2 }),
    );
    expect(q.rating).toBe("excellent");
    expect(q.isGroundswell).toBe(true);
    expect(q.label).toContain("Clean groundswell");
    expect(q.label).toContain("15s");
  });

  it("rates good for moderate groundswell", () => {
    const q = computeSwellQuality(
      makeHour({ swellPeriod: 12, swellHeight: 0.6 }),
    );
    expect(q.rating).toBe("good");
    expect(q.isGroundswell).toBe(true);
  });

  it("rates fair for mid-period swell", () => {
    const q = computeSwellQuality(
      makeHour({ swellPeriod: 9, swellHeight: 0.5 }),
    );
    expect(q.rating).toBe("fair");
    expect(q.isGroundswell).toBe(false);
  });

  it("rates poor for short-period wind swell", () => {
    const q = computeSwellQuality(
      makeHour({ swellPeriod: 5, swellHeight: 0.3 }),
    );
    expect(q.rating).toBe("poor");
    expect(q.label).toContain("Wind swell");
  });

  it("handles missing swell data", () => {
    const q = computeSwellQuality(
      makeHour({
        swellPeriod: null,
        swellHeight: null,
        wavePeriod: null,
        waveHeight: null,
      }),
    );
    expect(q.rating).toBe("poor");
    expect(q.label).toBe("No swell data");
  });

  it("falls back to wave data when swell is null", () => {
    const q = computeSwellQuality(
      makeHour({
        swellPeriod: null,
        swellHeight: null,
        wavePeriod: 14,
        waveHeight: 0.8,
      }),
    );
    expect(q.isGroundswell).toBe(true);
  });
});

// ── computeWaveAmplification ───────────────────────────────────────

describe("computeWaveAmplification", () => {
  it("returns none when no tide or swell data", () => {
    const amp = computeWaveAmplification(undefined, undefined, makeHour());
    expect(amp.level).toBe("none");
    expect(amp.factors).toEqual([]);
  });

  it("detects high amplification with rising tide + excellent swell + strong height", () => {
    const tide: TidePhase = {
      time: "2026-02-14T12:00",
      height: 1.2,
      phase: "rising",
      hoursToNextExtreme: 2,
      nextExtremeType: "H",
      rateOfChange: 0.3,
    };
    const swell: SwellQuality = {
      rating: "excellent",
      label: "Clean groundswell 14s",
      isGroundswell: true,
    };

    const amp = computeWaveAmplification(
      tide,
      swell,
      makeHour({ swellHeight: 1.5 }),
    );
    expect(amp.level).toBe("high");
    expect(amp.factors.length).toBeGreaterThanOrEqual(2);
  });

  it("detects moderate amplification", () => {
    const tide: TidePhase = {
      time: "2026-02-14T12:00",
      height: 1.0,
      phase: "rising",
      hoursToNextExtreme: 2,
      nextExtremeType: "H",
      rateOfChange: 0.2,
    };
    const swell: SwellQuality = {
      rating: "good",
      label: "Groundswell 12s",
      isGroundswell: true,
    };

    const amp = computeWaveAmplification(
      tide,
      swell,
      makeHour({ swellHeight: 0.5 }),
    );
    expect(amp.level).toBe("moderate");
  });

  it("returns none for falling tide with poor swell", () => {
    const tide: TidePhase = {
      time: "2026-02-14T12:00",
      height: 0.5,
      phase: "falling",
      hoursToNextExtreme: 3,
      nextExtremeType: "L",
      rateOfChange: -0.2,
    };
    const swell: SwellQuality = {
      rating: "poor",
      label: "Wind swell 5s",
      isGroundswell: false,
    };

    const amp = computeWaveAmplification(
      tide,
      swell,
      makeHour({ swellHeight: 0.2 }),
    );
    expect(amp.level).toBe("none");
  });
});

// ── computeConditionsInsight ───────────────────────────────────────

describe("computeConditionsInsight", () => {
  it("produces full insight with hours and tides", () => {
    const hours = Array.from({ length: 6 }, (_, i) =>
      makeHour({
        time: `2026-02-14T${String(9 + i).padStart(2, "0")}:00`,
        pressureMsl: 1013 - i * 0.5,
        swellHeight: 0.8 + i * 0.1,
        swellPeriod: 12,
      }),
    );

    const tides = [
      makeTide("2026-02-14T06:00", 0.3),
      makeTide("2026-02-14T09:00", 0.8),
      makeTide("2026-02-14T12:00", 1.5),
      makeTide("2026-02-14T15:00", 0.8),
    ];

    const insight = computeConditionsInsight(hours, tides);

    expect(insight.tidePhases).toHaveLength(4);
    expect(insight.pressureTrends).toHaveLength(6);
    expect(insight.swellQualities.size).toBe(6);
    expect(insight.amplifications.size).toBe(6);
  });

  it("works with empty tides (no NOAA station)", () => {
    const hours = [makeHour({ time: "2026-02-14T12:00" })];
    const insight = computeConditionsInsight(hours, []);

    expect(insight.tidePhases).toHaveLength(0);
    expect(insight.swellQualities.size).toBe(1);
    // amplification should be none since no tide
    expect(insight.amplifications.get("2026-02-14T12:00")?.level).toBe("none");
  });

  it("works with no swell data", () => {
    const hours = [
      makeHour({
        time: "2026-02-14T12:00",
        swellHeight: null,
        swellPeriod: null,
        waveHeight: null,
        wavePeriod: null,
      }),
    ];
    const tides = [makeTide("2026-02-14T12:00", 1.0)];

    const insight = computeConditionsInsight(hours, tides);
    const sq = insight.swellQualities.get("2026-02-14T12:00");
    expect(sq?.rating).toBe("poor");
  });
});
