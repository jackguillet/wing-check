import { describe, it, expect } from "vitest";
import { resolveCriteria, asAlertCriteria } from "../criteria";
import { defaultCriteria } from "../alerts/evaluator";

describe("resolveCriteria", () => {
  const spot = {
    ...defaultCriteria,
    minWindSpeed: 12,
    maxWindSpeed: 28,
    preferredDirections: "[270]",
  };
  const user = {
    ...defaultCriteria,
    minWindSpeed: 18,
    maxWindSpeed: 30,
    preferredDirections: "[45]",
  };

  it("prefers the rider's criteria", () => {
    const resolved = resolveCriteria(7, user, spot);
    expect(resolved.spotId).toBe(7);
    expect(resolved.minWindSpeed).toBe(18);
    expect(resolved.preferredDirections).toBe("[45]");
  });

  it("falls back to the spot default", () => {
    const resolved = resolveCriteria(7, null, spot);
    expect(resolved.minWindSpeed).toBe(12);
    expect(resolved.maxWindSpeed).toBe(28);
  });

  it("falls back to app defaults", () => {
    const resolved = resolveCriteria(7, null, null);
    expect(resolved.minWindSpeed).toBe(defaultCriteria.minWindSpeed);
    expect(resolved.maxWindSpeed).toBe(defaultCriteria.maxWindSpeed);
  });
});

describe("asAlertCriteria", () => {
  it("fills id and spotId", () => {
    const row = asAlertCriteria(3, defaultCriteria);
    expect(row.id).toBe(0);
    expect(row.spotId).toBe(3);
    expect(row.minWindSpeed).toBe(10);
  });
});
