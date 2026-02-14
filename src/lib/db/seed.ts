import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

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
      min_wind_speed REAL NOT NULL DEFAULT 15,
      max_wind_speed REAL NOT NULL DEFAULT 25,
      max_gust_factor REAL NOT NULL DEFAULT 1.5,
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

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
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
    console.log(`Database already has ${existingUsers.length} users. Skipping seed.`);
  }
}

seed().catch(console.error);
