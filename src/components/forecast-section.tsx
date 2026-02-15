"use client";

import { useMemo, useState } from "react";
import { Sun, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ForecastMap } from "@/components/forecast-map";
import { WindChart } from "@/components/wind-chart";
import { SwellCard } from "@/components/swell-card";
import { ForecastTable } from "@/components/forecast-table";
import type { ForecastHour } from "@/lib/weather/types";
import type { AlertCriteria } from "@/lib/db/schema";
import type { HourScore } from "@/lib/alerts/evaluator";

interface ForecastSectionProps {
  hours: ForecastHour[];
  sunrise: string[];
  sunset: string[];
  criteria: AlertCriteria | null;
  rawCriteria: AlertCriteria | null;
  hourScores?: HourScore[];
  spotId: number;
  lat: number;
  lng: number;
  isOwner: boolean;
  updateCriteriaAction: (formData: FormData) => Promise<void>;
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
      scores.map((s) => ({ time: s.time } as ForecastHour)),
      sunrise,
      sunset,
    ).map((h) => h.time),
  );
  return scores.filter((s) => daylightTimes.has(s.time));
}

export function ForecastSection({
  hours,
  sunrise,
  sunset,
  criteria,
  rawCriteria,
  hourScores,
  spotId,
  lat,
  lng,
  isOwner,
  updateCriteriaAction,
}: ForecastSectionProps) {
  const [daylightOnly, setDaylightOnly] = useState(true);

  const filteredHours = useMemo(
    () => (daylightOnly ? filterDaylightHours(hours, sunrise, sunset) : hours),
    [hours, sunrise, sunset, daylightOnly],
  );

  const filteredScores = useMemo(
    () =>
      hourScores
        ? daylightOnly
          ? filterDaylightScores(hourScores, sunrise, sunset)
          : hourScores
        : undefined,
    [hourScores, sunrise, sunset, daylightOnly],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
        <button
          type="button"
          onClick={() => setDaylightOnly(true)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            daylightOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
          Daylight
        </button>
        <button
          type="button"
          onClick={() => setDaylightOnly(false)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !daylightOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          24 Hours
        </button>
      </div>

      <ForecastMap
        spotId={spotId}
        lat={lat}
        lng={lng}
        hours={filteredHours}
      />

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Wind Chart</TabsTrigger>
          <TabsTrigger value="table">Forecast Table</TabsTrigger>
          {isOwner && <TabsTrigger value="criteria">Alert Criteria</TabsTrigger>}
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <WindChart hours={filteredHours} criteria={rawCriteria} />
          <SwellCard hours={filteredHours} />
        </TabsContent>

        <TabsContent value="table">
          <ForecastTable hours={filteredHours} hourScores={filteredScores} />
        </TabsContent>

        {isOwner && (
          <TabsContent value="criteria">
            <Card>
              <CardHeader>
                <CardTitle>Alert Criteria</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateCriteriaAction} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minWindSpeed">Min Wind Speed (kt)</Label>
                      <Input
                        id="minWindSpeed"
                        name="minWindSpeed"
                        type="number"
                        step="0.5"
                        defaultValue={criteria?.minWindSpeed}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxWindSpeed">Max Wind Speed (kt)</Label>
                      <Input
                        id="maxWindSpeed"
                        name="maxWindSpeed"
                        type="number"
                        step="0.5"
                        defaultValue={criteria?.maxWindSpeed}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxGustFactor">Max Gust Factor</Label>
                      <Input
                        id="maxGustFactor"
                        name="maxGustFactor"
                        type="number"
                        step="0.1"
                        defaultValue={criteria?.maxGustFactor}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minConsecutiveHours">Min Hours</Label>
                      <Input
                        id="minConsecutiveHours"
                        name="minConsecutiveHours"
                        type="number"
                        defaultValue={criteria?.minConsecutiveHours}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="preferredDirections">
                      Preferred Directions (JSON array of degrees)
                    </Label>
                    <Input
                      id="preferredDirections"
                      name="preferredDirections"
                      defaultValue={criteria?.preferredDirections}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directionTolerance">
                      Direction Tolerance (°)
                    </Label>
                    <Input
                      id="directionTolerance"
                      name="directionTolerance"
                      type="number"
                      defaultValue={criteria?.directionTolerance}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxWaveHeight">Max Wave Height (m)</Label>
                    <Input
                      id="maxWaveHeight"
                      name="maxWaveHeight"
                      type="number"
                      step="0.1"
                      defaultValue={criteria?.maxWaveHeight ?? ""}
                    />
                  </div>
                  <Button type="submit">Update Criteria</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
