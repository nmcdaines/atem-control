import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert
      role="note"
      className="my-3 border-amber-500/25 bg-amber-500/5 text-amber-200"
    >
      <AlertDescription className="text-inherit">{children}</AlertDescription>
    </Alert>
  );
}
