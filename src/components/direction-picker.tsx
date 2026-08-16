"use client";

import { useMemo, useState } from "react";
import { COMPASS_POINTS, directionsFromStored } from "@/lib/directions";
import { cn } from "@/lib/utils";

interface DirectionPickerProps {
  name?: string;
  defaultValue?: string;
  id?: string;
}

export function DirectionPicker({
  name = "preferredDirections",
  defaultValue = "[]",
  id,
}: DirectionPickerProps) {
  const [selected, setSelected] = useState<number[]>(() =>
    directionsFromStored(defaultValue),
  );

  const serialized = useMemo(() => JSON.stringify(selected), [selected]);

  function toggle(deg: number) {
    setSelected((current) =>
      current.includes(deg)
        ? current.filter((d) => d !== deg)
        : [...current, deg].sort((a, b) => a - b),
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} id={id} value={serialized} />
      <div className="flex flex-wrap gap-1.5">
        {COMPASS_POINTS.map((point) => {
          const isOn = selected.includes(point.deg);
          return (
            <button
              key={point.label}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(point.deg)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                isOn
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {point.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length === 0
          ? "Any direction. Click a bearing to restrict it."
          : `${selected.length} preferred ${selected.length === 1 ? "direction" : "directions"}`}
      </p>
    </div>
  );
}
