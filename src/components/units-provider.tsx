"use client";

import { createContext, useContext } from "react";
import { DEFAULT_UNITS, type DisplayUnits } from "@/lib/units";

const UnitsContext = createContext<DisplayUnits>(DEFAULT_UNITS);

export function UnitsProvider({
  units,
  children,
}: {
  units: DisplayUnits;
  children: React.ReactNode;
}) {
  return (
    <UnitsContext.Provider value={units}>{children}</UnitsContext.Provider>
  );
}

export function useUnits(): DisplayUnits {
  return useContext(UnitsContext);
}
