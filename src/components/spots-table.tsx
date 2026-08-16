"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { compareHref } from "@/lib/spots/compare";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientSpot } from "@/lib/spots/visibility";

interface SpotsTableProps {
  spots: ClientSpot[];
  favoriteIds: number[];
  isAuthenticated: boolean;
}

export function SpotsTable({
  spots,
  favoriteIds,
  isAuthenticated,
}: SpotsTableProps) {
  const [search, setSearch] = useState("");
  const [compare, setCompare] = useState<string[]>([]);
  const favSet = new Set(favoriteIds);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? spots.filter((s) => s.name.toLowerCase().includes(query))
    : spots;

  if (spots.length === 0) {
    return (
      <p className="text-muted-foreground">
        {isAuthenticated
          ? "No spots yet. Add your first one to start scoring a forecast."
          : "No public spots are listed yet. Sign up to add your own."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Label htmlFor="spot-search" className="sr-only">
          Search spots
        </Label>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="spot-search"
          placeholder="Search spots..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No spots found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <span className="sr-only">Compare</span>
                </TableHead>
                <TableHead className="w-8">
                  <span className="sr-only">Favorite</span>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Latitude</TableHead>
                <TableHead>Longitude</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((spot) => (
                <TableRow key={spot.id}>
                  <TableCell className="w-8 px-2">
                    {spot.slug ? (
                      <input
                        type="checkbox"
                        aria-label={`Compare ${spot.name}`}
                        checked={compare.includes(spot.slug)}
                        disabled={
                          !compare.includes(spot.slug) && compare.length >= 3
                        }
                        onChange={() => {
                          const slug = spot.slug!;
                          setCompare((prev) =>
                            prev.includes(slug)
                              ? prev.filter((s) => s !== slug)
                              : prev.length >= 3
                                ? prev
                                : [...prev, slug],
                          );
                        }}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="w-8 px-2">
                    {favSet.has(spot.id) && (
                      <Heart
                        className="h-4 w-4 fill-red-500 text-red-500"
                        aria-label="Favorite"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/spots/${spot.slug}`}
                      className="font-medium hover:underline"
                    >
                      {spot.name}
                    </Link>
                    {spot.visibility === "private" ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Private
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{spot.latitude.toFixed(4)}</TableCell>
                  <TableCell>{spot.longitude.toFixed(4)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {spot.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {compare.length > 0 ? (
        <div className="flex items-center gap-3">
          {compare.length >= 2 ? (
            <Button asChild>
              <Link href={compareHref(compare)}>
                Compare {compare.length} spots
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled>
              Compare {compare.length} spot
            </Button>
          )}
          <button
            type="button"
            className="text-sm underline text-muted-foreground"
            onClick={() => setCompare([])}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
