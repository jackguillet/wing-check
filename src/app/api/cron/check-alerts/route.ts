import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  spots,
  alertCriteria,
  userAlertCriteria,
  alertHistory,
  preferences,
  userSpots,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { evaluateSpot } from "@/lib/alerts/evaluator";
import { resolveCriteria, windProfileFromPrefs } from "@/lib/criteria";
import { sendAlert } from "@/lib/alerts/notifier";
import { getAppUrl } from "@/lib/app-url";
import { parseDisplayUnits } from "@/lib/units";
import {
  fetchWeatherForecast,
  fetchMarineForecast,
  mergeForecasts,
} from "@/lib/weather/open-meteo";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: Request) {
  const startTime = Date.now();

  // Verify cron secret — fail closed if not configured
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Bulk fetch: all users with alerts enabled and an email set
    const allPrefs = await db.select().from(preferences);
    const enabledPrefs = allPrefs.filter((p) => p.alertsEnabled && p.email);

    if (enabledPrefs.length === 0) {
      logger.info("No users with alerts enabled");
      return NextResponse.json({ message: "No users with alerts enabled" });
    }

    const enabledUserIds = enabledPrefs.map((p) => p.userId);

    // Bulk fetch: all subscriptions for enabled users
    const allSubscriptions = await db
      .select({ userId: userSpots.userId, spot: spots })
      .from(userSpots)
      .innerJoin(spots, eq(userSpots.spotId, spots.id))
      .where(
        and(
          inArray(userSpots.userId, enabledUserIds),
          eq(userSpots.alertsEnabled, true),
        ),
      );

    // Deduplicate spots for forecast fetching
    const uniqueSpots = new Map<number, (typeof allSubscriptions)[0]["spot"]>();
    for (const sub of allSubscriptions) {
      uniqueSpots.set(sub.spot.id, sub.spot);
    }

    const uniqueSpotIds = [...uniqueSpots.keys()];
    if (uniqueSpotIds.length === 0) {
      logger.info("No spots subscribed for alerts");
      return NextResponse.json({ message: "No spots subscribed" });
    }

    // Bulk fetch: all criteria for subscribed spots
    const allCriteria = await db
      .select()
      .from(alertCriteria)
      .where(inArray(alertCriteria.spotId, uniqueSpotIds));
    const criteriaBySpot = new Map(allCriteria.map((c) => [c.spotId, c]));

    const allUserCriteria = await db
      .select()
      .from(userAlertCriteria)
      .where(
        and(
          inArray(userAlertCriteria.userId, enabledUserIds),
          inArray(userAlertCriteria.spotId, uniqueSpotIds),
        ),
      );
    const userCriteriaByKey = new Map(
      allUserCriteria.map((c) => [`${c.userId}:${c.spotId}`, c]),
    );

    // Bulk fetch: all recent alert history for enabled users
    const allHistory = await db
      .select()
      .from(alertHistory)
      .where(inArray(alertHistory.userId, enabledUserIds));
    const prefsMap = new Map(enabledPrefs.map((p) => [p.userId, p]));

    // Fetch forecasts for unique spots (deduplicated)
    const forecastCache = new Map<
      number,
      Awaited<ReturnType<typeof fetchWeatherForecast>> & {
        marine: Awaited<ReturnType<typeof fetchMarineForecast>>;
      }
    >();

    await Promise.all(
      [...uniqueSpots.values()].map(async (spot) => {
        try {
          const [weather, marine] = await Promise.all([
            fetchWeatherForecast(spot.latitude, spot.longitude),
            fetchMarineForecast(spot.latitude, spot.longitude),
          ]);
          forecastCache.set(spot.id, { ...weather, marine });
        } catch (error) {
          logger.error(
            { err: error, spotId: spot.id },
            "Failed to fetch forecast for spot",
          );
          Sentry.captureException(error);
        }
      }),
    );

    const results = [];

    // Process each user-spot subscription
    for (const sub of allSubscriptions) {
      const prefs = prefsMap.get(sub.userId);
      if (!prefs) continue;

      const criteria = resolveCriteria(
        sub.spot.id,
        userCriteriaByKey.get(`${sub.userId}:${sub.spot.id}`),
        windProfileFromPrefs(prefs),
        criteriaBySpot.get(sub.spot.id),
      );

      const forecast = forecastCache.get(sub.spot.id);
      if (!forecast) continue;

      const hours = mergeForecasts(forecast, forecast.marine);
      const evaluation = evaluateSpot(
        hours,
        criteria,
        forecast.daily?.sunrise,
        forecast.daily?.sunset,
      );

      if (evaluation.goNoGo === "go" && evaluation.rideableWindows.length > 0) {
        // Check recent alert history (from bulk-fetched data)
        const recentAlerts = allHistory.filter((h) => {
          if (h.spotId !== sub.spot.id || h.userId !== prefs.userId)
            return false;
          const hoursSince =
            (Date.now() - h.sentAt.getTime()) / (1000 * 60 * 60);
          return hoursSince < prefs.checkIntervalHours;
        });

        if (recentAlerts.length > 0) continue;

        const appUrl = getAppUrl();
        const spotPath = sub.spot.slug
          ? `/spots/${sub.spot.slug}`
          : `/spots/${sub.spot.id}`;
        const result = await sendAlert({
          spotName: sub.spot.name,
          windows: evaluation.rideableWindows,
          email: prefs.email!,
          spotUrl: `${appUrl}${spotPath}`,
          windSpeedUnit: parseDisplayUnits(
            prefs.windSpeedUnit,
            prefs.temperatureUnit,
          ).windSpeedUnit,
        });

        await db.insert(alertHistory).values({
          spotId: sub.spot.id,
          userId: prefs.userId,
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
          spot: sub.spot.name,
          sent: true,
          result,
        });
      } else {
        results.push({
          user: prefs.userId,
          spot: sub.spot.name,
          sent: false,
          goNoGo: evaluation.goNoGo,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      {
        usersChecked: enabledPrefs.length,
        spotsChecked: uniqueSpots.size,
        alertsSent: results.filter((r) => r.sent).length,
        durationMs,
      },
      "Cron check-alerts completed",
    );

    return NextResponse.json({
      usersChecked: enabledPrefs.length,
      results,
    });
  } catch (error) {
    logger.error({ err: error }, "Cron check-alerts failed");
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
