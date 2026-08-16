import type { ForecastHour, TidePoint } from "./types";
import { degreesToCardinal } from "./types";
import { civilAbsDiffMinutes, civilToMinutes } from "./civil-time";

// ── Types ──────────────────────────────────────────────────────────

export interface TidePhase {
  time: string;
  height: number;
  phase: "rising" | "falling" | "high" | "low";
  hoursToNextExtreme: number;
  nextExtremeType: "H" | "L";
  rateOfChange: number; // m/hr, positive = rising
}

export interface PressureTrend {
  time: string;
  pressure: number;
  change3h: number | null;
  change6h: number | null;
  direction: "falling-fast" | "falling" | "steady" | "rising" | "rising-fast";
  label: string;
}

export interface SwellQuality {
  rating: "excellent" | "good" | "fair" | "poor";
  label: string;
  isGroundswell: boolean;
}

export type AmplificationLevel = "high" | "moderate" | "low" | "none";

export interface WaveAmplification {
  level: AmplificationLevel;
  factors: string[];
}

export interface ConditionsInsight {
  tidePhases: TidePhase[];
  pressureTrends: PressureTrend[];
  swellQualities: Map<string, SwellQuality>; // keyed by hour time
  amplifications: Map<string, WaveAmplification>; // keyed by hour time
}

// ── Tide Phases ────────────────────────────────────────────────────

/** Detect local extremes (H/L) in tide data by scanning for sign changes in the derivative. */
function findExtremes(
  tides: TidePoint[],
): { index: number; type: "H" | "L" }[] {
  if (tides.length < 3) return [];
  const extremes: { index: number; type: "H" | "L" }[] = [];

  for (let i = 1; i < tides.length - 1; i++) {
    const prev = tides[i - 1].height;
    const curr = tides[i].height;
    const next = tides[i + 1].height;

    if (curr > prev && curr >= next) {
      extremes.push({ index: i, type: "H" });
    } else if (curr < prev && curr <= next) {
      extremes.push({ index: i, type: "L" });
    }
  }

  return extremes;
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(civilToMinutes(b) - civilToMinutes(a)) / 60;
}

export function computeTidePhases(tides: TidePoint[]): TidePhase[] {
  if (tides.length === 0) return [];

  const extremes = findExtremes(tides);

  return tides.map((t, i) => {
    // Rate of change (m/hr) from neighbors
    let rateOfChange = 0;
    if (i > 0 && i < tides.length - 1) {
      const dt = hoursBetween(tides[i - 1].time, tides[i + 1].time);
      if (dt > 0)
        rateOfChange = (tides[i + 1].height - tides[i - 1].height) / dt;
    } else if (i === 0 && tides.length > 1) {
      const dt = hoursBetween(tides[0].time, tides[1].time);
      if (dt > 0) rateOfChange = (tides[1].height - tides[0].height) / dt;
    } else if (i === tides.length - 1 && tides.length > 1) {
      const dt = hoursBetween(tides[i - 1].time, tides[i].time);
      if (dt > 0) rateOfChange = (tides[i].height - tides[i - 1].height) / dt;
    }

    // Determine phase
    const isExtreme = extremes.find((e) => e.index === i);
    let phase: TidePhase["phase"];
    if (isExtreme) {
      phase = isExtreme.type === "H" ? "high" : "low";
    } else {
      phase = rateOfChange >= 0 ? "rising" : "falling";
    }

    // Find next extreme after this point
    const nextExtreme = extremes.find((e) => e.index > i);
    let hoursToNextExtreme = 0;
    let nextExtremeType: "H" | "L" = "H";

    if (nextExtreme) {
      hoursToNextExtreme =
        Math.round(hoursBetween(t.time, tides[nextExtreme.index].time) * 10) /
        10;
      nextExtremeType = nextExtreme.type;
    } else if (extremes.length > 0) {
      // Past all detected extremes — estimate from trend
      const lastExtreme = extremes[extremes.length - 1];
      nextExtremeType = lastExtreme.type === "H" ? "L" : "H";
      // Rough estimate: ~6.2 hours between extremes
      const hoursFromLast = hoursBetween(tides[lastExtreme.index].time, t.time);
      hoursToNextExtreme = Math.max(
        0,
        Math.round((6.2 - hoursFromLast) * 10) / 10,
      );
    }

    return {
      time: t.time,
      height: t.height,
      phase,
      hoursToNextExtreme,
      nextExtremeType,
      rateOfChange: Math.round(rateOfChange * 1000) / 1000,
    };
  });
}

// ── Pressure Trends ────────────────────────────────────────────────

function pressureDirection(
  change3h: number | null,
): PressureTrend["direction"] {
  if (change3h == null) return "steady";
  if (change3h <= -6) return "falling-fast";
  if (change3h <= -2) return "falling";
  if (change3h >= 6) return "rising-fast";
  if (change3h >= 2) return "rising";
  return "steady";
}

function pressureLabel(dir: PressureTrend["direction"]): string {
  switch (dir) {
    case "falling-fast":
      return "Storm approaching — winds likely to increase";
    case "falling":
      return "Weather system incoming";
    case "rising-fast":
      return "Rapid clearing — conditions improving quickly";
    case "rising":
      return "Conditions stabilizing";
    case "steady":
      return "Stable conditions";
  }
}

