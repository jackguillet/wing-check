import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userSpots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateOverviewForSpot } from "@/lib/ai/overview";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all distinct spotIds where any user has it favorited
  const favoritedSpots = await db
    .select({ spotId: userSpots.spotId })
    .from(userSpots)
    .where(eq(userSpots.isFavorite, true));

  const uniqueSpotIds = [...new Set(favoritedSpots.map((r) => r.spotId))];

  if (uniqueSpotIds.length === 0) {
    return NextResponse.json({ message: "No favorited spots" });
  }

  const results = [];
  for (const spotId of uniqueSpotIds) {
    const result = await generateOverviewForSpot(spotId);
    results.push(result);
  }

  return NextResponse.json({
    spotsProcessed: uniqueSpotIds.length,
    results,
  });
}
