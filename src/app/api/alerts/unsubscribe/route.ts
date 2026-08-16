import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/alerts/unsubscribe";

async function disableAlerts(token: string | null): Promise<boolean> {
  if (!token) return false;
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return false;
  await db
    .update(preferences)
    .set({ alertsEnabled: false })
    .where(eq(preferences.userId, parsed.userId));
  return true;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const ok = await disableAlerts(token);
  if (!ok) {
    return new NextResponse("Invalid or expired unsubscribe link.", {
      status: 400,
    });
  }
  return new NextResponse(
    "You are unsubscribed from Wing Check email alerts.",
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const ok = await disableAlerts(token);
  if (!ok) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
