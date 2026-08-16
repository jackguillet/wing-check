"use client";

import { useState, useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceDot,
  Tooltip,
} from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, Table2 } from "lucide-react";
import type { ForecastHour, TidePoint } from "@/lib/weather/types";
import { degreesToCardinal } from "@/lib/weather/types";
import type {
  ConditionsInsight,
  TidePhase,
  PressureTrend,
  SwellQuality,
  WaveAmplification,
} from "@/lib/weather/conditions";
import { format, parseISO } from "date-fns";
import { civilAbsDiffMinutes, hourIsOpen } from "@/lib/weather/civil-time";

interface ConditionsChartProps {
  hours: ForecastHour[];
  tides: TidePoint[];
  insight: ConditionsInsight;
  nowCivil: string;
}

const chartConfig = {
  tideHeight: {
    label: "Tide (m)",
    color: "var(--chart-6)",
  },
  swellHeight: {
    label: "Swell (m)",
    color: "var(--chart-3)",
  },
  pressureMsl: {
    label: "Pressure (hPa)",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

interface ChartDataPoint {
  time: string;
  label: string;
  tideHeight: number | null;
  swellHeight: number | null;
  pressureMsl: number | null;
  // Enrichments for tooltip
  tidePhase?: TidePhase;
  pressureTrend?: PressureTrend;
  swellQuality?: SwellQuality;
  amplification?: WaveAmplification;
}

// ── Custom Tooltip ─────────────────────────────────────────────────

function ConditionsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-medium">{d.label}</p>

      {d.tideHeight != null && d.tidePhase && (
        <p>
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--chart-6)] mr-1.5" />
          Tide: {d.tideHeight.toFixed(2)}m —{" "}
          <span className="capitalize">{d.tidePhase.phase}</span>
          {d.tidePhase.hoursToNextExtreme > 0 &&
            `, ${d.tidePhase.hoursToNextExtreme}h to ${d.tidePhase.nextExtremeType === "H" ? "High" : "Low"}`}
        </p>
      )}

      {d.swellHeight != null && d.swellQuality && (
        <p>
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--chart-3)] mr-1.5" />
          Swell: {d.swellHeight.toFixed(1)}m — {d.swellQuality.label}
        </p>
      )}

      {d.pressureMsl != null && d.pressureTrend && (
        <p>
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--chart-5)] mr-1.5" />
          Pressure: {d.pressureMsl.toFixed(0)} hPa —{" "}
          <span className="capitalize">
            {d.pressureTrend.direction.replace("-", " ")}
          </span>
        </p>
      )}

      {d.amplification && d.amplification.level !== "none" && (
        <p className="text-amber-500 font-medium capitalize">
          {d.amplification.level} wave amplification
          <span className="block font-normal normal-case text-muted-foreground">
            Shown for planning — not in the grade
          </span>
        </p>
      )}
    </div>
  );
}

// ── Amplification Zones ────────────────────────────────────────────

function getAmplificationZones(
  data: ChartDataPoint[],
): { start: string; end: string }[] {
  const zones: { start: string; end: string }[] = [];
  let zoneStart: string | null = null;

  for (const d of data) {
    const isAmp = d.amplification && d.amplification.level !== "none";
    if (isAmp && !zoneStart) {
      zoneStart = d.label;
    } else if (!isAmp && zoneStart) {
      zones.push({
        start: zoneStart,
        end: data[data.indexOf(d) - 1]?.label ?? zoneStart,
      });
      zoneStart = null;
    }
  }

  if (zoneStart) {
    zones.push({ start: zoneStart, end: data[data.length - 1].label });
  }

  return zones;
}

// ── H/L dots ───────────────────────────────────────────────────────

function getExtremeDots(
  data: ChartDataPoint[],
): { label: string; height: number; type: "H" | "L" }[] {
  return data
    .filter(
      (d) => d.tidePhase?.phase === "high" || d.tidePhase?.phase === "low",
    )
    .map((d) => ({
      label: d.label,
      height: d.tideHeight!,
      type: d.tidePhase!.phase === "high" ? ("H" as const) : ("L" as const),
    }));
}

// ── Main Component ─────────────────────────────────────────────────

