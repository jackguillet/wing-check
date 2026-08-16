"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpotAlertToggleProps {
  enabled: boolean;
  masterEnabled: boolean;
  alertEmail: string | null;
  lastAlertLabel: string | null;
  toggleAction: (formData: FormData) => void | Promise<void>;
}

export function SpotAlertToggle({
  enabled,
  masterEnabled,
  alertEmail,
  lastAlertLabel,
  toggleAction,
}: SpotAlertToggleProps) {
  const canArm = masterEnabled && !!alertEmail;

  if (!canArm) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href="/settings"
            aria-label="Turn on email alerts in Settings"
            title="Turn on email alerts in Settings first"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground max-w-[12rem] text-right">
          Turn on email alerts in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          first
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={toggleAction}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={enabled ? "Disable alerts for this spot" : "Enable alerts for this spot"}
          aria-pressed={enabled}
          title={enabled ? "Disable alerts" : "Enable alerts"}
        >
          <Bell
            className={cn(
              "h-5 w-5",
              enabled
                ? "fill-blue-500 text-blue-500"
                : "text-muted-foreground",
            )}
          />
        </Button>
      </form>
      {enabled ? (
        <p className="text-xs text-muted-foreground max-w-[14rem] text-right">
          {lastAlertLabel
            ? `Last alert: ${lastAlertLabel}`
            : `Email when this spot has a GO window (${alertEmail})`}
        </p>
      ) : null}
    </div>
  );
}
