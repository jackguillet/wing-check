import { describe, it, expect } from "vitest";
import type { RideableWindow } from "../evaluator";
import {
  ALERT_HORIZON_HOURS,
  upcomingGoWindows,
  unsentGoWindows,
  uniqueWindowAlertTypes,
  windowAlertType,
} from "../policy";

function window(overrides: Partial<RideableWindow>): RideableWindow {
  return {
    start: "2026-08-16T10:00",
    end: "2026-08-16T13:00",
    hours: 4,
    avgScore: 80,
    avgWind: 18,
    avgGusts: 22,
    dominantDirection: 270,
    ...overrides,
  };
}

describe("windowAlertType", () => {
  it("keys a send by the window's civil date", () => {
    expect(windowAlertType("2026-08-17T10:00")).toBe("go:2026-08-17");
  });
});

describe("upcomingGoWindows", () => {
  it("includes a Saturday morning GO when the cron runs Friday afternoon UTC", () => {
    // Friday 14:00 UTC = Friday 04:00 HST. Saturday 10:00 HST is 30h later.
    const windows = [
      window({
        start: "2026-08-14T08:00",
        end: "2026-08-14T11:00",
        avgScore: 85,
      }),
      window({
        start: "2026-08-16T10:00",
        end: "2026-08-16T13:00",
        avgScore: 80,
      }),
    ];
    const upcoming = upcomingGoWindows(windows, "2026-08-15T04:00");
    expect(upcoming.map((w) => w.start)).toEqual(["2026-08-16T10:00"]);
  });

  it("does not send a window that already ended", () => {
    const windows = [
      window({
        start: "2026-08-16T08:00",
        end: "2026-08-16T11:00",
        avgScore: 90,
      }),
    ];
    expect(upcomingGoWindows(windows, "2026-08-16T14:00")).toEqual([]);
  });

  it("includes an in-progress GO window", () => {
    const windows = [
      window({
        start: "2026-08-16T10:00",
        end: "2026-08-16T16:00",
        avgScore: 80,
      }),
    ];
    const upcoming = upcomingGoWindows(windows, "2026-08-16T14:00");
    expect(upcoming).toHaveLength(1);
  });

  it("ignores marginal windows", () => {
    const windows = [
      window({
        start: "2026-08-16T15:00",
        end: "2026-08-16T18:00",
        avgScore: 62,
      }),
    ];
    expect(upcomingGoWindows(windows, "2026-08-16T10:00")).toEqual([]);
  });

  it("drops windows that start after the horizon", () => {
    const windows = [
      window({
        start: "2026-08-18T10:00",
        end: "2026-08-18T13:00",
        avgScore: 85,
      }),
    ];
    const upcoming = upcomingGoWindows(
      windows,
      "2026-08-16T04:00",
      ALERT_HORIZON_HOURS,
    );
    expect(upcoming).toEqual([]);
  });
});

describe("unsentGoWindows", () => {
  it("skips a date that already produced an alert", () => {
    const windows = [
      window({ start: "2026-08-16T10:00", end: "2026-08-16T13:00" }),
      window({ start: "2026-08-17T10:00", end: "2026-08-17T13:00" }),
    ];
    const remaining = unsentGoWindows(windows, ["go:2026-08-16"]);
    expect(remaining.map((w) => w.start)).toEqual(["2026-08-17T10:00"]);
  });

  it("dedupes two windows on the same civil date to one type", () => {
    const windows = [
      window({ start: "2026-08-16T08:00", end: "2026-08-16T10:00" }),
      window({ start: "2026-08-16T15:00", end: "2026-08-16T17:00" }),
    ];
    expect(uniqueWindowAlertTypes(windows)).toEqual(["go:2026-08-16"]);
  });
});
