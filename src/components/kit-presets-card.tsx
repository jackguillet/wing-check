"use client";

import {
  activateKitPreset,
  deleteKitPreset,
  saveKitPreset,
} from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KitPreset } from "@/lib/db/schema";
import { MAX_KIT_PRESETS } from "@/lib/validations";

export function KitPresetsCard({
  presets,
  activeKitName,
  hasProfile,
}: {
  presets: KitPreset[];
  activeKitName: string | null;
  hasProfile: boolean;
}) {
  const atLimit = presets.length >= MAX_KIT_PRESETS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kit presets</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Name the kit you ride (Lake vs Gorge) and switch without retyping
          numbers. Activating a preset becomes your default on every spot
          without a custom window.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No named kits yet. Save your current default below.
          </p>
        ) : (
          <ul className="space-y-3">
            {presets.map((preset) => {
              const active = preset.name === activeKitName;
              const band = `${Math.round(preset.minWindSpeed)}–${Math.round(preset.maxWindSpeed)} kt`;
              return (
                <li
                  key={preset.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {preset.name}
                      {active ? (
                        <span className="ml-2 text-xs font-normal text-green-700 dark:text-green-400">
                          Active
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{band}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={activateKitPreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={active ? "secondary" : "outline"}
                        disabled={active}
                      >
                        {active ? "Active" : "Activate"}
                      </Button>
                    </form>
                    <form action={deleteKitPreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <form action={saveKitPreset} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="kitPresetName">Preset name</Label>
            <Input
              id="kitPresetName"
              name="name"
              maxLength={40}
              placeholder="Lake"
              disabled={!hasProfile || atLimit}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!hasProfile || atLimit}>
            Save current kit as preset
          </Button>
          {!hasProfile ? (
            <p className="text-xs text-muted-foreground">
              Save a default kit above first.
            </p>
          ) : atLimit ? (
            <p className="text-xs text-muted-foreground">
              You already have {MAX_KIT_PRESETS} presets. Delete one to add
              another.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Saving a name you already use overwrites that preset.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
