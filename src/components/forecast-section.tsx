"use client";

import { useMemo } from "react";
import { useForecastControls } from "@/components/forecast-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ForecastMap } from "@/components/forecast-map";
import { WindChart } from "@/components/wind-chart";
import { PressureTrendCard } from "@/components/pressure-trend-card";
import { ConditionsChart } from "@/components/conditions-chart";
import { ForecastTable } from "@/components/forecast-table";
import type { ForecastHour, TidePoint } from "@/lib/weather/types";
import { degreesToCardinal } from "@/lib/weather/types";
import { computeConditionsInsight } from "@/lib/weather/conditions";
import type { AlertCriteria } from "@/lib/db/schema";
import type { HourScore, RideableWindow } from "@/lib/alerts/evaluator";
import { CriteriaForm } from "@/components/criteria-form";
import { useUnits } from "@/components/units-provider";
import { formatWind } from "@/lib/units";

interface ForecastSectionProps {
  hours: ForecastHour[];
  tides: TidePoint[];
  sunrise: string[];
  sunset: string[];
  criteria: AlertCriteria | null;
  rawCriteria: AlertCriteria | null;
  hourScores?: HourScore[];
  rideableWindows?: RideableWindow[];
  spotId: number;
  lat: number;
  lng: number;
  isOwner: boolean;
  canEditCriteria?: boolean;
}

/** Filter hours to only include those within the given day range from the first hour. */
function filterByDayRange(hours: ForecastHour[], days: number): ForecastHour[] {
  if (hours.length === 0) return hours;
  const firstDate = hours[0].time.substring(0, 10);
  const cutoff = new Date(firstDate + "T00:00");
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  return hours.filter((h) => h.time.substring(0, 10) < cutoffStr);
}

/**
 * Filter hours to daylight only using sunrise/sunset times.
 * Floor sunrise to the hour, ceil sunset to the next hour.
 */
function filterDaylightHours(
  hours: ForecastHour[],
  sunrise: string[],
  sunset: string[],
): ForecastHour[] {
  // Build a map of date -> { sunriseHour, sunsetHour }
  const dayBounds = new Map<string, { rise: number; set: number }>();
  for (const sr of sunrise) {
    const date = sr.substring(0, 10);
    const h = parseInt(sr.substring(11, 13), 10);
    // Floor sunrise to the hour
    dayBounds.set(date, { rise: h, set: dayBounds.get(date)?.set ?? 21 });
  }
  for (const ss of sunset) {
    const date = ss.substring(0, 10);
    const h = parseInt(ss.substring(11, 13), 10);
    const m = parseInt(ss.substring(14, 16), 10);
    // Ceil sunset to next hour
    const ceilH = m > 0 ? h + 1 : h;
    const existing = dayBounds.get(date);
    if (existing) {
      existing.set = ceilH;
    } else {
      dayBounds.set(date, { rise: 5, set: ceilH });
    }
  }

  return hours.filter((h) => {
    const date = h.time.substring(0, 10);
    const hour = parseInt(h.time.substring(11, 13), 10);
    const bounds = dayBounds.get(date);
    if (!bounds) return true; // no sunrise/sunset data, include as fallback
    return hour >= bounds.rise && hour <= bounds.set;
  });
}

function filterDaylightScores(
  scores: HourScore[],
  sunrise: string[],
  sunset: string[],
): HourScore[] {
  const daylightTimes = new Set(
    filterDaylightHours(
      scores.map((s) => ({ time: s.time }) as ForecastHour),
      sunrise,
      sunset,
    ).map((h) => h.time),
  );
  return scores.filter((s) => daylightTimes.has(s.time));
}

/** Filter tide points by day range from the first hour. */
function filterTidesByDayRange(
  tides: TidePoint[],
  hours: ForecastHour[],
  days: number,
): TidePoint[] {
  if (hours.length === 0 || tides.length === 0) return tides;
  const firstDate = hours[0].time.substring(0, 10);
  const cutoff = new Date(firstDate + "T00:00");
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  return tides.filter((t) => t.time.substring(0, 10) < cutoffStr);
}

/** Filter tide points to daylight hours only. */
function filterDaylightTides(
  tides: TidePoint[],
  sunrise: string[],
  sunset: string[],
): TidePoint[] {
  const dayBounds = new Map<string, { rise: number; set: number }>();
  for (const sr of sunrise) {
    const date = sr.substring(0, 10);
    const h = parseInt(sr.substring(11, 13), 10);
    dayBounds.set(date, { rise: h, set: dayBounds.get(date)?.set ?? 21 });
  }
  for (const ss of sunset) {
    const date = ss.substring(0, 10);
    const h = parseInt(ss.substring(11, 13), 10);
    const m = parseInt(ss.substring(14, 16), 10);
    const ceilH = m > 0 ? h + 1 : h;
    const existing = dayBounds.get(date);
    if (existing) {
      existing.set = ceilH;
    } else {
      dayBounds.set(date, { rise: 5, set: ceilH });
    }
  }

  return tides.filter((t) => {
    const date = t.time.substring(0, 10);
    const hour = parseInt(t.time.substring(11, 13), 10);
    const bounds = dayBounds.get(date);
    if (!bounds) return true;
    return hour >= bounds.rise && hour <= bounds.set;
  });
}

