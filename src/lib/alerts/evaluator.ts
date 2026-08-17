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
import { dominantWing, relevantMissingWings, type WingBand } from "@/lib/wings";

export interface HourScore {
  time: string;
  score: number;
  windOk: boolean;
  gustOk: boolean;
  directionOk: boolean;
  waveOk: boolean;
  weatherOk: boolean;
  reason: string | null;
  /** Best-matching wing (m²) when a quiver scored this hour. */
  recommendedWing: number | null;
  /** A wing the rider does not own that would make this hour GO. */
  suggestedWing: number | null;
  suggestedScore: number | null;
}

export interface RideableWindow {
  start: string;
  end: string;
  hours: number;
  avgScore: number;
  avgWind: number;
  avgGusts: number;
  dominantDirection: number;
  recommendedWing: number | null;
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

export type SessionVerdict = "prime" | "solid" | "light" | "none";

export const LIGHT_WINDOW_THRESHOLD = 40;
export const SOLID_SCORE = 70;
export const PRIME_SCORE = 80;

export function verdictFromWindow(
  window: RideableWindow | null,
): SessionVerdict {
  if (!window) return "none";
  if (window.avgScore >= PRIME_SCORE) return "prime";
  if (window.avgScore >= SOLID_SCORE) return "solid";
  return "light";
}

export function verdictLabel(verdict: SessionVerdict): string {
  switch (verdict) {
    case "prime":
      return "Prime";
    case "solid":
      return "Solid";
    case "light":
      return "Light";
    case "none":
      return "No session";
  }
}

export function goNoGoFromVerdict(
  verdict: SessionVerdict,
): "go" | "marginal" | "no-go" {
  if (verdict === "prime" || verdict === "solid") return "go";
  if (verdict === "light") return "marginal";
  return "no-go";
}

function verdictTier(verdict: SessionVerdict): number {
  switch (verdict) {
    case "prime":
      return 3;
    case "solid":
      return 2;
    case "light":
      return 1;
    case "none":
      return 0;
  }
}

/** Prime beats Solid beats Light; longer wins inside a tier. */
export function betterSession(a: RideableWindow, b: RideableWindow): boolean {
  const ta = verdictTier(verdictFromWindow(a));
  const tb = verdictTier(verdictFromWindow(b));
  if (ta !== tb) return ta > tb;
  if (a.hours !== b.hours) return a.hours > b.hours;
  return a.avgScore > b.avgScore;
}

export function sessionSummary(window: RideableWindow | null): string {
  if (!window) return verdictLabel("none");
  return `${verdictLabel(verdictFromWindow(window))} · ${window.hours}h`;
}

export interface DayEvaluation {
  date: string;              // "2026-02-14"
  score: number;
  goNoGo: "go" | "marginal" | "no-go";
  verdict: SessionVerdict;
  rideableWindows: RideableWindow[];
  bestWindow: RideableWindow | null;
  /** Best GO window a missing wing would open. Null when the day is already GO. */
  suggestedWindow: RideableWindow | null;
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
  suggestedWindows: RideableWindow[];
  verdict: SessionVerdict;
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

function windPoints(speed: number, minWind: number, maxWind: number): number {
  const midpoint = (minWind + maxWind) / 2;
  const range = (maxWind - minWind) / 2;
  if (range === 0) {
    return speed === minWind ? 40 : 0;
  }
  const deviation = Math.abs(speed - midpoint) / range;
  return 40 * (1 - deviation ** 2);
}

function restOfHourScore(
  hour: ForecastHour,
  criteria: AlertCriteria,
  preferredDirs: number[],
  directionOk: boolean,
  waveOk: boolean,
): number {
  let score = 0;

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
  return score;
}

function windReason(
  speed: number,
  bands: Array<{ minWindSpeed: number; maxWindSpeed: number }>,
): "Light" | "Nuke" | "No wing" {
  const envMin = Math.min(...bands.map((b) => b.minWindSpeed));
  const envMax = Math.max(...bands.map((b) => b.maxWindSpeed));
  if (speed < envMin) return "Light";
  if (speed > envMax) return "Nuke";
  return "No wing";
}

const SUGGEST_MIN_SCORE = 70;
const SUGGEST_MIN_DELTA = 15;
const SOFT_MIN_FACTOR = 0.75;
const SOFT_MIN_FLOOR_KT = 8;
const LIGHT_SCORE_CAP = 49;

function softBandCandidates(
  bands: ScoreBand[],
  speed: number,
): ScoreBand[] {
  const out: ScoreBand[] = [];
  for (const band of bands) {
    const softMin = Math.max(
      SOFT_MIN_FLOOR_KT,
      band.minWindSpeed * SOFT_MIN_FACTOR,
    );
    if (speed >= softMin && speed < band.minWindSpeed) {
      out.push({
        sizeM2: band.sizeM2,
        minWindSpeed: softMin,
        maxWindSpeed: band.minWindSpeed,
      });
    }
  }
  return out;
}

type ScoreBand = {
  sizeM2: number | null;
  minWindSpeed: number;
  maxWindSpeed: number;
};

function bestAgainstBands(
  hour: ForecastHour,
  criteria: AlertCriteria,
  preferredDirs: number[],
  directionOk: boolean,
  waveOk: boolean,
  candidates: ScoreBand[],
): { score: number; sizeM2: number | null } | null {
  const matching = candidates.filter(
    (b) =>
      hour.windSpeed >= b.minWindSpeed && hour.windSpeed <= b.maxWindSpeed,
  );
  if (matching.length === 0) return null;
  const shared = restOfHourScore(
    hour,
    criteria,
    preferredDirs,
    directionOk,
    waveOk,
  );
  let bestScore = -1;
  let sizeM2: number | null = null;
  for (const band of matching) {
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          windPoints(hour.windSpeed, band.minWindSpeed, band.maxWindSpeed) +
            shared,
        ),
      ),
    );
    const better =
      score > bestScore ||
      (score === bestScore &&
        (sizeM2 == null || (band.sizeM2 != null && band.sizeM2 > sizeM2)));
    if (better) {
      bestScore = score;
      sizeM2 = band.sizeM2;
    }
  }
  return { score: bestScore, sizeM2 };
}

