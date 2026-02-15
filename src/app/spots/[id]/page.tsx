import { notFound } from "next/navigation";
import { getSpotWithCriteria, deleteSpot, updateSpotCriteria, getUserSpotPrefs, toggleFavorite, toggleSpotAlerts } from "@/lib/actions/spots";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { getSession } from "@/lib/auth-session";
import { evaluateSpot, defaultCriteria } from "@/lib/alerts/evaluator";
import { getOrGenerateOverview } from "@/lib/ai/overview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertCriteria } from "@/lib/db/schema";
import { degreesToCardinal } from "@/lib/weather/types";
import { ForecastSection } from "@/components/forecast-section";
import { Heart, Bell, Sparkles, Clock, Sunrise, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

import type { DayEvaluation } from "@/lib/alerts/evaluator";

const goNoGoColors = {
  go: "bg-green-600/10 border-green-600 text-green-700 dark:text-green-400",
  marginal: "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400",
  "no-go": "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400",
};

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  const d = new Date(dateStr + "T00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
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
            <p className="text-xs font-medium opacity-70 mb-1">{dayLabel(day.date, i)}</p>
            <div className="flex items-center justify-between">
              <p className={`font-bold uppercase ${i === 0 ? "text-lg" : "text-sm"}`}>{day.goNoGo}</p>
              <p className={`font-bold ${i === 0 ? "text-3xl" : "text-2xl"}`}>{day.score}</p>
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spotId = parseInt(id);
  if (isNaN(spotId)) notFound();

  const session = await getSession();
  const spotData = await getSpotWithCriteria(spotId);
  if (!spotData) notFound();

  const { spot, criteria: rawCriteria } = spotData;
  const isOwner = session?.user?.id === spot.userId;
  const isAuthenticated = !!session?.user;
  const userSpotPrefs = isAuthenticated ? await getUserSpotPrefs(spotId) : null;
  const criteria: AlertCriteria = rawCriteria ?? {
    id: 0,
    spotId: spot.id,
    ...defaultCriteria,
  };

  let forecast = null;
  let evaluation = null;
  try {
    forecast = await getSpotForecast(spot.id);
    if (forecast) {
      evaluation = evaluateSpot(forecast.hours, criteria, forecast.sunrise, forecast.sunset);
    }
  } catch (e) {
    console.error("Failed to load forecast:", e);
  }

  let overview = null;
  if (forecast) {
    try {
      overview = await getOrGenerateOverview(spot, forecast.hours, criteria, forecast.sunrise, forecast.sunset);
    } catch (e) {
      console.error("Failed to load overview:", e);
    }
  }

  const deleteAction = deleteSpot.bind(null, spot.id);
  const updateCriteriaAction = updateSpotCriteria.bind(null, spot.id);
  const toggleFavoriteAction = toggleFavorite.bind(null, spot.id);
  const toggleAlertsAction = toggleSpotAlerts.bind(null, spot.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{spot.name}</h1>
          <p className="text-muted-foreground">
            {spot.latitude.toFixed(4)}°, {spot.longitude.toFixed(4)}°
            {spot.notes && ` — ${spot.notes}`}
          </p>
          {forecast && (() => {
            const now = new Date();
            const localMs = now.getTime() + (now.getTimezoneOffset() * 60_000) + (forecast.utcOffsetSeconds * 1000);
            const localDate = new Date(localMs);
            const localTimeStr = localDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const todayStr = localDate.toISOString().slice(0, 10);
            const todaySunrise = forecast.sunrise.find(s => s.startsWith(todayStr));
            const todaySunset = forecast.sunset.find(s => s.startsWith(todayStr));
            const fmtSun = (iso: string) => {
              const h = parseInt(iso.substring(11, 13), 10);
              const m = iso.substring(14, 16);
              const ampm = h >= 12 ? "PM" : "AM";
              return `${h % 12 || 12}:${m} ${ampm}`;
            };
            return (
              <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{localTimeStr}</span>
                {todaySunrise && <span className="flex items-center gap-1"><Sunrise className="h-3.5 w-3.5" />{fmtSun(todaySunrise)}</span>}
                {todaySunset && <span className="flex items-center gap-1"><Sunset className="h-3.5 w-3.5" />{fmtSun(todaySunset)}</span>}
              </p>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <>
              <form action={toggleFavoriteAction}>
                <Button variant="ghost" size="icon" title={userSpotPrefs?.isFavorite ? "Remove from favorites" : "Add to favorites"}>
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
                <Button variant="ghost" size="icon" title={userSpotPrefs?.alertsEnabled ? "Disable alerts" : "Enable alerts"}>
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
            <form action={deleteAction}>
              <Button variant="destructive" size="sm">
                Delete Spot
              </Button>
            </form>
          )}
        </div>
      </div>

      {evaluation && evaluation.dayEvaluations.length > 0 && (
        <ThreeDayBanner days={evaluation.dayEvaluations} />
      )}

      {overview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Daily Overview
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {overview.generatedAt.toLocaleString()}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm leading-relaxed whitespace-pre-line">
              {overview.overview}
            </div>
          </CardContent>
        </Card>
      )}

      {evaluation && evaluation.rideableWindows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rideable Windows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {evaluation.rideableWindows.map((w, i) => {
                const start = new Date(w.start);
                const end = new Date(w.end);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {start.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {start.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        –{" "}
                        {end.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {w.hours}h · {w.avgWind}kt avg · gusts {w.avgGusts}kt ·{" "}
                        {degreesToCardinal(w.dominantDirection)}
                      </p>
                    </div>
                    <Badge
                      className={
                        w.avgScore >= 70
                          ? "bg-green-600 text-white"
                          : "bg-yellow-500 text-black"
                      }
                    >
                      {w.avgScore}/100
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {forecast && (
        <ForecastSection
          hours={forecast.hours}
          sunrise={forecast.sunrise}
          sunset={forecast.sunset}
          criteria={criteria}
          rawCriteria={rawCriteria}
          hourScores={evaluation?.hourScores}
          spotId={spot.id}
          lat={spot.latitude}
          lng={spot.longitude}
          minWind={criteria.minWindSpeed}
          maxWind={criteria.maxWindSpeed}
          isOwner={isOwner}
          updateCriteriaAction={updateCriteriaAction}
        />
      )}

      {forecast && (
        <p className="text-xs text-muted-foreground text-right">
          Forecast fetched: {new Date(forecast.fetchedAt).toLocaleString("en-US", {
            timeZone: forecast.timezone,
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </div>
  );
}
