"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientSpot } from "@/lib/spots/visibility";
import {
  nextRideableWindow,
  sessionSummary,
  verdictLabel,
  type SpotEvaluation,
} from "@/lib/alerts/evaluator";
import { Heart } from "lucide-react";
import { degreesToCardinal } from "@/lib/weather/types";
import { useUnits } from "@/components/units-provider";
import { formatWind } from "@/lib/units";
import { formatWingSize, formatWouldBeGo } from "@/lib/wings";
import {
  civilDate,
  formatCivilClock,
  formatCivilWeekdayShort,
} from "@/lib/weather/civil-time";
import { VerdictBadge, verdictDot } from "@/components/verdict-badge";

interface SpotCardProps {
  spot: ClientSpot;
  evaluation: SpotEvaluation | null;
  isFavorite?: boolean;
  stale?: boolean;
  distanceKm?: number;
}

function dayLabel(dateStr: string, todayDate: string | null): string {
  if (todayDate && dateStr === todayDate) return "Today";
  return formatCivilWeekdayShort(dateStr);
}

function formatWindowRange(startIso: string, endIso: string): string {
  return `${formatCivilWeekdayShort(startIso)} ${formatCivilClock(startIso)}–${formatCivilClock(endIso)}`;
}

export function SpotCard({
  spot,
  evaluation,
  isFavorite,
  stale,
  distanceKm,
}: SpotCardProps) {
  const { windSpeedUnit } = useUnits();
  const days = evaluation?.dayEvaluations.slice(0, 3) ?? [];
  const nextWindow = evaluation
    ? nextRideableWindow(evaluation.rideableWindows)
    : null;
  const todayDate = evaluation?.todayDate ?? null;

  return (
    <Link
      href={
        nextWindow
          ? `/spots/${spot.slug}?day=${civilDate(nextWindow.start)}`
          : `/spots/${spot.slug}`
      }
    >
      <Card
        className="transition-colors hover:bg-accent/50"
        title={
          evaluation
            ? `Today ${sessionSummary(evaluation.bestWindow)} — best remaining daylight session vs your kit.`
            : undefined
        }
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-1.5">
            {isFavorite && (
              <Heart
                className="h-4 w-4 fill-red-500 text-red-500 shrink-0"
                aria-label="Favorite"
              />
            )}
            {spot.name}
          </CardTitle>
          {evaluation && <VerdictBadge verdict={evaluation.verdict} />}
        </CardHeader>
        <CardContent>
          {days.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {days.map((day) => (
                <div key={day.date} className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {dayLabel(day.date, todayDate)}
                  </p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${verdictDot[day.verdict]}`}
                      aria-hidden
                    />
                    <span className="font-medium">
                      {verdictLabel(day.verdict)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {day.bestWindow
                      ? `${day.bestWindow.hours}h`
                      : day.suggestedWindow?.recommendedWing != null
                        ? formatWouldBeGo(day.suggestedWindow.recommendedWing)
                        : "—"}
                  </p>
                </div>
              ))}
            </div>
          ) : evaluation ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today</span>
              <span className="font-medium">
                {sessionSummary(evaluation.bestWindow)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Forecast unavailable</p>
          )}

          {evaluation && nextWindow && (
            <p className="text-sm mt-3">
              {formatWindowRange(nextWindow.start, nextWindow.end)}
              <span className="text-muted-foreground">
                {" "}
                · {formatWind(nextWindow.avgWind, windSpeedUnit, 0)}{" "}
                {degreesToCardinal(nextWindow.dominantDirection)}
                {nextWindow.recommendedWing != null
                  ? ` · ${formatWingSize(nextWindow.recommendedWing)}`
                  : ""}
              </span>
            </p>
          )}
          {evaluation && !nextWindow && evaluation.suggestedWindows[0] && (
            <p className="text-sm mt-3">
              {evaluation.suggestedWindows[0].recommendedWing != null
                ? formatWouldBeGo(evaluation.suggestedWindows[0].recommendedWing)
                : "A missing wing would open a window"}
              <span className="text-muted-foreground">
                {" "}
                ·{" "}
                {formatWindowRange(
                  evaluation.suggestedWindows[0].start,
                  evaluation.suggestedWindows[0].end,
                )}
              </span>
            </p>
          )}
          {evaluation &&
            !nextWindow &&
            !evaluation.suggestedWindows[0] && (
            <p className="text-sm text-muted-foreground mt-3">
              No session ahead
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {distanceKm != null
              ? `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km · `
              : null}
            {spot.latitude.toFixed(3)}°, {spot.longitude.toFixed(3)}°
            {stale ? " · cached" : null}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