function pickSuggestion(
  hour: ForecastHour,
  criteria: AlertCriteria,
  preferredDirs: number[],
  directionOk: boolean,
  waveOk: boolean,
  owned: WingBand[],
  missing: WingBand[] | null | undefined,
  ownedScore: number,
): { suggestedWing: number | null; suggestedScore: number | null } {
  if (!missing || missing.length === 0 || owned.length === 0) {
    return { suggestedWing: null, suggestedScore: null };
  }
  if (ownedScore >= SUGGEST_MIN_SCORE) {
    return { suggestedWing: null, suggestedScore: null };
  }
  const candidates = relevantMissingWings(hour.windSpeed, owned, missing);
  const best = bestAgainstBands(
    hour,
    criteria,
    preferredDirs,
    directionOk,
    waveOk,
    candidates,
  );
  if (
    !best ||
    best.sizeM2 == null ||
    best.score < SUGGEST_MIN_SCORE ||
    best.score < ownedScore + SUGGEST_MIN_DELTA
  ) {
    return { suggestedWing: null, suggestedScore: null };
  }
  return { suggestedWing: best.sizeM2, suggestedScore: best.score };
}

function scoreHour(
  hour: ForecastHour,
  criteria: AlertCriteria,
  quiver?: WingBand[] | null,
  missing?: WingBand[] | null,
): HourScore {
  const preferredDirs: number[] = parsePreferredDirections(
    criteria.preferredDirections,
  );

  const bands: Array<{
    sizeM2: number | null;
    minWindSpeed: number;
    maxWindSpeed: number;
  }> =
    quiver && quiver.length > 0
      ? quiver.map((w) => ({
          sizeM2: w.sizeM2,
          minWindSpeed: w.minWindSpeed,
          maxWindSpeed: w.maxWindSpeed,
        }))
      : [
          {
            sizeM2: null,
            minWindSpeed: criteria.minWindSpeed,
            maxWindSpeed: criteria.maxWindSpeed,
          },
        ];

  const matching = bands.filter(
    (b) =>
      hour.windSpeed >= b.minWindSpeed && hour.windSpeed <= b.maxWindSpeed,
  );
  const windOk = matching.length > 0;

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
      ? windReason(hour.windSpeed, bands)
      : !gustOk
        ? "Nuke"
        : !directionOk
          ? "Offshore"
          : !waveOk
            ? "Wave"
            : null;

  // Preferred dirs are a hard gate: a 180° offshore hour cannot GO.
  const directionHard = preferredDirs.length > 0 && !directionOk;
  const owned = quiver && quiver.length > 0 ? quiver : [];
  const canSuggest = gustOk && weatherOk && !directionHard;

  const hasQuiver = owned.length > 0;

  if (!windOk || !gustOk || !weatherOk || directionHard) {
    // Soft floor is for the spot's catalog band (people foil below "classic"
    // gorge min). A quiver wing that is simply too small stays a miss.
    if (!windOk && gustOk && weatherOk && !directionHard && !hasQuiver) {
      const soft = bestAgainstBands(
        hour,
        criteria,
        preferredDirs,
        directionOk,
        waveOk,
        softBandCandidates(bands, hour.windSpeed),
      );
      if (soft) {
        const suggestion = canSuggest
          ? pickSuggestion(
              hour,
              criteria,
              preferredDirs,
              directionOk,
              waveOk,
              owned,
              missing,
              Math.min(LIGHT_SCORE_CAP, soft.score),
            )
          : { suggestedWing: null, suggestedScore: null };
        return {
          time: hour.time,
          score: Math.min(LIGHT_SCORE_CAP, soft.score),
          windOk: true,
          gustOk,
          directionOk,
          waveOk,
          weatherOk,
          reason: "Light",
          recommendedWing: soft.sizeM2,
          ...suggestion,
        };
      }
    }
    const suggestion = canSuggest
      ? pickSuggestion(
          hour,
          criteria,
          preferredDirs,
          directionOk,
          waveOk,
          owned,
          missing,
          0,
        )
      : { suggestedWing: null, suggestedScore: null };
    return {
      time: hour.time,
      score: 0,
      windOk, gustOk, directionOk, waveOk, weatherOk,
      reason,
      recommendedWing: null,
      ...suggestion,
    };
  }

  const best = bestAgainstBands(
    hour,
    criteria,
    preferredDirs,
    directionOk,
    waveOk,
    matching,
  );
  const ownedScore = best?.score ?? 0;
  const suggestion = canSuggest
    ? pickSuggestion(
        hour,
        criteria,
        preferredDirs,
        directionOk,
        waveOk,
        owned,
        missing,
        ownedScore,
      )
    : { suggestedWing: null, suggestedScore: null };

  return {
    time: hour.time,
    score: ownedScore,
    windOk,
    gustOk,
    directionOk,
    waveOk,
    weatherOk,
    reason,
    recommendedWing: best?.sizeM2 ?? null,
    ...suggestion,
  };
}

