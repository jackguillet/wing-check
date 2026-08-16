import { z } from "zod";
import { haversineDistance } from "@/lib/geo";
import { logger } from "@/lib/logger";

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

export function pickNearestMetar(
  rows: {
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
  }[],
  lat: number,
  lon: number,
  maxKm = HONEST_METAR_MAX_KM,
): MetarObservation | null {
  let best: MetarObservation | null = null;
  for (const row of rows) {
    const km = haversineDistance(lat, lon, row.lat, row.lon);
    if (km > maxKm) continue;
    if (best && km >= best.km) continue;
    const dir =
      typeof row.wdir === "number"
        ? row.wdir
        : typeof row.wdir === "string" && /^\d+$/.test(row.wdir)
          ? Number(row.wdir)
          : null;
    best = {
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
  return best;
}

export async function fetchNearestMetar(
  lat: number,
  lon: number,
): Promise<MetarObservation | null> {
  const box = bboxAround(lat, lon, HONEST_METAR_MAX_KM);
  const bbox = `${box.minLat.toFixed(3)},${box.minLon.toFixed(3)},${box.maxLat.toFixed(3)},${box.maxLon.toFixed(3)}`;
  const url = `https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json&hours=2`;
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
    const rows = z.array(MetarRowSchema).safeParse(json);
    if (!rows.success) return null;
    return pickNearestMetar(rows.data, lat, lon);
  } catch (err) {
    logger.warn({ err, lat, lon }, "METAR fetch failed");
    return null;
  }
}
