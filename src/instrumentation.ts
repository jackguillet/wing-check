export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize Sentry for server-side error tracking
    await import("../sentry.server.config");

    // Eagerly initialize the metrics registry at server startup (dev only)
    if (process.env.NODE_ENV !== "production") {
      await import("@/lib/metrics");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
