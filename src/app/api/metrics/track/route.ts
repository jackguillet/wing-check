import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 },
    );
  }
  const { pageViews } = await import("@/lib/metrics");
  const { path } = (await request.json()) as { path: string };
  pageViews.inc({ path });
  return Response.json({ ok: true });
}