function isDaytime(
  time: string,
  sunrise: string[],
  sunset: string[],
): boolean {
  return isDaylightCivil(time, sunrise, sunset);
}

function buildWindow(
  hourScores: HourScore[],
  hours: ForecastHour[],
  start: number,
  endExclusive: number,
): RideableWindow {
  const windowHours = endExclusive - start;
  const windowScores = hourScores.slice(start, endExclusive);
  const windowForecast = hours.slice(start, endExclusive);
  const avgScore =
    windowScores.reduce((s, h) => s + h.score, 0) / windowHours;
  const avgWind =
    windowForecast.reduce((s, h) => s + h.windSpeed, 0) / windowHours;
  const avgGusts =
    windowForecast.reduce((s, h) => s + h.windGusts, 0) / windowHours;
  const sinSum = windowForecast.reduce(
    (s, h) => s + Math.sin((h.windDirection * Math.PI) / 180),
    0,
  );
  const cosSum = windowForecast.reduce(
    (s, h) => s + Math.cos((h.windDirection * Math.PI) / 180),
    0,
  );
  const dominantDirection =
    ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;

  return {
    start: hourScores[start].time,
    end: addCivilHours(hourScores[endExclusive - 1].time, 1),
    hours: windowHours,
    avgScore: Math.round(avgScore),
    avgWind: Math.round(avgWind * 10) / 10,
    avgGusts: Math.round(avgGusts * 10) / 10,
    dominantDirection: Math.round(dominantDirection),
    recommendedWing: dominantWing(windowScores.map((s) => s.recommendedWing)),
  };
}

/** Inside a rideable run, keep the best same-quality stretch — not a diluted mix. */
function bestSessionInRun(
  hourScores: HourScore[],
  hours: ForecastHour[],
  runStart: number,
  runEnd: number,
  minHours: number,
): RideableWindow {
  const tiers = [PRIME_SCORE, SOLID_SCORE, LIGHT_WINDOW_THRESHOLD];
  let best: RideableWindow | null = null;
  for (const minScore of tiers) {
    let i = runStart;
    while (i < runEnd) {
      if (hourScores[i].score < minScore) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < runEnd && hourScores[j].score >= minScore) j += 1;
      if (j - i >= minHours) {
        const candidate = buildWindow(hourScores, hours, i, j);
        if (!best || betterSession(candidate, best)) best = candidate;
      }
      i = j;
    }
  }
  return best ?? buildWindow(hourScores, hours, runStart, runEnd);
}

