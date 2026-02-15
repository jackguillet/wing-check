"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Sun, Clock } from "lucide-react";

interface ForecastControlsState {
  dayRange: number;
  setDayRange: (d: number) => void;
  daylightOnly: boolean;
  setDaylightOnly: (v: boolean) => void;
}

const ForecastControlsContext = createContext<ForecastControlsState | null>(null);

export function ForecastControlsProvider({ children }: { children: ReactNode }) {
  const [dayRange, setDayRange] = useState(3);
  const [daylightOnly, setDaylightOnly] = useState(true);

  return (
    <ForecastControlsContext.Provider value={{ dayRange, setDayRange, daylightOnly, setDaylightOnly }}>
      {children}
    </ForecastControlsContext.Provider>
  );
}

export function useForecastControls() {
  const ctx = useContext(ForecastControlsContext);
  if (!ctx) throw new Error("useForecastControls must be used within ForecastControlsProvider");
  return ctx;
}

export function ForecastToggles() {
  const { dayRange, setDayRange, daylightOnly, setDaylightOnly } = useForecastControls();

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg border p-1">
        {([1, 3, 5, 7] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDayRange(d)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              dayRange === d
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}D
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg border p-1">
        <button
          type="button"
          onClick={() => setDaylightOnly(true)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            daylightOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
          Daylight
        </button>
        <button
          type="button"
          onClick={() => setDaylightOnly(false)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !daylightOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          24 Hours
        </button>
      </div>
    </>
  );
}
