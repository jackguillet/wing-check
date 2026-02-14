import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Spot } from "@/lib/db/schema";
import type { SpotEvaluation } from "@/lib/alerts/evaluator";
import { degreesToCardinal } from "@/lib/weather/types";
import { Heart } from "lucide-react";

interface SpotCardProps {
  spot: Spot;
  evaluation: SpotEvaluation | null;
  isFavorite?: boolean;
}

function GoNoGoBadge({ status }: { status: "go" | "marginal" | "no-go" }) {
  switch (status) {
    case "go":
      return <Badge className="bg-green-600 text-white text-sm px-3">GO</Badge>;
    case "marginal":
      return <Badge className="bg-yellow-500 text-black text-sm px-3">MARGINAL</Badge>;
    case "no-go":
      return <Badge variant="outline" className="text-muted-foreground text-sm px-3">NO-GO</Badge>;
  }
}

export function SpotCard({ spot, evaluation, isFavorite }: SpotCardProps) {
  return (
    <Link href={`/spots/${spot.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-1.5">
            {isFavorite && <Heart className="h-4 w-4 fill-red-500 text-red-500 shrink-0" />}
            {spot.name}
          </CardTitle>
          {evaluation && <GoNoGoBadge status={evaluation.goNoGo} />}
        </CardHeader>
        <CardContent>
          {evaluation ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium">{evaluation.overallScore}/100</span>
              </div>
              {evaluation.bestWindow && (
                <div className="text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Best window</span>
                    <span className="font-medium">
                      {evaluation.bestWindow.avgWind}kt{" "}
                      {degreesToCardinal(evaluation.bestWindow.dominantDirection)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{evaluation.bestWindow.hours}h</span>
                  </div>
                </div>
              )}
              {evaluation.rideableWindows.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  +{evaluation.rideableWindows.length - 1} more window(s)
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading forecast...</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {spot.latitude.toFixed(3)}°, {spot.longitude.toFixed(3)}°
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
