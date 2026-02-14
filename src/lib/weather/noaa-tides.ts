import { NOAATidePredictionSchema, type TidePoint } from "./types";

const NOAA_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

export async function fetchTidePredictions(
  stationId: string,
  beginDate: string,
  endDate: string
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
    interval: "hilo",
  });

  try {
    const res = await fetch(`${NOAA_BASE}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const parsed = NOAATidePredictionSchema.parse(data);
    return parsed.predictions.map((p) => ({
      time: p.t,
      height: parseFloat(p.v),
      type: p.type as "H" | "L" | undefined,
    }));
  } catch {
    return [];
  }
}
