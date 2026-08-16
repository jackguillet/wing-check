import type { RideableWindow } from "./evaluator";
import { degreesToCardinal } from "@/lib/weather/types";
import { logger } from "@/lib/logger";
import {
  formatCivilClock,
  formatCivilWeekdayDate,
} from "@/lib/weather/civil-time";
import {
  DEFAULT_UNITS,
  formatWind,
  type WindSpeedUnit,
} from "@/lib/units";

interface AlertPayload {
  spotName: string;
  windows: RideableWindow[];
  email: string;
  spotUrl?: string;
  windSpeedUnit?: WindSpeedUnit;
}

export async function sendAlert({
  spotName,
  windows,
  email,
  spotUrl,
  windSpeedUnit = DEFAULT_UNITS.windSpeedUnit,
}: AlertPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set, skipping email alert");
    return null;
  }

  const windowSummaries = windows
    .map((w) => {
      const start = `${formatCivilWeekdayDate(w.start)} ${formatCivilClock(w.start)}`;
      const end = formatCivilClock(w.end);
      return `${start} – ${end}: ${formatWind(w.avgWind, windSpeedUnit)} avg (gusts ${formatWind(w.avgGusts, windSpeedUnit)}), ${degreesToCardinal(w.dominantDirection)}, score ${w.avgScore}/100`;
    })
    .join("\n");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const first = windows[0];
  const subjectWhen = first
    ? ` ${formatCivilWeekdayDate(first.start)} ${formatCivilClock(first.start)}`
    : "";

  const result = await resend.emails.send({
    from: "Wing Check <alerts@wingcheck.dev>",
    to: email,
    subject: `Wind alert: ${spotName} looks rideable${subjectWhen}`,
    text: `Good conditions forecast at ${spotName}:\n\n${windowSummaries}\n\n${spotUrl ? `View the forecast: ${spotUrl}` : "Check your dashboard for full details."}`,
  });

  return result;
}
