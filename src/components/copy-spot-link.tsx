"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForecastControls } from "@/components/forecast-controls";

export function CopySpotLink({ slug }: { slug: string }) {
  const { selectedDate } = useForecastControls();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(`/spots/${slug}`, window.location.origin);
    if (selectedDate) url.searchParams.set("day", selectedDate);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      <LinkIcon className="h-4 w-4" />
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
