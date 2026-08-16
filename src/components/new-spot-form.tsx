"use client";

import { useActionState } from "react";
import { createSpot, type SpotFormState } from "@/lib/actions/spots";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DirectionPicker } from "@/components/direction-picker";
import { SpotLocationPicker } from "@/components/spot-location-picker";
import { useUnits } from "@/components/units-provider";
import { fromKnots, roundTo, windUnitLabel } from "@/lib/units";
import { defaultCriteria } from "@/lib/alerts/evaluator";
import type { CriteriaFields } from "@/lib/criteria";

const initialState: SpotFormState = {};

function fieldError(
  state: SpotFormState,
  field: string,
): string | undefined {
  return state.fieldErrors?.[field]?.[0];
}

export function NewSpotForm({
  defaultWind,
}: {
  defaultWind?: CriteriaFields | null;
}) {
  const { windSpeedUnit } = useUnits();
  const windLabel = windUnitLabel(windSpeedUnit);
  const [state, formAction, pending] = useActionState(createSpot, initialState);
  const wind = defaultWind ?? defaultCriteria;

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {state.error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Spot Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Crissy Field"
              required
            />
            {fieldError(state, "name") && (
              <p className="text-xs text-destructive">
                {fieldError(state, "name")}
              </p>
            )}
          </div>
          <SpotLocationPicker
            latitudeError={fieldError(state, "latitude")}
            longitudeError={fieldError(state, "longitude")}
          />
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Best at mid-tide, watch for kiteboarders..."
            />
            {fieldError(state, "notes") && (
              <p className="text-xs text-destructive">
                {fieldError(state, "notes")}
              </p>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="visibility"
              value="public"
              className="mt-1"
            />
            <span>
              List in the public catalog. Leave unchecked to keep this pin
              private — only you can open the link.
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalog wind (optional)</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Saved as this pin&apos;s catalog default. Your kit and quiver
            still score it unless you later save a custom window on the
            spot.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minWindSpeed">
                Min Wind Speed ({windLabel})
              </Label>
              <Input
                id="minWindSpeed"
                name="minWindSpeed"
                type="number"
                step="0.5"
                defaultValue={roundTo(
                  fromKnots(wind.minWindSpeed, windSpeedUnit),
                )}
              />
              {fieldError(state, "minWindSpeed") && (
                <p className="text-xs text-destructive">
                  {fieldError(state, "minWindSpeed")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxWindSpeed">
                Max Wind Speed ({windLabel})
              </Label>
              <Input
                id="maxWindSpeed"
                name="maxWindSpeed"
                type="number"
                step="0.5"
                defaultValue={roundTo(
                  fromKnots(wind.maxWindSpeed, windSpeedUnit),
                )}
              />
              {fieldError(state, "maxWindSpeed") && (
                <p className="text-xs text-destructive">
                  {fieldError(state, "maxWindSpeed")}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxGustFactor">Max Gust Factor</Label>
              <Input
                id="maxGustFactor"
                name="maxGustFactor"
                type="number"
                step="0.1"
                defaultValue={wind.maxGustFactor}
              />
              <p className="text-xs text-muted-foreground">
                Soft curve only. Gusts above 50 kt still zero the hour.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minConsecutiveHours">Min Session Hours</Label>
              <Input
                id="minConsecutiveHours"
                name="minConsecutiveHours"
                type="number"
                defaultValue={wind.minConsecutiveHours}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Preferred Wind Directions</Label>
            <DirectionPicker
              defaultValue={wind.preferredDirections ?? "[]"}
            />
            <p className="text-xs text-muted-foreground">
              If you pick dirs, hours outside the tolerance cannot GO.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="directionTolerance">
              Direction Tolerance (degrees)
            </Label>
            <Input
              id="directionTolerance"
              name="directionTolerance"
              type="number"
              defaultValue={wind.directionTolerance}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxWaveHeight">Max Wave Height (m, optional)</Label>
            <Input
              id="maxWaveHeight"
              name="maxWaveHeight"
              type="number"
              step="0.1"
              placeholder="Leave empty for no limit"
              defaultValue={wind.maxWaveHeight ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Adding spot…" : "Add Spot"}
      </Button>
    </form>
  );
}
