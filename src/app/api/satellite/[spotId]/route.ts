import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromHeaders } from "@/lib/auth-session";
import { canViewSpot } from "@/lib/spots/visibility";
import { DEFAULT_MAP_RADIUS_KM, mapboxStaticSatelliteUrl } from "@/lib/geo";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spotId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { spotId } = await params;
  const id = parseInt(spotId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid spot ID" }, { status: 400 });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Satellite imagery not configured" },
      { status: 503 },
    );
  }

  const spot = await db.select().from(spots).where(eq(spots.id, id)).get();
  if (!spot || !canViewSpot(spot, session.user.id)) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  const url = mapboxStaticSatelliteUrl(
    token,
    spot.latitude,
    spot.longitude,
    spot.mapRadiusKm ?? DEFAULT_MAP_RADIUS_KM,
  );

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch satellite image" },
        { status: 502 },
      );
    }

    const imageBytes = await res.arrayBuffer();
    return new NextResponse(imageBytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=604800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch satellite image" },
      { status: 502 },
    );
  }
}
