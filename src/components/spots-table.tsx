"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Spot } from "@/lib/db/schema";

interface SpotsTableProps {
  spots: Spot[];
  favoriteIds: number[];
}

export function SpotsTable({ spots, favoriteIds }: SpotsTableProps) {
  const [search, setSearch] = useState("");
  const favSet = new Set(favoriteIds);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? spots.filter((s) => s.name.toLowerCase().includes(query))
    : spots;

  if (spots.length === 0) {
    return (
      <p className="text-muted-foreground">
        No spots yet. Add your first one!
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
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
                <TableHead className="w-8"></TableHead>
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
                    {favSet.has(spot.id) && (
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
