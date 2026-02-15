"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
import type { ForecastHour } from "@/lib/weather/types";
import { degreesToCardinal } from "@/lib/weather/types";
import { format, parseISO } from "date-fns";

interface SwellCardProps {
  hours: ForecastHour[];
}

const chartConfig = {
  swellHeight: {
    label: "Swell (m)",
    color: "var(--chart-3)",
  },
  waveHeight: {
    label: "Wave (m)",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function SwellCard({ hours }: SwellCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");

  const hasSwell = hours.some((h) => h.swellHeight != null);

  if (!hasSwell) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swell</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No swell data available for this location
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = hours.map((h) => ({
    time: h.time,
    label: format(parseISO(h.time), "EEE HH:mm"),
    swellHeight: h.swellHeight,
    waveHeight: h.waveHeight,
  }));

  const now = new Date().toISOString();
  const tableData = hours.filter((h) => h.time >= now);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Swell</CardTitle>
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
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={Math.max(1, Math.floor(chartData.length / 6) - 1)}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} width={44} unit=" m" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="waveHeight"
                stroke="var(--color-waveHeight)"
                fill="var(--color-waveHeight)"
                fillOpacity={0.1}
                strokeWidth={1}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="swellHeight"
                stroke="var(--color-swellHeight)"
                fill="var(--color-swellHeight)"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Swell (m)</TableHead>
                  <TableHead>Period (s)</TableHead>
                  <TableHead>Swell Dir</TableHead>
                  <TableHead>Wave (m)</TableHead>
                  <TableHead>Period (s)</TableHead>
                  <TableHead>Wave Dir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((h) => (
                  <TableRow key={h.time}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(parseISO(h.time), "EEE HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {h.swellHeight != null ? h.swellHeight.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell>
                      {h.swellPeriod != null ? h.swellPeriod.toFixed(0) : "—"}
                    </TableCell>
                    <TableCell>
                      {h.swellDirection != null
                        ? degreesToCardinal(h.swellDirection)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {h.waveHeight != null ? h.waveHeight.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell>
                      {h.wavePeriod != null ? h.wavePeriod.toFixed(0) : "—"}
                    </TableCell>
                    <TableCell>
                      {h.waveDirection != null
                        ? degreesToCardinal(h.waveDirection)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
