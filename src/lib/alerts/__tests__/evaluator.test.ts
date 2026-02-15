import { describe, it, expect } from "vitest";
import { evaluateSpot, type HourScore, type RideableWindow, type DayEvaluation } from "../evaluator";
import type { ForecastHour } from "@/lib/weather/types";
import type { AlertCriteria } from "@/lib/db/schema";

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

function makeHours(
  count: number,
  overrides: Partial<ForecastHour> = {}
): ForecastHour[] {
  return Array.from({ length: count }, (_, i) =>
    makeHour({
      time: `2026-02-14T${String(10 + i).padStart(2, "0")}:00`,
      ...overrides,
    })
  );
}

const defaultCriteria: AlertCriteria = {
  id: 1,
  spotId: 1,
  minWindSpeed: 15,
  maxWindSpeed: 25,
  maxGustFactor: 1.5,
  preferredDirections: "[270]",
  directionTolerance: 45,
  minConsecutiveHours: 2,
  maxWaveHeight: 2.0,
};

describe("evaluateSpot", () => {
  it("returns go with perfect conditions for 3+ hours", () => {
    const hours = makeHours(4, { windSpeed: 20, windGusts: 24, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    expect(result.goNoGo).toBe("go");
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.rideableWindows.length).toBeGreaterThanOrEqual(1);
    expect(result.bestWindow).not.toBeNull();
    expect(result.bestWindow!.hours).toBe(4);
  });

  it("returns no-go when wind is too light", () => {
    const hours = makeHours(4, { windSpeed: 5, windGusts: 7 });
    const result = evaluateSpot(hours, defaultCriteria);

    expect(result.goNoGo).toBe("no-go");
    expect(result.rideableWindows).toHaveLength(0);
  });

  it("returns no-go when wind is too strong", () => {
    const hours = makeHours(4, { windSpeed: 40, windGusts: 55, windDirection: 90 });
    const result = evaluateSpot(hours, defaultCriteria);

    expect(result.goNoGo).toBe("no-go");
    expect(result.rideableWindows).toHaveLength(0);
  });

  it("scores zero during thunderstorms (hard gate)", () => {
    const hours = makeHours(3, { windSpeed: 20, windGusts: 24, windDirection: 270, weatherCode: 95 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBe(0);
      expect(s.weatherOk).toBe(false);
    }
    expect(result.goNoGo).toBe("no-go");
  });

  it("passes weather gate with normal weather code", () => {
    const hours = makeHours(3, { windSpeed: 20, windGusts: 24, windDirection: 270, weatherCode: 3 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.weatherOk).toBe(true);
    }
  });

  it("fails gust gate when absolute spread exceeds 10 kt", () => {
    // 25 kt wind, 36 kt gusts: ratio 1.44 (under 1.5), but spread = 11 kt
    const hours = makeHours(3, { windSpeed: 25, windGusts: 36, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBe(0);
      expect(s.gustOk).toBe(false);
    }
  });

  it("passes gust gate when spread is exactly 10 kt", () => {
    // 25 kt wind, 35 kt gusts: ratio 1.4, spread = 10 kt
    const hours = makeHours(3, { windSpeed: 25, windGusts: 35, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.gustOk).toBe(true);
    }
  });

  it("passes gust gate when ratio and spread are both within limits", () => {
    // 15 kt wind, 22 kt gusts: ratio 1.47, spread = 7 kt
    const hours = makeHours(3, { windSpeed: 15, windGusts: 22, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.gustOk).toBe(true);
    }
  });

  it("penalizes gusty conditions", () => {
    const steadyHours = makeHours(3, { windSpeed: 20, windGusts: 22 });
    const gustyHours = makeHours(3, { windSpeed: 20, windGusts: 29 });

    const steadyResult = evaluateSpot(steadyHours, defaultCriteria);
    const gustyResult = evaluateSpot(gustyHours, defaultCriteria);

    expect(steadyResult.overallScore).toBeGreaterThan(gustyResult.overallScore);
  });

  it("penalizes wrong wind direction", () => {
    const goodDir = makeHours(3, { windDirection: 270 });
    const badDir = makeHours(3, { windDirection: 90 });

    const goodResult = evaluateSpot(goodDir, defaultCriteria);
    const badResult = evaluateSpot(badDir, defaultCriteria);

    expect(goodResult.overallScore).toBeGreaterThan(badResult.overallScore);
  });

  it("requires minimum consecutive hours", () => {
    // 1 good hour, then bad, then 1 good hour (min is 2)
    const hours = [
      makeHour({ time: "2026-02-14T10:00", windSpeed: 20, windGusts: 24 }),
      makeHour({ time: "2026-02-14T11:00", windSpeed: 5, windGusts: 7 }),
      makeHour({ time: "2026-02-14T12:00", windSpeed: 20, windGusts: 24 }),
    ];

    const result = evaluateSpot(hours, defaultCriteria);
    expect(result.rideableWindows).toHaveLength(0);
  });

  it("accepts any direction when preferredDirections is empty", () => {
    const criteria = { ...defaultCriteria, preferredDirections: "[]" };
    const hours = makeHours(3, { windDirection: 90 });

    const result = evaluateSpot(hours, criteria);
    // Should not penalize direction at all
    expect(result.hourScores.every((s) => s.directionOk)).toBe(true);
  });

  it("handles no wave data gracefully", () => {
    const hours = makeHours(3, { waveHeight: null, swellHeight: null });
    const result = evaluateSpot(hours, defaultCriteria);

    expect(result.hourScores.every((s) => s.waveOk)).toBe(true);
  });

  it("penalizes large waves when maxWaveHeight is set", () => {
    const calmWaves = makeHours(3, { waveHeight: 0.5 });
    const bigWaves = makeHours(3, { waveHeight: 3.0 });

    const calmResult = evaluateSpot(calmWaves, defaultCriteria);
    const bigResult = evaluateSpot(bigWaves, defaultCriteria);

    expect(calmResult.overallScore).toBeGreaterThan(bigResult.overallScore);
    expect(bigResult.hourScores.every((s) => !s.waveOk)).toBe(true);
  });

  it("finds multiple rideable windows", () => {
    const hours = [
      // Window 1: hours 10-12
      ...makeHours(3, { windSpeed: 20, windGusts: 24 }),
      // Gap: hours 13-14
      makeHour({ time: "2026-02-14T13:00", windSpeed: 5, windGusts: 7 }),
      makeHour({ time: "2026-02-14T14:00", windSpeed: 5, windGusts: 7 }),
      // Window 2: hours 15-17
      makeHour({ time: "2026-02-14T15:00", windSpeed: 22, windGusts: 26, windDirection: 270 }),
      makeHour({ time: "2026-02-14T16:00", windSpeed: 22, windGusts: 26, windDirection: 270 }),
      makeHour({ time: "2026-02-14T17:00", windSpeed: 22, windGusts: 26, windDirection: 270 }),
    ];

    const result = evaluateSpot(hours, defaultCriteria);
    expect(result.rideableWindows.length).toBe(2);
  });

  it("scores zero when wind is below minimum", () => {
    const hours = makeHours(3, { windSpeed: 6, windGusts: 3, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBe(0);
      expect(s.windOk).toBe(false);
    }
    expect(result.rideableWindows).toHaveLength(0);
    expect(result.goNoGo).toBe("no-go");
  });

  it("returns scores between 0 and 100", () => {
    const hours = makeHours(5, { windSpeed: 20, windGusts: 24 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const score of result.hourScores) {
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    }
  });

  describe("dayEvaluations", () => {
    it("groups hours by date into separate day evaluations", () => {
      const hours = [
        // Day 1: Feb 14
        makeHour({ time: "2026-02-14T10:00", windSpeed: 20, windGusts: 24 }),
        makeHour({ time: "2026-02-14T11:00", windSpeed: 20, windGusts: 24 }),
        makeHour({ time: "2026-02-14T12:00", windSpeed: 20, windGusts: 24 }),
        // Day 2: Feb 15
        makeHour({ time: "2026-02-15T10:00", windSpeed: 20, windGusts: 24 }),
        makeHour({ time: "2026-02-15T11:00", windSpeed: 20, windGusts: 24 }),
        // Day 3: Feb 16
        makeHour({ time: "2026-02-16T10:00", windSpeed: 5, windGusts: 7 }),
      ];

      const result = evaluateSpot(hours, defaultCriteria);
      expect(result.dayEvaluations).toHaveLength(3);
      expect(result.dayEvaluations[0].date).toBe("2026-02-14");
      expect(result.dayEvaluations[1].date).toBe("2026-02-15");
      expect(result.dayEvaluations[2].date).toBe("2026-02-16");
    });

    it("computes independent score and goNoGo per day", () => {
      const hours = [
        // Day 1: great conditions
        makeHour({ time: "2026-02-14T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
        makeHour({ time: "2026-02-14T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
        makeHour({ time: "2026-02-14T12:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
        // Day 2: no wind
        makeHour({ time: "2026-02-15T10:00", windSpeed: 5, windGusts: 7, windDirection: 270 }),
        makeHour({ time: "2026-02-15T11:00", windSpeed: 5, windGusts: 7, windDirection: 270 }),
        makeHour({ time: "2026-02-15T12:00", windSpeed: 5, windGusts: 7, windDirection: 270 }),
      ];

      const result = evaluateSpot(hours, defaultCriteria);
      expect(result.dayEvaluations[0].goNoGo).toBe("go");
      expect(result.dayEvaluations[0].score).toBeGreaterThanOrEqual(70);
      expect(result.dayEvaluations[1].goNoGo).toBe("no-go");
      expect(result.dayEvaluations[1].score).toBe(0);
    });

    it("sets overallScore and goNoGo from first day", () => {
      const hours = [
        // Day 1: no wind
        makeHour({ time: "2026-02-14T10:00", windSpeed: 5, windGusts: 7 }),
        makeHour({ time: "2026-02-14T11:00", windSpeed: 5, windGusts: 7 }),
        // Day 2: great conditions
        makeHour({ time: "2026-02-15T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
        makeHour({ time: "2026-02-15T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
        makeHour({ time: "2026-02-15T12:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      ];

      const result = evaluateSpot(hours, defaultCriteria);
      // Overall should reflect day 1 (no-go), not day 2 (go)
      expect(result.overallScore).toBe(result.dayEvaluations[0].score);
      expect(result.goNoGo).toBe("no-go");
      // But day 2 should still be go
      expect(result.dayEvaluations[1].goNoGo).toBe("go");
    });
  });
});
