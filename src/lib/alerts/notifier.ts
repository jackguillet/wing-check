import type { RideableWindow } from "./evaluator";
import { degreesToCardinal } from "@/lib/weather/types";
import {
  formatCivilClock,
  formatCivilWeekdayDate,
} from "@/lib/weather/civil-time";
import {
  DEFAULT_UNITS,
  formatWind,
  type WindSpeedUnit,
} from "@/lib/units";
import { requireResendKey } from "@/lib/mail";
import { getAppUrl } from "@/lib/app-url";
import { createUnsubscribeToken } from "./unsubscribe";

interface AlertPayload {
  spotName: string;
  windows: RideableWindow[];
  email: string;
  userId: string;
  spotUrl?: string;
  windSpeedUnit?: WindSpeedUnit;
}

export async function sendAlert({
  spotName,
  windows,
  email,
  userId,
  spotUrl,
  windSpeedUnit = DEFAULT_UNITS.windSpeedUnit,
}: AlertPayload) {
  const apiKey = requireResendKey();
  if (!apiKey) return null;

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

  const unsubUrl = `${getAppUrl()}/api/alerts/unsubscribe?token=${createUnsubscribeToken(userId)}`;

  const result = await resend.emails.send({
    from: "Wing Check <alerts@wingcheck.dev>",
    to: email,
    subject: `Wind alert: ${spotName} looks rideable${subjectWhen}`,
    text: `Good conditions forecast at ${spotName}:\n\n${windowSummaries}\n\n${spotUrl ? `View the forecast: ${spotUrl}\n\n` : ""}Unsubscribe: ${unsubUrl}`,
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  return result;
}
