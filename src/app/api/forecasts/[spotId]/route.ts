import { NextResponse } from "next/server";
import { getSpotForecast } from "@/lib/actions/forecasts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spotId: string }> }
) {
  const { spotId } = await params;
  const id = parseInt(spotId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid spot ID" }, { status: 400 });
  }

  try {
    const forecast = await getSpotForecast(id);
    if (!forecast) {
      return NextResponse.json({ error: "Spot not found" }, { status: 404 });
    }
    return NextResponse.json(forecast);
  } catch (error) {
    console.error("Forecast fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch forecast" },
      { status: 500 }
    );
  }
}
