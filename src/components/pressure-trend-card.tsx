"use client";

import { useMemo } from "react";
import { Area, AreaChart } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { PressureTrend } from "@/lib/weather/conditions";

interface PressureTrendCardProps {
  trends: PressureTrend[];
}

const chartConfig = {
  pressure: {
    label: "Pressure",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

function TrendIcon({ direction }: { direction: PressureTrend["direction"] }) {
  switch (direction) {
    case "falling-fast":
    case "falling":
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    case "rising-fast":
    case "rising":
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    case "steady":
      return <Minus className="h-5 w-5 text-muted-foreground" />;
  }
}

function changeColor(direction: PressureTrend["direction"]): string {
  switch (direction) {
    case "falling-fast":
      return "text-red-600";
    case "falling":
      return "text-red-400";
    case "rising-fast":
      return "text-green-600";
    case "rising":
      return "text-green-400";
    case "steady":
      return "text-muted-foreground";
  }
}

export function PressureTrendCard({ trends }: PressureTrendCardProps) {
  const latest = trends[trends.length - 1];

  const sparkData = useMemo(
    () => trends.map((t) => ({ pressure: t.pressure })),
    [trends],
  );

  if (!latest || latest.pressure === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Barometric Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No pressure data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barometric Pressure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums">
            {latest.pressure.toFixed(1)} hPa
          </span>
          <TrendIcon direction={latest.direction} />
          {latest.change3h != null && (
            <span
              className={`text-sm font-medium tabular-nums ${changeColor(latest.direction)}`}
            >
              {latest.change3h > 0 ? "+" : ""}
              {latest.change3h.toFixed(1)} hPa / 3h
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{latest.label}</p>

        <ChartContainer config={chartConfig} className="h-[80px] w-full">
          <AreaChart
            data={sparkData}
            margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
          >
            <Area
              type="monotone"
              dataKey="pressure"
              stroke="var(--color-pressure)"
              fill="var(--color-pressure)"
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>

        {latest.change6h != null && (
          <p className="text-xs text-muted-foreground">
            6h change:{" "}
            <span className={`font-medium ${changeColor(latest.direction)}`}>
              {latest.change6h > 0 ? "+" : ""}
              {latest.change6h.toFixed(1)} hPa
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
