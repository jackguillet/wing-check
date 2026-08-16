"use client";

import { useActionState } from "react";
import { updateSpot, type SpotFormState } from "@/lib/actions/spots";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: SpotFormState = {};

export function EditSpotForm({
  spotId,
  name,
  latitude,
  longitude,
  noaaStationId,
  notes,
}: {
  spotId: number;
  name: string;
  latitude: number;
  longitude: number;
  noaaStationId: string | null;
  notes: string | null;
}) {
  const action = updateSpot.bind(null, spotId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit pin</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              Spot saved. Forecast will refresh on next load if the pin moved.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="editName">Name</Label>
            <Input id="editName" name="name" defaultValue={name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editLat">Latitude</Label>
              <Input
                id="editLat"
                name="latitude"
                type="number"
                step="0.0001"
                defaultValue={latitude}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLng">Longitude</Label>
              <Input
                id="editLng"
                name="longitude"
                type="number"
                step="0.0001"
                defaultValue={longitude}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editNoaa">NOAA tide station</Label>
            <Input
              id="editNoaa"
              name="noaaStationId"
              defaultValue={noaaStationId ?? ""}
              placeholder="Leave blank to pick the nearest honest station"
            />
            <p className="text-xs text-muted-foreground">
              Clear this after moving the pin to re-pick a nearby station.
              Stations farther than 80 km are not shown as tide.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editNotes">Notes</Label>
            <Textarea
              id="editNotes"
              name="notes"
              maxLength={500}
              defaultValue={notes ?? ""}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save pin"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
