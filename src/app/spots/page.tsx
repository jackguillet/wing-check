import { getSpotsWithFavorites } from "@/lib/actions/spots";
import { getSession } from "@/lib/auth-session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

      {spots.length === 0 ? (
        <p className="text-muted-foreground">
          No spots yet. Add your first one!
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Latitude</TableHead>
                <TableHead>Longitude</TableHead>
                <TableHead>NOAA Station</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spots.map((spot) => (
                <TableRow key={spot.id}>
                  <TableCell className="w-8 px-2">
                    {favoriteIds.has(spot.id) && (
                      <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/spots/${spot.id}`}
                      className="font-medium hover:underline"
                    >
                      {spot.name}
                    </Link>
                  </TableCell>
                  <TableCell>{spot.latitude.toFixed(4)}</TableCell>
                  <TableCell>{spot.longitude.toFixed(4)}</TableCell>
                  <TableCell>{spot.noaaStationId ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {spot.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
