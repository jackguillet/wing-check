"use client";

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
import { format, parseISO } from "date-fns";

interface ForecastTableProps {
  hours: ForecastHour[];
  hourScores?: HourScore[];
}

function scoreBadge(score: number) {
  if (score >= 70) return <Badge className="bg-green-600 text-white">{score}</Badge>;
  if (score >= 40) return <Badge variant="secondary" className="bg-yellow-500 text-black">{score}</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">{score}</Badge>;
}

export function ForecastTable({ hours, hourScores }: ForecastTableProps) {
  const now = new Date().toISOString();
  const upcoming = hours.filter((h) => h.time >= now).slice(0, 48);
  const scoreMap = new Map(hourScores?.map((s) => [s.time, s]));

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Wind (kt)</TableHead>
            <TableHead>Gusts (kt)</TableHead>
            <TableHead>Dir</TableHead>
            <TableHead>Temp</TableHead>
            <TableHead>Weather</TableHead>
            <TableHead>Wave</TableHead>
            {hourScores && <TableHead>Score</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {upcoming.map((h) => {
            const score = scoreMap.get(h.time);
            return (
              <TableRow key={h.time}>
                <TableCell className="whitespace-nowrap text-sm">
                  {format(parseISO(h.time), "EEE HH:mm")}
                </TableCell>
                <TableCell className="font-bold" style={{ color: getWindColor(h.windSpeed) }}>
                  {h.windSpeed.toFixed(1)}
                </TableCell>
                <TableCell className="font-bold" style={{ color: getGustColor(h.windSpeed, h.windGusts) }}>
                  {h.windGusts.toFixed(1)}
                </TableCell>
                <TableCell>
                  {degreesToCardinal(h.windDirection)} ({Math.round(h.windDirection)}°)
                </TableCell>
                <TableCell>{Math.round(h.temperature)}°C</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {weatherCodeToDescription(h.weatherCode)}
                </TableCell>
                <TableCell>
                  {h.waveHeight != null
                    ? `${h.waveHeight.toFixed(1)}m`
                    : "—"}
                </TableCell>
                {hourScores && (
                  <TableCell>
                    {score ? scoreBadge(score.score) : "—"}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
