import { notFound } from "next/navigation";
import { getSpotWithCriteria, deleteSpot, updateSpotCriteria } from "@/lib/actions/spots";
import { getSpotForecast } from "@/lib/actions/forecasts";
import { getSession } from "@/lib/auth-session";
import { evaluateSpot, defaultCriteria } from "@/lib/alerts/evaluator";
import { WindChart } from "@/components/wind-chart";
import { SwellCard } from "@/components/swell-card";
import { ForecastTable } from "@/components/forecast-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AlertCriteria } from "@/lib/db/schema";
import { degreesToCardinal } from "@/lib/weather/types";

export const dynamic = "force-dynamic";

function GoNoGoBanner({ status, score }: { status: string; score: number }) {
  const colors = {
    go: "bg-green-600/10 border-green-600 text-green-700 dark:text-green-400",
    marginal: "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400",
    "no-go": "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400",
  };
  const color = colors[status as keyof typeof colors] ?? colors["no-go"];

  return (
    <div className={`rounded-lg border-2 p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold uppercase">{status}</p>
          <p className="text-sm opacity-80">Overall condition score</p>
        </div>
        <p className="text-4xl font-bold">{score}</p>
      </div>
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
      evaluation = evaluateSpot(forecast.hours, criteria);
    }
  } catch (e) {
    console.error("Failed to load forecast:", e);
  }

  const deleteAction = deleteSpot.bind(null, spot.id);
  const updateCriteriaAction = updateSpotCriteria.bind(null, spot.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{spot.name}</h1>
          <p className="text-muted-foreground">
            {spot.latitude.toFixed(4)}°, {spot.longitude.toFixed(4)}°
            {spot.notes && ` — ${spot.notes}`}
          </p>
        </div>
        {isOwner && (
          <form action={deleteAction}>
            <Button variant="destructive" size="sm">
              Delete Spot
            </Button>
          </form>
        )}
      </div>

      {evaluation && (
        <GoNoGoBanner status={evaluation.goNoGo} score={evaluation.overallScore} />
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

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Wind Chart</TabsTrigger>
          <TabsTrigger value="table">Forecast Table</TabsTrigger>
          {isOwner && <TabsTrigger value="criteria">Alert Criteria</TabsTrigger>}
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          {forecast ? (
            <>
              <WindChart hours={forecast.hours} criteria={rawCriteria} />
              <SwellCard hours={forecast.hours} />
            </>
          ) : (
            <p className="text-muted-foreground">
              Could not load forecast data.
            </p>
          )}
        </TabsContent>

        <TabsContent value="table">
          {forecast ? (
            <ForecastTable
              hours={forecast.hours}
              hourScores={evaluation?.hourScores}
            />
          ) : (
            <p className="text-muted-foreground">
              Could not load forecast data.
            </p>
          )}
        </TabsContent>

        {isOwner && (
          <TabsContent value="criteria">
            <Card>
              <CardHeader>
                <CardTitle>Alert Criteria</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateCriteriaAction} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minWindSpeed">Min Wind Speed (kt)</Label>
                      <Input
                        id="minWindSpeed"
                        name="minWindSpeed"
                        type="number"
                        step="0.5"
                        defaultValue={criteria.minWindSpeed}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxWindSpeed">Max Wind Speed (kt)</Label>
                      <Input
                        id="maxWindSpeed"
                        name="maxWindSpeed"
                        type="number"
                        step="0.5"
                        defaultValue={criteria.maxWindSpeed}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxGustFactor">Max Gust Factor</Label>
                      <Input
                        id="maxGustFactor"
                        name="maxGustFactor"
                        type="number"
                        step="0.1"
                        defaultValue={criteria.maxGustFactor}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minConsecutiveHours">Min Hours</Label>
                      <Input
                        id="minConsecutiveHours"
                        name="minConsecutiveHours"
                        type="number"
                        defaultValue={criteria.minConsecutiveHours}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="preferredDirections">
                      Preferred Directions (JSON array of degrees)
                    </Label>
                    <Input
                      id="preferredDirections"
                      name="preferredDirections"
                      defaultValue={criteria.preferredDirections}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directionTolerance">
                      Direction Tolerance (°)
                    </Label>
                    <Input
                      id="directionTolerance"
                      name="directionTolerance"
                      type="number"
                      defaultValue={criteria.directionTolerance}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxWaveHeight">Max Wave Height (m)</Label>
                    <Input
                      id="maxWaveHeight"
                      name="maxWaveHeight"
                      type="number"
                      step="0.1"
                      defaultValue={criteria.maxWaveHeight ?? ""}
                    />
                  </div>
                  <Button type="submit">Update Criteria</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {forecast && (
        <p className="text-xs text-muted-foreground text-right">
          Forecast fetched: {new Date(forecast.fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
