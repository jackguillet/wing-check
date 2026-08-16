import { NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth-session";

export async function GET(request: Request) {
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "5",
    addressdetails: "0",
  });

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "WingCheck/1.0 (https://wingcheck.dev)",
          Accept: "application/json",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding failed" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;

    return NextResponse.json(
      data.map((item) => ({
        label: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      })),
    );
  } catch {
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}
