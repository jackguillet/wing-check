import type { Spot } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { spots } from "@/lib/db/schema";

export type SpotVisibility = "public" | "private";

export type ClientSpot = Omit<Spot, "userId">;

export function canViewSpot(
  spot: Pick<Spot, "visibility" | "userId">,
  viewerId?: string | null,
): boolean {
  if (spot.visibility === "public") return true;
  return !!viewerId && spot.userId === viewerId;
}

export function isSpotOwner(
  spot: Pick<Spot, "userId">,
  viewerId?: string | null,
): boolean {
  return !!viewerId && spot.userId === viewerId;
}

export function toClientSpot(spot: Spot): ClientSpot {
  const { userId: _userId, ...rest } = spot;
  return rest;
}

export function visibleSpotsFilter(viewerId?: string | null) {
  if (viewerId) {
    return or(eq(spots.visibility, "public"), eq(spots.userId, viewerId));
  }
  return eq(spots.visibility, "public");
}
