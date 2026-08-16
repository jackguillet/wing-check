import { describe, it, expect } from "vitest";
import {
  fromKnots,
  toKnots,
  fromCelsius,
  formatWind,
  formatTemp,
  parseDisplayUnits,
  windUnitLabel,
  formWindsToKnots,
} from "../units";

describe("wind conversion", () => {
  it("round-trips knots through each unit", () => {
    for (const unit of ["knots", "mph", "kmh", "ms"] as const) {
      const display = fromKnots(20, unit);
      expect(toKnots(display, unit)).toBeCloseTo(20, 6);
    }
  });

  it("converts 10 kt to expected display values", () => {
    expect(fromKnots(10, "knots")).toBe(10);
    expect(fromKnots(10, "mph")).toBeCloseTo(11.5, 1);
    expect(fromKnots(10, "kmh")).toBeCloseTo(18.5, 1);
    expect(fromKnots(10, "ms")).toBeCloseTo(5.1, 1);
  });

  it("formats with the short label", () => {
    expect(formatWind(20, "knots")).toBe("20.0 kt");
    expect(formatWind(10, "kmh", 0)).toBe("19 km/h");
    expect(windUnitLabel("ms")).toBe("m/s");
  });
});

describe("temperature conversion", () => {
  it("leaves celsius unchanged and converts fahrenheit", () => {
    expect(fromCelsius(20, "celsius")).toBe(20);
    expect(fromCelsius(20, "fahrenheit")).toBe(68);
    expect(formatTemp(0, "fahrenheit")).toBe("32°F");
    expect(formatTemp(18, "celsius")).toBe("18°C");
  });
});

describe("formWindsToKnots", () => {
  it("converts display mph back to knots", () => {
    const result = formWindsToKnots(
      { minWindSpeed: "11.5", maxWindSpeed: "28.8", name: "keep" },
      "mph",
    );
    expect(Number(result.minWindSpeed)).toBeCloseTo(10, 1);
    expect(Number(result.maxWindSpeed)).toBeCloseTo(25, 1);
    expect(result.name).toBe("keep");
  });
});

describe("parseDisplayUnits", () => {
  it("falls back to knots/celsius for junk", () => {
    expect(parseDisplayUnits("nope", "also-nope")).toEqual({
      windSpeedUnit: "knots",
      temperatureUnit: "celsius",
    });
    expect(parseDisplayUnits("mph", "fahrenheit")).toEqual({
      windSpeedUnit: "mph",
      temperatureUnit: "fahrenheit",
    });
  });
});
