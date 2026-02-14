import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spots, alertCriteria, alertHistory, preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { evaluateSpot } from "@/lib/alerts/evaluator";
import { sendAlert } from "@/lib/alerts/notifier";

export async function GET(request: Request) {
  // Optional: verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefsRows = await db.select().from(preferences);
  const prefs = prefsRows[0];
  if (!prefs?.alertsEnabled || !prefs.email) {
    return NextResponse.json({ message: "Alerts disabled or no email" });
  }

  const allSpots = await db.select().from(spots);
  const results = [];

  for (const spot of allSpots) {
    const criteriaRows = await db
      .select()
      .from(alertCriteria)
      .where(eq(alertCriteria.spotId, spot.id));
    const criteria = criteriaRows[0];

    if (!criteria) continue;

    const forecast = await getSpotForecast(spot.id);
    if (!forecast) continue;

    const evaluation = evaluateSpot(forecast.hours, criteria);

    if (evaluation.goNoGo === "go" && evaluation.rideableWindows.length > 0) {
      // Check if we already sent an alert recently
      const allHistory = await db
        .select()
        .from(alertHistory)
        .where(eq(alertHistory.spotId, spot.id));
      const recent = allHistory.filter((h) => {
        const hoursSince =
          (Date.now() - h.sentAt.getTime()) / (1000 * 60 * 60);
        return hoursSince < prefs.checkIntervalHours;
      });

      if (recent.length > 0) continue;

      const result = await sendAlert({
        spotName: spot.name,
        windows: evaluation.rideableWindows,
        email: prefs.email,
      });

      await db.insert(alertHistory)
        .values({
          spotId: spot.id,
          sentAt: new Date(),
          alertType: "go",
          forecastSummary: JSON.stringify({
            score: evaluation.overallScore,
            windows: evaluation.rideableWindows.length,
            bestWindow: evaluation.bestWindow,
          }),
        });

      results.push({ spot: spot.name, sent: true, result });
    } else {
      results.push({ spot: spot.name, sent: false, goNoGo: evaluation.goNoGo });
    }
  }

  return NextResponse.json({ checked: allSpots.length, results });
}
