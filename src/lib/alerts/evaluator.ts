import type { ForecastHour } from "@/lib/weather/types";
import type { AlertCriteria } from "@/lib/db/schema";

export interface HourScore {
  time: string;
  score: number;
  windOk: boolean;
  gustOk: boolean;
  directionOk: boolean;
  waveOk: boolean;
}

export interface RideableWindow {
  start: string;
  end: string;
  hours: number;
  avgScore: number;
  avgWind: number;
  avgGusts: number;
  dominantDirection: number;
}

export interface SpotEvaluation {
  overallScore: number;
  goNoGo: "go" | "marginal" | "no-go";
  hourScores: HourScore[];
  rideableWindows: RideableWindow[];
  bestWindow: RideableWindow | null;
}

function angleDifference(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function scoreHour(hour: ForecastHour, criteria: AlertCriteria): HourScore {
  const preferredDirs: number[] = JSON.parse(criteria.preferredDirections);

  const windOk =
    hour.windSpeed >= criteria.minWindSpeed &&
    hour.windSpeed <= criteria.maxWindSpeed;

  const gustOk =
    hour.windGusts <= hour.windSpeed * criteria.maxGustFactor;

  const directionOk =
    preferredDirs.length === 0 ||
    preferredDirs.some(
      (dir) => angleDifference(hour.windDirection, dir) <= criteria.directionTolerance
    );

  const waveOk =
    criteria.maxWaveHeight == null ||
    hour.waveHeight == null ||
    hour.waveHeight <= criteria.maxWaveHeight;

  let score = 0;

  // Wind speed scoring (0-40 points)
  if (windOk) {
    const midpoint = (criteria.minWindSpeed + criteria.maxWindSpeed) / 2;
    const range = (criteria.maxWindSpeed - criteria.minWindSpeed) / 2;
    const deviation = Math.abs(hour.windSpeed - midpoint) / range;
    score += 40 * (1 - deviation * 0.5);
  }

  // Gust scoring (0-25 points)
  if (gustOk) {
    const gustRatio = hour.windGusts / hour.windSpeed;
    score += 25 * (1 - (gustRatio - 1) / (criteria.maxGustFactor - 1));
  }

  // Direction scoring (0-25 points)
  if (directionOk && preferredDirs.length > 0) {
    const minAngleDiff = Math.min(
      ...preferredDirs.map((dir) => angleDifference(hour.windDirection, dir))
    );
    score += 25 * (1 - minAngleDiff / criteria.directionTolerance);
  } else if (preferredDirs.length === 0) {
    score += 25;
  }

  // Wave scoring (0-10 points)
  if (waveOk) {
    if (criteria.maxWaveHeight != null && hour.waveHeight != null) {
      score += 10 * (1 - hour.waveHeight / criteria.maxWaveHeight);
    } else {
      score += 10;
    }
  }

  return {
    time: hour.time,
    score: Math.max(0, Math.min(100, Math.round(score))),
    windOk,
    gustOk,
    directionOk,
    waveOk,
  };
}

function isDaytime(
  time: string,
  sunrise: string[],
  sunset: string[],
): boolean {
  const datePrefix = time.slice(0, 10);
  const rise = sunrise.find((s) => s.startsWith(datePrefix));
  const set = sunset.find((s) => s.startsWith(datePrefix));
  if (!rise || !set) return true;
  return time >= rise && time <= set;
}

function findRideableWindows(
  hourScores: HourScore[],
  hours: ForecastHour[],
  minConsecutiveHours: number,
  threshold: number = 50,
  sunrise?: string[],
  sunset?: string[],
): RideableWindow[] {
  const windows: RideableWindow[] = [];
  let windowStart = -1;

  for (let i = 0; i <= hourScores.length; i++) {
    const daytime = sunrise && sunset ? isDaytime(hourScores[i]?.time ?? "", sunrise, sunset) : true;
    const isGood = i < hourScores.length && daytime && hourScores[i].score >= threshold;

    if (isGood && windowStart === -1) {
      windowStart = i;
    } else if (!isGood && windowStart !== -1) {
      const windowHours = i - windowStart;
      if (windowHours >= minConsecutiveHours) {
        const windowScores = hourScores.slice(windowStart, i);
        const windowForecast = hours.slice(windowStart, i);
        const avgScore =
          windowScores.reduce((s, h) => s + h.score, 0) / windowHours;
        const avgWind =
          windowForecast.reduce((s, h) => s + h.windSpeed, 0) / windowHours;
        const avgGusts =
          windowForecast.reduce((s, h) => s + h.windGusts, 0) / windowHours;

        // Find dominant direction (circular mean)
        const sinSum = windowForecast.reduce(
          (s, h) => s + Math.sin((h.windDirection * Math.PI) / 180),
          0
        );
        const cosSum = windowForecast.reduce(
          (s, h) => s + Math.cos((h.windDirection * Math.PI) / 180),
          0
        );
        const dominantDirection =
          ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;

        windows.push({
          start: hourScores[windowStart].time,
          end: hourScores[i - 1].time,
          hours: windowHours,
          avgScore: Math.round(avgScore),
          avgWind: Math.round(avgWind * 10) / 10,
          avgGusts: Math.round(avgGusts * 10) / 10,
          dominantDirection: Math.round(dominantDirection),
        });
      }
      windowStart = -1;
    }
  }

  return windows;
}

export function evaluateSpot(
  hours: ForecastHour[],
  criteria: AlertCriteria,
  sunrise?: string[],
  sunset?: string[],
): SpotEvaluation {
  const hourScores = hours.map((h) => scoreHour(h, criteria));
  const rideableWindows = findRideableWindows(
    hourScores,
    hours,
    criteria.minConsecutiveHours,
    50,
    sunrise,
    sunset,
  );

  const bestWindow =
    rideableWindows.length > 0
      ? rideableWindows.reduce((best, w) =>
          w.avgScore > best.avgScore ? w : best
        )
      : null;

  // Overall score: best window score, or max hour score if no windows
  const overallScore = bestWindow
    ? bestWindow.avgScore
    : hourScores.length > 0
      ? Math.max(...hourScores.map((h) => h.score))
      : 0;

  const goNoGo: "go" | "marginal" | "no-go" =
    bestWindow && bestWindow.avgScore >= 70
      ? "go"
      : bestWindow || overallScore >= 40
        ? "marginal"
        : "no-go";

  return {
    overallScore,
    goNoGo,
    hourScores,
    rideableWindows,
    bestWindow,
  };
}

export const defaultCriteria: Omit<AlertCriteria, "id" | "spotId"> = {
  minWindSpeed: 15,
  maxWindSpeed: 25,
  maxGustFactor: 1.5,
  preferredDirections: "[]",
  directionTolerance: 45,
  minConsecutiveHours: 2,
  maxWaveHeight: null,
};
