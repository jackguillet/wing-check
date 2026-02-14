import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { TOP_SPOTS } from "../data/top-spots";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

async function syncCoords() {
  const allSpots = await db.select().from(schema.spots);
  const spotsByName = new Map(allSpots.map((s) => [s.name, s]));

  let updated = 0;
  let unchanged = 0;
  let notFound = 0;

  for (const topSpot of TOP_SPOTS) {
    const dbSpot = spotsByName.get(topSpot.name);
    if (!dbSpot) {
      console.log(`  NOT FOUND: "${topSpot.name}"`);
      notFound++;
      continue;
    }

    if (dbSpot.latitude !== topSpot.latitude || dbSpot.longitude !== topSpot.longitude) {
      await db
        .update(schema.spots)
        .set({ latitude: topSpot.latitude, longitude: topSpot.longitude })
        .where(eq(schema.spots.id, dbSpot.id));
      console.log(
        `  UPDATED: "${topSpot.name}" (${dbSpot.latitude},${dbSpot.longitude}) → (${topSpot.latitude},${topSpot.longitude})`,
      );
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`\nUpdated ${updated} spots. ${unchanged} unchanged. ${notFound} not found in DB.`);
}

syncCoords().catch(console.error);
