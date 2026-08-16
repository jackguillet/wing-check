export const WIND_SPEED_UNITS = ["knots", "mph", "kmh", "ms"] as const;
export const TEMPERATURE_UNITS = ["celsius", "fahrenheit"] as const;

export type WindSpeedUnit = (typeof WIND_SPEED_UNITS)[number];
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

export interface DisplayUnits {
  windSpeedUnit: WindSpeedUnit;
  temperatureUnit: TemperatureUnit;
}

export const DEFAULT_UNITS: DisplayUnits = {
  windSpeedUnit: "knots",
  temperatureUnit: "celsius",
};

const KNOTS_TO: Record<WindSpeedUnit, number> = {
  knots: 1,
  mph: 1.150779,
  kmh: 1.852,
  ms: 0.514444,
};

export function isWindSpeedUnit(value: string): value is WindSpeedUnit {
  return (WIND_SPEED_UNITS as readonly string[]).includes(value);
}

export function isTemperatureUnit(value: string): value is TemperatureUnit {
  return (TEMPERATURE_UNITS as readonly string[]).includes(value);
}

export function parseDisplayUnits(
  wind: string | null | undefined,
  temp: string | null | undefined,
): DisplayUnits {
  return {
    windSpeedUnit: wind && isWindSpeedUnit(wind) ? wind : "knots",
    temperatureUnit: temp && isTemperatureUnit(temp) ? temp : "celsius",
  };
}

export function fromKnots(knots: number, unit: WindSpeedUnit): number {
  return knots * KNOTS_TO[unit];
}

export function toKnots(value: number, unit: WindSpeedUnit): number {
  return value / KNOTS_TO[unit];
}

export function fromCelsius(celsius: number, unit: TemperatureUnit): number {
  return unit === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius;
}

export function windUnitLabel(unit: WindSpeedUnit): string {
  switch (unit) {
    case "knots":
      return "kt";
    case "mph":
      return "mph";
    case "kmh":
      return "km/h";
    case "ms":
      return "m/s";
  }
}

export function tempUnitLabel(unit: TemperatureUnit): string {
  return unit === "fahrenheit" ? "°F" : "°C";
}

export function formatWind(
  knots: number,
  unit: WindSpeedUnit,
  digits = 1,
): string {
  return `${fromKnots(knots, unit).toFixed(digits)} ${windUnitLabel(unit)}`;
}

export function formatTemp(celsius: number, unit: TemperatureUnit): string {
  return `${Math.round(fromCelsius(celsius, unit))}${tempUnitLabel(unit)}`;
}

export function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Convert form wind fields from the user's display unit into knots. */
export function formWindsToKnots(
  fields: Record<string, string>,
  unit: WindSpeedUnit,
): Record<string, string> {
  const next = { ...fields };
  for (const key of ["minWindSpeed", "maxWindSpeed"]) {
    if (next[key] == null || next[key] === "") continue;
    const n = Number(next[key]);
    if (!Number.isFinite(n)) continue;
    next[key] = String(roundTo(toKnots(n, unit), 2));
  }
  return next;
}
