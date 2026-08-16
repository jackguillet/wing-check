import { NextResponse } from "next/server";
import { getSpotForecast } from "@/lib/data/forecasts";
import { getSpot } from "@/lib/data/spots";
import { getSessionFromHeaders } from "@/lib/auth-session";
import { canViewSpot } from "@/lib/spots/visibility";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spotId: string }> },
) {
  const { spotId } = await params;
  const id = parseInt(spotId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid spot ID" }, { status: 400 });
  }

  const session = await getSessionFromHeaders(request.headers);
  const spot = await getSpot(id);
  if (!spot || !canViewSpot(spot, session?.user?.id)) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  try {
    const forecast = await getSpotForecast(id, {
      allowLive: !!session?.user,
    });
    if (!forecast) {
      return NextResponse.json({ error: "Spot not found" }, { status: 404 });
    }
    return NextResponse.json(forecast);
  } catch (error) {
    logger.error({ err: error, spotId: id }, "Forecast fetch error");
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to fetch forecast" },
      { status: 500 },
    );
  }
}
