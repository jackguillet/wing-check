import { describe, it, expect } from "vitest";
import { bboxAround, pickNearestMetar, HONEST_METAR_MAX_KM } from "../metar";

describe("bboxAround", () => {
  it("is roughly square in degrees near the equator", () => {
    const box = bboxAround(0, 0, 40);
    expect(box.maxLat - box.minLat).toBeCloseTo(80 / 111, 2);
    expect(box.maxLon - box.minLon).toBeCloseTo(80 / 111, 2);
  });
});

describe("pickNearestMetar", () => {
  const ksfo = {
    icaoId: "KSFO",
    name: "San Francisco Intl",
    lat: 37.62,
    lon: -122.37,
    obsTime: 1_786_913_760,
    wspd: 15,
    wdir: 310,
    wgst: null,
    temp: 20,
    rawOb: "METAR KSFO",
  };
  const koak = {
    icaoId: "KOAK",
    name: "Oakland",
    lat: 37.72,
    lon: -122.22,
    obsTime: 1_786_913_760,
    wspd: 8,
    wdir: "270",
    wgst: 12,
    temp: 19,
  };

  it("picks the closer airport inside the honest radius", () => {
    const picked = pickNearestMetar([ksfo, koak], 37.8, -122.47);
    expect(picked?.icaoId).toBe("KSFO");
    expect(picked?.km).toBeLessThan(HONEST_METAR_MAX_KM);
    expect(picked?.windKt).toBe(15);
    expect(picked?.windDir).toBe(310);
  });

  it("returns null when every station is too far", () => {
    expect(pickNearestMetar([ksfo], 18.1, -63.03)).toBeNull();
  });

  it("parses numeric direction strings", () => {
    const picked = pickNearestMetar([koak], 37.72, -122.22);
    expect(picked?.windDir).toBe(270);
  });
});
