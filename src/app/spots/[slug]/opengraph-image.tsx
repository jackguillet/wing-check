import { ImageResponse } from "next/og";
import { getVisibleSpotBySlug } from "@/lib/data/spots";
import { getCachedForecastsBySpotIds } from "@/lib/data/forecasts";
import { getResolvedCriteriaDetails } from "@/lib/data/spots";
import { evaluateSpot } from "@/lib/alerts/evaluator";
import { spotLocalNow } from "@/lib/weather/civil-time";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Wing Check spot forecast";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const spot = await getVisibleSpotBySlug(slug, null);
  if (!spot) {
    return new ImageResponse(
      <Card title="Wing Check" subtitle="Spot not found" score={null} />,
      size,
    );
  }

  const cached = (await getCachedForecastsBySpotIds([spot.id])).get(spot.id);
  let verdict = "Forecast";
  let score: number | null = null;
  if (cached) {
    const { criteria } = await getResolvedCriteriaDetails(spot.id, null);
    const evaluation = evaluateSpot(
      cached.hours,
      criteria,
      cached.sunrise,
      cached.sunset,
      spotLocalNow(cached.utcOffsetSeconds),
      null,
      cached.tides,
    );
    verdict = evaluation.goNoGo.toUpperCase();
    score = evaluation.overallScore;
  }

  return new ImageResponse(
    <Card title={spot.name} subtitle={`${verdict} · Wing Check`} score={score} />,
    size,
  );
}

function Card({
  title,
  subtitle,
  score,
}: {
  title: string;
  subtitle: string;
  score: number | null;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0b1220",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 28, opacity: 0.7 }}>Wing Check</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 72, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 36, opacity: 0.85 }}>{subtitle}</div>
      </div>
      <div style={{ fontSize: 48, fontWeight: 600 }}>
        {score != null ? `${score}/100` : "wing-check.vercel.app"}
      </div>
    </div>
  );
}
