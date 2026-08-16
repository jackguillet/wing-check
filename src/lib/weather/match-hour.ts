import type { ForecastHour } from "./types";
import { civilMinute } from "./civil-time";

/** Forecast hour that contains this civil clock (HH:00 is open until HH+1:00). */
export function forecastHourAt(
  hours: ForecastHour[],
  civil: string,
): ForecastHour | null {
  const now = civilMinute(civil);
  const floor = `${now.slice(0, 13)}:00`;
  return hours.find((h) => civilMinute(h.time) === floor) ?? null;
}
