"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetarHourDelta, MetarObservation } from "@/lib/weather/metar";
import type { ForecastHour } from "@/lib/weather/types";
import { degreesToCardinal } from "@/lib/weather/types";
import { formatTemp, formatWind } from "@/lib/units";
import { formatCivilClock } from "@/lib/weather/civil-time";
import { useUnits } from "@/components/units-provider";

function signedKt(delta: number): string {
  const n = Math.round(delta);
  if (n === 0) return "0";
  return `${n > 0 ? "+" : ""}${n}`;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observed vs model</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="font-medium">{observation.icaoId}</span>
          {" · "}
          {observation.km} km · {observedAt} {timezone}
        </p>
        <p>
          Observed{" "}
          {observation.windKt != null
            ? formatWind(observation.windKt, windSpeedUnit, 0)
            : "—"}
          {observation.windDir != null
            ? ` ${degreesToCardinal(observation.windDir)}`
            : ""}
          {observation.gustKt != null
            ? ` · gusts ${formatWind(observation.gustKt, windSpeedUnit, 0)}`
            : ""}
          {observation.tempC != null
            ? ` · ${formatTemp(observation.tempC, temperatureUnit)}`
            : ""}
        </p>
        {model ? (
          <p className="text-muted-foreground">
            Model this hour{" "}
            {formatWind(model.windSpeed, windSpeedUnit, 0)}{" "}
            {degreesToCardinal(model.windDirection)}
            {delta != null
              ? ` · obs ${delta >= 0 ? "+" : ""}${delta.toFixed(0)} kt vs model`
              : ""}
          </p>
        ) : (
          <p className="text-muted-foreground">
            No matching model hour for this observation time.
          </p>
        )}
        {bias ? (
          <p>
            Last 24h · obs averaging {signedKt(bias.meanKt)} kt vs model (
            {bias.n} hours)
          </p>
        ) : series.length > 0 ? (
          <p className="text-muted-foreground">
            Last 24h · not enough paired hours for a bias yet
          </p>
        ) : null}
        {series.length > 0 ? (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-mono">
            {series.map((hour) => (
              <span
                key={hour.civilHour}
                title={
                  hour.obsKt != null && hour.modelKt != null
                    ? `obs ${hour.obsKt.toFixed(0)} / model ${hour.modelKt.toFixed(0)}`
                    : "missing obs or model"
                }
              >
                <span className="text-muted-foreground">
                  {formatCivilClock(hour.civilHour)}
                </span>{" "}
                {hour.deltaKt == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  signedKt(hour.deltaKt)
                )}
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Airport METAR, not the launch. Use it as a check on the model.
        </p>
      </CardContent>
    </Card>
  );
}
