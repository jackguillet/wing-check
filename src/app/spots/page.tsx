import { getSpotsWithFavorites } from "@/lib/data/spots";
import { getSession } from "@/lib/auth-session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SpotsTable } from "@/components/spots-table";

export const dynamic = "force-dynamic";

export default async function SpotsPage() {
  const session = await getSession();
  const isAuthenticated = !!session?.user;
  const { spots, favoriteIds } = await getSpotsWithFavorites();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Spots</h1>
        {isAuthenticated && (
          <Link href="/spots/new">
            <Button>Add Spot</Button>
          </Link>
        )}
      </div>

      <SpotsTable spots={spots} favoriteIds={Array.from(favoriteIds)} />
    </div>
  );
}