export function ConditionsChart({
  hours,
  tides,
  insight,
  nowCivil,
}: ConditionsChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");

  const hasTides = tides.length > 0;
  const hasSwell = hours.some(
    (h) => h.swellHeight != null || h.waveHeight != null,
  );
  const hasPressure = hours.some((h) => h.pressureMsl != null);

  // Build tide lookup by nearest hour for alignment with forecast hours
  const tideLookup = useMemo(() => {
    const map = new Map<string, TidePoint>();
    for (const t of tides) {
      map.set(t.time, t);
    }
    return map;
  }, [tides]);

  // Pressure trend lookup
  const pressureLookup = useMemo(() => {
    const map = new Map<string, PressureTrend>();
    for (const pt of insight.pressureTrends) {
      map.set(pt.time, pt);
    }
    return map;
  }, [insight.pressureTrends]);

  // Tide phase lookup
  const tidePhaseLookup = useMemo(() => {
    const map = new Map<string, TidePhase>();
    for (const tp of insight.tidePhases) {
      map.set(tp.time, tp);
    }
    return map;
  }, [insight.tidePhases]);

  // Build unified timeline from hours (primary) with tide data interpolated
  const chartData = useMemo(() => {
    // Collect all unique times from both sources, sorted
    const timeSet = new Set<string>();
    for (const h of hours) timeSet.add(h.time);
    for (const t of tides) timeSet.add(t.time);
    const allTimes = Array.from(timeSet).sort();

    const hourMap = new Map<string, ForecastHour>();
    for (const h of hours) hourMap.set(h.time, h);

    return allTimes.map((time) => {
      const h = hourMap.get(time);
      const t = tideLookup.get(time);
      const tidePhase = tidePhaseLookup.get(time);
      const pressureTrend = h ? pressureLookup.get(h.time) : undefined;
      const swellQuality = h ? insight.swellQualities.get(h.time) : undefined;
      const amplification = h ? insight.amplifications.get(h.time) : undefined;

      return {
        time,
        label: format(parseISO(time), "EEE HH:mm"),
        tideHeight: t?.height ?? null,
        swellHeight: h?.swellHeight ?? h?.waveHeight ?? null,
        pressureMsl: h?.pressureMsl ?? null,
        tidePhase,
        pressureTrend,
        swellQuality,
        amplification,
      } satisfies ChartDataPoint;
    });
  }, [hours, tides, tideLookup, tidePhaseLookup, pressureLookup, insight]);

  const ampZones = useMemo(() => getAmplificationZones(chartData), [chartData]);
  const extremeDots = useMemo(() => getExtremeDots(chartData), [chartData]);

  if (!hasTides && !hasSwell && !hasPressure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No tide, swell, or pressure data available for this location
          </p>
        </CardContent>
      </Card>
    );
  }

  const tableHours = hours.filter((h) => hourIsOpen(h.time, nowCivil));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Conditions</CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              Tide, swell quality, and wave amplification are not in the grade
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setView("chart")}
              className={`rounded-md p-1.5 ${
                view === "chart"
                  ? "bg-muted"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Chart view"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={`rounded-md p-1.5 ${
                view === "table"
                  ? "bg-muted"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === "chart" ? (
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={Math.max(1, Math.floor(chartData.length / 6) - 1)}
                angle={-45}
                textAnchor="end"
                height={60}
              />

              {/* Left Y-axis: Tide (m) */}
              {hasTides && (
                <YAxis
                  yAxisId="tide"
                  tick={{ fontSize: 11 }}
                  width={44}
                  unit=" m"
                  orientation="left"
                />
              )}

              {/* Right Y-axis: Swell (m) */}
              {hasSwell && (
                <YAxis
                  yAxisId="swell"
                  tick={{ fontSize: 11 }}
                  width={44}
                  unit=" m"
                  orientation="right"
                />
              )}

              {/* Second right Y-axis: Pressure — hidden on small screens via CSS */}
              {hasPressure && (
                <YAxis
                  yAxisId="pressure"
                  tick={{ fontSize: 10 }}
                  width={52}
                  unit=" hPa"
                  orientation="right"
                  domain={["auto", "auto"]}
                  className="hidden md:block"
                />
              )}

              <Tooltip content={<ConditionsTooltip />} />

              {/* Wave amplification zones */}
              {ampZones.map((z, i) => (
                <ReferenceArea
                  key={i}
                  x1={z.start}
                  x2={z.end}
                  yAxisId={hasTides ? "tide" : hasSwell ? "swell" : "pressure"}
                  fill="hsl(38, 92%, 50%)"
                  fillOpacity={0.1}
                  strokeOpacity={0}
                />
              ))}

              {/* Tide area */}
              {hasTides && (
                <Area
                  yAxisId="tide"
                  type="monotone"
                  dataKey="tideHeight"
                  stroke="var(--color-tideHeight)"
                  fill="var(--color-tideHeight)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}

              {/* H/L extreme dots */}
              {hasTides &&
                extremeDots.map((dot, i) => (
                  <ReferenceDot
                    key={i}
                    x={dot.label}
                    y={dot.height}
                    yAxisId="tide"
                    r={4}
                    fill={
                      dot.type === "H"
                        ? "hsl(210, 80%, 55%)"
                        : "hsl(210, 60%, 75%)"
                    }
                    stroke="white"
                    strokeWidth={1.5}
                    label={{
                      value: dot.type,
                      position: dot.type === "H" ? "top" : "bottom",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                ))}

              {/* Swell line */}
              {hasSwell && (
                <Line
                  yAxisId="swell"
                  type="monotone"
                  dataKey="swellHeight"
                  stroke="var(--color-swellHeight)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}

              {/* Pressure line */}
              {hasPressure && (
                <Line
                  yAxisId="pressure"
                  type="monotone"
                  dataKey="pressureMsl"
                  stroke="var(--color-pressureMsl)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ChartContainer>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  {hasTides && <TableHead>Tide (m)</TableHead>}
                  {hasTides && <TableHead>Phase</TableHead>}
                  {hasSwell && <TableHead>Swell (m)</TableHead>}
                  {hasSwell && <TableHead>Quality</TableHead>}
                  {hasSwell && <TableHead>Period</TableHead>}
                  {hasSwell && <TableHead>Dir</TableHead>}
                  <TableHead>Wave (m)</TableHead>
                  {hasPressure && <TableHead>Pressure</TableHead>}
                  {hasPressure && <TableHead>Trend</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableHours.map((h) => {
                  const sq = insight.swellQualities.get(h.time);
                  const pt = insight.pressureTrends.find(
                    (p) => p.time === h.time,
                  );
                  const nearestTide = findNearestTideForTable(h.time, tides);
                  const tp = nearestTide
                    ? insight.tidePhases.find(
                        (p) => p.time === nearestTide.time,
                      )
                    : undefined;

                  return (
                    <TableRow key={h.time}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(parseISO(h.time), "EEE HH:mm")}
                      </TableCell>
                      {hasTides && (
                        <TableCell className="font-medium">
                          {nearestTide ? nearestTide.height.toFixed(2) : "—"}
                        </TableCell>
                      )}
                      {hasTides && (
                        <TableCell className="capitalize text-sm">
                          {tp?.phase ?? "—"}
                        </TableCell>
                      )}
                      {hasSwell && (
                        <TableCell className="font-medium">
                          {h.swellHeight != null
                            ? h.swellHeight.toFixed(1)
                            : "—"}
                        </TableCell>
                      )}
                      {hasSwell && (
                        <TableCell>
                          {sq ? (
                            <span
                              className={
                                sq.rating === "excellent"
                                  ? "text-green-600"
                                  : sq.rating === "good"
                                    ? "text-green-500"
                                    : sq.rating === "fair"
                                      ? "text-yellow-500"
                                      : "text-muted-foreground"
                              }
                            >
                              {sq.rating}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      )}
                      {hasSwell && (
                        <TableCell>
                          {h.swellPeriod != null
                            ? `${h.swellPeriod.toFixed(0)}s`
                            : "—"}
                        </TableCell>
                      )}
                      {hasSwell && (
                        <TableCell>
                          {h.swellDirection != null
                            ? degreesToCardinal(h.swellDirection)
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        {h.waveHeight != null ? h.waveHeight.toFixed(1) : "—"}
                      </TableCell>
                      {hasPressure && (
                        <TableCell className="tabular-nums">
                          {h.pressureMsl != null
                            ? h.pressureMsl.toFixed(0)
                            : "—"}
                        </TableCell>
                      )}
                      {hasPressure && (
                        <TableCell className="capitalize text-sm">
                          {pt?.direction.replace("-", " ") ?? "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Find nearest tide point within 30 minutes of given time. */
function findNearestTideForTable(
  time: string,
  tides: TidePoint[],
): TidePoint | undefined {
  if (tides.length === 0) return undefined;
  let best: TidePoint | undefined;
  let bestDist = Infinity;

  for (const tide of tides) {
    const dist = civilAbsDiffMinutes(tide.time, time);
    if (dist < bestDist) {
      bestDist = dist;
      best = tide;
    }
  }

  return bestDist <= 30 ? best : undefined;
}
