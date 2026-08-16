"use client";

import { useActionState } from "react";
import { updateSpotCriteria, type SpotFormState } from "@/lib/actions/spots";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DirectionPicker } from "@/components/direction-picker";
import type { AlertCriteria } from "@/lib/db/schema";
import { useUnits } from "@/components/units-provider";
import { fromKnots, roundTo, windUnitLabel } from "@/lib/units";

interface CriteriaFormProps {
  spotId: number;
  criteria: AlertCriteria | null;
}

const initialState: SpotFormState = {};

function fieldError(state: SpotFormState, field: string): string | undefined {
  return state.fieldErrors?.[field]?.[0];
}

export function CriteriaForm({ spotId, criteria }: CriteriaFormProps) {
  const { windSpeedUnit } = useUnits();
  const windLabel = windUnitLabel(windSpeedUnit);
  const action = updateSpotCriteria.bind(null, spotId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Criteria</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          {state.ok && (
            <p className="text-sm text-green-700 dark:text-green-400">
              Criteria saved.
            </p>
          )}
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
                defaultValue={
                  criteria
                    ? roundTo(fromKnots(criteria.minWindSpeed, windSpeedUnit))
                    : undefined
                }
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
                defaultValue={
                  criteria
                    ? roundTo(fromKnots(criteria.maxWindSpeed, windSpeedUnit))
                    : undefined
                }
              />
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
                defaultValue={criteria?.maxGustFactor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minConsecutiveHours">Min Hours</Label>
              <Input
                id="minConsecutiveHours"
                name="minConsecutiveHours"
                type="number"
                defaultValue={criteria?.minConsecutiveHours}
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Preferred Directions</Label>
            <DirectionPicker
              defaultValue={criteria?.preferredDirections ?? "[]"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="directionTolerance">Direction Tolerance (°)</Label>
            <Input
              id="directionTolerance"
              name="directionTolerance"
              type="number"
              defaultValue={criteria?.directionTolerance}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxWaveHeight">Max Wave Height (m)</Label>
            <Input
              id="maxWaveHeight"
              name="maxWaveHeight"
              type="number"
              step="0.1"
              defaultValue={criteria?.maxWaveHeight ?? ""}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Update Criteria"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
