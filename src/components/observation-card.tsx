"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetarHourDelta, MetarObservation } from "@/lib/weather/metar";
import type { ForecastHour } from "@/lib/weather/types";
import { degreesToCardinal } from "@/lib/weather/types";
import { formatTemp, formatWind, fromKnots, windUnitLabel } from "@/lib/units";
import { formatCivilClock } from "@/lib/weather/civil-time";
import { useUnits } from "@/components/units-provider";
import { cn } from "@/lib/utils";
import { comparePhrase, dayBiasPhrase } from "@/lib/weather/observation-copy";

function barColor(deltaKt: number): string {
  const mag = Math.abs(deltaKt);
  if (mag >= 8) return "bg-red-500";
  if (mag >= 4) return "bg-amber-500";
  return "bg-emerald-600";
}

function HourlyBias({
  series,
  unit,
}: {
  series: MetarHourDelta[];
  unit: Parameters<typeof fromKnots>[1];
}) {
  const unitLabel = windUnitLabel(unit);
  const maxAbs = Math.max(
    8,
    ...series.map((h) => (h.deltaKt == null ? 0 : Math.abs(h.deltaKt))),
  );
  const peak = series.reduce<{ hour: MetarHourDelta; mag: number } | null>(
    (best, hour) => {
      if (hour.deltaKt == null) return best;
      const mag = Math.abs(hour.deltaKt);
      if (!best || mag > best.mag) return { hour, mag };
      return best;
    },
    null,
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Hour by hour · airport minus forecast
      </p>
      <div
        className="flex items-stretch gap-px sm:gap-0.5 h-24"
        role="img"
        aria-label="Hourly difference between airport wind and the forecast"
      >
        {series.map((hour) => {
          const delta = hour.deltaKt;
          const up = delta != null && delta > 0;
          const down = delta != null && delta < 0;
          const pct =
            delta == null ? 0 : Math.min(100, (Math.abs(delta) / maxAbs) * 100);
          const label = formatCivilClock(hour.civilHour);
          const showLabel =
            label.endsWith(":00") && Number(label.slice(0, 2)) % 3 === 0;
          const title =
            hour.obsKt != null && hour.modelKt != null
              ? `${label} · airport ${fromKnots(hour.obsKt, unit).toFixed(0)} / forecast ${fromKnots(hour.modelKt, unit).toFixed(0)} ${unitLabel}`
              : `${label} · missing a reading`;
          return (
            <div
              key={hour.civilHour}
              className="flex-1 min-w-0 flex flex-col items-center"
              title={title}
            >
              <div className="relative w-full flex-1 flex flex-col">
                <div className="flex-1 flex items-end justify-center">
                  {up ? (
                    <div
                      className={cn("w-full max-w-3 rounded-t-sm", barColor(delta))}
                      style={{ height: `${pct}%` }}
                    />
                  ) : null}
                </div>
                <div className="h-px w-full bg-border" />
                <div className="flex-1 flex items-start justify-center">
                  {down ? (
                    <div
                      className={cn("w-full max-w-3 rounded-b-sm", barColor(delta))}
                      style={{ height: `${pct}%` }}
                    />
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  "mt-1 text-[10px] tabular-nums text-muted-foreground leading-none",
                  showLabel ? "visible" : "invisible",
                )}
              >
                {label.slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Lighter than forecast</span>
        <span>Windier than forecast</span>
      </div>
      {peak && peak.mag >= 8 && peak.hour.deltaKt != null ? (
        <p className="text-xs text-muted-foreground">
          Biggest swing {formatCivilClock(peak.hour.civilHour)} ·{" "}
          {peak.hour.deltaKt > 0 ? "+" : ""}
          {Math.round(fromKnots(peak.hour.deltaKt, unit))} {unitLabel}
        </p>
      ) : null}
    </div>
  );
}

export function ObservationCard({
  observation,
  model,
  timezone,
  series = [],
  bias = null,
}: {
  observation: MetarObservation;
  model: ForecastHour | null;
  timezone: string;
  series?: MetarHourDelta[];
  bias?: { n: number; meanKt: number } | null;
}) {
  const { windSpeedUnit, temperatureUnit } = useUnits();
  const unitLabel = windUnitLabel(windSpeedUnit);
  const observedAt = new Date(observation.observedAtUnix * 1000).toLocaleString(
    "en-US",
    {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      hour12: false,
    },
  );
  const delta =
    observation.windKt != null && model
      ? observation.windKt - model.windSpeed
      : null;
  const station =
    observation.name && observation.name !== observation.icaoId
      ? observation.name
      : observation.icaoId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Airport vs forecast</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          {station} ({observation.icaoId}) · {observation.km} km from the
          launch · {observedAt}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">At the airport</p>
            <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">
              {observation.windKt != null
                ? formatWind(observation.windKt, windSpeedUnit, 0)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {observation.windDir != null
                ? degreesToCardinal(observation.windDir)
                : "no direction"}
              {observation.gustKt != null
                ? ` · gusts ${formatWind(observation.gustKt, windSpeedUnit, 0)}`
                : ""}
              {observation.tempC != null
                ? ` · ${formatTemp(observation.tempC, temperatureUnit)}`
                : ""}
            </p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Forecast this hour</p>
            {model ? (
              <>
                <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">
                  {formatWind(model.windSpeed, windSpeedUnit, 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {degreesToCardinal(model.windDirection)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground mt-1">
                No matching forecast hour
              </p>
            )}
          </div>
        </div>

        {delta != null ? (
          <p className="font-medium">{comparePhrase(delta, unitLabel)}</p>
        ) : null}

        {bias ? (
          <p className="text-muted-foreground">{dayBiasPhrase(bias.meanKt, bias.n)}</p>
        ) : series.length > 0 ? (
          <p className="text-muted-foreground">
            Last day · not enough paired hours for a trend yet
          </p>
        ) : null}

        {series.length > 0 ? (
          <HourlyBias series={series} unit={windSpeedUnit} />
        ) : null}

        <p className="text-xs text-muted-foreground">
          This is the nearest airport, not the water. Use it to see if the
          model is in the ballpark — it does not change the grade.
        </p>
      </CardContent>
    </Card>
  );
}
