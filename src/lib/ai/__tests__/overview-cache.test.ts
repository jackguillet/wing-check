import { describe, it, expect } from "vitest";
import { pickCachedOverview, fallbackOverviewText } from "../overview";

describe("pickCachedOverview", () => {
  const now = new Date("2026-08-16T20:00:00Z");
  const summary = '{"today":"current"}';

  it("returns a fresh row that matches this forecast", () => {
    const fresh = {
      forecastSummary: summary,
      expiresAt: new Date("2026-08-17T00:00:00Z"),
    };
    const staleOther = {
      forecastSummary: '{"today":"may"}',
      expiresAt: new Date("2026-08-17T00:00:00Z"),
    };
    expect(pickCachedOverview([staleOther, fresh], summary, now).fresh).toBe(
      fresh,
    );
  });

  it("never returns a row for a different forecast", () => {
    const old = {
      forecastSummary: '{"today":"may"}',
      expiresAt: new Date("2026-08-17T00:00:00Z"),
    };
    const picked = pickCachedOverview([old], summary, now);
    expect(picked.fresh).toBeNull();
    expect(picked.matchingExpired).toBeNull();
  });

  it("keeps an expired matching row only as a last-resort fallback", () => {
    const expired = {
      forecastSummary: summary,
      expiresAt: new Date("2026-08-16T10:00:00Z"),
    };
    const picked = pickCachedOverview([expired], summary, now);
    expect(picked.fresh).toBeNull();
    expect(picked.matchingExpired).toBe(expired);
  });
});

describe("fallbackOverviewText", () => {
  it("states NO-GO when there is no window", () => {
    const text = fallbackOverviewText({
      spot: {
        name: "Kanaha Beach",
        notes: "",
        coordinates: "20.9°, -156.4°",
      },
      criteria: {
        windRange: "10-22 kt",
        maxGustFactor: 2.5,
        preferredDirections: "[]",
        maxWaveHeight: null,
        quiver: [],
      },
      days: [
        {
          date: "2026-08-16",
          windRange: "2-5 kt",
          gustRange: "8-20 kt",
          dominantDirection: "ENE",
          tempRange: "26-28°C",
          weather: ["Thunderstorm"],
          swellSummary: "1.5m @ 8s",
        },
      ],
      evaluation: {
        goNoGo: "no-go",
        overallScore: 0,
        rideableWindows: [],
        suggestedWindows: [],
      },
    });
    expect(text).toMatch(/Kanaha Beach/);
    expect(text).toMatch(/2-5 kt/);
    expect(text).toMatch(/NO-GO \(0\/100\)/);
    expect(text).not.toMatch(/Go time/i);
  });
});
