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

const MODEL = "claude-sonnet-4-20250514";
const OVERVIEW_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    const sinSum = dirs.reduce(
      (s, d) => s + Math.sin((d * Math.PI) / 180),
      0,
    );
    const cosSum = dirs.reduce(
      (s, d) => s + Math.cos((d * Math.PI) / 180),
      0,
    );
    const avgDir =
      ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;

    const weatherCodes = [
      ...new Set(dayHours.map((h) => weatherCodeToDescription(h.weatherCode))),
    ];

    const swellHours = dayHours.filter((h) => h.swellHeight != null);
    let swellSummary: string | null = null;
    if (swellHours.length > 0) {
      const avgSwell =
        swellHours.reduce((s, h) => s + h.swellHeight!, 0) / swellHours.length;
      const avgPeriod = swellHours
        .filter((h) => h.swellPeriod != null)
        .reduce((s, h) => s + h.swellPeriod!, 0) / (swellHours.filter((h) => h.swellPeriod != null).length || 1);
      swellSummary = `${avgSwell.toFixed(1)}m @ ${avgPeriod.toFixed(0)}s`;
    }

    days.push({
      date,
      windRange: `${Math.min(...winds).toFixed(0)}-${Math.max(...winds).toFixed(0)} kt`,
      gustRange: `${Math.min(...gusts).toFixed(0)}-${Math.max(...gusts).toFixed(0)} kt`,
      dominantDirection: degreesToCardinal(Math.round(avgDir)),
      tempRange: `${Math.min(...temps).toFixed(0)}-${Math.max(...temps).toFixed(0)}°C`,
      weather: weatherCodes,
      swellSummary,
    });
  }

  // Evaluation results
  const evaluation = evaluateSpot(hours, criteria, sunrise, sunset);

  const windows = evaluation.rideableWindows.map((w) => ({
    start: w.start,
    end: w.end,
    hours: w.hours,
    avgWind: w.avgWind,
    avgGusts: w.avgGusts,
    direction: degreesToCardinal(w.dominantDirection),
    score: w.avgScore,
  }));

  return {
    spot: {
      name: spot.name,
      notes: spot.notes,
      coordinates: `${spot.latitude.toFixed(4)}°, ${spot.longitude.toFixed(4)}°`,
    },
    criteria: {
      windRange: `${criteria.minWindSpeed}-${criteria.maxWindSpeed} kt`,
      maxGustFactor: criteria.maxGustFactor,
      preferredDirections: criteria.preferredDirections,
      maxWaveHeight: criteria.maxWaveHeight,
    },
    days,
    evaluation: {
      goNoGo: evaluation.goNoGo,
      overallScore: evaluation.overallScore,
      rideableWindows: windows,
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
): Promise<{ overview: string; forecastSummary: string }> {
  const summary = buildForecastSummary(spot, hours, criteria, sunrise, sunset);
  const forecastSummary = JSON.stringify(summary);

  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: `You are a concise wing foiling weather analyst writing for experienced riders. Write a single short paragraph (50-80 words max) summarizing today's conditions: wind range, direction, best window, and swell if relevant. Don't explain basic concepts or restate the rider's own criteria — they already know what they need. Only mention web search findings if they reveal something genuinely noteworthy (storm warnings, unusual conditions, local hazard reports). End with a bold **Bottom line:** one-sentence go/no-go verdict.`,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Generate a daily wing foiling overview for ${spot.name} (${spot.latitude.toFixed(4)}°, ${spot.longitude.toFixed(4)}°).

Here's the forecast data and evaluation:
${forecastSummary}

Search for any recent local wind or wing foiling reports near this spot if relevant, then write the overview.`,
      },
    ],
  });

  // Extract text blocks from response (skip tool_use blocks)
  const textParts = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text);

  const overview = textParts[textParts.length - 1] ?? "";

  return { overview, forecastSummary };
}

// ── Get or generate (cached) overview ────────────────────────────────

export async function getOrGenerateOverview(
  spot: Spot,
  hours: ForecastHour[],
  criteria: AlertCriteria,
  sunrise?: string[],
  sunset?: string[],
): Promise<SpotOverview | null> {
  // Check for fresh cached overview
  const now = new Date();
  const cached = await db
    .select()
    .from(spotOverviews)
    .where(eq(spotOverviews.spotId, spot.id));

  const fresh = cached.find((row) => row.expiresAt > now);
  if (fresh) return fresh;

  try {
    const { overview, forecastSummary } = await generateSpotOverview(
      spot,
      hours,
      criteria,
      sunrise,
      sunset,
    );

    // Delete old entries
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
    console.error("Failed to generate overview:", error);
    // Fall back to stale overview if available
    const stale = cached[0];
    return stale ?? null;
  }
}
