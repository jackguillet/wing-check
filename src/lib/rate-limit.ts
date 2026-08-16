import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Rate limiting is not configured");
    }
    return null;
  }
  return new Redis({ url, token });
}

function limiter(prefix: string, requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
  });
}

/** Credential endpoints: 10 / minute / IP */
export function getAuthLimiter() {
  return limiter("rl:auth", 10, "1 m");
}

/** get-session and other auth reads: 60 / minute / IP */
export function getSessionLimiter() {
  return limiter("rl:auth-session", 60, "1 m");
}

/** API routes: 30 / minute / IP */
export function getApiLimiter() {
  return limiter("rl:api", 30, "1 m");
}

export async function limitMutation(
  userId: string,
  action: string,
  requests: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
): Promise<{ ok: boolean }> {
  const rl = limiter(`rl:mut:${action}`, requests, window);
  if (!rl) return { ok: true };
  const { success } = await rl.limit(userId);
  return { ok: success };
}
