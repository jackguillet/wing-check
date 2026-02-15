"use client";

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
import type { TidePoint } from "@/lib/weather/types";
import { format, parseISO } from "date-fns";

interface TideChartProps {
  tides: TidePoint[];
}

const chartConfig = {
  height: {
    label: "Tide (m)",
    color: "var(--chart-6)",
  },
} satisfies ChartConfig;

export function TideChart({ tides }: TideChartProps) {
  if (tides.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tides</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No tide data available for this location
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = tides.map((t) => ({
    time: t.time,
    label: format(parseISO(t.time), "EEE HH:mm"),
    height: t.height,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tides</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={Math.max(1, Math.floor(data.length / 6) - 1)}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11 }} width={44} unit=" m" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="height"
              stroke="var(--color-height)"
              fill="var(--color-height)"
              fillOpacity={0.3}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
