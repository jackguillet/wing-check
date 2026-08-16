"use client";

import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ForecastHour } from "@/lib/weather/types";
import type { HourScore } from "@/lib/alerts/evaluator";
import { degreesToCardinal, weatherCodeToDescription } from "@/lib/weather/types";
import { getWindColor, getGustColor } from "@/lib/weather/colors";
import { format, parseISO, isSameDay } from "date-fns";
import { useUnits } from "@/components/units-provider";
import { formatTemp, fromKnots, windUnitLabel } from "@/lib/units";
import { hourIsOpen } from "@/lib/weather/civil-time";
import type { AlertCriteria } from "@/lib/db/schema";

interface ForecastTableProps {
  hours: ForecastHour[];
  hourScores?: HourScore[];
  nowCivil: string;
  criteria?: AlertCriteria | null;
}

function scoreBadge(score: HourScore) {
  if (score.score >= 70)
    return <Badge className="bg-green-600 text-white">{score.score}</Badge>;
  if (score.score >= 40)
    return (
      <Badge variant="secondary" className="bg-yellow-500 text-black">
        {score.score}
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {score.reason ? `${score.reason} · ${score.score}` : score.score}
    </Badge>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }
      title={ok ? `${label} ok` : `${label} fail`}
    >
      {label}
    </span>
  );
}

export function ForecastTable({
  hours,
  hourScores,
  nowCivil,
  criteria,
}: ForecastTableProps) {
  const { windSpeedUnit, temperatureUnit } = useUnits();
  const windLabel = windUnitLabel(windSpeedUnit);
  const upcoming = hours.filter((h) => hourIsOpen(h.time, nowCivil));
  const scoreMap = new Map(hourScores?.map((s) => [s.time, s]));
  const colCount = hourScores ? 11 : 9;

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Wind ({windLabel})</TableHead>
            <TableHead>Gusts ({windLabel})</TableHead>
            <TableHead>Dir</TableHead>
            <TableHead>Temp</TableHead>
            <TableHead>Weather</TableHead>
            <TableHead>Rain</TableHead>
            <TableHead>Cloud</TableHead>
            <TableHead>Wave</TableHead>
            {hourScores && <TableHead>Why</TableHead>}
            {hourScores && <TableHead>Score</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {upcoming.map((h, i) => {
            const parsed = parseISO(h.time);
            const prevParsed = i > 0 ? parseISO(upcoming[i - 1].time) : null;
            const isNewDay = i === 0 || !isSameDay(parsed, prevParsed!);
            const score = scoreMap.get(h.time);
            return (
              <Fragment key={h.time}>
                {isNewDay && (
                  <TableRow className="bg-muted/50 border-t-2 hover:bg-muted/50">
                    <TableCell
                      colSpan={colCount}
                      className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {format(parsed, "EEEE, d MMMM")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(parsed, "HH:mm")}
                  </TableCell>
                  <TableCell
                    className="font-bold"
                    style={{
                      color: getWindColor(
                        h.windSpeed,
                        criteria?.minWindSpeed,
                        criteria?.maxWindSpeed,
                      ),
                    }}
                  >
                    {fromKnots(h.windSpeed, windSpeedUnit).toFixed(1)}
                  </TableCell>
                  <TableCell
                    className="font-bold"
                    style={{ color: getGustColor(h.windSpeed, h.windGusts) }}
                  >
                    {fromKnots(h.windGusts, windSpeedUnit).toFixed(1)}
                  </TableCell>
                  <TableCell>
                    {degreesToCardinal(h.windDirection)} (
                    {Math.round(h.windDirection)}°)
                  </TableCell>
                  <TableCell>
                    {formatTemp(h.temperature, temperatureUnit)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {weatherCodeToDescription(h.weatherCode)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {h.precipitation != null
                      ? `${h.precipitation.toFixed(1)} mm`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {h.cloudCover != null ? `${Math.round(h.cloudCover)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    {h.waveHeight != null ? `${h.waveHeight.toFixed(1)}m` : "—"}
                  </TableCell>
                  {hourScores && (
                    <TableCell className="text-xs whitespace-nowrap">
                      {score ? (
                        <span className="flex gap-1">
                          <Flag ok={score.windOk} label="W" />
                          <Flag ok={score.gustOk} label="G" />
                          <Flag ok={score.directionOk} label="D" />
                          <Flag ok={score.waveOk} label="Wv" />
                          <Flag ok={score.weatherOk} label="Wx" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  {hourScores && (
                    <TableCell>
                      {score ? scoreBadge(score) : "—"}
                    </TableCell>
                  )}
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
