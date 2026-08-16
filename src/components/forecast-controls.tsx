"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Sun, Clock } from "lucide-react";

interface ForecastControlsState {
  dayRange: number;
  setDayRange: (d: number) => void;
  daylightOnly: boolean;
  setDaylightOnly: (v: boolean) => void;
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
}

const ForecastControlsContext = createContext<ForecastControlsState | null>(
  null,
);

export function ForecastControlsProvider({
  children,
  initialDate = null,
}: {
  children: ReactNode;
  initialDate?: string | null;
}) {
  const [dayRange, setDayRange] = useState(3);
  const [daylightOnly, setDaylightOnly] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);

  return (
    <ForecastControlsContext.Provider
      value={{
        dayRange,
        setDayRange: (d) => {
          setSelectedDate(null);
          setDayRange(d);
        },
        daylightOnly,
        setDaylightOnly,
        selectedDate,
        setSelectedDate,
      }}
    >
      {children}
    </ForecastControlsContext.Provider>
  );
}

export function useForecastControls() {
  const ctx = useContext(ForecastControlsContext);
  if (!ctx)
    throw new Error(
      "useForecastControls must be used within ForecastControlsProvider",
    );
  return ctx;
}

export function ForecastToggles() {
  const { dayRange, setDayRange, daylightOnly, setDaylightOnly } =
    useForecastControls();

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
      <div
        className="flex items-center gap-1 rounded-lg border p-1 w-full sm:w-auto"
        role="group"
        aria-label="Forecast day range"
      >
        {([1, 3, 5, 7] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDayRange(d)}
            aria-pressed={dayRange === d}
            aria-label={`${d} day forecast`}
            className={`min-h-11 flex-1 sm:flex-none rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              dayRange === d
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}D
          </button>
        ))}
      </div>
      <div
        className="flex items-center gap-1 rounded-lg border p-1 w-full sm:w-auto"
        role="group"
        aria-label="Daylight filter"
      >
        <button
          type="button"
          onClick={() => setDaylightOnly(true)}
          aria-pressed={daylightOnly}
          className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
          aria-pressed={!daylightOnly}
          className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !daylightOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          24 Hours
        </button>
      </div>
    </div>
  );
}
