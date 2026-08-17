const R = 6371; // Earth radius in km

export const DEFAULT_MAP_RADIUS_KM = 3;
export const MIN_MAP_RADIUS_KM = 0.4;
export const MAX_MAP_RADIUS_KM = 12;
export const MAP_RADIUS_PRESETS = [
  { label: "Small", km: 1 },
  { label: "Typical", km: 3 },
  { label: "Wide", km: 6 },
] as const;

export interface GeoBBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** Bounding box for a circle, padded so the area is not flush to the image edge. */
export function bboxFromRadiusKm(
  lat: number,
  lon: number,
  radiusKm: number,
  pad = 1.2,
): GeoBBox {
  const r = Math.max(radiusKm, MIN_MAP_RADIUS_KM) * pad;
  const dLat = r / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = r / (111.32 * Math.max(Math.abs(cos), 0.05));
  return {
    minLon: clampLon(lon - dLon),
    minLat: clampLat(lat - dLat),
    maxLon: clampLon(lon + dLon),
    maxLat: clampLat(lat + dLat),
  };
}

function clampLat(n: number): number {
  return Math.max(-85, Math.min(85, n));
}

function clampLon(n: number): number {
  if (n > 180) return n - 360;
  if (n < -180) return n + 360;
  return n;
}

export function mapboxStaticSatelliteUrl(
  token: string,
  lat: number,
  lon: number,
  radiusKm: number,
  width = 600,
  height = 400,
): string {
  const box = bboxFromRadiusKm(lat, lon, radiusKm);
  const bbox = `[${box.minLon},${box.minLat},${box.maxLon},${box.maxLat}]`;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${bbox}/${width}x${height}@2x?access_token=${token}`;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
