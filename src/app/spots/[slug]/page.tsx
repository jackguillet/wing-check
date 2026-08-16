import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import {
  getSpot,
  getSpotWithCriteriaBySlug,
  getResolvedCriteriaMap,
  deleteSpot,
  updateSpotNotes,
  getUserSpotPrefs,
  toggleFavorite,
  toggleSpotAlerts,
} from "@/lib/actions/spots";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { getSession } from "@/lib/auth-session";
import { evaluateSpot, defaultCriteria } from "@/lib/alerts/evaluator";
import { getOrGenerateOverview } from "@/lib/ai/overview";
import { getDisplayUnits } from "@/lib/actions/settings";
import { UnitsProvider } from "@/components/units-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertCriteria, Spot } from "@/lib/db/schema";
import type { ForecastHour } from "@/lib/weather/types";
import { ForecastSection } from "@/components/forecast-section";
import {
  ForecastControlsProvider,
  ForecastToggles,
} from "@/components/forecast-controls";
import { SpotNotes } from "@/components/spot-notes";
import ReactMarkdown from "react-markdown";
import { Heart, Bell, Sparkles, Clock, Sunrise, Sunset, AlertTriangle } from "lucide-react";
import { DeleteSpotButton } from "@/components/delete-spot-button";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

import type { DayEvaluation } from "@/lib/alerts/evaluator";

const goNoGoColors = {
  go: "bg-green-600/10 border-green-600 text-green-700 dark:text-green-400",
  marginal:
    "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400",
  "no-go": "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400",
};

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  const d = new Date(dateStr + "T00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function OverviewSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Daily Overview
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-4/6" />
        </div>
      </CardContent>
    </Card>
  );
}

