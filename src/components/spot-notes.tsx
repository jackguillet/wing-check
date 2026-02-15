"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpotNotes({
  spotId,
  notes,
  isOwner,
  updateAction,
}: {
  spotId: number;
  notes: string | null;
  isOwner: boolean;
  updateAction: (spotId: number, notes: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [isPending, startTransition] = useTransition();

  if (!isOwner && !notes) return null;

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Local knowledge, tips, restrictions..."
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await updateAction(spotId, value);
                setEditing(false);
              });
            }}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setValue(notes ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="text-sm text-muted-foreground flex-1">
        {notes ? (
          <p>{notes}</p>
        ) : (
          <button
            className="text-muted-foreground/60 hover:text-muted-foreground italic"
            onClick={() => setEditing(true)}
          >
            Add notes...
          </button>
        )}
      </div>
      {isOwner && notes && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
