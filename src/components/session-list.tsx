import {
  revokeOtherUserSessions,
  revokeUserSession,
} from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SessionRow {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  current: boolean;
}

function deviceLabel(userAgent?: string | null) {
  if (!userAgent) return "Unknown device";
  if (/iPhone|iPad/i.test(userAgent)) return "iPhone / iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Macintosh/i.test(userAgent)) return "Mac";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Linux/i.test(userAgent)) return "Linux";
  return userAgent.slice(0, 48);
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const others = sessions.filter((s) => !s.current).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sessions last 7 days and refresh when you use the app. Sign out other
          devices if a laptop is missing.
        </p>
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li
              key={s.token}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {deviceLabel(s.userAgent)}
                  {s.current ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      This device
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ipAddress ?? "No IP"} · expires{" "}
                  {s.expiresAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
              </div>
              {!s.current ? (
                <form action={revokeUserSession}>
                  <input type="hidden" name="token" value={s.token} />
                  <Button type="submit" variant="outline" size="sm">
                    Revoke
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {others > 0 ? (
          <form action={revokeOtherUserSessions}>
            <Button type="submit" variant="outline" size="sm">
              Sign out other devices
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