async function OverviewSection({
  spot,
  hours,
  criteria,
  sunrise,
  sunset,
}: {
  spot: Spot;
  hours: ForecastHour[];
  criteria: AlertCriteria;
  sunrise?: string[];
  sunset?: string[];
}) {
  let overview = null;
  try {
    overview = await getOrGenerateOverview(
      spot,
      hours,
      criteria,
      sunrise,
      sunset,
    );
  } catch (e) {
    logger.error({ err: e }, "Failed to load overview");
    Sentry.captureException(e);
  }
  if (!overview) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Daily Overview
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {overview.generatedAt.toLocaleString("en-US", { hour12: false })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm leading-relaxed">
          <ReactMarkdown>{overview.overview}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

function ThreeDayBanner({ days }: { days: DayEvaluation[] }) {
  const display = days.slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-3">
      {display.map((day, i) => {
        const color = goNoGoColors[day.goNoGo];
        return (
          <div
            key={day.date}
            className={`rounded-lg border-2 p-4 ${color} ${i === 0 ? "ring-2 ring-offset-2 ring-offset-background ring-current" : ""}`}
          >
            <p className="text-xs font-medium opacity-70 mb-1">
              {dayLabel(day.date, i)}
            </p>
            <div className="flex items-center justify-between">
              <p
                className={`font-bold uppercase ${i === 0 ? "text-lg" : "text-sm"}`}
              >
                {day.goNoGo}
              </p>
              <p className={`font-bold ${i === 0 ? "text-3xl" : "text-2xl"}`}>
                {day.score}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Backward-compat: if slug is all digits, look up by numeric ID and redirect
  if (/^\d+$/.test(slug)) {
    const spot = await getSpot(parseInt(slug));
    if (!spot || !spot.slug) notFound();
    redirect(`/spots/${spot.slug}`);
  }

  const session = await getSession();
  const spotData = await getSpotWithCriteriaBySlug(slug);
  if (!spotData) notFound();

  const { spot } = spotData;
  const isOwner = session?.user?.id === spot.userId;
  const isAuthenticated = !!session?.user;
  const userSpotPrefs = isAuthenticated
    ? await getUserSpotPrefs(spot.id)
    : null;
  const resolvedMap = await getResolvedCriteriaMap(
    [spot.id],
    session?.user?.id,
  );
  const criteria: AlertCriteria = resolvedMap.get(spot.id) ?? {
    id: 0,
    spotId: spot.id,
    ...defaultCriteria,
  };

  let forecast = null;
  let evaluation = null;
  try {
    forecast = await getSpotForecast(spot.id);
    if (forecast) {
      evaluation = evaluateSpot(
        forecast.hours,
        criteria,
        forecast.sunrise,
        forecast.sunset,
      );
    }
  } catch (e) {
    logger.error({ err: e, spotId: spot.id }, "Failed to load forecast");
    Sentry.captureException(e);
  }

  const deleteAction = deleteSpot.bind(null, spot.id);
  const toggleFavoriteAction = toggleFavorite.bind(null, spot.id);
  const toggleAlertsAction = toggleSpotAlerts.bind(null, spot.id);
  const units = await getDisplayUnits();

  return (
    <UnitsProvider units={units}>
    <ForecastControlsProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{spot.name}</h1>
            <p className="text-muted-foreground">
              {spot.latitude.toFixed(4)}°, {spot.longitude.toFixed(4)}°
            </p>
            {forecast &&
              (() => {
                const now = new Date();
                const localMs =
                  now.getTime() +
                  now.getTimezoneOffset() * 60_000 +
                  forecast.utcOffsetSeconds * 1000;
                const localDate = new Date(localMs);
                const localTimeStr = localDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
                const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
                const todaySunrise = forecast.sunrise.find((s) =>
                  s.startsWith(todayStr),
                );
                const todaySunset = forecast.sunset.find((s) =>
                  s.startsWith(todayStr),
                );
                const fmtSun = (iso: string) => iso.substring(11, 16);
                return (
                  <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {localTimeStr}
                    </span>
                    {todaySunrise && (
                      <span className="flex items-center gap-1">
                        <Sunrise className="h-3.5 w-3.5" />
                        {fmtSun(todaySunrise)}
                      </span>
                    )}
                    {todaySunset && (
                      <span className="flex items-center gap-1">
                        <Sunset className="h-3.5 w-3.5" />
                        {fmtSun(todaySunset)}
                      </span>
                    )}
                  </p>
                );
              })()}
          </div>
          <div className="flex items-center gap-2">
            <ForecastToggles />
            {isAuthenticated && (
              <>
                <form action={toggleFavoriteAction}>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={
                      userSpotPrefs?.isFavorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                  >
                    <Heart
                      className={cn(
                        "h-5 w-5",
                        userSpotPrefs?.isFavorite
                          ? "fill-red-500 text-red-500"
                          : "text-muted-foreground",
                      )}
                    />
                  </Button>
                </form>
                <form action={toggleAlertsAction}>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={
                      userSpotPrefs?.alertsEnabled
                        ? "Disable alerts"
                        : "Enable alerts"
                    }
                  >
                    <Bell
                      className={cn(
                        "h-5 w-5",
                        userSpotPrefs?.alertsEnabled
                          ? "fill-blue-500 text-blue-500"
                          : "text-muted-foreground",
                      )}
                    />
                  </Button>
                </form>
              </>
            )}
            {isOwner && (
              <DeleteSpotButton
                spotName={spot.name}
                deleteAction={deleteAction}
              />
            )}
          </div>
        </div>

        <SpotNotes
          spotId={spot.id}
          notes={spot.notes}
          isOwner={isOwner}
          updateAction={updateSpotNotes}
        />

        {forecast?.stale && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Showing a cached forecast from{" "}
              {new Date(forecast.fetchedAt).toLocaleString("en-US", {
                timeZone: forecast.timezone,
                dateStyle: "medium",
                timeStyle: "short",
                hour12: false,
              })}
              . Latest data couldn&apos;t be fetched.
            </p>
          </div>
        )}

        {!forecast && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="font-medium">Couldn&apos;t load the forecast</p>
              <p className="text-sm text-muted-foreground">
                Weather data is temporarily unavailable. Refresh to try again.
              </p>
            </CardContent>
          </Card>
        )}

        {evaluation && evaluation.dayEvaluations.length > 0 && (
          <ThreeDayBanner days={evaluation.dayEvaluations} />
        )}

        {forecast && (
          <Suspense fallback={<OverviewSkeleton />}>
            <OverviewSection
              spot={spot}
              hours={forecast.hours}
              criteria={criteria}
              sunrise={forecast.sunrise}
              sunset={forecast.sunset}
            />
          </Suspense>
        )}

        {forecast && (
          <ForecastSection
            hours={forecast.hours}
            tides={forecast.tides}
            sunrise={forecast.sunrise}
            sunset={forecast.sunset}
            criteria={criteria}
            rawCriteria={criteria}
            hourScores={evaluation?.hourScores}
            rideableWindows={evaluation?.rideableWindows}
            spotId={spot.id}
            lat={spot.latitude}
            lng={spot.longitude}
            isOwner={isOwner}
            canEditCriteria={isAuthenticated}
          />
        )}

        {forecast && (
          <p className="text-xs text-muted-foreground text-right">
            Forecast fetched:{" "}
            {new Date(forecast.fetchedAt).toLocaleString("en-US", {
              timeZone: forecast.timezone,
              dateStyle: "medium",
              timeStyle: "short",
              hour12: false,
            })}
          </p>
        )}
      </div>
    </ForecastControlsProvider>
    </UnitsProvider>
  );
}