function sessionsInRun(
  hourScores: HourScore[],
  hours: ForecastHour[],
  runStart: number,
  runEnd: number,
  minHours: number,
): RideableWindow[] {
  const best = bestSessionInRun(
    hourScores,
    hours,
    runStart,
    runEnd,
    minHours,
  );
  const startIdx = hourScores.findIndex((h) => h.time === best.start);
  const endIdx = startIdx + best.hours;
  const out: RideableWindow[] = [best];
  if (startIdx - runStart >= minHours) {
    out.push(
      ...sessionsInRun(hourScores, hours, runStart, startIdx, minHours),
    );
  }
  if (runEnd - endIdx >= minHours) {
    out.push(...sessionsInRun(hourScores, hours, endIdx, runEnd, minHours));
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
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
        windows.push(
          ...sessionsInRun(
            hourScores,
            hours,
            windowStart,
            i,
            minConsecutiveHours,
          ),
        );
      }
      windowStart = -1;
    }
  }

  return windows;
}

function suggestionHourScores(hourScores: HourScore[]): HourScore[] {
  return hourScores.map((s) => ({
    ...s,
    score:
      s.suggestedScore != null &&
      s.suggestedScore >= SUGGEST_MIN_SCORE &&
      s.score < SUGGEST_MIN_SCORE
        ? s.suggestedScore
        : 0,
    recommendedWing: s.suggestedWing,
  }));
}

function bestSuggestedWindow(
  scores: HourScore[],
  forecast: ForecastHour[],
  minConsecutiveHours: number,
  sunrise?: string[],
  sunset?: string[],
  nowCivil?: string,
  rider?: RiderSchedule | null,
  tides?: TidePoint[] | null,
): RideableWindow | null {
  const windows = findRideableWindows(
    suggestionHourScores(scores),
    forecast,
    minConsecutiveHours,
    SUGGEST_MIN_SCORE,
    sunrise,
    sunset,
    nowCivil,
    rider,
    tides,
  );
  if (windows.length === 0) return null;
  return windows.reduce((best, w) =>
    w.avgScore > best.avgScore ? w : best,
  );
}

export function evaluateSpot(
  hours: ForecastHour[],
  criteria: AlertCriteria,
  sunrise?: string[],
  sunset?: string[],
  nowCivil?: string,
  rider?: RiderSchedule | null,
  tides?: TidePoint[] | null,
  quiver?: WingBand[] | null,
  missing?: WingBand[] | null,
): SpotEvaluation {
  const hourScores = hours.map((h) => scoreHour(h, criteria, quiver, missing));
  const rideableWindows = findRideableWindows(
    hourScores,
    hours,
    criteria.minConsecutiveHours,
    LIGHT_WINDOW_THRESHOLD,
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
      LIGHT_WINDOW_THRESHOLD,
      sunrise,
      sunset,
      nowCivil,
      rider,
      tides,
    );
    const dayBest = dayWindows.length > 0
      ? dayWindows.reduce((best, w) => (betterSession(w, best) ? w : best))
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
    const verdict = verdictFromWindow(dayBest);
    const dayGoNoGo = goNoGoFromVerdict(verdict);
    const suggestedWindow =
      dayGoNoGo === "go"
        ? null
        : bestSuggestedWindow(
            group.scores,
            group.forecast,
            criteria.minConsecutiveHours,
            sunrise,
            sunset,
            nowCivil,
            rider,
            tides,
          );

    dayEvaluations.push({
      date,
      score: dayScore,
      goNoGo: dayGoNoGo,
      verdict,
      rideableWindows: dayWindows,
      bestWindow: dayBest,
      suggestedWindow,
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
          betterSession(w, best) ? w : best,
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
  const verdict: SessionVerdict = todayEval ? todayEval.verdict : "none";

  const suggestedWindows = limitedDayEvals
    .map((d) => d.suggestedWindow)
    .filter((w): w is RideableWindow => w != null);

  return {
    overallScore,
    goNoGo,
    hourScores,
    rideableWindows: limitedWindows,
    bestWindow: limitedBestWindow,
    dayEvaluations: limitedDayEvals,
    todayDate,
    suggestedWindows,
    verdict,
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
