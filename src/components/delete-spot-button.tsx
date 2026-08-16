"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteSpotButtonProps {
  spotName: string;
  deleteAction: () => Promise<void>;
}

export function DeleteSpotButton({
  spotName,
  deleteAction,
}: DeleteSpotButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete Spot
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {spotName}?</DialogTitle>
            <DialogDescription>
              This permanently removes the spot and its alert criteria. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={deleteAction}>
              <Button variant="destructive" type="submit">
                Delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
