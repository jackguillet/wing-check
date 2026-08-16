import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 60 * 60 * 24 * 90;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is required");
  return value;
}

export function createUnsubscribeToken(userId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
  now = Date.now(),
): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!userId || !Number.isFinite(exp) || exp * 1000 < now) return null;

  const payload = `${userId}.${expRaw}`;
  const expected = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId };
}
