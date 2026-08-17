import { Badge } from "@/components/ui/badge";
import {
  type SessionVerdict,
  verdictLabel,
} from "@/lib/alerts/evaluator";

const badgeClass: Record<SessionVerdict, string> = {
  prime: "bg-green-600 text-white",
  solid: "bg-emerald-600 text-white",
  light: "bg-amber-500 text-black",
  none: "text-muted-foreground",
};

export function VerdictBadge({
  verdict,
  className = "",
}: {
  verdict: SessionVerdict;
  className?: string;
}) {
  if (verdict === "none") {
    return (
      <Badge variant="outline" className={`text-sm px-3 ${className}`.trim()}>
        {verdictLabel(verdict)}
      </Badge>
    );
  }
  return (
    <Badge className={`${badgeClass[verdict]} text-sm px-3 ${className}`.trim()}>
      {verdictLabel(verdict)}
    </Badge>
  );
}

export const verdictDot: Record<SessionVerdict, string> = {
  prime: "bg-green-600",
  solid: "bg-emerald-500",
  light: "bg-amber-500",
  none: "bg-muted-foreground/40",
};
