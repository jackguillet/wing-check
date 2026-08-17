import { describe, it, expect } from "vitest";
import { comparePhrase, dayBiasPhrase } from "../observation-copy";

describe("comparePhrase", () => {
  it("says matching when the delta rounds to zero", () => {
    expect(comparePhrase(0.4, "kt")).toMatch(/Matching/);
  });

  it("uses windier / lighter in plain language", () => {
    expect(comparePhrase(3.2, "kt")).toBe(
      "Airport is 3 kt windier than the forecast",
    );
    expect(comparePhrase(-5, "mph")).toBe(
      "Airport is 5 mph lighter than the forecast",
    );
  });
});

describe("dayBiasPhrase", () => {
  it("treats a 1 kt mean as close", () => {
    expect(dayBiasPhrase(0.8, 13)).toMatch(/close/);
  });

  it("states a lasting high or low bias", () => {
    expect(dayBiasPhrase(2.4, 13)).toMatch(/2 kt windier/);
    expect(dayBiasPhrase(-4, 8)).toMatch(/4 kt lighter/);
  });
});
