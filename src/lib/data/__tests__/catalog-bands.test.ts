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

  it("sets an explicit min and max on every catalog pin", () => {
    for (const spot of TOP_SPOTS) {
      expect(spot.alertCriteria?.minWindSpeed, spot.name).toBeGreaterThan(0);
      expect(spot.alertCriteria?.maxWindSpeed, spot.name).toBeGreaterThan(
        spot.alertCriteria?.minWindSpeed ?? 0,
      );
    }
  });
});
