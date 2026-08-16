import type { RideableWindow } from "./evaluator";
import {
  addCivilHours,
  civilDate,
  civilMinute,
  hourIsOpen,
} from "@/lib/weather/civil-time";

/** Daily cron can see tomorrow morning; keep the look-ahead inside one Hobby run. */
export const ALERT_HORIZON_HOURS = 48;

export const GO_ALERT_PREFIX = "go:";

export function windowAlertType(windowStart: string): string {
  return `${GO_ALERT_PREFIX}${civilDate(windowStart)}`;
}

/**
 * Remaining GO windows (avg ≥ 70) that start before `now + horizon`.
 * In-progress windows (start already passed, end still open) are included.
 */
export function upcomingGoWindows(
  windows: RideableWindow[],
  nowCivil: string,
  horizonHours: number = ALERT_HORIZON_HOURS,
): RideableWindow[] {
  const now = civilMinute(nowCivil);
  const horizon = addCivilHours(now, horizonHours);
  return windows.filter((w) => {
    if (w.avgScore < 70) return false;
    if (!hourIsOpen(w.end, now)) return false;
    return civilMinute(w.start) < horizon;
  });
}

export function unsentGoWindows(
  windows: RideableWindow[],
  sentTypes: Iterable<string>,
): RideableWindow[] {
  const sent = sentTypes instanceof Set ? sentTypes : new Set(sentTypes);
  return windows.filter((w) => !sent.has(windowAlertType(w.start)));
}

export function uniqueWindowAlertTypes(windows: RideableWindow[]): string[] {
  return [...new Set(windows.map((w) => windowAlertType(w.start)))];
}
