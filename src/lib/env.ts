import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const baseSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1, "TURSO_DATABASE_URL is required"),
  TURSO_AUTH_TOKEN: z.string().min(1, "TURSO_AUTH_TOKEN is required"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: optionalUrl,
  ANTHROPIC_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const productionSchema = baseSchema.extend({
  // Alerts, cron, and rate limits fail closed in their own modules when
  // these are absent. Do not take the whole site down for them.
  CRON_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().min(1, "MAPBOX_ACCESS_TOKEN is required"),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const developmentSchema = baseSchema.extend({
  CRON_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof productionSchema>;

let validated = false;

function isStrictProduction() {
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.NODE_ENV !== "production") return false;
  // `next build` sets NODE_ENV=production; don't fail the compile.
  if (process.env.NEXT_PHASE?.includes("build")) return false;
  return !process.env.VERCEL;
}

export function validateEnv() {
  if (validated) return;

  const schema = isStrictProduction() ? productionSchema : developmentSchema;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\nEnvironment validation failed:\n${missing}\n`);

    if (isStrictProduction()) {
      throw new Error("Missing required environment variables");
    }
  } else if (isStrictProduction()) {
    const missing: string[] = [];
    if (!process.env.CRON_SECRET) missing.push("CRON_SECRET");
    if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      missing.push("UPSTASH_REDIS_REST_URL/TOKEN");
    }
    if (missing.length > 0) {
      console.warn(
        `Optional production services not configured (${missing.join(", ")}). Alerts and rate limits are disabled.`,
      );
    }
  }

  validated = true;
}
