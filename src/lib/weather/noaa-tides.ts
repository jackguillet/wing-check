import { NOAATidePredictionSchema, type TidePoint } from "./types";

const NOAA_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

async function fetchPredictions(
  stationId: string,
  beginDate: string,
  endDate: string,
  interval: "h" | "hilo",
): Promise<TidePoint[]> {
  const params = new URLSearchParams({
    begin_date: beginDate,
    end_date: endDate,
    station: stationId,
    product: "predictions",
    datum: "MLLW",
    units: "metric",
    time_zone: "lst_ldt",
    application: "wing-check",
    format: "json",
    interval,
  });
  const res = await fetch(`${NOAA_BASE}?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const parsed = NOAATidePredictionSchema.parse(data);
  return parsed.predictions.map((p) => ({
    time: p.t.replace(" ", "T"),
    height: parseFloat(p.v),
    type: p.type === "H" || p.type === "L" ? p.type : undefined,
  }));
}

export async function fetchTidePredictions(
  stationId: string,
  beginDate: string,
  endDate: string
): Promise<TidePoint[]> {
  try {
    const [hourly, hilo] = await Promise.all([
      fetchPredictions(stationId, beginDate, endDate, "h"),
      fetchPredictions(stationId, beginDate, endDate, "hilo"),
    ]);
    if (hourly.length === 0 && hilo.length === 0) return [];
    const byTime = new Map(hourly.map((p) => [p.time, { ...p }]));
    for (const extreme of hilo) {
      const existing = byTime.get(extreme.time);
      if (existing) {
        existing.type = extreme.type;
        existing.height = extreme.height;
      } else {
        byTime.set(extreme.time, extreme);
      }
    }
    return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}
