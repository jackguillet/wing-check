import { describe, it, expect } from "vitest";
import {
  resolveCriteria,
  asAlertCriteria,
  windProfileFromPrefs,
  criteriaSource,
  criteriaSourceLabel,
  criteriaKitLabel,
  kitsMatch,
} from "../criteria";
import { defaultCriteria } from "../alerts/evaluator";

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
const kit = {
  ...defaultCriteria,
  minWindSpeed: 14,
  maxWindSpeed: 22,
  preferredDirections: "[90]",
};

describe("resolveCriteria", () => {

  it("prefers a per-spot override", () => {
    const resolved = resolveCriteria(7, user, kit, spot);
    expect(resolved.spotId).toBe(7);
    expect(resolved.minWindSpeed).toBe(18);
    expect(resolved.preferredDirections).toBe("[45]");
  });

  it("uses the rider's default kit when there is no override", () => {
    const resolved = resolveCriteria(7, null, kit, spot);
    expect(resolved.minWindSpeed).toBe(14);
    expect(resolved.maxWindSpeed).toBe(22);
    expect(resolved.preferredDirections).toBe("[90]");
  });

  it("falls back to the spot default", () => {
    const resolved = resolveCriteria(7, null, null, spot);
    expect(resolved.minWindSpeed).toBe(12);
    expect(resolved.maxWindSpeed).toBe(28);
  });

  it("falls back to app defaults", () => {
    const resolved = resolveCriteria(7, null, null, null);
    expect(resolved.minWindSpeed).toBe(defaultCriteria.minWindSpeed);
    expect(resolved.maxWindSpeed).toBe(defaultCriteria.maxWindSpeed);
  });
});

describe("criteriaSource", () => {
  it("names the layer that won", () => {
    expect(criteriaSource(user, kit, spot)).toBe("spot-override");
    expect(criteriaSource(null, kit, spot)).toBe("user-default");
    expect(criteriaSource(null, null, spot)).toBe("catalog");
    expect(criteriaSource(null, null, null)).toBe("app");
  });

  it("has a readable label for each layer", () => {
    expect(criteriaSourceLabel("spot-override")).toMatch(/custom window/i);
    expect(criteriaSourceLabel("user-default")).toMatch(/default kit/i);
    expect(criteriaSourceLabel("catalog")).toMatch(/catalog/i);
  });
});

describe("windProfileFromPrefs", () => {
  it("returns null until min and max are set", () => {
    expect(
      windProfileFromPrefs({
        minWindSpeed: null,
        maxWindSpeed: null,
        maxGustFactor: null,
        preferredDirections: null,
        directionTolerance: null,
        minConsecutiveHours: null,
        maxWaveHeight: null,
      }),
    ).toBeNull();
  });

  it("builds a kit from saved preference columns", () => {
    const kit = windProfileFromPrefs({
      minWindSpeed: 16,
      maxWindSpeed: 28,
      maxGustFactor: null,
      preferredDirections: "[270]",
      directionTolerance: null,
      minConsecutiveHours: null,
      maxWaveHeight: 2,
    });
    expect(kit?.minWindSpeed).toBe(16);
    expect(kit?.preferredDirections).toBe("[270]");
    expect(kit?.maxGustFactor).toBe(defaultCriteria.maxGustFactor);
    expect(kit?.maxWaveHeight).toBe(2);
  });
});

describe("criteriaKitLabel", () => {
  const band = { minWindSpeed: 12, maxWindSpeed: 22 };

  it("names the active preset on the user-default layer", () => {
    expect(criteriaKitLabel("user-default", band, "Lake")).toBe(
      "Lake · 12–22 kt",
    );
  });

  it("falls back when no preset is active", () => {
    expect(criteriaKitLabel("user-default", band, null)).toBe(
      "Your default kit · 12–22 kt",
    );
  });

  it("does not use the preset name on a spot override", () => {
    expect(criteriaKitLabel("spot-override", band, "Lake")).toBe(
      "Custom window · 12–22 kt",
    );
  });
});

describe("kitsMatch", () => {
  const lake = {
    ...defaultCriteria,
    minWindSpeed: 12,
    maxWindSpeed: 22,
    maxWaveHeight: 1.5,
  };

  it("is true for identical wind fields", () => {
    expect(kitsMatch(lake, { ...lake })).toBe(true);
  });

  it("is false when the band changes", () => {
    expect(kitsMatch(lake, { ...lake, maxWindSpeed: 30 })).toBe(false);
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
