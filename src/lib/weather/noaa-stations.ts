export const HONEST_TIDE_MAX_KM = 80;

interface NOAAStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

let cachedStations: NOAAStation[] | null = null;

const MAX_DISTANCE_KM = 150;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchStations(): Promise<NOAAStation[]> {
  if (cachedStations) return cachedStations;

  const res = await fetch(
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions"
  );
  if (!res.ok) return [];

  const json = await res.json();
  const stations: NOAAStation[] = (json.stations ?? []).map(
    (s: { id: string; name?: string; lat: number; lng: number }) => ({
      id: s.id,
      name: s.name ?? s.id,
      lat: s.lat,
      lng: s.lng,
    })
  );

  cachedStations = stations;
  return stations;
}

export async function validateStation(stationId: string): Promise<boolean> {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const params = new URLSearchParams({
    begin_date: fmt(today),
    end_date: fmt(today),
    station: stationId,
    product: "predictions",
    datum: "MLLW",
    units: "metric",
    time_zone: "lst_ldt",
    application: "wing-check",
    format: "json",
    interval: "h",
  });
  try {
    const res = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data?.predictions) && data.predictions.length > 0;
  } catch {
    return false;
  }
}

export async function findNearestStation(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const stations = await fetchStations();
    if (stations.length === 0) return null;

    const candidates = stations
      .map((s) => ({ id: s.id, dist: haversineKm(lat, lng, s.lat, s.lng) }))
      .filter((c) => c.dist <= MAX_DISTANCE_KM)
      .sort((a, b) => a.dist - b.dist);

    for (const c of candidates) {
      if (await validateStation(c.id)) return c.id;
    }

    return null;
  } catch {
    return null;
  }
}

export async function getTideStationInfo(
  stationId: string,
  lat: number,
  lng: number,
): Promise<{ id: string; name: string; km: number } | null> {
  try {
    const stations = await fetchStations();
    const station = stations.find((s) => s.id === stationId);
    if (!station) return { id: stationId, name: stationId, km: Number.NaN };
    const km = Math.round(haversineKm(lat, lng, station.lat, station.lng) * 10) / 10;
    return { id: station.id, name: station.name, km };
  } catch {
    return { id: stationId, name: stationId, km: Number.NaN };
  }
}
