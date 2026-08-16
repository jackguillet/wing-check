import { describe, it, expect } from "vitest";
import type { ForecastHour } from "../types";
import {
  bboxAround,
  pickNearestMetar,
  pickNearestRecentMetar,
  historyForStation,
  collapseMetarToHours,
  metarHourDeltas,
  meanWindBiasKt,
  HONEST_METAR_MAX_KM,
  MIN_BIAS_SAMPLES,
} from "../metar";
import type { MetarObservation } from "../metar";

function hour(time: string, windSpeed: number): ForecastHour {
  return {
    time,
    temperature: 18,
    windSpeed,
    windDirection: 270,
    windGusts: windSpeed + 4,
    weatherCode: 1,
    waveHeight: null,
    waveDirection: null,
    wavePeriod: null,
    swellHeight: null,
    swellDirection: null,
    swellPeriod: null,
    pressureMsl: 1013,
    precipitation: 0,
    cloudCover: 20,
    visibility: 10000,
  };
}

function obs(
  overrides: Partial<MetarObservation> & { observedAtUnix: number },
): MetarObservation {
  return {
    icaoId: "KSFO",
    name: "San Francisco Intl",
    km: 22,
    windKt: 15,
    gustKt: null,
    windDir: 310,
    tempC: 18,
    raw: null,
    ...overrides,
  };
}

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

describe("bboxAround", () => {
  it("is roughly square in degrees near the equator", () => {
    const box = bboxAround(0, 0, 40);
    expect(box.maxLat - box.minLat).toBeCloseTo(80 / 111, 2);
    expect(box.maxLon - box.minLon).toBeCloseTo(80 / 111, 2);
  });
});

describe("pickNearestMetar", () => {
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

describe("pickNearestRecentMetar", () => {
  it("ignores a closer station whose only report is stale", () => {
    const now = 1_786_913_760;
    const staleCloser = {
      ...ksfo,
      obsTime: now - 20 * 3600,
    };
    const recentFarther = {
      ...koak,
      obsTime: now - 600,
    };
    const picked = pickNearestRecentMetar(
      [staleCloser, recentFarther],
      37.8,
      -122.47,
      now,
    );
    expect(picked?.icaoId).toBe("KOAK");
  });
});

describe("historyForStation", () => {
  it("keeps only that ICAO, oldest first", () => {
    const rows = [
      { ...koak, obsTime: 20 },
      { ...ksfo, obsTime: 30 },
      { ...ksfo, obsTime: 10 },
    ];
    const history = historyForStation(rows, "KSFO", 22);
    expect(history.map((r) => r.observedAtUnix)).toEqual([10, 30]);
  });
});

describe("collapseMetarToHours", () => {
  it("keeps the latest report in each spot-local hour", () => {
    const offset = -7 * 3600;
    const t12 = Date.UTC(2026, 7, 16, 19, 10) / 1000;
    const t12b = Date.UTC(2026, 7, 16, 19, 50) / 1000;
    const t13 = Date.UTC(2026, 7, 16, 20, 5) / 1000;
    const collapsed = collapseMetarToHours(
      [
        obs({ observedAtUnix: t12, windKt: 10 }),
        obs({ observedAtUnix: t12b, windKt: 14 }),
        obs({ observedAtUnix: t13, windKt: 16 }),
      ],
      offset,
    );
    expect(collapsed.map((r) => r.windKt)).toEqual([14, 16]);
  });
});

describe("metarHourDeltas", () => {
  it("pairs collapsed obs with the matching model hour", () => {
    const offset = 0;
    const t = Date.UTC(2026, 7, 16, 12, 20) / 1000;
    const deltas = metarHourDeltas(
      [obs({ observedAtUnix: t, windKt: 18 })],
      [hour("2026-08-16T12:00", 12), hour("2026-08-16T13:00", 20)],
      offset,
    );
    expect(deltas).toHaveLength(1);
    expect(deltas[0].civilHour).toBe("2026-08-16T12:00");
    expect(deltas[0].obsKt).toBe(18);
    expect(deltas[0].modelKt).toBe(12);
    expect(deltas[0].deltaKt).toBe(6);
  });
});

describe("meanWindBiasKt", () => {
  it("returns null until there are enough paired hours", () => {
    expect(meanWindBiasKt([2, 4])).toBeNull();
    expect(MIN_BIAS_SAMPLES).toBe(3);
  });

  it("averages signed obs-minus-model deltas", () => {
    expect(meanWindBiasKt([4, 2, 6, null])).toEqual({ n: 3, meanKt: 4 });
  });
});
