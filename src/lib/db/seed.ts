import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, inArray, isNotNull, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { SYSTEM_USER_ID, TOP_SPOTS } from "../data/top-spots";
import { findNearestStation, validateStation } from "../weather/noaa-stations";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

const DEMO_USER_ID = "demo-user-000";

async function seed() {
  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS session_userId_idx ON session(user_id);

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    );

    CREATE INDEX IF NOT EXISTS account_userId_idx ON account(user_id);

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    );

    CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

    CREATE TABLE IF NOT EXISTS spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      noaa_station_id TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS alert_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
      min_wind_speed REAL NOT NULL DEFAULT 10,
      max_wind_speed REAL NOT NULL DEFAULT 25,
      max_gust_factor REAL NOT NULL DEFAULT 2.5,
      preferred_directions TEXT NOT NULL DEFAULT '[]',
      direction_tolerance REAL NOT NULL DEFAULT 45,
      min_consecutive_hours INTEGER NOT NULL DEFAULT 2,
      max_wave_height REAL
    );

    CREATE TABLE IF NOT EXISTS forecast_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
      fetched_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      weather_data TEXT NOT NULL,
      marine_data TEXT,
      tide_data TEXT
    );

    CREATE TABLE IF NOT EXISTS user_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      alerts_enabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS user_spots_userId_idx ON user_spots(user_id);
    CREATE INDEX IF NOT EXISTS user_spots_spotId_idx ON user_spots(spot_id);
    CREATE UNIQUE INDEX IF NOT EXISTS user_spots_userId_spotId_uniq ON user_spots(user_id, spot_id);

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
      sent_at INTEGER NOT NULL,
      alert_type TEXT NOT NULL,
      forecast_summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      email TEXT,
      alerts_enabled INTEGER NOT NULL DEFAULT 0,
      check_interval_hours INTEGER NOT NULL DEFAULT 6,
      wind_speed_unit TEXT NOT NULL DEFAULT 'knots',
      temperature_unit TEXT NOT NULL DEFAULT 'celsius'
    );
  `);

  // Seed demo user and example data
  const existingUsers = await db.select().from(schema.user);
  if (existingUsers.length === 0) {
    console.log("Seeding demo user and example spots...");

    const now = new Date();

    // Create demo user
    await db.insert(schema.user).values({
      id: DEMO_USER_ID,
      name: "Demo User",
      email: "demo@wingcheck.dev",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    // Seed example spots
    const crissyResult = await db
      .insert(schema.spots)
      .values({
        userId: DEMO_USER_ID,
        name: "Crissy Field",
        latitude: 37.8045,
        longitude: -122.4654,
        noaaStationId: "9414290",
        notes: "Classic SF bay spot. Best on strong W/NW wind. Watch for kiteboarders.",
      })
      .returning();
    const crissy = crissyResult[0];

    await db.insert(schema.alertCriteria)
      .values({
        spotId: crissy.id,
        minWindSpeed: 18,
        maxWindSpeed: 28,
        maxGustFactor: 1.4,
        preferredDirections: "[270, 290, 310]",
        directionTolerance: 40,
        minConsecutiveHours: 2,
        maxWaveHeight: 1.5,
      });

    const hookipaResult = await db
      .insert(schema.spots)
      .values({
        userId: DEMO_USER_ID,
        name: "Ho'okipa Beach",
        latitude: 20.9342,
        longitude: -156.3558,
        notes: "Maui north shore. Afternoon trades are best. Advanced riders only when big.",
      })
      .returning();
    const hookipa = hookipaResult[0];

    await db.insert(schema.alertCriteria)
      .values({
        spotId: hookipa.id,
        minWindSpeed: 15,
        maxWindSpeed: 30,
        maxGustFactor: 1.6,
        preferredDirections: "[45, 60, 75, 90]",
        directionTolerance: 45,
        minConsecutiveHours: 3,
        maxWaveHeight: 2.5,
      });

    // Create userSpots rows for demo user (favorite + alerts on)
    await db.insert(schema.userSpots).values([
      {
        userId: DEMO_USER_ID,
        spotId: crissy.id,
        isFavorite: true,
        alertsEnabled: true,
      },
      {
        userId: DEMO_USER_ID,
        spotId: hookipa.id,
        isFavorite: true,
        alertsEnabled: true,
      },
    ]);

    // Create default preferences for demo user
    await db.insert(schema.preferences)
      .values({
        userId: DEMO_USER_ID,
        email: null,
        alertsEnabled: false,
        checkIntervalHours: 6,
        windSpeedUnit: "knots",
        temperatureUnit: "celsius",
      });

    console.log("Seeded demo user, 2 example spots, and default preferences.");
  } else {
    console.log(`Database already has ${existingUsers.length} users. Skipping demo seed.`);
  }

  // ── Seed system user + curated spots (always idempotent) ──
  const existingSystem = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, SYSTEM_USER_ID));

  if (existingSystem.length === 0) {
    const now = new Date();
    await db.insert(schema.user).values({
      id: SYSTEM_USER_ID,
      name: "Wing Check",
      email: "system@wingcheck.dev",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    console.log("Created system user.");
  }

  // Fetch existing spot names to avoid duplicates
  const existingSpots = await db
    .select({ name: schema.spots.name })
    .from(schema.spots);
  const existingNames = new Set(existingSpots.map((s) => s.name));

  let seededCount = 0;
  for (const topSpot of TOP_SPOTS) {
    if (existingNames.has(topSpot.name)) continue;

    const insertResult = await db
      .insert(schema.spots)
      .values({
        userId: SYSTEM_USER_ID,
        name: topSpot.name,
        latitude: topSpot.latitude,
        longitude: topSpot.longitude,
        noaaStationId: topSpot.noaaStationId ?? null,
        notes: topSpot.notes,
      })
      .returning();
    const inserted = insertResult[0];

    await db.insert(schema.alertCriteria).values({
      spotId: inserted.id,
      minWindSpeed: topSpot.alertCriteria?.minWindSpeed ?? 10,
      maxWindSpeed: topSpot.alertCriteria?.maxWindSpeed ?? 25,
      maxGustFactor: topSpot.alertCriteria?.maxGustFactor ?? 2.5,
      preferredDirections: topSpot.alertCriteria?.preferredDirections ?? "[]",
      directionTolerance: topSpot.alertCriteria?.directionTolerance ?? 45,
      minConsecutiveHours: topSpot.alertCriteria?.minConsecutiveHours ?? 2,
      maxWaveHeight: topSpot.alertCriteria?.maxWaveHeight ?? null,
    });

    seededCount++;
  }

  console.log(`Seeded ${seededCount} curated spots (${TOP_SPOTS.length - seededCount} already existed).`);

  // ── Reseed criteria for existing system-owned spots ──
  const systemSpots = await db
    .select({ id: schema.spots.id, name: schema.spots.name })
    .from(schema.spots)
    .where(eq(schema.spots.userId, SYSTEM_USER_ID));

  let updatedCriteriaCount = 0;
  for (const sysSpot of systemSpots) {
    const topSpot = TOP_SPOTS.find((t) => t.name === sysSpot.name);
    if (!topSpot?.alertCriteria) continue;

    const criteriaValues = {
      minWindSpeed: topSpot.alertCriteria.minWindSpeed ?? 10,
      maxWindSpeed: topSpot.alertCriteria.maxWindSpeed ?? 25,
      maxGustFactor: topSpot.alertCriteria.maxGustFactor ?? 2.5,
      preferredDirections: topSpot.alertCriteria.preferredDirections ?? "[]",
      directionTolerance: topSpot.alertCriteria.directionTolerance ?? 45,
      minConsecutiveHours: topSpot.alertCriteria.minConsecutiveHours ?? 2,
      maxWaveHeight: topSpot.alertCriteria.maxWaveHeight ?? null,
    };

    const existingCriteria = await db
      .select()
      .from(schema.alertCriteria)
      .where(eq(schema.alertCriteria.spotId, sysSpot.id));

    if (existingCriteria.length > 0) {
      await db
        .update(schema.alertCriteria)
        .set(criteriaValues)
        .where(eq(schema.alertCriteria.spotId, sysSpot.id));
    } else {
      await db.insert(schema.alertCriteria).values({
        spotId: sysSpot.id,
        ...criteriaValues,
      });
    }
    updatedCriteriaCount++;
  }
  console.log(`Updated criteria for ${updatedCriteriaCount} existing system spots.`);

  // ── Backfill NOAA station IDs for spots missing them ──
  const spotsWithoutStation = await db
    .select({ id: schema.spots.id, name: schema.spots.name, latitude: schema.spots.latitude, longitude: schema.spots.longitude })
    .from(schema.spots)
    .where(isNull(schema.spots.noaaStationId));

  let backfilledCount = 0;
  const backfilledIds: number[] = [];
  for (const spot of spotsWithoutStation) {
    const stationId = await findNearestStation(spot.latitude, spot.longitude);
    if (stationId) {
      await db
        .update(schema.spots)
        .set({ noaaStationId: stationId })
        .where(eq(schema.spots.id, spot.id));
      backfilledIds.push(spot.id);
      backfilledCount++;
      console.log(`  ${spot.name} → station ${stationId}`);
    }
  }
  console.log(`Backfilled NOAA station for ${backfilledCount}/${spotsWithoutStation.length} spots.`);

  // ── Validate existing NOAA stations ──
  const spotsWithStation = await db
    .select({
      id: schema.spots.id,
      name: schema.spots.name,
      latitude: schema.spots.latitude,
      longitude: schema.spots.longitude,
      noaaStationId: schema.spots.noaaStationId,
    })
    .from(schema.spots)
    .where(isNotNull(schema.spots.noaaStationId));

  let revalidatedCount = 0;
  for (const spot of spotsWithStation) {
    const valid = await validateStation(spot.noaaStationId!);
    if (!valid) {
      const newStation = await findNearestStation(spot.latitude, spot.longitude);
      if (newStation && newStation !== spot.noaaStationId) {
        await db
          .update(schema.spots)
          .set({ noaaStationId: newStation })
          .where(eq(schema.spots.id, spot.id));
        backfilledIds.push(spot.id);
        revalidatedCount++;
        console.log(`  ${spot.name}: ${spot.noaaStationId} → ${newStation}`);
      } else {
        await db
          .update(schema.spots)
          .set({ noaaStationId: null })
          .where(eq(schema.spots.id, spot.id));
        backfilledIds.push(spot.id);
        console.log(`  ${spot.name}: ${spot.noaaStationId} → none (no valid station)`);
      }
    }
  }
  console.log(`Re-validated ${revalidatedCount} stations.`);

  // Clear stale forecast cache for backfilled/re-validated spots
  if (backfilledIds.length > 0) {
    await db.delete(schema.forecastCache)
      .where(inArray(schema.forecastCache.spotId, backfilledIds));
    console.log(`Cleared forecast cache for ${backfilledIds.length} spots.`);
  }
}

seed().catch(console.error);
