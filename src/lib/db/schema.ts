import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const spots = sqliteTable("spots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  noaaStationId: text("noaa_station_id"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const alertCriteria = sqliteTable("alert_criteria", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spotId: integer("spot_id")
    .notNull()
    .references(() => spots.id, { onDelete: "cascade" }),
  minWindSpeed: real("min_wind_speed").notNull().default(15),
  maxWindSpeed: real("max_wind_speed").notNull().default(25),
  maxGustFactor: real("max_gust_factor").notNull().default(1.5),
  preferredDirections: text("preferred_directions").notNull().default("[]"),
  directionTolerance: real("direction_tolerance").notNull().default(45),
  minConsecutiveHours: integer("min_consecutive_hours").notNull().default(2),
  maxWaveHeight: real("max_wave_height"),
});

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
  sentAt: integer("sent_at", { mode: "timestamp" }).notNull(),
  alertType: text("alert_type").notNull(),
  forecastSummary: text("forecast_summary").notNull(),
});

export const preferences = sqliteTable("preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email"),
  alertsEnabled: integer("alerts_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  checkIntervalHours: integer("check_interval_hours").notNull().default(6),
  windSpeedUnit: text("wind_speed_unit").notNull().default("knots"),
  temperatureUnit: text("temperature_unit").notNull().default("celsius"),
});

export type Spot = typeof spots.$inferSelect;
export type NewSpot = typeof spots.$inferInsert;
export type AlertCriteria = typeof alertCriteria.$inferSelect;
export type NewAlertCriteria = typeof alertCriteria.$inferInsert;
export type ForecastCache = typeof forecastCache.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
