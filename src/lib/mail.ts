import { logger } from "@/lib/logger";

export function requireResendKey(): string | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return apiKey;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_API_KEY is not configured");
  }
  logger.warn("RESEND_API_KEY not set; skipping email");
  return null;
}
