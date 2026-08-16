import { z } from "zod";
import { isValidDirectionList } from "@/lib/directions";
import { MAX_WING_SIZE_M2, MIN_WING_SIZE_M2 } from "@/lib/wings";

const preferredDirectionsField = z
  .string()
  .optional()
  .default("[]")
  .refine(isValidDirectionList, {
    message: "Preferred directions must be degrees between 0 and 360",
  });

const windRangeFields = {
  minWindSpeed: z.coerce.number().min(0).max(100).optional().default(10),
  maxWindSpeed: z.coerce.number().min(0).max(100).optional().default(25),
};

function refineWindRange<
  T extends { minWindSpeed: number; maxWindSpeed: number },
>(data: T, ctx: z.RefinementCtx) {
  if (data.minWindSpeed > data.maxWindSpeed) {
    ctx.addIssue({
      code: "custom",
      path: ["minWindSpeed"],
      message: "Min wind speed must be less than or equal to max",
    });
  }
}

export const createSpotSchema = z
  .object({
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
    preferredDirections: preferredDirectionsField,
    ...windRangeFields,
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
  })
  .superRefine(refineWindRange);

export const updateCriteriaSchema = z
  .object({
    ...windRangeFields,
    maxGustFactor: z.coerce.number().min(1).max(10).optional().default(2.5),
    preferredDirections: preferredDirectionsField,
    directionTolerance: z.coerce.number().min(0).max(180).optional().default(45),
    minConsecutiveHours: z.coerce
      .number()
      .int()
      .min(1)
      .max(24)
      .optional()
      .default(2),
    maxWaveHeight: z.coerce.number().min(0).max(20).optional(),
  })
  .superRefine(refineWindRange);

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

export const kitPresetNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(40, "Name too long");

export const MAX_KIT_PRESETS = 20;

export const riderWeightKgSchema = z.coerce
  .number()
  .min(30, "Weight must be at least 30 kg")
  .max(200, "Weight must be at most 200 kg");

export const wingSizeSchema = z.coerce
  .number()
  .min(MIN_WING_SIZE_M2, `Wing size must be at least ${MIN_WING_SIZE_M2} m²`)
  .max(MAX_WING_SIZE_M2, `Wing size must be at most ${MAX_WING_SIZE_M2} m²`);

export { MAX_WINGS } from "@/lib/wings";

export const spotNotesSchema = createSpotSchema.shape.notes;

export const updateSpotSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  latitude: z.coerce
    .number()
    .min(-90)
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180)
    .max(180, "Longitude must be between -180 and 180"),
  noaaStationId: z.string().max(20).optional().default(""),
  notes: spotNotesSchema,
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
