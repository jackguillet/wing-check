import { pageViews } from "@/lib/metrics";

export async function POST(request: Request) {
  const { path } = (await request.json()) as { path: string };
  pageViews.inc({ path });
  return Response.json({ ok: true });
}
