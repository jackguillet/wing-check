import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export interface AlertHistoryItem {
  id: number;
  sentAt: Date;
  alertType: string;
  forecastSummary: string;
  spotName: string;
  spotSlug: string | null;
}

export function AlertHistoryList({ items }: { items: AlertHistoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert history</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No GO emails yet. Arm the bell on a spot after verifying email.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="text-sm">
                <p className="font-medium">
                  {item.spotSlug ? (
                    <Link
                      href={`/spots/${item.spotSlug}`}
                      className="underline"
                    >
                      {item.spotName}
                    </Link>
                  ) : (
                    item.spotName
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.sentAt.toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "UTC",
                  })}{" "}
                  UTC · {item.alertType}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {item.forecastSummary}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
