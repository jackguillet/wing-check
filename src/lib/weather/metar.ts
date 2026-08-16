import { z } from "zod";
import { haversineDistance } from "@/lib/geo";
import { logger } from "@/lib/logger";
import { spotLocalNow } from "@/lib/weather/civil-time";
import { forecastHourAt } from "@/lib/weather/match-hour";
import type { ForecastHour } from "@/lib/weather/types";

export const HONEST_METAR_MAX_KM = 40;

const MetarRowSchema = z.object({
  icaoId: z.string(),
  name: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  obsTime: z.number(),
  temp: z.number().nullable().optional(),
  wdir: z.union([z.number(), z.string()]).nullable().optional(),
  wspd: z.number().nullable().optional(),
  wgst: z.number().nullable().optional(),
  rawOb: z.string().optional(),
});

export interface MetarObservation {
  icaoId: string;
  name: string;
  km: number;
  observedAtUnix: number;
  windKt: number | null;
  gustKt: number | null;
  windDir: number | null;
  tempC: number | null;
  raw: string | null;
}

export function bboxAround(
  lat: number,
  lon: number,
  km: number,
): { minLat: number; minLon: number; maxLat: number; maxLon: number } {
  const dLat = km / 111;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = km / (111 * Math.max(0.2, Math.abs(cos)));
  return {
    minLat: lat - dLat,
    minLon: lon - dLon,
    maxLat: lat + dLat,
    maxLon: lon + dLon,
  };
}

export type RawMetarRow = {
  icaoId: string;
  name?: string;
  lat: number;
  lon: number;
  obsTime: number;
  temp?: number | null;
  wdir?: number | string | null;
  wspd?: number | null;
  wgst?: number | null;
  rawOb?: string;
};

export const MIN_BIAS_SAMPLES = 3;
export const RECENT_METAR_SEC = 2 * 3600;

export function rowToObservation(
  row: RawMetarRow,
  km: number,
): MetarObservation {
  const dir =
    typeof row.wdir === "number"
      ? row.wdir
      : typeof row.wdir === "string" && /^\d+$/.test(row.wdir)
        ? Number(row.wdir)
        : null;
  return {
    icaoId: row.icaoId,
    name: row.name ?? row.icaoId,
    km: Math.round(km * 10) / 10,
    observedAtUnix: row.obsTime,
    windKt: row.wspd ?? null,
    gustKt: row.wgst ?? null,
    windDir: dir,
    tempC: row.temp ?? null,
    raw: row.rawOb ?? null,
  };
}

export function pickNearestMetar(
  rows: RawMetarRow[],
  lat: number,
  lon: number,
  maxKm = HONEST_METAR_MAX_KM,
): MetarObservation | null {
  let best: MetarObservation | null = null;
  for (const row of rows) {
    const km = haversineDistance(lat, lon, row.lat, row.lon);
    if (km > maxKm) continue;
    if (best && km >= best.km) continue;
    best = rowToObservation(row, km);
  }
  return best;
}

/** Prefer a station that reported recently so a 20h-old closer METAR does not win. */
export function pickNearestRecentMetar(
  rows: RawMetarRow[],
  lat: number,
  lon: number,
  nowUnix: number,
  recentWindowSec = RECENT_METAR_SEC,
  maxKm = HONEST_METAR_MAX_KM,
): MetarObservation | null {
  const recent = rows.filter((row) => row.obsTime >= nowUnix - recentWindowSec);
  return pickNearestMetar(recent.length > 0 ? recent : rows, lat, lon, maxKm);
}

export function historyForStation(
  rows: RawMetarRow[],
  icaoId: string,
  km: number,
): MetarObservation[] {
  return rows
    .filter((row) => row.icaoId === icaoId)
    .map((row) => rowToObservation(row, km))
    .sort((a, b) => a.observedAtUnix - b.observedAtUnix);
}

export function collapseMetarToHours(
  samples: MetarObservation[],
  utcOffsetSeconds: number,
): MetarObservation[] {
  const byHour = new Map<string, MetarObservation>();
  for (const sample of samples) {
    const civil = spotLocalNow(
      utcOffsetSeconds,
      new Date(sample.observedAtUnix * 1000),
    );
    const hour = `${civil.slice(0, 13)}:00`;
    const prev = byHour.get(hour);
    if (!prev || sample.observedAtUnix >= prev.observedAtUnix) {
      byHour.set(hour, sample);
    }
  }
  return [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, sample]) => sample);
}

export type MetarHourDelta = {
  civilHour: string;
  obsKt: number | null;
  modelKt: number | null;
  deltaKt: number | null;
};

export function metarHourDeltas(
  history: MetarObservation[],
  hours: ForecastHour[],
  utcOffsetSeconds: number,
): MetarHourDelta[] {
  return collapseMetarToHours(history, utcOffsetSeconds).map((obs) => {
    const civil = spotLocalNow(
      utcOffsetSeconds,
      new Date(obs.observedAtUnix * 1000),
    );
    const hour = `${civil.slice(0, 13)}:00`;
    const model = forecastHourAt(hours, civil);
    const obsKt = obs.windKt;
    const modelKt = model?.windSpeed ?? null;
    const deltaKt =
      obsKt != null && modelKt != null ? obsKt - modelKt : null;
    return { civilHour: hour, obsKt, modelKt, deltaKt };
  });
}

export function meanWindBiasKt(
  deltas: Array<number | null | undefined>,
): { n: number; meanKt: number } | null {
  const values = deltas.filter((d): d is number => typeof d === "number");
  if (values.length < MIN_BIAS_SAMPLES) return null;
  const mean = values.reduce((sum, d) => sum + d, 0) / values.length;
  return { n: values.length, meanKt: Math.round(mean * 10) / 10 };
}

export interface MetarSeries {
  latest: MetarObservation;
  history: MetarObservation[];
}

export async function fetchMetarSeries(
  lat: number,
  lon: number,
): Promise<MetarSeries | null> {
  const box = bboxAround(lat, lon, HONEST_METAR_MAX_KM);
  const bbox = `${box.minLat.toFixed(3)},${box.minLon.toFixed(3)},${box.maxLat.toFixed(3)},${box.maxLon.toFixed(3)}`;
  const url = `https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json&hours=24`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "wing-check (https://wing-check.vercel.app)",
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = z.array(MetarRowSchema).safeParse(json);
    if (!parsed.success) return null;
    const nowUnix = Math.floor(Date.now() / 1000);
    const nearest = pickNearestRecentMetar(parsed.data, lat, lon, nowUnix);
    if (!nearest) return null;
    const history = historyForStation(parsed.data, nearest.icaoId, nearest.km);
    const latest =
      history.reduce<MetarObservation | null>((best, row) => {
        if (!best || row.observedAtUnix >= best.observedAtUnix) return row;
        return best;
      }, null) ?? nearest;
    return { latest, history };
  } catch (err) {
    logger.warn({ err, lat, lon }, "METAR fetch failed");
    return null;
  }
}

export async function fetchNearestMetar(
  lat: number,
  lon: number,
): Promise<MetarObservation | null> {
  const series = await fetchMetarSeries(lat, lon);
  return series?.latest ?? null;
}
