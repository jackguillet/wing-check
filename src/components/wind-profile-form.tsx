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
import { SKILL_KITS, type CriteriaFields, type RiderSkill } from "@/lib/criteria";
import { defaultCriteria } from "@/lib/alerts/evaluator";

export function WindProfileForm({
  profile,
  next,
  skill,
  sessionStartHour,
  sessionEndHour,
  preferredTide,
  activeKitName,
}: {
  profile: CriteriaFields | null;
  next?: string;
  skill?: string | null;
  sessionStartHour?: number | null;
  sessionEndHour?: number | null;
  preferredTide?: string | null;
  activeKitName?: string | null;
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
          spot. If you add a quiver below, wind is scored against those
          wings instead of this min/max. Leave this unset to keep using
          each spot&apos;s catalog default.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            Default kit is on
            {activeKitName?.trim() ? ` · ${activeKitName.trim()}` : ""}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No default kit yet. Saving here applies these numbers everywhere.
          </p>
        )}
        <form action={updateWindProfile} className="space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div className="space-y-2">
            <Label htmlFor="skill">Skill</Label>
            <select
              id="skill"
              name="skill"
              defaultValue={skill ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => {
                const kit = SKILL_KITS[e.target.value as RiderSkill];
                if (!kit) return;
                const min = document.getElementById(
                  "profileMinWind",
                ) as HTMLInputElement | null;
                const max = document.getElementById(
                  "profileMaxWind",
                ) as HTMLInputElement | null;
                if (min) min.value = String(roundTo(fromKnots(kit.minWindSpeed, windSpeedUnit)));
                if (max) max.value = String(roundTo(fromKnots(kit.maxWindSpeed, windSpeedUnit)));
              }}
            >
              <option value="">Not set</option>
              <option value="beginner">Beginner (tighter band)</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced (wider band)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Picking a skill fills a conservative or wider wind band. You can
              still edit the numbers.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionStartHour">Ride from (hour)</Label>
              <Input
                id="sessionStartHour"
                name="sessionStartHour"
                type="number"
                min={0}
                max={23}
                placeholder="e.g. 7"
                defaultValue={sessionStartHour ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionEndHour">Ride until (hour)</Label>
              <Input
                id="sessionEndHour"
                name="sessionEndHour"
                type="number"
                min={0}
                max={23}
                placeholder="e.g. 11"
                defaultValue={sessionEndHour ?? ""}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave blank for any daylight hour. A mornings-only rider (7–11)
            will not get a GO for a 3–6pm window.
          </p>
          <div className="space-y-2">
            <Label htmlFor="preferredTide">Tide preference</Label>
            <select
              id="preferredTide"
              name="preferredTide"
              defaultValue={preferredTide ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any tide</option>
              <option value="rising">Incoming / rising</option>
              <option value="falling">Outgoing / falling</option>
              <option value="mid">High or low slack</option>
            </select>
          </div>
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
            <p className="text-xs text-muted-foreground">
              If you pick dirs, hours outside the tolerance cannot GO.
            </p>
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
