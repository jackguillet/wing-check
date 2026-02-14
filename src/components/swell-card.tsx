import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ForecastHour } from "@/lib/weather/types";
import { degreesToCardinal } from "@/lib/weather/types";

interface SwellCardProps {
  hours: ForecastHour[];
}

export function SwellCard({ hours }: SwellCardProps) {
  // Find the next hours with swell data
  const now = new Date().toISOString();
  const upcoming = hours.filter(
    (h) => h.time >= now && h.swellHeight != null
  );
  const current = upcoming[0];

  if (!current || current.swellHeight == null) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swell</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold">{current.swellHeight?.toFixed(1)}m</p>
            <p className="text-muted-foreground text-xs">Height</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{current.swellPeriod?.toFixed(0)}s</p>
            <p className="text-muted-foreground text-xs">Period</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {current.swellDirection != null
                ? degreesToCardinal(current.swellDirection)
                : "—"}
            </p>
            <p className="text-muted-foreground text-xs">Direction</p>
          </div>
        </div>
        {current.waveHeight != null && (
          <div className="mt-4 border-t pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-lg font-semibold">{current.waveHeight?.toFixed(1)}m</p>
                <p className="text-muted-foreground text-xs">Wave Height</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{current.wavePeriod?.toFixed(0)}s</p>
                <p className="text-muted-foreground text-xs">Wave Period</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {current.waveDirection != null
                    ? degreesToCardinal(current.waveDirection)
                    : "—"}
                </p>
                <p className="text-muted-foreground text-xs">Wave Dir</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
