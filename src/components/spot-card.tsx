"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Spot } from "@/lib/db/schema";
import {
  nextRideableWindow,
  type SpotEvaluation,
} from "@/lib/alerts/evaluator";
import { Heart } from "lucide-react";
import { degreesToCardinal } from "@/lib/weather/types";
import { useUnits } from "@/components/units-provider";
import { formatWind } from "@/lib/units";
import {
  formatCivilClock,
  formatCivilWeekdayShort,
} from "@/lib/weather/civil-time";

interface SpotCardProps {
  spot: Spot;
  evaluation: SpotEvaluation | null;
  isFavorite?: boolean;
}

function GoNoGoBadge({ status }: { status: "go" | "marginal" | "no-go" }) {
  switch (status) {
    case "go":
      return <Badge className="bg-green-600 text-white text-sm px-3">GO</Badge>;
    case "marginal":
      return (
        <Badge className="bg-yellow-500 text-black text-sm px-3">
          MARGINAL
        </Badge>
      );
    case "no-go":
      return (
        <Badge variant="outline" className="text-muted-foreground text-sm px-3">
          NO-GO
        </Badge>
      );
  }
}

const statusDot: Record<string, string> = {
  go: "bg-green-500",
  marginal: "bg-yellow-500",
  "no-go": "bg-red-500",
};

function dayLabel(dateStr: string, todayDate: string | null): string {
  if (todayDate && dateStr === todayDate) return "Today";
  return formatCivilWeekdayShort(dateStr);
}

function formatWindowRange(startIso: string, endIso: string): string {
  return `${formatCivilWeekdayShort(startIso)} ${formatCivilClock(startIso)}–${formatCivilClock(endIso)}`;
}

export function SpotCard({ spot, evaluation, isFavorite }: SpotCardProps) {
  const { windSpeedUnit } = useUnits();
  const days = evaluation?.dayEvaluations.slice(0, 3) ?? [];
  const nextWindow = evaluation
    ? nextRideableWindow(evaluation.rideableWindows)
    : null;
  const todayDate = evaluation?.todayDate ?? null;

  return (
    <Link href={`/spots/${spot.slug}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-1.5">
            {isFavorite && (
              <Heart className="h-4 w-4 fill-red-500 text-red-500 shrink-0" />
            )}
            {spot.name}
          </CardTitle>
          {evaluation && <GoNoGoBadge status={evaluation.goNoGo} />}
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
                      className={`inline-block h-2 w-2 rounded-full ${statusDot[day.goNoGo]}`}
                    />
                    <span className="font-medium">{day.score}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : evaluation ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score</span>
              <span className="font-medium">{evaluation.overallScore}/100</span>
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
              </span>
            </p>
          )}
          {evaluation && !nextWindow && (
            <p className="text-sm text-muted-foreground mt-3">
              No rideable window ahead
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {spot.latitude.toFixed(3)}°, {spot.longitude.toFixed(3)}°
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
