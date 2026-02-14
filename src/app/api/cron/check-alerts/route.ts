import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  user,
  spots,
  alertCriteria,
  alertHistory,
  preferences,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { evaluateSpot } from "@/lib/alerts/evaluator";
import { sendAlert } from "@/lib/alerts/notifier";
import {
  fetchWeatherForecast,
  fetchMarineForecast,
  mergeForecasts,
} from "@/lib/weather/open-meteo";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all users with alerts enabled and an email set
  const allPrefs = await db.select().from(preferences);
  const enabledPrefs = allPrefs.filter((p) => p.alertsEnabled && p.email);

  if (enabledPrefs.length === 0) {
    return NextResponse.json({ message: "No users with alerts enabled" });
  }

  const results = [];

  for (const prefs of enabledPrefs) {
    // Get this user's spots
    const userSpots = await db
      .select()
      .from(spots)
      .where(eq(spots.userId, prefs.userId));

    for (const spot of userSpots) {
      const criteriaRows = await db
        .select()
        .from(alertCriteria)
        .where(eq(alertCriteria.spotId, spot.id));
      const criteria = criteriaRows[0];

      if (!criteria) continue;

      // Fetch forecast directly (no session needed for cron)
      const [weather, marine] = await Promise.all([
        fetchWeatherForecast(spot.latitude, spot.longitude),
        fetchMarineForecast(spot.latitude, spot.longitude),
      ]);
      const hours = mergeForecasts(weather, marine);

      const evaluation = evaluateSpot(hours, criteria);

      if (
        evaluation.goNoGo === "go" &&
        evaluation.rideableWindows.length > 0
      ) {
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
          email: prefs.email!,
        });

        await db.insert(alertHistory).values({
          spotId: spot.id,
          sentAt: new Date(),
          alertType: "go",
          forecastSummary: JSON.stringify({
            score: evaluation.overallScore,
            windows: evaluation.rideableWindows.length,
            bestWindow: evaluation.bestWindow,
          }),
        });

        results.push({
          user: prefs.userId,
          spot: spot.name,
          sent: true,
          result,
        });
      } else {
        results.push({
          user: prefs.userId,
          spot: spot.name,
          sent: false,
          goNoGo: evaluation.goNoGo,
        });
      }
    }
  }

  return NextResponse.json({ usersChecked: enabledPrefs.length, results });
}
