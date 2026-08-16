import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { spotOverviews } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { evaluateSpot } from "@/lib/alerts/evaluator";
import type { ForecastHour } from "@/lib/weather/types";
import {
  degreesToCardinal,
  weatherCodeToDescription,
} from "@/lib/weather/types";
import type { AlertCriteria, Spot, SpotOverview } from "@/lib/db/schema";
import { formatWingSize, type WingBand } from "@/lib/wings";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import {
  DEFAULT_UNITS,
  formatTemp,
  formatWind,
  fromKnots,
  windUnitLabel,
  type DisplayUnits,
} from "@/lib/units";

const MODEL = "claude-sonnet-4-20250514";
const OVERVIEW_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours max; also keyed on forecast summary

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// ── Build a prompt-friendly forecast summary ─────────────────────────

interface DaySummary {
  date: string;
  windRange: string;
  gustRange: string;
  dominantDirection: string;
  tempRange: string;
  weather: string[];
  swellSummary: string | null;
}

export function buildForecastSummary(
  spot: Spot,
  hours: ForecastHour[],
  criteria: AlertCriteria,
  sunrise?: string[],
  sunset?: string[],
  units: DisplayUnits = DEFAULT_UNITS,
  nowCivil?: string,
  quiver?: WingBand[] | null,
  missing?: WingBand[] | null,
) {
  // Group hours by day (first 72h)
  const next72h = hours.slice(0, 72);
  const byDay = new Map<string, ForecastHour[]>();
  for (const h of next72h) {
    const day = h.time.split("T")[0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(h);
  }

  const days: DaySummary[] = [];
  for (const [date, dayHours] of byDay) {
    const winds = dayHours.map((h) => h.windSpeed);
    const gusts = dayHours.map((h) => h.windGusts);
    const temps = dayHours.map((h) => h.temperature);
    const dirs = dayHours.map((h) => h.windDirection);

    // Dominant direction via circular mean
    const sinSum = dirs.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
    const cosSum = dirs.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
    const avgDir = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;

    const weatherCodes = [
      ...new Set(dayHours.map((h) => weatherCodeToDescription(h.weatherCode))),
    ];

    const swellHours = dayHours.filter((h) => h.swellHeight != null);
    let swellSummary: string | null = null;
    if (swellHours.length > 0) {
      const avgSwell =
        swellHours.reduce((s, h) => s + h.swellHeight!, 0) / swellHours.length;
      const avgPeriod =
        swellHours
          .filter((h) => h.swellPeriod != null)
          .reduce((s, h) => s + h.swellPeriod!, 0) /
        (swellHours.filter((h) => h.swellPeriod != null).length || 1);
      swellSummary = `${avgSwell.toFixed(1)}m @ ${avgPeriod.toFixed(0)}s`;
    }

    days.push({
      date,
      windRange: `${fromKnots(Math.min(...winds), units.windSpeedUnit).toFixed(0)}-${fromKnots(Math.max(...winds), units.windSpeedUnit).toFixed(0)} ${windUnitLabel(units.windSpeedUnit)}`,
      gustRange: `${fromKnots(Math.min(...gusts), units.windSpeedUnit).toFixed(0)}-${fromKnots(Math.max(...gusts), units.windSpeedUnit).toFixed(0)} ${windUnitLabel(units.windSpeedUnit)}`,
      dominantDirection: degreesToCardinal(Math.round(avgDir)),
      tempRange: `${formatTemp(Math.min(...temps), units.temperatureUnit)}-${formatTemp(Math.max(...temps), units.temperatureUnit)}`,
      weather: weatherCodes,
      swellSummary,
    });
  }

  // Evaluation results
  const evaluation = evaluateSpot(
    hours,
    criteria,
    sunrise,
    sunset,
    nowCivil,
    null,
    null,
    quiver,
    missing,
  );

  const windows = evaluation.rideableWindows.map((w) => ({
    start: w.start,
    end: w.end,
    hours: w.hours,
    avgWind: formatWind(w.avgWind, units.windSpeedUnit),
    avgGusts: formatWind(w.avgGusts, units.windSpeedUnit),
    direction: degreesToCardinal(w.dominantDirection),
    score: w.avgScore,
    wing:
      w.recommendedWing != null ? formatWingSize(w.recommendedWing) : null,
  }));
  const suggested = evaluation.suggestedWindows.map((w) => ({
    start: w.start,
    end: w.end,
    hours: w.hours,
    score: w.avgScore,
    wing:
      w.recommendedWing != null ? formatWingSize(w.recommendedWing) : null,
  }));

  return {
    spot: {
      name: spot.name,
      notes: spot.notes,
      coordinates: `${spot.latitude.toFixed(4)}°, ${spot.longitude.toFixed(4)}°`,
    },
    criteria: {
      windRange: `${formatWind(criteria.minWindSpeed, units.windSpeedUnit, 0)}-${formatWind(criteria.maxWindSpeed, units.windSpeedUnit, 0)}`,
      maxGustFactor: criteria.maxGustFactor,
      preferredDirections: criteria.preferredDirections,
      maxWaveHeight: criteria.maxWaveHeight,
      quiver: quiver?.map((w) => formatWingSize(w.sizeM2)) ?? [],
    },
    days,
    evaluation: {
      goNoGo: evaluation.goNoGo,
      overallScore: evaluation.overallScore,
      rideableWindows: windows,
      suggestedWindows: suggested,
    },
  };
}

// ── Generate overview via Claude API ─────────────────────────────────

async function generateSpotOverview(
  spot: Spot,
  hours: ForecastHour[],
  criteria: AlertCriteria,
  sunrise?: string[],
  sunset?: string[],
  units: DisplayUnits = DEFAULT_UNITS,
  nowCivil?: string,
  quiver?: WingBand[] | null,
  missing?: WingBand[] | null,
): Promise<{ overview: string; forecastSummary: string }> {
  const summary = buildForecastSummary(
    spot,
    hours,
    criteria,
    sunrise,
    sunset,
    units,
    nowCivil,
    quiver,
    missing,
  );
  const forecastSummary = JSON.stringify(summary);

  const client = getClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 300,
      system: `You are a concise wing foiling weather analyst writing for experienced riders.
Use only the dates and numbers in the forecast data. Do not invent another month or season.
Write a single short paragraph (50-80 words max) summarizing today's conditions:
wind range, direction, best window, recommended wing size if given, and swell if relevant.
If suggestedWindows is present, mention that a wing they do not own would make the day GO.
Don't explain basic
concepts or restate the rider's criteria — they already know what they need.
End with a bold **Bottom line:** one-sentence go/no-go verdict.`,
      messages: [
        {
          role: "user",
          content: `Generate a daily wing foiling overview for ${spot.name} (${spot.latitude.toFixed(4)}°, ${spot.longitude.toFixed(4)}°).

Here's the forecast data and evaluation:
${forecastSummary}`,
        },
      ],
    },
    { signal: controller.signal },
  );
  clearTimeout(timeout);

  // Extract text — without tools there's a single text block
  const textParts = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text);

  const overview = textParts.join("").trim();

  return { overview, forecastSummary };
}

