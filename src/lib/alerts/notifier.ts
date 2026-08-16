import type { RideableWindow } from "./evaluator";
import { degreesToCardinal } from "@/lib/weather/types";
import { logger } from "@/lib/logger";

interface AlertPayload {
  spotName: string;
  windows: RideableWindow[];
  email: string;
  spotUrl?: string;
}

export async function sendAlert({
  spotName,
  windows,
  email,
  spotUrl,
}: AlertPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set, skipping email alert");
    return null;
  }

  const windowSummaries = windows
    .map((w) => {
      const start = new Date(w.start).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const end = new Date(w.end).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${start} – ${end}: ${w.avgWind}kt avg (gusts ${w.avgGusts}kt), ${degreesToCardinal(w.dominantDirection)}, score ${w.avgScore}/100`;
    })
    .join("\n");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from: "Wing Check <alerts@wingcheck.dev>",
    to: email,
    subject: `Wind alert: ${spotName} looks rideable!`,
    text: `Good conditions forecast at ${spotName}:\n\n${windowSummaries}\n\n${spotUrl ? `View the forecast: ${spotUrl}` : "Check your dashboard for full details."}`,
  });

  return result;
}
