export const COMPASS_POINTS = [
  { label: "N", deg: 0 },
  { label: "NNE", deg: 22.5 },
  { label: "NE", deg: 45 },
  { label: "ENE", deg: 67.5 },
  { label: "E", deg: 90 },
  { label: "ESE", deg: 112.5 },
  { label: "SE", deg: 135 },
  { label: "SSE", deg: 157.5 },
  { label: "S", deg: 180 },
  { label: "SSW", deg: 202.5 },
  { label: "SW", deg: 225 },
  { label: "WSW", deg: 247.5 },
  { label: "W", deg: 270 },
  { label: "WNW", deg: 292.5 },
  { label: "NW", deg: 315 },
  { label: "NNW", deg: 337.5 },
] as const;

export function snapToCompass(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index].deg;
}

/**
 * Parse stored preferred directions. Accepts a JSON number array
 * or a comma/space-separated list. Invalid input yields [].
 */
export function parsePreferredDirections(
  raw: string | null | undefined,
): number[] {
  if (raw == null) return [];
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "[]") return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => Number(value))
        .filter((n) => Number.isFinite(n));
    }
  } catch {
    // fall through to comma-separated
  }

  return trimmed
    .split(/[,\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
}

export function serializePreferredDirections(degrees: number[]): string {
  const unique = [...new Set(degrees.map(snapToCompass))].sort((a, b) => a - b);
  return JSON.stringify(unique);
}

export function directionsFromStored(raw: string | null | undefined): number[] {
  return [
    ...new Set(parsePreferredDirections(raw).map(snapToCompass)),
  ].sort((a, b) => a - b);
}

export function isValidDirectionList(raw: string | null | undefined): boolean {
  if (raw == null || raw.trim() === "" || raw.trim() === "[]") return true;
  const parsed = parsePreferredDirections(raw);
  if (parsed.length === 0) return false;
  return parsed.every((n) => n >= 0 && n < 360);
}
