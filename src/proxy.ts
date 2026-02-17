import { NextRequest, NextResponse } from "next/server";

function trackPageView(request: NextRequest, pathname: string) {
  // Skip API routes, Next.js internals, and static files
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return;
  }

  // Normalize dynamic segments to prevent label cardinality explosion
  const normalized = pathname.replace(/^\/spots\/[^/]+/, "/spots/[slug]");

  // Fire-and-forget page view tracking
  const trackUrl = new URL("/api/metrics/track", request.url);
  fetch(trackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: normalized }),
  }).catch(() => {
    // Silently ignore tracking failures
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Track page views
  trackPageView(request, pathname);

  // Only require auth for specific routes
  const authRequired =
    pathname.startsWith("/spots/new") || pathname.startsWith("/settings");

  if (!authRequired) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
