# Production Readiness — Task Tracker

## Phase 1: Security Hardening

- [x] 1.1 Create proxy.ts (security headers, route protection, request ID)
- [x] 1.2 Rate limiting with Upstash Redis
- [x] 1.3 Harden cron endpoint (fail closed)
- [x] 1.4 Input validation with Zod schemas
- [x] 1.5 Verify Phase 1 — build passes, tests pass

## Phase 2: Observability

- [x] 2.1 Structured logging with Pino
- [x] 2.2 Error tracking with Sentry
- [x] 2.3 Production metrics strategy (guard prom-client behind NODE_ENV)
- [x] 2.4 Verify Phase 2 — build passes

## Phase 3: Reliability

- [x] 3.1 React error boundaries
- [x] 3.2 Graceful degradation for API failures (stale-while-error)
- [x] 3.3 Dashboard N+1 optimization (getSpotsWithCriteria batch)
- [x] 3.4 Cron N+1 optimization (bulk queries, deduplicated forecasts)
- [x] 3.5 Verify Phase 3 — build passes

## Phase 4: Testing

- [x] 4.1 Test infrastructure (setup, mocks, coverage)
- [x] 4.2 New test files (validations — 20 tests)
- [x] 4.3 Verify Phase 4 — 76/76 tests pass

## Phase 5: Operational Readiness

- [x] 5.1 Health check endpoint
- [x] 5.2 Custom 404 page
- [x] 5.3 Environment validation at startup
- [x] 5.4 Verify Phase 5 — build passes
