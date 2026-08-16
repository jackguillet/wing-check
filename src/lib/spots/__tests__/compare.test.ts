import { describe, it, expect } from "vitest";
import { parseCompareSlugs, compareHref } from "../compare";

describe("parseCompareSlugs", () => {
  it("keeps order and caps at three unique slugs", () => {
    expect(
      parseCompareSlugs("orient-bay,south-padre-island,orient-bay,kanaha"),
    ).toEqual(["orient-bay", "south-padre-island", "kanaha"]);
  });

  it("accepts repeated query values", () => {
    expect(parseCompareSlugs(["orient-bay", "kanaha"])).toEqual([
      "orient-bay",
      "kanaha",
    ]);
  });

  it("returns empty for blank input", () => {
    expect(parseCompareSlugs(undefined)).toEqual([]);
    expect(parseCompareSlugs("  ,  ")).toEqual([]);
  });
});

describe("compareHref", () => {
  it("builds a bookmarkable query", () => {
    expect(compareHref(["Orient-Bay", "kanaha"])).toBe(
      "/compare?spots=orient-bay,kanaha",
    );
  });
});
