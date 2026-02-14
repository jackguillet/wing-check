import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

async function seed() {
  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      email TEXT,
      alerts_enabled INTEGER NOT NULL DEFAULT 0,
      check_interval_hours INTEGER NOT NULL DEFAULT 6,
      wind_speed_unit TEXT NOT NULL DEFAULT 'knots',
      temperature_unit TEXT NOT NULL DEFAULT 'celsius'
    );
  `);

  // Seed example spots
  const existingSpots = await db.select().from(schema.spots);
  if (existingSpots.length === 0) {
    console.log("Seeding example spots...");

    const crissyResult = await db
      .insert(schema.spots)
      .values({
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

    // Create default preferences
    await db.insert(schema.preferences)
      .values({
        email: null,
        alertsEnabled: false,
        checkIntervalHours: 6,
        windSpeedUnit: "knots",
        temperatureUnit: "celsius",
      });

    console.log("Seeded 2 example spots and default preferences.");
  } else {
    console.log(`Database already has ${existingSpots.length} spots. Skipping seed.`);
  }
}

seed().catch(console.error);
