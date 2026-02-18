import { z } from "zod";

export const createSpotSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  latitude: z.coerce
    .number()
    .min(-90)
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180)
    .max(180, "Longitude must be between -180 and 180"),
  noaaStationId: z.string().optional().default(""),
  notes: z.string().max(500, "Notes too long").optional().default(""),
  preferredDirections: z.string().optional().default("[]"),
  minWindSpeed: z.coerce.number().min(0).max(100).optional().default(10),
  maxWindSpeed: z.coerce.number().min(0).max(100).optional().default(25),
  maxGustFactor: z.coerce.number().min(1).max(10).optional().default(2.5),
  directionTolerance: z.coerce.number().min(0).max(180).optional().default(45),
  minConsecutiveHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24)
    .optional()
    .default(2),
  maxWaveHeight: z.coerce.number().min(0).max(20).optional(),
});

export const updateCriteriaSchema = z.object({
  minWindSpeed: z.coerce.number().min(0).max(100).optional().default(10),
  maxWindSpeed: z.coerce.number().min(0).max(100).optional().default(25),
  maxGustFactor: z.coerce.number().min(1).max(10).optional().default(2.5),
  preferredDirections: z.string().optional().default("[]"),
  directionTolerance: z.coerce.number().min(0).max(180).optional().default(45),
  minConsecutiveHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24)
    .optional()
    .default(2),
  maxWaveHeight: z.coerce.number().min(0).max(20).optional(),
});

export const updatePreferencesSchema = z.object({
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  alertsEnabled: z.enum(["on", "off"]).optional(),
  checkIntervalHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .optional()
    .default(6),
  windSpeedUnit: z
    .enum(["knots", "mph", "kmh", "ms"])
    .optional()
    .default("knots"),
  temperatureUnit: z
    .enum(["celsius", "fahrenheit"])
    .optional()
    .default("celsius"),
});

/** Parse FormData into a plain object for Zod validation */
export function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") {
      obj[key] = value;
    }
  });
  return obj;
}
