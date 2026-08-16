"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ForecastHour } from "@/lib/weather/types";
import type { AlertCriteria } from "@/lib/db/schema";
import { format, parseISO } from "date-fns";
import { useUnits } from "@/components/units-provider";
import { fromKnots, windUnitLabel } from "@/lib/units";

interface WindChartProps {
  hours: ForecastHour[];
  criteria: AlertCriteria | null;
}

export function WindChart({ hours, criteria }: WindChartProps) {
  const { windSpeedUnit } = useUnits();
  const unit = windUnitLabel(windSpeedUnit);
  const minWind = fromKnots(criteria?.minWindSpeed ?? 10, windSpeedUnit);
  const maxWind = fromKnots(criteria?.maxWindSpeed ?? 25, windSpeedUnit);

  const chartConfig = {
    windSpeed: {
      label: `Wind Speed (${unit})`,
      color: "var(--chart-1)",
    },
    windGusts: {
      label: `Gusts (${unit})`,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  const data = hours.map((h) => ({
    time: h.time,
    label: format(parseISO(h.time), "EEE HH:mm"),
    windSpeed: fromKnots(h.windSpeed, windSpeedUnit),
    windGusts: fromKnots(h.windGusts, windSpeedUnit),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wind Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={Math.max(1, Math.floor(data.length / 6) - 1)}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11 }} width={56} unit={` ${unit}`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ReferenceArea
              y1={minWind}
              y2={maxWind}
              fill="hsl(142, 76%, 36%)"
              fillOpacity={0.12}
              strokeOpacity={0}
              ifOverflow="extendDomain"
            />
            <ReferenceLine
              y={minWind}
              stroke="hsl(142, 76%, 36%)"
              strokeDasharray="4 4"
              label={{ value: "Min", position: "left", fontSize: 10 }}
            />
            <ReferenceLine
              y={maxWind}
              stroke="hsl(0, 84%, 60%)"
              strokeDasharray="4 4"
              label={{ value: "Max", position: "left", fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="windGusts"
              stroke="var(--color-windGusts)"
              fill="var(--color-windGusts)"
              fillOpacity={0.1}
              strokeWidth={1}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="windSpeed"
              stroke="var(--color-windSpeed)"
              fill="var(--color-windSpeed)"
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
