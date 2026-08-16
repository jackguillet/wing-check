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
import { spotLocalNow } from "@/lib/weather/civil-time";
import { resolveCriteria, windProfileFromPrefs } from "@/lib/criteria";
import { sendAlert } from "@/lib/alerts/notifier";
import {
  upcomingGoWindows,
  uniqueWindowAlertTypes,
  unsentGoWindows,
} from "@/lib/alerts/policy";
import { getAppUrl } from "@/lib/app-url";
import { parseDisplayUnits } from "@/lib/units";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: Request) {
  const startTime = Date.now();

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
    const allPrefs = await db.select().from(preferences);
    const enabledPrefs = allPrefs.filter((p) => p.alertsEnabled && p.email);

    if (enabledPrefs.length === 0) {
      logger.info("No users with alerts enabled");
      return NextResponse.json({ message: "No users with alerts enabled" });
    }

    const enabledUserIds = enabledPrefs.map((p) => p.userId);

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

    const uniqueSpots = new Map<number, (typeof allSubscriptions)[0]["spot"]>();
    for (const sub of allSubscriptions) {
      uniqueSpots.set(sub.spot.id, sub.spot);
    }

    const uniqueSpotIds = [...uniqueSpots.keys()];
    if (uniqueSpotIds.length === 0) {
      logger.info("No spots subscribed for alerts");
      return NextResponse.json({ message: "No spots subscribed" });
    }

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

    const allHistory = await db
      .select()
      .from(alertHistory)
      .where(inArray(alertHistory.userId, enabledUserIds));
    const prefsMap = new Map(enabledPrefs.map((p) => [p.userId, p]));

    const forecastBySpot = new Map<
      number,
      Awaited<ReturnType<typeof getSpotForecast>>
    >();
    await Promise.all(
      uniqueSpotIds.map(async (spotId) => {
        try {
          forecastBySpot.set(spotId, await getSpotForecast(spotId));
        } catch (error) {
          logger.error(
            { err: error, spotId },
            "Failed to fetch forecast for spot",
          );
          Sentry.captureException(error);
        }
      }),
    );

    const results = [];

    for (const sub of allSubscriptions) {
      const prefs = prefsMap.get(sub.userId);
      if (!prefs?.email) continue;

      const criteria = resolveCriteria(
        sub.spot.id,
        userCriteriaByKey.get(`${sub.userId}:${sub.spot.id}`),
        windProfileFromPrefs(prefs),
        criteriaBySpot.get(sub.spot.id),
      );

      const forecast = forecastBySpot.get(sub.spot.id);
      if (!forecast) continue;

      const nowCivil = spotLocalNow(forecast.utcOffsetSeconds);
      const evaluation = evaluateSpot(
        forecast.hours,
        criteria,
        forecast.sunrise,
        forecast.sunset,
        nowCivil,
      );

      const upcoming = upcomingGoWindows(evaluation.rideableWindows, nowCivil);
      const sentTypes = new Set(
        allHistory
          .filter(
            (h) => h.spotId === sub.spot.id && h.userId === prefs.userId,
          )
          .map((h) => h.alertType),
      );
      const toSend = unsentGoWindows(upcoming, sentTypes);

      if (toSend.length === 0) {
        results.push({
          user: prefs.userId,
          spot: sub.spot.name,
          sent: false,
          goNoGo: evaluation.goNoGo,
        });
        continue;
      }

      const appUrl = getAppUrl();
      const spotPath = sub.spot.slug
        ? `/spots/${sub.spot.slug}`
        : `/spots/${sub.spot.id}`;
      const result = await sendAlert({
        spotName: sub.spot.name,
        windows: toSend,
        email: prefs.email,
        spotUrl: `${appUrl}${spotPath}`,
        windSpeedUnit: parseDisplayUnits(
          prefs.windSpeedUnit,
          prefs.temperatureUnit,
        ).windSpeedUnit,
      });

      const sentAt = new Date();
      const types = uniqueWindowAlertTypes(toSend);
      for (const alertType of types) {
        const inserted = {
          spotId: sub.spot.id,
          userId: prefs.userId,
          sentAt,
          alertType,
          forecastSummary: JSON.stringify({
            score: evaluation.overallScore,
            windows: toSend.map((w) => w.start),
            bestWindow: evaluation.bestWindow,
          }),
        };
        await db.insert(alertHistory).values(inserted);
        allHistory.push({
          id: 0,
          ...inserted,
        });
      }

      results.push({
        user: prefs.userId,
        spot: sub.spot.name,
        sent: true,
        windows: toSend.map((w) => w.start),
        result,
      });
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
