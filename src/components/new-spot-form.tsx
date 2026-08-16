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

const initialState: SpotFormState = {};

function fieldError(
  state: SpotFormState,
  field: string,
): string | undefined {
  return state.fieldErrors?.[field]?.[0];
}

export function NewSpotForm() {
  const [state, formAction, pending] = useActionState(createSpot, initialState);

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wind Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minWindSpeed">Min Wind Speed (kt)</Label>
              <Input
                id="minWindSpeed"
                name="minWindSpeed"
                type="number"
                step="0.5"
                defaultValue="10"
              />
              {fieldError(state, "minWindSpeed") && (
                <p className="text-xs text-destructive">
                  {fieldError(state, "minWindSpeed")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxWindSpeed">Max Wind Speed (kt)</Label>
              <Input
                id="maxWindSpeed"
                name="maxWindSpeed"
                type="number"
                step="0.5"
                defaultValue="25"
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
                defaultValue="2.5"
              />
              <p className="text-xs text-muted-foreground">
                Higher ratios score lower; gusts at this ratio score 0 points
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minConsecutiveHours">Min Session Hours</Label>
              <Input
                id="minConsecutiveHours"
                name="minConsecutiveHours"
                type="number"
                defaultValue="2"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Preferred Wind Directions</Label>
            <DirectionPicker defaultValue="[]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="directionTolerance">
              Direction Tolerance (degrees)
            </Label>
            <Input
              id="directionTolerance"
              name="directionTolerance"
              type="number"
              defaultValue="45"
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
