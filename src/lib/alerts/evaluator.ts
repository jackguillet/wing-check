import type { ForecastHour, TidePoint } from "@/lib/weather/types";
import type { AlertCriteria } from "@/lib/db/schema";
import { computeTidePhases } from "@/lib/weather/conditions";
import { parsePreferredDirections } from "@/lib/directions";
import {
  addCivilHours,
  civilAbsDiffMinutes,
  civilDate,
  civilMinute,
  hourIsOpen,
  isDaylightCivil,
} from "@/lib/weather/civil-time";

export interface HourScore {
  time: string;
  score: number;
  windOk: boolean;
  gustOk: boolean;
  directionOk: boolean;
  waveOk: boolean;
  weatherOk: boolean;
  reason: string | null;
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

/**
 * Next window that has not already ended.
 * `end` is the start of the last good hour, so the window is open until end+1h.
 * `nowIso` is a spot-local civil time. If omitted, the soonest window is returned
 * (callers that already filtered to remaining windows can skip it).
 */
export function nextRideableWindow(
  windows: RideableWindow[],
  nowIso?: string,
): RideableWindow | null {
  if (windows.length === 0) return null;
  const upcoming = windows
    .filter((w) => (nowIso ? civilMinute(w.end) > civilMinute(nowIso) : true))
    .sort((a, b) => a.start.localeCompare(b.start));
  return upcoming[0] ?? null;
}

/** Best remaining window score starting within `horizonHours` of today's midnight. */
export function bestUpcomingWindowScore(
  evaluation: SpotEvaluation,
  horizonHours = 72,
): number {
  const origin = evaluation.todayDate
    ? `${evaluation.todayDate}T00:00`
    : evaluation.rideableWindows[0]?.start;
  if (!origin) return 0;
  const cutoff = addCivilHours(origin, horizonHours);
  let best = 0;
  for (const w of evaluation.rideableWindows) {
    if (civilMinute(w.start) >= cutoff) continue;
    if (w.avgScore > best) best = w.avgScore;
  }
  return best;
}

export interface DayEvaluation {
  date: string;              // "2026-02-14"
  score: number;
  goNoGo: "go" | "marginal" | "no-go";
  rideableWindows: RideableWindow[];
  bestWindow: RideableWindow | null;
}

export interface SpotEvaluation {
  overallScore: number;
  goNoGo: "go" | "marginal" | "no-go";
  hourScores: HourScore[];
  rideableWindows: RideableWindow[];
  bestWindow: RideableWindow | null;
  dayEvaluations: DayEvaluation[];
  /** Spot-local YYYY-MM-DD used as "today". */
  todayDate: string | null;
}

function angleDifference(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const MAX_GUST_ABSOLUTE_KT = 50;

/** Soft 0–10 penalty. Thunderstorms stay a hard zero via weatherOk. */
const WEATHER_PENALTY: Record<number, number> = {
  45: 5, // fog
  48: 5, // depositing rime fog
  65: 8, // heavy rain
  82: 10, // violent rain showers
};

export function weatherPenaltyFor(code: number, precipitationMm?: number | null): number {
  const coded = WEATHER_PENALTY[code] ?? 0;
  const rain = precipitationMm != null && precipitationMm >= 2 ? 8 : 0;
  return Math.max(coded, rain);
}

export type PreferredTide = "rising" | "falling" | "mid";

export interface RiderSchedule {
  sessionStartHour?: number | null;
  sessionEndHour?: number | null;
  preferredTide?: PreferredTide | null;
}

export function hourInSession(
  time: string,
  schedule?: RiderSchedule | null,
): boolean {
  if (!schedule) return true;
  const start = schedule.sessionStartHour;
  const end = schedule.sessionEndHour;
  if (start == null || end == null) return true;
  const h = parseInt(civilMinute(time).slice(11, 13), 10);
  if (Number.isNaN(h)) return true;
  if (start === end) return true;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

export function hourMatchesTide(
  time: string,
  schedule: RiderSchedule | null | undefined,
  tides: TidePoint[] | null | undefined,
): boolean {
  const pref = schedule?.preferredTide;
  if (!pref) return true;
  if (!tides || tides.length === 0) return true;
  const phases = computeTidePhases(tides);
  if (phases.length === 0) return true;
  let nearest = phases[0];
  let best = Number.POSITIVE_INFINITY;
  for (const p of phases) {
    const d = civilAbsDiffMinutes(p.time, time);
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  if (pref === "rising") return nearest.phase === "rising" || nearest.phase === "low";
  if (pref === "falling") return nearest.phase === "falling" || nearest.phase === "high";
  return nearest.phase === "high" || nearest.phase === "low" || nearest.hoursToNextExtreme <= 1.5;
}

function scoreHour(hour: ForecastHour, criteria: AlertCriteria): HourScore {
  const preferredDirs: number[] = parsePreferredDirections(
    criteria.preferredDirections,
  );

  const windOk =
    hour.windSpeed >= criteria.minWindSpeed &&
    hour.windSpeed <= criteria.maxWindSpeed;

  const gustOk = hour.windGusts <= MAX_GUST_ABSOLUTE_KT;

  const directionOk =
    preferredDirs.length === 0 ||
    preferredDirs.some(
      (dir) => angleDifference(hour.windDirection, dir) <= criteria.directionTolerance
    );

  // Missing marine data is not a free pass when the rider set a max.
  const waveOk =
    criteria.maxWaveHeight == null ||
    (hour.waveHeight != null && hour.waveHeight <= criteria.maxWaveHeight);

  const weatherOk = !THUNDERSTORM_CODES.has(hour.weatherCode);

  const reason = !weatherOk
    ? "Storm"
    : !windOk
      ? hour.windSpeed < criteria.minWindSpeed
        ? "Light"
        : "Nuke"
      : !gustOk
        ? "Nuke"
        : !directionOk
          ? "Offshore"
          : !waveOk
            ? "Wave"
            : null;

  // Preferred dirs are a hard gate: a 180° offshore hour cannot GO.
  const directionHard = preferredDirs.length > 0 && !directionOk;

  // Early exit: wind, gusts, storms, and (when set) direction
  if (!windOk || !gustOk || !weatherOk || directionHard) {
    return {
      time: hour.time,
      score: 0,
      windOk, gustOk, directionOk, waveOk, weatherOk,
      reason,
    };
  }

  let score = 0;

  // Wind speed scoring (0-40 points)
  const midpoint = (criteria.minWindSpeed + criteria.maxWindSpeed) / 2;
  const range = (criteria.maxWindSpeed - criteria.minWindSpeed) / 2;
  if (range === 0) {
    score += hour.windSpeed === criteria.minWindSpeed ? 40 : 0;
  } else {
    const deviation = Math.abs(hour.windSpeed - midpoint) / range;
    score += 40 * (1 - deviation ** 2);
  }

  // Gust scoring (0-25 points). maxGustFactor <= 1 means "no gusts allowed".
  // The 50 kt absolute cap above is the only hard gust gate.
  const gustDenom = criteria.maxGustFactor - 1;
  if (gustDenom <= 0) {
    score += hour.windGusts <= hour.windSpeed ? 25 : 0;
  } else if (hour.windSpeed <= 0) {
    score += 0;
  } else {
    const gustRatio = hour.windGusts / hour.windSpeed;
    const gustScore = Math.max(
      0,
      Math.min(25, 25 * (1 - (gustRatio - 1) / gustDenom)),
    );
    score += gustScore;
  }

  // Direction scoring (0-25 points)
  if (directionOk && preferredDirs.length > 0) {
    const minAngleDiff = Math.min(
      ...preferredDirs.map((dir) => angleDifference(hour.windDirection, dir))
    );
    if (criteria.directionTolerance <= 0) {
      score += minAngleDiff === 0 ? 25 : 0;
    } else {
      score += 25 * (1 - minAngleDiff / criteria.directionTolerance);
    }
  } else if (preferredDirs.length === 0) {
    score += 25;
  }

  // Wave scoring (0-10 points). Unknown waves with a max set score 0 of 10.
  if (criteria.maxWaveHeight == null) {
    score += 10;
  } else if (hour.waveHeight != null && waveOk) {
    score += 10 * (1 - hour.waveHeight / criteria.maxWaveHeight);
  }

  score -= weatherPenaltyFor(hour.weatherCode, hour.precipitation);

  return {
    time: hour.time,
    score: Math.max(0, Math.min(100, Math.round(score))),
    windOk,
    gustOk,
    directionOk,
    waveOk,
    weatherOk,
    reason,
  };
}

function isDaytime(
  time: string,
  sunrise: string[],
  sunset: string[],
): boolean {
  return isDaylightCivil(time, sunrise, sunset);
}

function findRideableWindows(
  hourScores: HourScore[],
  hours: ForecastHour[],
  minConsecutiveHours: number,
  threshold: number = 50,
  sunrise?: string[],
  sunset?: string[],
  nowCivil?: string,
  rider?: RiderSchedule | null,
  tides?: TidePoint[] | null,
): RideableWindow[] {
  const windows: RideableWindow[] = [];
  let windowStart = -1;

  for (let i = 0; i <= hourScores.length; i++) {
    const t = hourScores[i]?.time ?? "";
    const daytime = sunrise && sunset ? isDaytime(t, sunrise, sunset) : true;
    const inSession = hourInSession(t, rider);
    const tideOk = hourMatchesTide(t, rider, tides);
    const remaining =
      !nowCivil ||
      (i < hourScores.length && hourIsOpen(hourScores[i].time, nowCivil));
    const isGood =
      i < hourScores.length &&
      daytime &&
      inSession &&
      tideOk &&
      remaining &&
      hourScores[i].score >= threshold;

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
          end: addCivilHours(hourScores[i - 1].time, 1),
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
  nowCivil?: string,
  rider?: RiderSchedule | null,
  tides?: TidePoint[] | null,
): SpotEvaluation {
  const hourScores = hours.map((h) => scoreHour(h, criteria));
  const rideableWindows = findRideableWindows(
    hourScores,
    hours,
    criteria.minConsecutiveHours,
    50,
    sunrise,
    sunset,
    nowCivil,
    rider,
    tides,
  );

  // Group hours by date for per-day evaluations
  const dateGroups = new Map<string, { scores: HourScore[]; forecast: ForecastHour[] }>();
  for (let i = 0; i < hourScores.length; i++) {
    const date = hourScores[i].time.slice(0, 10);
    let group = dateGroups.get(date);
    if (!group) {
      group = { scores: [], forecast: [] };
      dateGroups.set(date, group);
    }
    group.scores.push(hourScores[i]);
    group.forecast.push(hours[i]);
  }

  const dayEvaluations: DayEvaluation[] = [];
  for (const [date, group] of dateGroups) {
    const dayWindows = findRideableWindows(
      group.scores,
      group.forecast,
      criteria.minConsecutiveHours,
      50,
      sunrise,
      sunset,
      nowCivil,
      rider,
      tides,
    );
    const dayBest = dayWindows.length > 0
      ? dayWindows.reduce((best, w) => w.avgScore > best.avgScore ? w : best)
      : null;
    // When `nowCivil` is set, a used-up morning is no-go — not this morning's 90.
    // Without it (tests / full-series eval) keep the max-hour fallback.
    const dayScore = dayBest
      ? dayBest.avgScore
      : nowCivil
        ? 0
        : group.scores.length > 0
          ? Math.max(...group.scores.map((h) => h.score))
          : 0;
    const dayGoNoGo: "go" | "marginal" | "no-go" =
      dayBest && dayBest.avgScore >= 70
        ? "go"
        : dayBest || (!nowCivil && dayScore >= 40)
          ? "marginal"
          : "no-go";

    dayEvaluations.push({
      date,
      score: dayScore,
      goNoGo: dayGoNoGo,
      rideableWindows: dayWindows,
      bestWindow: dayBest,
    });
  }

  // Limit to first 7 days
  const maxDays = 7;
  const limitedDayEvals = dayEvaluations.slice(0, maxDays);
  const cutoffDate = limitedDayEvals.length > 0
    ? limitedDayEvals[limitedDayEvals.length - 1].date
    : "";
  const limitedWindows = rideableWindows.filter(w => w.start.slice(0, 10) <= cutoffDate);

  const limitedBestWindow =
    limitedWindows.length > 0
      ? limitedWindows.reduce((best, w) =>
          w.avgScore > best.avgScore ? w : best
        )
      : null;

  const todayDate = nowCivil
    ? civilDate(nowCivil)
    : limitedDayEvals[0]?.date ?? null;
  const todayEval = todayDate
    ? (limitedDayEvals.find((d) => d.date === todayDate) ?? limitedDayEvals[0])
    : limitedDayEvals[0];
  const overallScore = todayEval ? todayEval.score : 0;
  const goNoGo: "go" | "marginal" | "no-go" = todayEval ? todayEval.goNoGo : "no-go";

  return {
    overallScore,
    goNoGo,
    hourScores,
    rideableWindows: limitedWindows,
    bestWindow: limitedBestWindow,
    dayEvaluations: limitedDayEvals,
    todayDate,
  };
}

export const defaultCriteria: Omit<AlertCriteria, "id" | "spotId"> = {
  minWindSpeed: 10,
  maxWindSpeed: 25,
  maxGustFactor: 2.5,
  preferredDirections: "[]",
  directionTolerance: 45,
  minConsecutiveHours: 2,
  maxWaveHeight: 1.5,
};
