"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ScoringGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HelpCircle className="h-4 w-4" />
          How scoring works
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How the 0–100 score works</DialogTitle>
          <DialogDescription>
            Each daylight hour is scored against your kit. If you saved a
            quiver, wind is scored against the best wing you own — a light
            day can still be GO. If a size you do not own would make the
            day GO, we say so. Consecutive hours at 50+ become a rideable
            window. The day badge is the best remaining window.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-2">
          <li>
            <span className="font-medium">Wind 0–40</span> — hard gate
            outside your min/max (or outside every wing in your quiver);
            peaks at the midpoint of the matching wing.
          </li>
          <li>
            <span className="font-medium">Gusts 0–25</span> — hard gate only
            above 50 kt; steadier wind scores higher.
          </li>
          <li>
            <span className="font-medium">Direction 0–25</span> — closer to
            your preferred dirs scores higher. If you set dirs, outside
            tolerance is a hard zero (cannot GO).
          </li>
          <li>
            <span className="font-medium">Waves 0–10</span> — over your max
            (or missing data) scores 0 of 10. Not a hard zero.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Heavy rain, violent showers, and fog take up to 10 points off.
          Tide, swell quality, and wave amplification are shown for
          planning and are not in the grade. GO is a remaining window
          averaging 70+. MARGINAL is a remaining window below that. NO-GO
          means nothing rideable is left today.
        </p>
      </DialogContent>
    </Dialog>
  );
}
