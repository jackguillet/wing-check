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
import type { ForecastHour } from "@/lib/weather/types";
import { format, parseISO } from "date-fns";

interface PressureChartProps {
  hours: ForecastHour[];
}

const chartConfig = {
  pressureMsl: {
    label: "Pressure (hPa)",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export function PressureChart({ hours }: PressureChartProps) {
  const hasPressure = hours.some((h) => h.pressureMsl != null);

  if (!hasPressure) {
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

  const data = hours.map((h) => ({
    time: h.time,
    label: format(parseISO(h.time), "EEE HH:mm"),
    pressureMsl: h.pressureMsl,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barometric Pressure</CardTitle>
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
            <YAxis
              tick={{ fontSize: 11 }}
              width={56}
              unit=" hPa"
              domain={["auto", "auto"]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="pressureMsl"
              stroke="var(--color-pressureMsl)"
              fill="var(--color-pressureMsl)"
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
