"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compareHref } from "@/lib/spots/compare";

export function ComparePicker({
  spots,
  selected,
}: {
  spots: { slug: string | null; name: string }[];
  selected: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>(selected);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      spots.filter(
        (s) =>
          s.slug &&
          (!query || s.name.toLowerCase().includes(query)),
      ),
    [spots, query],
  );

  function toggle(slug: string) {
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 3) return prev;
      return [...prev, slug];
    });
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="compare-search" className="sr-only">
        Filter spots to compare
      </Label>
      <Input
        id="compare-search"
        placeholder="Filter spots..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="max-h-56 overflow-auto rounded-md border divide-y">
        {visible.slice(0, 40).map((spot) => {
          const slug = spot.slug!;
          const on = picked.includes(slug);
          return (
            <li key={slug}>
              <label className="flex items-center gap-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && picked.length >= 3}
                  onChange={() => toggle(slug)}
                />
                {spot.name}
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        disabled={picked.length < 2}
        onClick={() => router.push(compareHref(picked))}
      >
        Compare {picked.length || ""} {picked.length === 1 ? "spot" : "spots"}
      </Button>
    </div>
  );
}
