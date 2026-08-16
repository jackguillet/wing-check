import { NextRequest, NextResponse } from "next/server";
import {
  getAuthLimiter,
  getApiLimiter,
  getSessionLimiter,
} from "@/lib/rate-limit";

const PROTECTED_ROUTES = ["/settings", "/spots/new", "/setup"];

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io; frame-ancestors 'none';",
  );
  return response;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

function nextWithPath(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate request ID for log correlation
  const requestId = crypto.randomUUID();

  // Rate limiting for auth endpoints
  if (pathname.startsWith("/api/auth")) {
    const strict =
      /sign-in|sign-up|forget-password|reset-password|request-password-reset|send-verification/.test(
        pathname,
      );
    const limiter = strict ? getAuthLimiter() : getSessionLimiter();
    if (limiter) {
      const ip = getClientIp(request);
      const { success, remaining } = await limiter.limit(ip);
      if (!success) {
        const res = NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        );
        res.headers.set("x-request-id", requestId);
        res.headers.set("Retry-After", "60");
        return addSecurityHeaders(res);
      }
      const response = nextWithPath(request, pathname);
      response.headers.set("x-ratelimit-remaining", String(remaining));
      response.headers.set("x-request-id", requestId);
      return addSecurityHeaders(response);
    }
  }

  // Rate limiting for API routes (non-auth)
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    const limiter = getApiLimiter();
    if (limiter) {
      const ip = getClientIp(request);
      const { success, remaining } = await limiter.limit(ip);
      if (!success) {
        const res = NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        );
        res.headers.set("x-request-id", requestId);
        res.headers.set("Retry-After", "60");
        return addSecurityHeaders(res);
      }
      const response = nextWithPath(request, pathname);
      response.headers.set("x-ratelimit-remaining", String(remaining));
      response.headers.set("x-request-id", requestId);
      return addSecurityHeaders(response);
    }
  }

  // Route protection (defense-in-depth — server actions still gate auth)
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const sessionCookie =
      request.cookies.get("better-auth.session_token") ??
      request.cookies.get("__Secure-better-auth.session_token");
    if (!sessionCookie?.value) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      const response = NextResponse.redirect(signInUrl);
      response.headers.set("x-request-id", requestId);
      return addSecurityHeaders(response);
    }
  }

  const response = nextWithPath(request, pathname);
  response.headers.set("x-request-id", requestId);
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
