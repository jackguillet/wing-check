import { sql } from "drizzle-orm";
import { index, uniqueIndex, sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ── Better Auth tables ──────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ── App tables ──────────────────────────────────────────────────────

export const spots = sqliteTable(
  "spots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    noaaStationId: text("noaa_station_id"),
    notes: text("notes"),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("spots_slug_uniq").on(table.slug)],
);

export const userSpots = sqliteTable(
  "user_spots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spotId: integer("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    isFavorite: integer("is_favorite", { mode: "boolean" })
      .notNull()
      .default(false),
    alertsEnabled: integer("alerts_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("user_spots_userId_idx").on(table.userId),
    index("user_spots_spotId_idx").on(table.spotId),
    uniqueIndex("user_spots_userId_spotId_uniq").on(table.userId, table.spotId),
  ],
);

export const alertCriteria = sqliteTable("alert_criteria", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spotId: integer("spot_id")
    .notNull()
    .references(() => spots.id, { onDelete: "cascade" }),
  minWindSpeed: real("min_wind_speed").notNull().default(10),
  maxWindSpeed: real("max_wind_speed").notNull().default(25),
  maxGustFactor: real("max_gust_factor").notNull().default(2.5),
  preferredDirections: text("preferred_directions").notNull().default("[]"),
  directionTolerance: real("direction_tolerance").notNull().default(45),
  minConsecutiveHours: integer("min_consecutive_hours").notNull().default(2),
  maxWaveHeight: real("max_wave_height").default(1.5),
});

export const userAlertCriteria = sqliteTable(
  "user_alert_criteria",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spotId: integer("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    minWindSpeed: real("min_wind_speed").notNull().default(10),
    maxWindSpeed: real("max_wind_speed").notNull().default(25),
    maxGustFactor: real("max_gust_factor").notNull().default(2.5),
    preferredDirections: text("preferred_directions").notNull().default("[]"),
    directionTolerance: real("direction_tolerance").notNull().default(45),
    minConsecutiveHours: integer("min_consecutive_hours").notNull().default(2),
    maxWaveHeight: real("max_wave_height").default(1.5),
  },
  (table) => [
    index("user_alert_criteria_userId_idx").on(table.userId),
    uniqueIndex("user_alert_criteria_userId_spotId_uniq").on(
      table.userId,
      table.spotId,
    ),
  ],
);

export const forecastCache = sqliteTable("forecast_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spotId: integer("spot_id")
    .notNull()
    .references(() => spots.id, { onDelete: "cascade" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  weatherData: text("weather_data").notNull(),
  marineData: text("marine_data"),
  tideData: text("tide_data"),
});

export const alertHistory = sqliteTable("alert_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spotId: integer("spot_id")
    .notNull()
    .references(() => spots.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  sentAt: integer("sent_at", { mode: "timestamp" }).notNull(),
  alertType: text("alert_type").notNull(),
  forecastSummary: text("forecast_summary").notNull(),
});

export const spotOverviews = sqliteTable(
  "spot_overviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    spotId: integer("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    overview: text("overview").notNull(),
    model: text("model").notNull(),
    generatedAt: integer("generated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    forecastSummary: text("forecast_summary").notNull(),
  },
  (table) => [index("spot_overviews_spotId_idx").on(table.spotId)],
);

export const preferences = sqliteTable(
  "preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email"),
    alertsEnabled: integer("alerts_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    checkIntervalHours: integer("check_interval_hours").notNull().default(6),
    windSpeedUnit: text("wind_speed_unit").notNull().default("knots"),
    temperatureUnit: text("temperature_unit").notNull().default("celsius"),
    minWindSpeed: real("min_wind_speed"),
    maxWindSpeed: real("max_wind_speed"),
    maxGustFactor: real("max_gust_factor"),
    preferredDirections: text("preferred_directions"),
    directionTolerance: real("direction_tolerance"),
    minConsecutiveHours: integer("min_consecutive_hours"),
    maxWaveHeight: real("max_wave_height"),
  },
  (table) => [uniqueIndex("preferences_userId_uniq").on(table.userId)],
);

export type Spot = typeof spots.$inferSelect;
export type NewSpot = typeof spots.$inferInsert;
export type UserSpot = typeof userSpots.$inferSelect;
export type NewUserSpot = typeof userSpots.$inferInsert;
export type AlertCriteria = typeof alertCriteria.$inferSelect;
export type NewAlertCriteria = typeof alertCriteria.$inferInsert;
export type UserAlertCriteria = typeof userAlertCriteria.$inferSelect;
export type NewUserAlertCriteria = typeof userAlertCriteria.$inferInsert;
export type ForecastCache = typeof forecastCache.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type SpotOverview = typeof spotOverviews.$inferSelect;
