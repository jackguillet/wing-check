import { describe, it, expect } from "vitest";
import { evaluateSpot, nextRideableWindow, bestUpcomingWindowScore, type HourScore, type RideableWindow, type DayEvaluation } from "../evaluator";
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
    precipitation: 0,
    cloudCover: 20,
    visibility: 20000,
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
  minWindSpeed: 10,
  maxWindSpeed: 25,
  maxGustFactor: 2.5,
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

  it("fails gust gate when gusts exceed 50 kt absolute ceiling", () => {
    const hours = makeHours(3, { windSpeed: 25, windGusts: 55, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBe(0);
      expect(s.gustOk).toBe(false);
    }
  });

  it("passes gust gate when gusts are at exactly 50 kt", () => {
    const hours = makeHours(3, { windSpeed: 25, windGusts: 50, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.gustOk).toBe(true);
    }
  });

  it("passes gust gate with high ratio but below absolute ceiling", () => {
    // 15 kt wind, 40 kt gusts: ratio 2.67, but under 50 kt ceiling
    const hours = makeHours(3, { windSpeed: 15, windGusts: 40, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);

    for (const s of result.hourScores) {
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

  it("zeros an hour 180° off preferred direction so it cannot GO", () => {
    const goodDir = makeHours(3, { windDirection: 270 });
    const badDir = makeHours(3, { windDirection: 90 });

    const goodResult = evaluateSpot(goodDir, defaultCriteria);
    const badResult = evaluateSpot(badDir, defaultCriteria);

    expect(goodResult.goNoGo).toBe("go");
    expect(badResult.goNoGo).toBe("no-go");
    expect(badResult.hourScores.every((s) => s.score === 0)).toBe(true);
    expect(badResult.hourScores.every((s) => s.reason === "Offshore")).toBe(true);
    expect(badResult.rideableWindows).toHaveLength(0);
  });

  it("penalizes direction inside the tolerance band without zeroing", () => {
    const onDir = makeHours(3, { windDirection: 270 });
    const edge = makeHours(3, { windDirection: 300 });

    const on = evaluateSpot(onDir, defaultCriteria);
    const off = evaluateSpot(edge, defaultCriteria);

    expect(off.hourScores.every((s) => s.directionOk && s.score > 0)).toBe(true);
    expect(on.overallScore).toBeGreaterThan(off.overallScore);
  });

  it("scores violent rain worse than clear sky", () => {
    const clear = evaluateSpot(makeHours(3, { weatherCode: 1 }), defaultCriteria);
    const rain = evaluateSpot(makeHours(3, { weatherCode: 82 }), defaultCriteria);

    expect(rain.hourScores.every((s) => s.weatherOk && s.score > 0)).toBe(true);
    expect(clear.overallScore).toBeGreaterThan(rain.overallScore);
    expect(clear.hourScores[0].score - rain.hourScores[0].score).toBe(10);
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

  it("parses comma-separated preferred directions", () => {
    const criteria = { ...defaultCriteria, preferredDirections: "270, 280" };
    const hours = makeHours(3, { windDirection: 270 });
    const result = evaluateSpot(hours, criteria);
    expect(result.hourScores.every((s) => s.directionOk)).toBe(true);
  });

  it("does not throw on invalid preferredDirections JSON", () => {
    const criteria = { ...defaultCriteria, preferredDirections: "not-json" };
    const hours = makeHours(3, { windDirection: 90 });
    expect(() => evaluateSpot(hours, criteria)).not.toThrow();
    const result = evaluateSpot(hours, criteria);
    expect(result.hourScores.every((s) => s.directionOk)).toBe(true);
  });

  it("does not treat missing wave data as a free 10 points", () => {
    const missing = makeHours(3, { waveHeight: null, swellHeight: null });
    const knownSmall = makeHours(3, { waveHeight: 0.3, swellHeight: 0.3 });
    const missingResult = evaluateSpot(missing, defaultCriteria);
    const knownResult = evaluateSpot(knownSmall, defaultCriteria);

    expect(missingResult.hourScores.every((s) => s.waveOk)).toBe(false);
    expect(knownResult.overallScore).toBeGreaterThan(missingResult.overallScore);
  });

  it("awards full wave points when no max wave is set, even without data", () => {
    const criteria = { ...defaultCriteria, maxWaveHeight: null };
    const hours = makeHours(3, { waveHeight: null });
    const result = evaluateSpot(hours, criteria);
    expect(result.hourScores.every((s) => s.waveOk)).toBe(true);
  });

  it("scores a single-value wind band without NaN", () => {
    const criteria = { ...defaultCriteria, minWindSpeed: 18, maxWindSpeed: 18 };
    const onTarget = evaluateSpot(makeHours(3, { windSpeed: 18, windGusts: 20 }), criteria);
    const offTarget = evaluateSpot(makeHours(3, { windSpeed: 12, windGusts: 14 }), criteria);

    for (const s of onTarget.hourScores) {
      expect(Number.isFinite(s.score)).toBe(true);
      expect(s.score).toBeGreaterThan(0);
    }
    expect(offTarget.hourScores.every((s) => s.score === 0)).toBe(true);
    expect(offTarget.goNoGo).toBe("no-go");
  });

  it("treats maxGustFactor of 1 as no extra gusts, without NaN", () => {
    const criteria = { ...defaultCriteria, maxGustFactor: 1 };
    const steady = evaluateSpot(
      makeHours(3, { windSpeed: 20, windGusts: 20 }),
      criteria,
    );
    const gusty = evaluateSpot(
      makeHours(3, { windSpeed: 20, windGusts: 24 }),
      criteria,
    );

    for (const s of steady.hourScores) {
      expect(Number.isFinite(s.score)).toBe(true);
      expect(s.score).toBeGreaterThan(0);
    }
    expect(steady.overallScore).toBeGreaterThan(gusty.overallScore);
  });

  it("restricts rideable windows to daylight when sunrise/sunset are provided", () => {
    const hours = [
      makeHour({ time: "2026-02-14T06:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T07:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T12:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T13:00", windSpeed: 20, windGusts: 22 }),
    ];
    const result = evaluateSpot(
      hours,
      defaultCriteria,
      ["2026-02-14T07:30"],
      ["2026-02-14T18:00"],
    );

    expect(result.rideableWindows).toHaveLength(1);
    expect(result.rideableWindows[0].start).toBe("2026-02-14T12:00");
    expect(result.hourScores[0].score).toBeGreaterThan(0);
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

  it("limits dayEvaluations and rideableWindows to 7 days", () => {
    const hours = [
      // Day 1: Feb 14
      makeHour({ time: "2026-02-14T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-14T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-14T12:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 2: Feb 15
      makeHour({ time: "2026-02-15T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-15T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 3: Feb 16
      makeHour({ time: "2026-02-16T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-16T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 4: Feb 17
      makeHour({ time: "2026-02-17T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-17T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 5: Feb 18
      makeHour({ time: "2026-02-18T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-18T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 6: Feb 19
      makeHour({ time: "2026-02-19T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-19T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 7: Feb 20
      makeHour({ time: "2026-02-20T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-20T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 8: Feb 21 — should be excluded
      makeHour({ time: "2026-02-21T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-21T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      // Day 9: Feb 22 — should be excluded
      makeHour({ time: "2026-02-22T10:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
      makeHour({ time: "2026-02-22T11:00", windSpeed: 20, windGusts: 24, windDirection: 270 }),
    ];

    const result = evaluateSpot(hours, defaultCriteria);
    expect(result.dayEvaluations).toHaveLength(7);
    expect(result.dayEvaluations.map(d => d.date)).toEqual([
      "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17",
      "2026-02-18", "2026-02-19", "2026-02-20",
    ]);
    // No rideable windows on day 8 or 9
    for (const w of result.rideableWindows) {
      expect(w.start.slice(0, 10) <= "2026-02-20").toBe(true);
    }
    // hourScores still includes all days (unfiltered)
    expect(result.hourScores.some(h => h.time.startsWith("2026-02-21"))).toBe(true);
    expect(result.hourScores.some(h => h.time.startsWith("2026-02-22"))).toBe(true);
  });

  it("regression: Kanaha-like gusty conditions are not no-go", () => {
    // 11 kt wind, 32 kt gusts, NE direction (44°) — rideable for wing foiling
    const kanahaCriteria: AlertCriteria = {
      id: 1,
      spotId: 1,
      minWindSpeed: 10,
      maxWindSpeed: 30,
      maxGustFactor: 2.5,
      preferredDirections: "[45, 60, 75, 90]",
      directionTolerance: 45,
      minConsecutiveHours: 2,
      maxWaveHeight: null,
    };

    const hours = makeHours(4, {
      windSpeed: 11,
      windGusts: 32,
      windDirection: 44,
    });

    const result = evaluateSpot(hours, kanahaCriteria);

    // Should score > 0 per hour (not zeroed out by hard gate)
    for (const s of result.hourScores) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.gustOk).toBe(true);
      expect(s.windOk).toBe(true);
    }
    // Should NOT be no-go
    expect(result.goNoGo).not.toBe("no-go");
  });

  it("labels a zero hour with the failing constraint", () => {
    const light = evaluateSpot(makeHours(1, { windSpeed: 4, windGusts: 5 }), defaultCriteria);
    expect(light.hourScores[0].reason).toBe("Light");
    const storm = evaluateSpot(
      makeHours(1, { windSpeed: 20, windGusts: 22, weatherCode: 95 }),
      defaultCriteria,
    );
    expect(storm.hourScores[0].reason).toBe("Storm");
  });

  it("stores window end as the exclusive last hour + 1h", () => {
    const hours = makeHours(3, { windSpeed: 20, windGusts: 22, windDirection: 270 });
    const result = evaluateSpot(hours, defaultCriteria);
    expect(result.rideableWindows[0].start).toBe("2026-02-14T10:00");
    expect(result.rideableWindows[0].end).toBe("2026-02-14T13:00");
  });

  describe("remaining windows (nowCivil)", () => {
    const sunrise = ["2026-02-14T07:00"];
    const sunset = ["2026-02-14T18:00"];

    it("drops a morning window that already ended", () => {
      const hours = [
        makeHour({ time: "2026-02-14T08:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T09:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T10:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T11:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T15:00", windSpeed: 5, windGusts: 6 }),
        makeHour({ time: "2026-02-14T16:00", windSpeed: 5, windGusts: 6 }),
      ];
      const result = evaluateSpot(
        hours,
        defaultCriteria,
        sunrise,
        sunset,
        "2026-02-14T14:00",
      );

      expect(result.rideableWindows).toHaveLength(0);
      expect(result.goNoGo).toBe("no-go");
      expect(result.overallScore).toBe(0);
      expect(result.todayDate).toBe("2026-02-14");
      expect(result.hourScores[0].score).toBeGreaterThan(0);
    });

    it("keeps an afternoon window that has not started", () => {
      const hours = [
        makeHour({ time: "2026-02-14T08:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T09:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T15:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T16:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T17:00", windSpeed: 20, windGusts: 22 }),
      ];
      const result = evaluateSpot(
        hours,
        defaultCriteria,
        sunrise,
        sunset,
        "2026-02-14T14:00",
      );

      expect(result.goNoGo).toBe("go");
      expect(result.rideableWindows).toHaveLength(1);
      expect(result.rideableWindows[0].start).toBe("2026-02-14T15:00");
    });

    it("labels today by the spot-local date, not the first bucket", () => {
      const hours = [
        makeHour({ time: "2026-02-13T16:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-13T17:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T15:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T16:00", windSpeed: 20, windGusts: 22 }),
        makeHour({ time: "2026-02-14T17:00", windSpeed: 20, windGusts: 22 }),
      ];
      const result = evaluateSpot(
        hours,
        defaultCriteria,
        ["2026-02-13T07:00", "2026-02-14T07:00"],
        ["2026-02-13T18:00", "2026-02-14T18:00"],
        "2026-02-14T10:00",
      );

      expect(result.todayDate).toBe("2026-02-14");
      expect(result.dayEvaluations[0].date).toBe("2026-02-13");
      expect(result.dayEvaluations[0].goNoGo).toBe("no-go");
      expect(result.goNoGo).toBe("go");
      expect(result.overallScore).toBe(result.dayEvaluations[1].score);
    });
  });
});

describe("nextRideableWindow", () => {
  const windows: RideableWindow[] = [
    {
      start: "2026-08-16T10:00",
      end: "2026-08-16T14:00",
      hours: 3,
      avgScore: 80,
      avgWind: 18,
      avgGusts: 22,
      dominantDirection: 270,
    },
    {
      start: "2026-08-17T14:00",
      end: "2026-08-17T18:00",
      hours: 3,
      avgScore: 70,
      avgWind: 16,
      avgGusts: 20,
      dominantDirection: 250,
    },
  ];

  it("returns the earliest window that has not ended", () => {
    const next = nextRideableWindow(windows, "2026-08-16T12:00");
    expect(next?.start).toBe("2026-08-16T10:00");
  });

  it("skips a window that already ended", () => {
    const next = nextRideableWindow(windows, "2026-08-16T14:00");
    expect(next?.start).toBe("2026-08-17T14:00");
  });

  it("keeps a window whose last hour is still in progress", () => {
    const next = nextRideableWindow(windows, "2026-08-16T13:30");
    expect(next?.start).toBe("2026-08-16T10:00");
  });

  it("returns null when every window is over", () => {
    expect(nextRideableWindow(windows, "2026-08-18T00:00")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(nextRideableWindow([])).toBeNull();
  });
});

describe("bestUpcomingWindowScore", () => {
  function window(start: string, end: string, avgScore: number): RideableWindow {
    return {
      start,
      end,
      hours: 2,
      avgScore,
      avgWind: 16,
      avgGusts: 20,
      dominantDirection: 270,
    };
  }

  it("picks the best window that starts inside the 72h horizon", () => {
    const evaluation = {
      overallScore: 55,
      goNoGo: "marginal" as const,
      hourScores: [],
      rideableWindows: [
        window("2026-08-16T10:00", "2026-08-16T12:00", 55),
        window("2026-08-18T10:00", "2026-08-18T12:00", 88),
        window("2026-08-20T10:00", "2026-08-20T12:00", 95),
      ],
      bestWindow: null,
      dayEvaluations: [],
      todayDate: "2026-08-16",
    };

    expect(bestUpcomingWindowScore(evaluation, 72)).toBe(88);
  });

  it("returns 0 when nothing is in range", () => {
    const evaluation = {
      overallScore: 0,
      goNoGo: "no-go" as const,
      hourScores: [],
      rideableWindows: [
        window("2026-08-20T10:00", "2026-08-20T12:00", 95),
      ],
      bestWindow: null,
      dayEvaluations: [],
      todayDate: "2026-08-16",
    };

    expect(bestUpcomingWindowScore(evaluation, 72)).toBe(0);
  });
});

describe("rider schedule", () => {
  it("does not GO on an afternoon window for a mornings-only rider", () => {
    const hours = [
      makeHour({ time: "2026-02-14T15:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T16:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T17:00", windSpeed: 20, windGusts: 22 }),
    ];
    const result = evaluateSpot(
      hours,
      defaultCriteria,
      ["2026-02-14T07:00"],
      ["2026-02-14T18:00"],
      "2026-02-14T08:00",
      { sessionStartHour: 7, sessionEndHour: 11 },
    );
    expect(result.goNoGo).toBe("no-go");
    expect(result.rideableWindows).toHaveLength(0);
    expect(result.hourScores.every((s) => s.score > 50)).toBe(true);
  });

  it("keeps a morning window for a mornings-only rider", () => {
    const hours = [
      makeHour({ time: "2026-02-14T08:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T09:00", windSpeed: 20, windGusts: 22 }),
      makeHour({ time: "2026-02-14T10:00", windSpeed: 20, windGusts: 22 }),
    ];
    const result = evaluateSpot(
      hours,
      defaultCriteria,
      ["2026-02-14T07:00"],
      ["2026-02-14T18:00"],
      "2026-02-14T07:30",
      { sessionStartHour: 7, sessionEndHour: 11 },
    );
    expect(result.goNoGo).toBe("go");
    expect(result.rideableWindows[0].start).toBe("2026-02-14T08:00");
  });
});