export function pickCachedOverview<
  T extends { forecastSummary: string; expiresAt: Date },
>(
  rows: T[],
  forecastSummary: string,
  now: Date,
): { fresh: T | null; matchingExpired: T | null } {
  let matchingExpired: T | null = null;
  for (const row of rows) {
    if (row.forecastSummary !== forecastSummary) continue;
    if (row.expiresAt > now) return { fresh: row, matchingExpired: null };
    if (!matchingExpired || row.expiresAt > matchingExpired.expiresAt) {
      matchingExpired = row;
    }
  }
  return { fresh: null, matchingExpired };
}

export function fallbackOverviewText(
  summary: ReturnType<typeof buildForecastSummary>,
): string {
  const ev = summary.evaluation;
  const verdict =
    ev.goNoGo === "go"
      ? "GO"
      : ev.goNoGo === "marginal"
        ? "MARGINAL"
        : "NO-GO";
  const today = summary.days[0];
  const wind = today
    ? `${today.windRange} ${today.dominantDirection}`
    : "no daylight hours loaded";
  const best = [...ev.rideableWindows].sort((a, b) => b.score - a.score)[0];
  const window = best
    ? `Best remaining window ${best.start}–${best.end}, ${best.avgWind}, score ${best.score}/100.`
    : "No remaining rideable window.";
  const suggested = ev.suggestedWindows[0];
  const maybe =
    !best && suggested?.wing
      ? ` A ${suggested.wing} you do not own would open a window.`
      : "";
  return `${summary.spot.name}: ${wind}. ${window}${maybe} **Bottom line:** ${verdict} (${ev.overallScore}/100).`;
}

function syntheticOverview(
  spotId: number,
  overview: string,
  forecastSummary: string,
  now: Date,
): SpotOverview {
  return {
    id: 0,
    spotId,
    overview,
    model: "fallback",
    generatedAt: now,
    expiresAt: now,
    forecastSummary,
  };
}

// ── Get or generate (cached) overview ────────────────────────────────

export async function getOrGenerateOverview(
  spot: Spot,
  hours: ForecastHour[],
  criteria: AlertCriteria,
  sunrise?: string[],
  sunset?: string[],
  nowCivil?: string,
  quiver?: WingBand[] | null,
  missing?: WingBand[] | null,
): Promise<SpotOverview | null> {
  const now = new Date();
  const units = DEFAULT_UNITS;
  const summary = buildForecastSummary(
    spot,
    hours,
    criteria,
    sunrise,
    sunset,
    units,
    nowCivil,
    quiver,
    missing,
  );
  const forecastSummary = JSON.stringify(summary);

  const cached = await db
    .select()
    .from(spotOverviews)
    .where(eq(spotOverviews.spotId, spot.id));

  const { fresh, matchingExpired } = pickCachedOverview(
    cached,
    forecastSummary,
    now,
  );
  if (fresh) return fresh;

  try {
    const { overview } = await generateSpotOverview(
      spot,
      hours,
      criteria,
      sunrise,
      sunset,
      units,
      nowCivil,
      quiver,
      missing,
    );

    if (cached.length > 0) {
      await db
        .delete(spotOverviews)
        .where(eq(spotOverviews.spotId, spot.id));
    }

    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + OVERVIEW_TTL_MS);

    const inserted = await db
      .insert(spotOverviews)
      .values({
        spotId: spot.id,
        overview,
        model: MODEL,
        generatedAt,
        expiresAt,
        forecastSummary,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    logger.error(
      { err: error, spotId: spot.id },
      "Failed to generate overview",
    );
    Sentry.captureException(error);
    if (matchingExpired) return matchingExpired;
    return syntheticOverview(
      spot.id,
      fallbackOverviewText(summary),
      forecastSummary,
      now,
    );
  }
}
