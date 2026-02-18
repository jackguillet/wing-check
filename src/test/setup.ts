// Global test setup — mock environment variables
process.env.CRON_SECRET = "test-cron-secret";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.TURSO_DATABASE_URL = "libsql://test.turso.io";
process.env.TURSO_AUTH_TOKEN = "test-token";
process.env.BETTER_AUTH_SECRET = "test-auth-secret";
