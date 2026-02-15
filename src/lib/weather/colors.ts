/** Wind speed color: red (too light) → green (sweet spot) → red (too strong) */
export function getWindColor(speed: number): string {
  if (speed < 6) return "#ef4444";
  if (speed < 10) return "#f97316";
  if (speed < 12) return "#eab308";
  if (speed < 15) return "#84cc16";
  if (speed <= 21) return "#22c55e";
  if (speed <= 24) return "#84cc16";
  if (speed <= 28) return "#eab308";
  if (speed <= 32) return "#f97316";
  return "#ef4444";
}

/** Gust spread color: green (steady) → red (gusty) */
export function getGustColor(windSpeed: number, gustSpeed: number): string {
  const spread = gustSpeed - windSpeed;
  if (spread < 5) return "#22c55e";
  if (spread < 8) return "#84cc16";
  if (spread < 12) return "#eab308";
  if (spread < 15) return "#f97316";
  return "#ef4444";
}
