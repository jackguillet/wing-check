import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spotId: string }> },
) {
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
  if (!spot) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${spot.longitude},${spot.latitude},12,0,0/600x400@2x?access_token=${token}`;

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
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch satellite image" },
      { status: 502 },
    );
  }
}
