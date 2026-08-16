import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../unsubscribe";

const SECRET = "x".repeat(32);

describe("unsubscribe token", () => {
  const prev = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = prev;
  });

  it("round-trips a user id", () => {
    const token = createUnsubscribeToken("user-1", 1_700_000_000_000);
    expect(verifyUnsubscribeToken(token, 1_700_000_000_000)?.userId).toBe(
      "user-1",
    );
  });

  it("rejects a tampered token", () => {
    const token = createUnsubscribeToken("user-1");
    expect(verifyUnsubscribeToken(token.slice(0, -2) + "aa")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createUnsubscribeToken("user-1", 1_000_000);
    expect(verifyUnsubscribeToken(token, Date.now())).toBeNull();
  });
});
