"use client";

import { clearWindProfile, updateWindProfile } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DirectionPicker } from "@/components/direction-picker";
import { useUnits } from "@/components/units-provider";
import { fromKnots, roundTo, windUnitLabel } from "@/lib/units";
import type { CriteriaFields } from "@/lib/criteria";
import { defaultCriteria } from "@/lib/alerts/evaluator";

export function WindProfileForm({
  profile,
}: {
  profile: CriteriaFields | null;
}) {
  const { windSpeedUnit } = useUnits();
  const windLabel = windUnitLabel(windSpeedUnit);
  const source = profile ?? defaultCriteria;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My default wind</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Used to score every spot unless you save a custom window on that
          spot. Leave this unset to keep using each spot&apos;s catalog
          default.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            Default kit is on.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No default kit yet. Saving here applies these numbers everywhere.
          </p>
        )}
        <form action={updateWindProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profileMinWind">
                Min Wind Speed ({windLabel})
              </Label>
              <Input
                id="profileMinWind"
                name="minWindSpeed"
                type="number"
                step="0.5"
                defaultValue={roundTo(
                  fromKnots(source.minWindSpeed, windSpeedUnit),
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileMaxWind">
                Max Wind Speed ({windLabel})
              </Label>
              <Input
                id="profileMaxWind"
                name="maxWindSpeed"
                type="number"
                step="0.5"
                defaultValue={roundTo(
                  fromKnots(source.maxWindSpeed, windSpeedUnit),
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profileGust">Max Gust Factor</Label>
              <Input
                id="profileGust"
                name="maxGustFactor"
                type="number"
                step="0.1"
                defaultValue={source.maxGustFactor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileHours">Min Hours</Label>
              <Input
                id="profileHours"
                name="minConsecutiveHours"
                type="number"
                defaultValue={source.minConsecutiveHours}
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Preferred Directions</Label>
            <DirectionPicker
              defaultValue={source.preferredDirections ?? "[]"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileTolerance">Direction Tolerance (°)</Label>
            <Input
              id="profileTolerance"
              name="directionTolerance"
              type="number"
              defaultValue={source.directionTolerance}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileWave">Max Wave Height (m)</Label>
            <Input
              id="profileWave"
              name="maxWaveHeight"
              type="number"
              step="0.1"
              defaultValue={source.maxWaveHeight ?? ""}
            />
          </div>
          <Button type="submit">Save default wind</Button>
        </form>
        {profile && (
          <form action={clearWindProfile}>
            <Button type="submit" variant="outline">
              Clear default (use catalog numbers)
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
