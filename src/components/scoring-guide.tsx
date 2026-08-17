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
          How sessions are graded
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How sessions are graded</DialogTitle>
          <DialogDescription>
            We grade the best remaining daylight session, not the whole day
            average. Three prime hours beat eight barely-rideable ones.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-2">
          <li>
            <span className="font-medium">Prime</span> — a remaining window
            that is on. Bring that wing.
          </li>
          <li>
            <span className="font-medium">Solid</span> — a remaining window
            that is properly rideable, just not the sweet spot.
          </li>
          <li>
            <span className="font-medium">Light</span> — people will be out
            (often foiling), but it is below this spot&apos;s classic band.
            Not a hard no.
          </li>
          <li>
            <span className="font-medium">No session</span> — nothing
            rideable left in daylight. Storm, offshore, or truly too light.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          If you saved a quiver, each hour is scored against the best wing
          you own. A size you do not own is suggested only — it will not
          flip the grade. Alerts still fire on Solid or Prime windows.
        </p>
      </DialogContent>
    </Dialog>
  );
}
