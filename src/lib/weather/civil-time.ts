/**
 * Forecast and tide times are offset-less spot-local strings
 * ("2026-02-14T12:00" or "2026-02-14T12:00:00"). Never interpret them
 * with `new Date(...)` / `toISOString()` — those use the runtime zone.
 */

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Normalize to `YYYY-MM-DDTHH:mm` for string compare. */
export function civilMinute(isoLike: string): string {
  const normalized = isoLike.trim().replace(" ", "T");
  if (normalized.length >= 16) return normalized.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T00:00`;
  return normalized;
}

export function civilDate(isoLike: string): string {
  return civilMinute(isoLike).slice(0, 10);
}

export function parseCivil(isoLike: string): {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
} {
  const s = civilMinute(isoLike);
  return {
    y: Number(s.slice(0, 4)),
    mo: Number(s.slice(5, 7)),
    d: Number(s.slice(8, 10)),
    h: Number(s.slice(11, 13)),
    mi: Number(s.slice(14, 16)),
  };
}

/** Linear minutes since Unix epoch, treating the civil clock as UTC. */
export function civilToMinutes(isoLike: string): number {
  const { y, mo, d, h, mi } = parseCivil(isoLike);
  return Date.UTC(y, mo - 1, d, h, mi) / 60_000;
}

export function minutesToCivil(minutes: number): string {
  const dt = new Date(Math.round(minutes) * 60_000);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const h = String(dt.getUTCHours()).padStart(2, "0");
  const mi = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function addCivilHours(isoLike: string, hours: number): string {
  return minutesToCivil(civilToMinutes(isoLike) + hours * 60);
}

export function addCivilDays(dateStr: string, days: number): string {
  const y = Number(dateStr.slice(0, 4));
  const mo = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Spot-local `YYYY-MM-DDTHH:mm` from a UTC instant and the spot's offset. */
export function spotLocalNow(
  utcOffsetSeconds: number,
  now: Date = new Date(),
): string {
  const dt = new Date(now.getTime() + utcOffsetSeconds * 1000);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const h = String(dt.getUTCHours()).padStart(2, "0");
  const mi = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function toYyyymmdd(dateStr: string): string {
  return civilDate(dateStr).replaceAll("-", "");
}

/**
 * An hourly slot `HH:00` is still open until `HH+1:00`.
 * `now == end+1h` means the hour just finished.
 */
export function hourIsOpen(hourTime: string, nowCivil: string): boolean {
  return addCivilHours(hourTime, 1) > civilMinute(nowCivil);
}

/**
 * Daylight uses the same civil-string compare as the evaluator:
 * include the hour if `sunrise <= time <= sunset`. No hour flooring.
 */
export function isDaylightCivil(
  time: string,
  sunrise: string[],
  sunset: string[],
): boolean {
  const datePrefix = civilDate(time);
  const rise = sunrise.find((s) => s.startsWith(datePrefix));
  const set = sunset.find((s) => s.startsWith(datePrefix));
  if (!rise || !set) return true;
  return civilMinute(time) >= civilMinute(rise) && civilMinute(time) <= civilMinute(set);
}

export function civilMidpoint(a: string, b: string): string {
  return minutesToCivil((civilToMinutes(a) + civilToMinutes(b)) / 2);
}

export function civilAbsDiffMinutes(a: string, b: string): number {
  return Math.abs(civilToMinutes(a) - civilToMinutes(b));
}

export function formatCivilClock(isoLike: string): string {
  return civilMinute(isoLike).slice(11, 16);
}

export function formatCivilWeekdayShort(dateStr: string): string {
  const { y, mo, d } = parseCivil(dateStr);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return WEEKDAYS_SHORT[dow];
}

export function formatCivilWeekdayDate(isoLike: string): string {
  const { y, mo, d } = parseCivil(isoLike);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[dow]}, ${MONTHS_SHORT[mo - 1]} ${d}`;
}

export function formatCivilWindow(start: string, end: string): string {
  return `${formatCivilWeekdayDate(start)} ${formatCivilClock(start)} – ${formatCivilClock(end)}`;
}
