export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Eagerly initialize the metrics registry at server startup
    await import("@/lib/metrics");
  }
}