export function ForecastSection({
  hours,
  tides,
  sunrise,
  sunset,
  criteria,
  rawCriteria,
  hourScores,
  rideableWindows,
  spotId,
  lat,
  lng,
  isOwner,
  canEditCriteria = isOwner,
}: ForecastSectionProps) {
  const { dayRange, daylightOnly } = useForecastControls();
  const { windSpeedUnit } = useUnits();

  const rangeFilteredHours = useMemo(
    () => filterByDayRange(hours, dayRange),
    [hours, dayRange],
  );

  const filteredHours = useMemo(
    () =>
      daylightOnly
        ? filterDaylightHours(rangeFilteredHours, sunrise, sunset)
        : rangeFilteredHours,
    [rangeFilteredHours, sunrise, sunset, daylightOnly],
  );

  const filteredScores = useMemo(() => {
    if (!hourScores) return undefined;
    const rangeScores = filterByDayRange(
      hourScores.map((s) => ({ time: s.time }) as ForecastHour),
      dayRange,
    ).map((h) => h.time);
    const rangeSet = new Set(rangeScores);
    const byRange = hourScores.filter((s) => rangeSet.has(s.time));
    return daylightOnly
      ? filterDaylightScores(byRange, sunrise, sunset)
      : byRange;
  }, [hourScores, dayRange, sunrise, sunset, daylightOnly]);

  const filteredTides = useMemo(() => {
    const byRange = filterTidesByDayRange(tides, hours, dayRange);
    return daylightOnly
      ? filterDaylightTides(byRange, sunrise, sunset)
      : byRange;
  }, [tides, hours, dayRange, daylightOnly, sunrise, sunset]);

  const filteredWindows = useMemo(() => {
    if (!rideableWindows) return undefined;
    if (hours.length === 0) return rideableWindows;
    const firstDate = hours[0].time.substring(0, 10);
    const cutoff = new Date(firstDate + "T00:00");
    cutoff.setDate(cutoff.getDate() + dayRange);
    const cutoffStr = cutoff.toISOString().substring(0, 10);
    return rideableWindows.filter((w) => w.start.substring(0, 10) < cutoffStr);
  }, [rideableWindows, hours, dayRange]);

  const conditionsInsight = useMemo(
    () => computeConditionsInsight(filteredHours, filteredTides),
    [filteredHours, filteredTides],
  );

  return (
    <div className="space-y-6">
      {filteredWindows && filteredWindows.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ForecastMap
            spotId={spotId}
            lat={lat}
            lng={lng}
            hours={filteredHours}
            sunrise={sunrise}
            sunset={sunset}
          />
          <Card>
            <CardHeader>
              <CardTitle>Rideable Windows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredWindows.map((w, i) => {
                  const start = new Date(w.start);
                  const end = new Date(w.end);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {start.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          {start.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}{" "}
                          –{" "}
                          {end.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {w.hours}h · {formatWind(w.avgWind, windSpeedUnit)} avg
                          · gusts {formatWind(w.avgGusts, windSpeedUnit)}
                          · {degreesToCardinal(w.dominantDirection)}
                        </p>
                        {(() => {
                          const midTime = new Date(
                            (new Date(w.start).getTime() +
                              new Date(w.end).getTime()) /
                              2,
                          )
                            .toISOString()
                            .substring(0, 16);
                          const nearestHour = filteredHours.reduce((best, h) =>
                            Math.abs(
                              new Date(h.time).getTime() -
                                new Date(midTime).getTime(),
                            ) <
                            Math.abs(
                              new Date(best.time).getTime() -
                                new Date(midTime).getTime(),
                            )
                              ? h
                              : best,
                          );
                          const sq = conditionsInsight.swellQualities.get(
                            nearestHour.time,
                          );
                          const pt = conditionsInsight.pressureTrends.find(
                            (p) => p.time === nearestHour.time,
                          );
                          const tp =
                            conditionsInsight.tidePhases.length > 0
                              ? conditionsInsight.tidePhases.reduce(
                                  (best, phase) =>
                                    Math.abs(
                                      new Date(phase.time).getTime() -
                                        new Date(midTime).getTime(),
                                    ) <
                                    Math.abs(
                                      new Date(best.time).getTime() -
                                        new Date(midTime).getTime(),
                                    )
                                      ? phase
                                      : best,
                                )
                              : null;

                          const parts: string[] = [];
                          if (tp)
                            parts.push(
                              `${tp.phase === "rising" ? "Rising" : tp.phase === "falling" ? "Falling" : tp.phase === "high" ? "High" : "Low"} tide`,
                            );
                          if (sq && sq.rating !== "poor") parts.push(sq.label);
                          if (pt && pt.direction !== "steady")
                            parts.push(
                              `Pressure ${pt.direction.replace("-", " ")}`,
                            );

                          if (parts.length === 0) return null;
                          return (
                            <p className="text-xs text-muted-foreground">
                              {parts.join(" · ")}
                            </p>
                          );
                        })()}
                      </div>
                      <Badge
                        className={
                          w.avgScore >= 70
                            ? "bg-green-600 text-white"
                            : "bg-yellow-500 text-black"
                        }
                      >
                        {w.avgScore}/100
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ForecastMap
          spotId={spotId}
          lat={lat}
          lng={lng}
          hours={filteredHours}
          sunrise={sunrise}
          sunset={sunset}
        />
      )}

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Wind Chart</TabsTrigger>
          <TabsTrigger value="table">Forecast Table</TabsTrigger>
          {canEditCriteria && (
            <TabsTrigger value="criteria">My Wind</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <WindChart hours={filteredHours} criteria={criteria} />
          <PressureTrendCard trends={conditionsInsight.pressureTrends} />
          <ConditionsChart
            hours={filteredHours}
            tides={filteredTides}
            insight={conditionsInsight}
          />
        </TabsContent>

        <TabsContent value="table">
          <ForecastTable hours={filteredHours} hourScores={filteredScores} />
        </TabsContent>

        {canEditCriteria && (
          <TabsContent value="criteria">
            <CriteriaForm spotId={spotId} criteria={rawCriteria} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
