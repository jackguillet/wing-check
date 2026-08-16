import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  let databaseOk = false;
  try {
    await db.run(sql`SELECT 1`);
    databaseOk = true;
  } catch {
    databaseOk = false;
  }

  const ok = databaseOk;
  return NextResponse.json(
    {
      ok,
      database: databaseOk,
    },
    { status: ok ? 200 : 503 },
  );
}
