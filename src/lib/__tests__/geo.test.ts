import { describe, it, expect } from "vitest";
import {
  bboxFromRadiusKm,
  mapboxStaticSatelliteUrl,
  haversineDistance,
} from "../geo";

describe("bboxFromRadiusKm", () => {
  it("is centered on the pin and larger than the raw radius", () => {
    const box = bboxFromRadiusKm(21.4, -157.8, 3);
    expect(box.minLat).toBeLessThan(21.4);
    expect(box.maxLat).toBeGreaterThan(21.4);
    expect(box.minLon).toBeLessThan(-157.8);
    expect(box.maxLon).toBeGreaterThan(-157.8);
    const heightKm = (box.maxLat - box.minLat) * 111.32;
    expect(heightKm).toBeGreaterThan(6);
    expect(heightKm).toBeLessThan(9);
  });

  it("widens a bigger area", () => {
    const small = bboxFromRadiusKm(37.8, -122.5, 1);
    const wide = bboxFromRadiusKm(37.8, -122.5, 6);
    expect(wide.maxLon - wide.minLon).toBeGreaterThan(small.maxLon - small.minLon);
  });
});

describe("mapboxStaticSatelliteUrl", () => {
  it("uses a bbox instead of a fixed zoom", () => {
    const url = mapboxStaticSatelliteUrl("tok", 21.4, -157.8, 2);
    expect(url).toContain("satellite-v9/static/[");
    expect(url).not.toContain(",12,0,0/");
    expect(url).toContain("access_token=tok");
  });
});

describe("haversineDistance", () => {
  it("is ~0 for the same point", () => {
    expect(haversineDistance(10, 20, 10, 20)).toBeCloseTo(0, 5);
  });
});
