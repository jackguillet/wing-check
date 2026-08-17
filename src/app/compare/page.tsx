import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth-session";
import {
  getResolvedCriteriaDetails,
  getSpotsWithFavorites,
  getVisibleSpotBySlug,
} from "@/lib/data/spots";
import { getCachedForecastsBySpotIds } from "@/lib/data/forecasts";
import { getPreferences, getWingsForUser } from "@/lib/data/settings";
import { riderScheduleFromPrefs } from "@/lib/criteria";
import { defaultCriteria, evaluateSpot } from "@/lib/alerts/evaluator";
import { formatWingSize, formatWouldBeGo, quiverPair } from "@/lib/wings";
import { spotLocalNow } from "@/lib/weather/civil-time";
import { parseCompareSlugs } from "@/lib/spots/compare";
import { ComparePicker } from "@/components/compare-picker";
import { VerdictBadge } from "@/components/verdict-badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ spots?: string | string[] }>;
}): Promise<Metadata> {
  const { spots } = await searchParams;
  const slugs = parseCompareSlugs(spots);
  if (slugs.length < 2) return { title: "Compare spots · Wing Check" };
  return { title: `Compare ${slugs.length} spots · Wing Check` };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ spots?: string | string[] }>;
}) {
  const { spots: raw } = await searchParams;
  const slugs = parseCompareSlugs(raw);
  const session = await getSession();
  const viewerId = session?.user?.id;
  const { spots: catalog } = await getSpotsWithFavorites();

  const loaded = (
    await Promise.all(
      slugs.map(async (slug) => {
        const spot = await getVisibleSpotBySlug(slug, viewerId);
        return spot;
      }),
    )
  ).filter((s): s is NonNullable<typeof s> => s != null);

  const prefs = viewerId ? await getPreferences() : null;
  const rider = prefs ? riderScheduleFromPrefs(prefs) : null;
  const wingRows = viewerId ? await getWingsForUser(viewerId) : [];
  const ownedSizes = wingRows.map((w) => w.sizeM2);
  const cached = await getCachedForecastsBySpotIds(loaded.map((s) => s.id));

  const columns = await Promise.all(
    loaded.map(async (spot) => {
      const { criteria, source } = await getResolvedCriteriaDetails(
        spot.id,
        viewerId,
      );
      const forecast = cached.get(spot.id);
      const { quiver, missing } = quiverPair(
        source,
        ownedSizes,
        prefs?.riderWeightKg,
      );
      const evaluation = forecast
        ? evaluateSpot(
            forecast.hours,
            criteria ?? { id: 0, spotId: spot.id, ...defaultCriteria },
            forecast.sunrise,
            forecast.sunset,
            spotLocalNow(forecast.utcOffsetSeconds),
            rider,
            forecast.tides,
            quiver,
            missing,
          )
        : null;
      return { spot, evaluation };
    }),
  );

  const dates = [
    ...new Set(
      columns.flatMap((c) => c.evaluation?.dayEvaluations.map((d) => d.date) ?? []),
    ),
  ].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compare spots</h1>
        <p className="text-muted-foreground mt-2">
          Pick two or three pins. Sessions use your kit when you are signed in.
        </p>
      </div>

      <ComparePicker
        spots={catalog.map((s) => ({ slug: s.slug, name: s.name }))}
        selected={loaded.map((s) => s.slug).filter(Boolean) as string[]}
      />

      {columns.length >= 2 && dates.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Day</th>
                {columns.map((col) => (
                  <th key={col.spot.id} className="text-left p-3 font-medium">
                    <Link
                      href={`/spots/${col.spot.slug}`}
                      className="underline"
                    >
                      {col.spot.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.slice(0, 7).map((date) => (
                <tr key={date} className="border-b last:border-0">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {date}
                  </td>
                  {columns.map((col) => {
                    const day = col.evaluation?.dayEvaluations.find(
                      (d) => d.date === date,
                    );
                    if (!day) {
                      return (
                        <td key={col.spot.id} className="p-3 text-muted-foreground">
                          —
                        </td>
                      );
                    }
                    const w = day.bestWindow;
                    return (
                      <td key={col.spot.id} className="p-3">
                        <div className="flex items-center gap-2">
                          <VerdictBadge verdict={day.verdict} />
                          {w ? (
                            <span className="font-medium">{w.hours}h</span>
                          ) : null}
                        </div>
                        {w ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            {w.start.slice(11, 16)}–{w.end.slice(11, 16)}
                            {w.recommendedWing != null
                              ? ` · ${formatWingSize(w.recommendedWing)}`
                              : ""}
                          </p>
                        ) : day.suggestedWindow?.recommendedWing != null ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatWouldBeGo(day.suggestedWindow.recommendedWing)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            No window
                          </p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : columns.length === 1 ? (
        <p className="text-sm text-muted-foreground">
          Add one more spot to compare.
        </p>
      ) : slugs.length >= 2 && columns.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Those slugs are private or missing. Pick public spots you can view.
        </p>
      ) : null}
    </div>
  );
}
