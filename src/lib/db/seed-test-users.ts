/**
 * One-shot seed script: 50 test users with random spot assignments + page views.
 *
 * Run:
 *   npx tsx --env-file=.env.local src/lib/db/seed-test-users.ts
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// ── Helpers ─────────────────────────────────────────────────────────

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function uuid() {
  return crypto.randomUUID();
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching existing spots…");
  const allSpots = await db
    .select({ id: schema.spots.id, slug: schema.spots.slug })
    .from(schema.spots);
  if (allSpots.length === 0) {
    console.error("No spots found — run the main seed first.");
    process.exit(1);
  }
  console.log(`Found ${allSpots.length} spots.`);

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // ── 1. Insert 50 test users ─────────────────────────────────────
  console.log("Inserting 50 test users…");
  const users = Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    const padded = String(n).padStart(3, "0");
    return {
      id: `test-user-${padded}`,
      name: `Test User ${n}`,
      email: `testuser${n}@wingcheck.dev`,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Batch insert (SQLite has a variable limit, so chunk by 25)
  for (let i = 0; i < users.length; i += 25) {
    await db
      .insert(schema.user)
      .values(users.slice(i, i + 25))
      .onConflictDoNothing();
  }
  console.log("Users inserted.");

  // ── 2. Insert sessions ──────────────────────────────────────────
  console.log("Creating sessions…");
  const sessions = users.map((u) => ({
    id: uuid(),
    expiresAt: new Date(now.getTime() + sevenDaysMs),
    token: uuid(),
    createdAt: now,
    updatedAt: now,
    userId: u.id,
  }));

  for (let i = 0; i < sessions.length; i += 25) {
    await db
      .insert(schema.session)
      .values(sessions.slice(i, i + 25))
      .onConflictDoNothing();
  }
  console.log("Sessions created.");

  // ── 3. Assign spots (3–6 per user, 1–2 favorites) ──────────────
  console.log("Assigning spots to users…");
  let totalSpotAssignments = 0;
  let totalFavorites = 0;

  for (const u of users) {
    const count = randomInt(3, 6);
    const chosen = pick(allSpots, count);
    const favCount = randomInt(1, 2);

    const rows = chosen.map((spot, idx) => ({
      userId: u.id,
      spotId: spot.id,
      isFavorite: idx < favCount,
      alertsEnabled: false,
    }));

    await db.insert(schema.userSpots).values(rows).onConflictDoNothing();
    totalSpotAssignments += rows.length;
    totalFavorites += favCount;
  }
  console.log(
    `Assigned ${totalSpotAssignments} user-spot rows (${totalFavorites} favorites).`,
  );

  // ── 4. Simulate page views ──────────────────────────────────────
  // Requires the app to be running (locally or deployed). Skip gracefully if unreachable.
  console.log(`Firing page views against ${APP_URL}…`);
  const spotSlugs = allSpots.filter((s) => s.slug).map((s) => s.slug!);
  const staticPaths = ["/", "/spots", "/sign-in", "/settings"];

  let viewCount = 0;
  let failCount = 0;

  // Quick reachability check
  let reachable = true;
  try {
    const probe = await fetch(`${APP_URL}/api/metrics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/" }),
    });
    if (!probe.ok) {
      console.warn(
        `Track endpoint returned ${probe.status} — skipping page views.`,
      );
      reachable = false;
    }
  } catch {
    console.warn(`Cannot reach ${APP_URL} — skipping page views.`);
    reachable = false;
  }

  if (reachable) {
    for (const u of users) {
      const paths: string[] = [];
      for (let j = 0; j < 5; j++) {
        if (Math.random() < 0.4 && spotSlugs.length > 0) {
          paths.push(`/spots/${pick(spotSlugs, 1)[0]}`);
        } else {
          paths.push(staticPaths[randomInt(0, staticPaths.length - 1)]);
        }
      }

      const results = await Promise.allSettled(
        paths.map((path) =>
          fetch(`${APP_URL}/api/metrics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path }),
          }),
        ),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.ok) viewCount++;
        else failCount++;
      }
    }
  }
  console.log(`Page views: ${viewCount} succeeded, ${failCount} failed.`);

  // ── Done ────────────────────────────────────────────────────────
  console.log("\nSeed complete!");
  console.log(`  Users:    50`);
  console.log(`  Sessions: 50`);
  console.log(`  Spot assignments: ${totalSpotAssignments}`);
  console.log(`  Favorites: ${totalFavorites}`);
  console.log(`  Page views sent: ${viewCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
