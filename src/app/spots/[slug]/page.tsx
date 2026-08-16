import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  deleteSpot,
  updateSpotNotes,
  toggleFavorite,
  toggleSpotAlerts,
  clearSpotWindOverride,
  updateSpotVisibility,
} from "@/lib/actions/spots";
import {
  getVisibleSpot,
  getVisibleSpotBySlug,
  getSpotWithCriteriaBySlug,
  getResolvedCriteriaDetails,
  getUserSpotPrefs,
  getLatestSpotAlert,
} from "@/lib/data/spots";
import { getSpotForecast, getCachedForecastsBySpotIds } from "@/lib/data/forecasts";
import { getSession } from "@/lib/auth-session";
import { evaluateSpot } from "@/lib/alerts/evaluator";
import { spotLocalNow } from "@/lib/weather/civil-time";
import { criteriaKitLabel, riderScheduleFromPrefs } from "@/lib/criteria";
import { HONEST_TIDE_MAX_KM } from "@/lib/weather/noaa-stations";
import { getOrGenerateOverview } from "@/lib/ai/overview";
import { getDisplayUnits, getPreferences } from "@/lib/data/settings";
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
import { Heart, Sparkles, Clock, Sunrise, Sunset, AlertTriangle } from "lucide-react";
import { DeleteSpotButton } from "@/components/delete-spot-button";
import { SpotAlertToggle } from "@/components/spot-alert-toggle";
import { ScoringGuide } from "@/components/scoring-guide";
import { SevenDayStrip } from "@/components/seven-day-strip";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const viewerId = session?.user?.id;
  const spot = /^\d+$/.test(slug)
    ? await getVisibleSpot(parseInt(slug), viewerId)
    : await getVisibleSpotBySlug(slug, viewerId);
  if (!spot) {
    return { title: "Spot · Wing Check" };
  }
  const cached = (await getCachedForecastsBySpotIds([spot.id])).get(spot.id);
  if (!cached) {
    return {
      title: `${spot.name} · Wing Check`,
      description: `Wind forecast and go/no-go score for ${spot.name}.`,
    };
  }
  const { criteria } = await getResolvedCriteriaDetails(spot.id, viewerId);
  const prefs = viewerId ? await getPreferences() : null;
  const evaluation = evaluateSpot(
    cached.hours,
    criteria,
    cached.sunrise,
    cached.sunset,
    spotLocalNow(cached.utcOffsetSeconds),
    prefs ? riderScheduleFromPrefs(prefs) : null,
    cached.tides,
  );
  const verdict = evaluation.goNoGo.toUpperCase();
  return {
    title: `${spot.name} · ${verdict} ${evaluation.overallScore} · Wing Check`,
    description: `${verdict} ${evaluation.overallScore}/100 today at ${spot.name}.`,
  };
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
  nowCivil,
}: {
  spot: Spot;
  hours: ForecastHour[];
  criteria: AlertCriteria;
  sunrise?: string[];
  sunset?: string[];
  nowCivil?: string;
}) {
  let overview = null;
  try {
    overview = await getOrGenerateOverview(
      spot,
      hours,
      criteria,
      sunrise,
      sunset,
      nowCivil,
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



export default async function SpotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { slug } = await params;
  const { day: dayParam } = await searchParams;

  // Backward-compat: if slug is all digits, look up by numeric ID and redirect
  const session = await getSession();
  const viewerId = session?.user?.id;

  if (/^\d+$/.test(slug)) {
    const spot = await getVisibleSpot(parseInt(slug), viewerId);
    if (!spot || !spot.slug) notFound();
    redirect(`/spots/${spot.slug}`);
  }

  const spotData = await getSpotWithCriteriaBySlug(slug, viewerId);
  if (!spotData) notFound();

  const { spot } = spotData;
  const isOwner = session?.user?.id === spot.userId;
  const isAuthenticated = !!session?.user;
  const [userSpotPrefs, alertPrefs, latestAlert] = isAuthenticated
    ? await Promise.all([
        getUserSpotPrefs(spot.id),
        getPreferences(),
        getLatestSpotAlert(spot.id),
      ])
    : [null, null, null];
  const { criteria, source } = await getResolvedCriteriaDetails(
    spot.id,
    session?.user?.id,
  );

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
        spotLocalNow(forecast.utcOffsetSeconds),
        alertPrefs ? riderScheduleFromPrefs(alertPrefs) : null,
        forecast.tides,
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
    <ForecastControlsProvider initialDate={dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : null}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{spot.name}</h1>
            <p className="text-muted-foreground">
              {spot.latitude.toFixed(4)}°, {spot.longitude.toFixed(4)}°
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {criteriaKitLabel(source, criteria)}
              {spot.visibility === "private" ? " · Private" : null}
            </p>
            {forecast?.tideStation ? (
              <p className="text-xs text-muted-foreground mt-1">
                {Number.isNaN(forecast.tideStation.km) ||
                forecast.tideStation.km > HONEST_TIDE_MAX_KM
                  ? `Tide unavailable — nearest NOAA station ${forecast.tideStation.name} is too far`
                  : `Tide: ${forecast.tideStation.name} · ${forecast.tideStation.km} km`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Tide unavailable for this spot
              </p>
            )}
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
          <div className="flex flex-col gap-3 md:items-end">
            <div className="flex items-center gap-2 flex-wrap">
              <ScoringGuide />
            {isAuthenticated && (
              <>
                <form action={toggleFavoriteAction}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={
                      userSpotPrefs?.isFavorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    aria-pressed={!!userSpotPrefs?.isFavorite}
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
                <SpotAlertToggle
                  enabled={!!userSpotPrefs?.alertsEnabled}
                  masterEnabled={
                    !!alertPrefs?.alertsEnabled &&
                    !!session?.user.emailVerified
                  }
                  alertEmail={session?.user.email ?? null}
                  lastAlertLabel={
                    latestAlert
                      ? latestAlert.sentAt.toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: "UTC",
                        }) + " UTC"
                      : null
                  }
                  toggleAction={toggleAlertsAction}
                />
              </>
            )}
            {isOwner && (
              <>
                <form action={updateSpotVisibility.bind(null, spot.id)}>
                  <input
                    type="hidden"
                    name="visibility"
                    value={spot.visibility === "public" ? "private" : "public"}
                  />
                  <Button variant="outline" size="sm">
                    {spot.visibility === "public"
                      ? "Unpublish"
                      : "Publish to catalog"}
                  </Button>
                </form>
                {spot.visibility === "private" ? (
                  <DeleteSpotButton
                    spotName={spot.name}
                    deleteAction={deleteAction}
                  />
                ) : null}
              </>
            )}
            </div>
            <ForecastToggles />
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
          <SevenDayStrip
            days={evaluation.dayEvaluations}
            todayDate={evaluation.todayDate}
          />
        )}

        {forecast && (
          <Suspense fallback={<OverviewSkeleton />}>
            <OverviewSection
              spot={spot}
              hours={forecast.hours}
              criteria={criteria}
              sunrise={forecast.sunrise}
              sunset={forecast.sunset}
              nowCivil={spotLocalNow(forecast.utcOffsetSeconds)}
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
            criteriaSource={source}
            clearOverrideAction={clearSpotWindOverride.bind(null, spot.id)}
            utcOffsetSeconds={forecast.utcOffsetSeconds}
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
