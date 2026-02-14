import type { ForecastHour } from "./types";

export interface InterpolatedPoint {
  time: Date;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Circular interpolation — shortest arc across the 0°/360° boundary */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  const result = a + diff * t;
  return ((result % 360) + 360) % 360;
}

/**
 * Interpolate hourly forecast data into finer intervals.
 * Returns points at every `intervalMinutes` between the first and last hour.
 */
export function interpolateForecasts(
  hours: ForecastHour[],
  intervalMinutes: number,
): InterpolatedPoint[] {
  if (hours.length === 0) return [];
  if (hours.length === 1) {
    return [
      {
        time: new Date(hours[0].time),
        windSpeed: hours[0].windSpeed,
        windDirection: hours[0].windDirection,
        windGusts: hours[0].windGusts,
      },
    ];
  }

  const points: InterpolatedPoint[] = [];
  const intervalMs = intervalMinutes * 60_000;

  for (let i = 0; i < hours.length - 1; i++) {
    const startTime = new Date(hours[i].time).getTime();
    const endTime = new Date(hours[i + 1].time).getTime();
    const segmentMs = endTime - startTime;
    const steps = Math.round(segmentMs / intervalMs);

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push({
        time: new Date(startTime + s * intervalMs),
        windSpeed: lerp(hours[i].windSpeed, hours[i + 1].windSpeed, t),
        windDirection: lerpAngle(
          hours[i].windDirection,
          hours[i + 1].windDirection,
          t,
        ),
        windGusts: lerp(hours[i].windGusts, hours[i + 1].windGusts, t),
      });
    }
  }

  // Add the final point
  const last = hours[hours.length - 1];
  points.push({
    time: new Date(last.time),
    windSpeed: last.windSpeed,
    windDirection: last.windDirection,
    windGusts: last.windGusts,
  });

  return points;
}
