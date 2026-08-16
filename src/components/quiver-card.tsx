"use client";

import { addWing, deleteWing, updateRiderWeight } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Wing } from "@/lib/db/schema";
import {
  COMMON_WING_SIZES,
  DEFAULT_RIDER_WEIGHT_KG,
  MAX_WINGS,
  bandForWing,
  formatWingSize,
  kgToLbs,
  lbsToKg,
} from "@/lib/wings";

export function QuiverCard({
  wings,
  riderWeightKg,
}: {
  wings: Wing[];
  riderWeightKg: number | null;
}) {
  const atLimit = wings.length >= MAX_WINGS;
  const owned = new Set(wings.map((w) => w.sizeM2));
  const assumingDefault = riderWeightKg == null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My quiver</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Hours are scored against the best wing you own. A 12 kt day can be
          GO if you have a 6m — and the forecast will say to bring it.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={updateRiderWeight} className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="riderWeight">Rider weight</Label>
              <Input
                id="riderWeight"
                name="weight"
                type="number"
                step="0.5"
                min={1}
                defaultValue={
                  riderWeightKg != null
                    ? String(Math.round(riderWeightKg * 10) / 10)
                    : String(DEFAULT_RIDER_WEIGHT_KG)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightUnit">Unit</Label>
              <select
                id="weightUnit"
                name="weightUnit"
                defaultValue="kg"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(e) => {
                  const input = document.getElementById(
                    "riderWeight",
                  ) as HTMLInputElement | null;
                  if (!input) return;
                  const n = Number(input.value);
                  if (!Number.isFinite(n) || n <= 0) return;
                  input.value =
                    e.target.value === "lb"
                      ? String(Math.round(kgToLbs(n)))
                      : String(Math.round(lbsToKg(n) * 10) / 10);
                }}
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {assumingDefault
              ? `Bands assume ${DEFAULT_RIDER_WEIGHT_KG} kg (${Math.round(kgToLbs(DEFAULT_RIDER_WEIGHT_KG))} lb) until you save a weight.`
              : "Heavier riders get a slightly higher wind band on the same wing."}
          </p>
          <Button type="submit" variant="outline" size="sm">
            Save weight
          </Button>
        </form>

        {wings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wings yet. Add the sizes you actually own.
          </p>
        ) : (
          <ul className="space-y-2">
            {wings.map((wing) => {
              const band = bandForWing(wing.sizeM2, riderWeightKg);
              return (
                <li
                  key={wing.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatWingSize(wing.sizeM2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {band.minWindSpeed}–{band.maxWindSpeed} kt
                    </p>
                  </div>
                  <form action={deleteWing}>
                    <input type="hidden" name="id" value={wing.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Remove
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Quick add</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_WING_SIZES.map((size) => {
              const have = owned.has(size);
              return (
                <form action={addWing} key={size}>
                  <input type="hidden" name="sizeM2" value={size} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={have ? "secondary" : "outline"}
                    disabled={have || atLimit}
                  >
                    {formatWingSize(size)}
                  </Button>
                </form>
              );
            })}
          </div>
        </div>

        <form action={addWing} className="flex items-end gap-2">
          <div className="space-y-2 flex-1">
            <Label htmlFor="customWing">Custom size (m²)</Label>
            <Input
              id="customWing"
              name="sizeM2"
              type="number"
              step="0.1"
              min={2.5}
              max={8}
              placeholder="4.8"
              disabled={atLimit}
            />
          </div>
          <Button type="submit" variant="outline" disabled={atLimit}>
            Add
          </Button>
        </form>
        {atLimit ? (
          <p className="text-xs text-muted-foreground">
            You already have {MAX_WINGS} wings. Remove one to add another.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
