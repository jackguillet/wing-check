interface NOAAStation {
  id: string;
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
    (s: { id: string; lat: number; lng: number }) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
    })
  );

  cachedStations = stations;
  return stations;
}

export async function findNearestStation(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const stations = await fetchStations();
    if (stations.length === 0) return null;

    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const s of stations) {
      const d = haversineKm(lat, lng, s.lat, s.lng);
      if (d < bestDist) {
        bestDist = d;
        bestId = s.id;
      }
    }

    return bestDist <= MAX_DISTANCE_KM ? bestId : null;
  } catch {
    return null;
  }
}
