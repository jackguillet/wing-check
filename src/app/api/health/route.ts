import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {};

  // Database connectivity
  try {
    await db.run(sql`SELECT 1`);
    checks.database = { status: "healthy" };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Required env vars
  const requiredVars = [
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "BETTER_AUTH_SECRET",
  ];
  const missingVars = requiredVars.filter((v) => !process.env[v]);
  checks.env =
    missingVars.length === 0
      ? { status: "healthy" }
      : { status: "unhealthy", message: `Missing: ${missingVars.join(", ")}` };

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  );
}
