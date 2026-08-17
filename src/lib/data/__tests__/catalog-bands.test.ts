import { describe, it, expect } from "vitest";
import { CATALOG_BANDS, TOP_SPOTS } from "../top-spots";

describe("catalog bands", () => {
  it("gives Kanaha a light-trade 10–22 window, not 10–30", () => {
    const kanaha = TOP_SPOTS.find((s) => s.name === "Kanaha Beach");
    expect(kanaha?.alertCriteria?.minWindSpeed).toBe(
      CATALOG_BANDS.lightTrade.minWindSpeed,
    );
    expect(kanaha?.alertCriteria?.maxWindSpeed).toBe(
      CATALOG_BANDS.lightTrade.maxWindSpeed,
    );
  });

  it("gives Hood River a gorge band that treats 12 kt as light, not a hard miss", () => {
    const hood = TOP_SPOTS.find((s) => s.name === "Hood River");
    expect(hood?.alertCriteria?.minWindSpeed).toBe(CATALOG_BANDS.gorge.minWindSpeed);
    expect(hood?.alertCriteria?.minWindSpeed).toBe(14);
    expect(hood?.alertCriteria?.maxWindSpeed).toBe(35);
  });

  it("sets an explicit min and max on every catalog pin", () => {
    for (const spot of TOP_SPOTS) {
      expect(spot.alertCriteria?.minWindSpeed, spot.name).toBeGreaterThan(0);
      expect(spot.alertCriteria?.maxWindSpeed, spot.name).toBeGreaterThan(
        spot.alertCriteria?.minWindSpeed ?? 0,
      );
    }
  });
});
