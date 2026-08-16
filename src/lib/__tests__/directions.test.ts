import { describe, it, expect } from "vitest";
import {
  parsePreferredDirections,
  serializePreferredDirections,
  directionsFromStored,
  isValidDirectionList,
  snapToCompass,
} from "../directions";

describe("parsePreferredDirections", () => {
  it("parses a JSON number array", () => {
    expect(parsePreferredDirections("[270, 290]")).toEqual([270, 290]);
  });

  it("parses comma-separated values", () => {
    expect(parsePreferredDirections("270,290")).toEqual([270, 290]);
  });

  it("returns empty for [] or blank", () => {
    expect(parsePreferredDirections("[]")).toEqual([]);
    expect(parsePreferredDirections("")).toEqual([]);
    expect(parsePreferredDirections(null)).toEqual([]);
  });

  it("returns empty for invalid JSON that is not numeric", () => {
    expect(parsePreferredDirections("not-json")).toEqual([]);
    expect(parsePreferredDirections("{bad")).toEqual([]);
  });
});

describe("isValidDirectionList", () => {
  it("accepts empty and valid lists", () => {
    expect(isValidDirectionList("[]")).toBe(true);
    expect(isValidDirectionList("[270, 315]")).toBe(true);
    expect(isValidDirectionList("270, 315")).toBe(true);
  });

  it("rejects garbage and out-of-range values", () => {
    expect(isValidDirectionList("west")).toBe(false);
    expect(isValidDirectionList("[400]")).toBe(false);
    expect(isValidDirectionList("[-10]")).toBe(false);
  });
});

describe("snapToCompass", () => {
  it("snaps to the nearest 16-point bearing", () => {
    expect(snapToCompass(270)).toBe(270);
    expect(snapToCompass(280)).toBe(270);
    expect(snapToCompass(290)).toBe(292.5);
  });
});

describe("directionsFromStored / serialize", () => {
  it("round-trips selected chips", () => {
    const stored = serializePreferredDirections([270, 315]);
    expect(directionsFromStored(stored)).toEqual([270, 315]);
  });
});
