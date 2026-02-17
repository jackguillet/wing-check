import { Registry, Gauge, Counter, collectDefaultMetrics } from "prom-client";
import { db } from "@/lib/db";
import { user, session, userSpots, spots } from "@/lib/db/schema";
import { count, eq, sql } from "drizzle-orm";

function createRegistry() {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry });

  new Gauge({
    name: "wingcheck_users_total",
    help: "Total number of registered users",
    registers: [registry],
    async collect() {
      const [row] = await db.select({ value: count() }).from(user);
      this.set(row.value);
    },
  });

  new Gauge({
    name: "wingcheck_active_sessions",
    help: "Number of active (non-expired) sessions",
    registers: [registry],
    async collect() {
      const [row] = await db
        .select({ value: count() })
        .from(session)
        .where(sql`${session.expiresAt} > ${Date.now()}`);
      this.set(row.value);
    },
  });

  new Gauge({
    name: "wingcheck_spot_users",
    help: "Number of users per spot",
    labelNames: ["spot_name", "spot_id"] as const,
    registers: [registry],
    async collect() {
      this.reset();
      const rows = await db
        .select({
          spotId: userSpots.spotId,
          spotName: spots.name,
          value: count(),
        })
        .from(userSpots)
        .innerJoin(spots, eq(userSpots.spotId, spots.id))
        .groupBy(userSpots.spotId);
      for (const row of rows) {
        this.set(
          { spot_name: row.spotName, spot_id: String(row.spotId) },
          row.value,
        );
      }
    },
  });

  new Gauge({
    name: "wingcheck_spot_favorites",
    help: "Number of favorites per spot",
    labelNames: ["spot_name", "spot_id"] as const,
    registers: [registry],
    async collect() {
      this.reset();
      const rows = await db
        .select({
          spotId: userSpots.spotId,
          spotName: spots.name,
          value: count(),
        })
        .from(userSpots)
        .innerJoin(spots, eq(userSpots.spotId, spots.id))
        .where(eq(userSpots.isFavorite, true))
        .groupBy(userSpots.spotId);
      for (const row of rows) {
        this.set(
          { spot_name: row.spotName, spot_id: String(row.spotId) },
          row.value,
        );
      }
    },
  });

  const pageViews = new Counter({
    name: "wingcheck_page_views_total",
    help: "Total page views",
    labelNames: ["path"] as const,
    registers: [registry],
  });

  return { registry, pageViews };
}

const globalKey = Symbol.for("wingcheck-metrics");

type MetricsSingleton = ReturnType<typeof createRegistry>;

function getMetrics(): MetricsSingleton {
  const g = globalThis as unknown as Record<symbol, MetricsSingleton>;
  if (!g[globalKey]) {
    g[globalKey] = createRegistry();
  }
  return g[globalKey];
}

export const { registry, pageViews } = getMetrics();
