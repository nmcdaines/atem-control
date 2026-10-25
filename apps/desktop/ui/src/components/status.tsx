import { Badge } from "@/components/ui/badge";
import type { DeviceState } from "@/bindings";

export function Status({
  state,
  simulated,
}: {
  state?: DeviceState;
  simulated: boolean;
}) {
  return (
    <Badge
      className={`status ${state?.status ?? "disconnected"}`}
      variant="outline"
    >
      <i />
      {simulated
        ? "SIMULATED"
        : (state?.status?.toUpperCase() ?? "DISCONNECTED")}
    </Badge>
  );
}
