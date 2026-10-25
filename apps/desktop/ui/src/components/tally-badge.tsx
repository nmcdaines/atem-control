import { Badge } from "@/components/ui/badge";
import type { Tally } from "@/lib/tally";

export function TallyBadge({ tally }: { tally: Tally }) {
  if (!tally) return null;
  return tally === "program" ? (
    <Badge
      className="border-red-500/60 bg-red-500/15 text-red-300"
      variant="outline"
    >
      ON AIR
    </Badge>
  ) : (
    <Badge
      className="border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
      variant="outline"
    >
      PREVIEW
    </Badge>
  );
}
