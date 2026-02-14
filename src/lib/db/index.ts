import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | null = null;
let database: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    if (!database) {
      database = drizzle(getClient(), { schema });
    }
    return (database as unknown as Record<string | symbol, unknown>)[prop];
  },
});
