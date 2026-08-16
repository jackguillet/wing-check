import { describe, it, expect } from "vitest";
import {
  DEFAULT_RIDER_WEIGHT_KG,
  bandForWing,
  resolveQuiver,
  quiverEnvelope,
  quiverForScoring,
  criteriaWithQuiverEnvelope,
  formatWingSize,
  formatQuiverLabel,
  lbsToKg,
  kgToLbs,
  dominantWing,
  sweetSpotKt,
  missingQuiver,
  idealWingSize,
  relevantMissingWings,
  quiverPair,
} from "../wings";
import { defaultCriteria } from "../alerts/evaluator";

describe("bandForWing", () => {
  it("puts an 80 kg rider's 5m around 12–22 kt", () => {
    const band = bandForWing(5, 80);
    expect(band.sizeM2).toBe(5);
    expect(band.minWindSpeed).toBe(12);
    expect(band.maxWindSpeed).toBe(22.5);
  });

  it("gives a 6m a lighter band than a 4m", () => {
    const six = bandForWing(6, 80);
    const four = bandForWing(4, 80);
    expect(six.minWindSpeed).toBeLessThan(four.minWindSpeed);
    expect(six.maxWindSpeed).toBeLessThan(four.maxWindSpeed);
    expect(six.maxWindSpeed).toBeGreaterThan(four.minWindSpeed);
  });

  it("uses the default weight when none is saved", () => {
    expect(bandForWing(5, null)).toEqual(bandForWing(5, DEFAULT_RIDER_WEIGHT_KG));
  });

  it("shifts the band up for a heavier rider", () => {
    const light = bandForWing(5, 70);
    const heavy = bandForWing(5, 95);
    expect(heavy.minWindSpeed).toBeGreaterThan(light.minWindSpeed);
    expect(heavy.maxWindSpeed).toBeGreaterThan(light.maxWindSpeed);
  });
});

describe("sweetSpotKt", () => {
  it("is weight / size", () => {
    expect(sweetSpotKt(5, 80)).toBe(16);
    expect(sweetSpotKt(4, 80)).toBe(20);
  });
});

describe("resolveQuiver", () => {
  it("sorts largest first and computes bands", () => {
    const quiver = resolveQuiver([4.2, 6, 5], 80);
    expect(quiver.map((w) => w.sizeM2)).toEqual([6, 5, 4.2]);
    expect(quiver[0].minWindSpeed).toBeLessThan(quiver[2].minWindSpeed);
  });
});

describe("quiverEnvelope", () => {
  it("returns the union of the bands", () => {
    const env = quiverEnvelope(resolveQuiver([6, 4], 80));
    expect(env?.minWindSpeed).toBe(bandForWing(6, 80).minWindSpeed);
    expect(env?.maxWindSpeed).toBe(bandForWing(4, 80).maxWindSpeed);
  });

  it("is null for an empty quiver", () => {
    expect(quiverEnvelope([])).toBeNull();
  });
});

describe("quiverPair", () => {
  it("returns owned bands plus missing catalog sizes", () => {
    const { quiver, missing } = quiverPair("user-default", [5], 80);
    expect(quiver?.map((w) => w.sizeM2)).toEqual([5]);
    expect(missing?.some((w) => w.sizeM2 === 7)).toBe(true);
    expect(missing?.some((w) => w.sizeM2 === 5)).toBe(false);
  });

  it("is null on a spot override", () => {
    expect(quiverPair("spot-override", [5], 80)).toEqual({
      quiver: null,
      missing: null,
    });
  });
});

describe("quiverForScoring", () => {
  const quiver = resolveQuiver([6, 5], 80);

  it("skips the quiver on a spot override", () => {
    expect(quiverForScoring("spot-override", quiver)).toBeNull();
  });

  it("uses the quiver on the rider default kit", () => {
    expect(quiverForScoring("user-default", quiver)).toEqual(quiver);
  });

  it("is null when the rider has no wings", () => {
    expect(quiverForScoring("user-default", [])).toBeNull();
  });
});

describe("criteriaWithQuiverEnvelope", () => {
  it("widens min/max to the quiver union", () => {
    const quiver = resolveQuiver([6, 4], 80);
    const next = criteriaWithQuiverEnvelope(
      { id: 0, spotId: 1, ...defaultCriteria, minWindSpeed: 16, maxWindSpeed: 22 },
      quiver,
    );
    expect(next.minWindSpeed).toBe(bandForWing(6, 80).minWindSpeed);
    expect(next.maxWindSpeed).toBe(bandForWing(4, 80).maxWindSpeed);
    expect(next.maxGustFactor).toBe(defaultCriteria.maxGustFactor);
  });
});

describe("formatWingSize", () => {
  it("drops .0 on whole metres", () => {
    expect(formatWingSize(6)).toBe("6m");
    expect(formatWingSize(4.2)).toBe("4.2m");
  });
});

describe("formatQuiverLabel", () => {
  it("lists sizes largest first", () => {
    expect(formatQuiverLabel([4.2, 6, 5])).toBe("6 / 5 / 4.2m");
  });
});

describe("weight conversion", () => {
  it("round-trips pounds and kilos", () => {
    expect(kgToLbs(80)).toBeCloseTo(176.4, 1);
    expect(lbsToKg(176.37)).toBeCloseTo(80, 1);
  });
});

describe("missingQuiver", () => {
  it("drops sizes the rider already owns", () => {
    const missing = missingQuiver([6, 5], 80);
    expect(missing.map((w) => w.sizeM2)).not.toContain(6);
    expect(missing.map((w) => w.sizeM2)).not.toContain(5);
    expect(missing.map((w) => w.sizeM2)).toContain(7);
    expect(missing.map((w) => w.sizeM2)).toContain(4);
  });

  it("treats 5.2 as covering the 5.0 common size", () => {
    expect(missingQuiver([5.2], 80).map((w) => w.sizeM2)).not.toContain(5);
  });
});

describe("idealWingSize", () => {
  it("snaps an 80 kg rider at 12 kt toward a 6.5–7m", () => {
    const size = idealWingSize(12, 80);
    expect(size).toBeGreaterThanOrEqual(6.5);
    expect(size).toBeLessThanOrEqual(7);
  });

  it("snaps 22 kt toward a 3.5–4.2m", () => {
    const size = idealWingSize(22, 80);
    expect(size).toBeGreaterThanOrEqual(3.5);
    expect(size).toBeLessThanOrEqual(4.2);
  });
});

describe("relevantMissingWings", () => {
  const owned = [bandForWing(5, 80)];
  const missing = missingQuiver([5], 80);

  it("only suggests larger wings when the wind is below the quiver", () => {
    const light = relevantMissingWings(9, owned, missing);
    expect(light.every((w) => w.sizeM2 > 5)).toBe(true);
  });

  it("only suggests smaller wings when the wind is above the quiver", () => {
    const nuke = relevantMissingWings(30, owned, missing);
    expect(nuke.every((w) => w.sizeM2 < 5)).toBe(true);
  });
});

describe("dominantWing", () => {
  it("picks the most common size and the larger on a tie", () => {
    expect(dominantWing([6, 6, 5])).toBe(6);
    expect(dominantWing([6, 5])).toBe(6);
    expect(dominantWing([null, undefined])).toBeNull();
  });
});
