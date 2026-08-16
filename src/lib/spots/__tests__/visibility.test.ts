import { describe, it, expect } from "vitest";
import { canViewSpot, isSpotOwner, toClientSpot } from "../visibility";
import type { Spot } from "@/lib/db/schema";

function spot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 1,
    userId: "owner-1",
    name: "Secret Beach",
    slug: "secret-beach",
    latitude: 18,
    longitude: -63,
    noaaStationId: null,
    notes: "home break",
    visibility: "private",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("canViewSpot", () => {
  it("lets anyone see a public catalog pin", () => {
    const catalog = spot({ visibility: "public" });
    expect(canViewSpot(catalog, null)).toBe(true);
    expect(canViewSpot(catalog, "someone-else")).toBe(true);
  });

  it("hides a private pin from guests and other users", () => {
    const secret = spot({ visibility: "private" });
    expect(canViewSpot(secret, null)).toBe(false);
    expect(canViewSpot(secret, "someone-else")).toBe(false);
    expect(canViewSpot(secret, "owner-1")).toBe(true);
  });
});

describe("toClientSpot", () => {
  it("strips userId so the owner id never reaches the client", () => {
    const client = toClientSpot(spot());
    expect(client).not.toHaveProperty("userId");
    expect(client.name).toBe("Secret Beach");
    expect(client.visibility).toBe("private");
  });
});

describe("isSpotOwner", () => {
  it("is true only for the owning user", () => {
    expect(isSpotOwner(spot(), "owner-1")).toBe(true);
    expect(isSpotOwner(spot(), null)).toBe(false);
  });
});