export function computePressureTrend(hours: ForecastHour[]): PressureTrend[] {
  // Build a map of time -> index for lookback
  const timeIndex = new Map<string, number>();
  hours.forEach((h, i) => timeIndex.set(h.time, i));

  return hours.map((h, i) => {
    const pressure = h.pressureMsl ?? 0;

    // 3h lookback
    let change3h: number | null = null;
    if (i >= 3 && hours[i - 3].pressureMsl != null && h.pressureMsl != null) {
      change3h =
        Math.round((h.pressureMsl - hours[i - 3].pressureMsl!) * 10) / 10;
    }

    // 6h lookback
    let change6h: number | null = null;
    if (i >= 6 && hours[i - 6].pressureMsl != null && h.pressureMsl != null) {
      change6h =
        Math.round((h.pressureMsl - hours[i - 6].pressureMsl!) * 10) / 10;
    }

    const direction = pressureDirection(change3h);

    return {
      time: h.time,
      pressure,
      change3h,
      change6h,
      direction,
      label: pressureLabel(direction),
    };
  });
}

// ── Swell Quality ──────────────────────────────────────────────────

export function computeSwellQuality(hour: ForecastHour): SwellQuality {
  const period = hour.swellPeriod ?? hour.wavePeriod ?? 0;
  const height = hour.swellHeight ?? hour.waveHeight ?? 0;
  const isGroundswell = period >= 12;
  const dir = hour.swellDirection ?? hour.waveDirection;
  const dirLabel = dir != null ? ` ${degreesToCardinal(dir)}` : "";

  if (height === 0 && period === 0) {
    return { rating: "poor", label: "No swell data", isGroundswell: false };
  }

  let rating: SwellQuality["rating"];
  let typeLabel: string;

  if (isGroundswell && period >= 14 && height >= 0.5) {
    rating = "excellent";
    typeLabel = "Clean groundswell";
  } else if (isGroundswell && height >= 0.3) {
    rating = "good";
    typeLabel = "Groundswell";
  } else if (period >= 8) {
    rating = "fair";
    typeLabel = "Mid-period swell";
  } else {
    rating = "poor";
    typeLabel = "Wind swell";
  }

  return {
    rating,
    label: `${typeLabel} ${Math.round(period)}s${dirLabel}`,
    isGroundswell,
  };
}

// ── Wave Amplification ─────────────────────────────────────────────

export function computeWaveAmplification(
  tidePhase: TidePhase | undefined,
  swellQuality: SwellQuality | undefined,
  hour: ForecastHour,
): WaveAmplification {
  if (!tidePhase || !swellQuality) {
    return { level: "none", factors: [] };
  }

  const factors: string[] = [];
  let score = 0;

  // Rising tide approaching high = wave energy pushes shoreward
  if (
    tidePhase.phase === "rising" &&
    tidePhase.hoursToNextExtreme <= 3 &&
    tidePhase.nextExtremeType === "H"
  ) {
    factors.push("Rising tide approaching high");
    score += 2;
  } else if (tidePhase.phase === "rising") {
    factors.push("Rising tide");
    score += 1;
  }

  // Good swell quality contributes
  if (swellQuality.rating === "excellent") {
    factors.push("Excellent swell quality");
    score += 2;
  } else if (swellQuality.rating === "good") {
    factors.push("Good swell quality");
    score += 1;
  }

  // Decent swell height
  const swellH = hour.swellHeight ?? hour.waveHeight ?? 0;
  if (swellH >= 1.0) {
    factors.push(`Strong swell ${swellH.toFixed(1)}m`);
    score += 1;
  }

  let level: AmplificationLevel;
  if (score >= 4) level = "high";
  else if (score >= 3) level = "moderate";
  else if (score >= 2) level = "low";
  else level = "none";

  return { level, factors: level !== "none" ? factors : [] };
}

// ── Top-level Orchestrator ─────────────────────────────────────────

/**
 * Joins tide, pressure, swell into a single ConditionsInsight.
 * Tide phases are aligned to forecast hours by nearest timestamp.
 */
export function computeConditionsInsight(
  hours: ForecastHour[],
  tides: TidePoint[],
): ConditionsInsight {
  const tidePhases = computeTidePhases(tides);
  const pressureTrends = computePressureTrend(hours);
  const swellQualities = new Map<string, SwellQuality>();
  const amplifications = new Map<string, WaveAmplification>();

  // Build tide phase lookup by time
  const tidePhaseLookup = new Map<string, TidePhase>();
  for (const tp of tidePhases) {
    tidePhaseLookup.set(tp.time, tp);
  }

  for (const hour of hours) {
    const sq = computeSwellQuality(hour);
    swellQualities.set(hour.time, sq);

    // Find nearest tide phase
    const nearestTide = findNearestTidePhase(hour.time, tidePhases);
    const amp = computeWaveAmplification(nearestTide, sq, hour);
    amplifications.set(hour.time, amp);
  }

  return { tidePhases, pressureTrends, swellQualities, amplifications };
}

/** Find the tide phase closest in time to the given ISO timestamp. */
function findNearestTidePhase(
  time: string,
  tidePhases: TidePhase[],
): TidePhase | undefined {
  if (tidePhases.length === 0) return undefined;

  let closest = tidePhases[0];
  let minDist = civilAbsDiffMinutes(closest.time, time);

  for (let i = 1; i < tidePhases.length; i++) {
    const dist = civilAbsDiffMinutes(tidePhases[i].time, time);
    if (dist < minDist) {
      minDist = dist;
      closest = tidePhases[i];
    }
  }

  return closest;
}
