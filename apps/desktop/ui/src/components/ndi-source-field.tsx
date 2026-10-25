import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/combobox";
import { api } from "@/api";
import type { NdiSource } from "@/bindings";

export function NdiSourceField({
  value,
  onChange,
  available,
  error,
  address,
  onUseAddress,
  label = "NDI® preview source",
  required,
}: {
  value?: string;
  onChange: (source: string | undefined) => void;
  available: boolean;
  error?: string | null;
  /** The device's control address, offered to sync with the source's IP. */
  address?: string;
  onUseAddress?: (ip: string) => void;
  label?: string;
  /** Hides the "No preview" choice when a source must be chosen. */
  required?: boolean;
}) {
  const [sources, setSources] = useState<NdiSource[]>([]);
  const [searching, setSearching] = useState(false);
  const [failure, setFailure] = useState("");
  const search = async () => {
    setSearching(true);
    setFailure("");
    try {
      setSources(await api.ndiSources());
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };
  useEffect(() => {
    if (available) void search();
  }, [available]);
  // Keep a configured source selectable while it is offline.
  const options = [
    ...(value && !sources.some((s) => s.name === value)
      ? [{ value, label: value, hint: "offline" }]
      : []),
    ...sources.map((source) => ({
      value: source.name,
      label: source.name,
      hint: source.address?.replace(/:\d+$/, ""),
    })),
  ];
  const ip = sources
    .find((source) => source.name === value)
    ?.address?.replace(/:\d+$/, "");
  return (
    <div className="my-3 grid gap-2">
      <Label htmlFor="ndi-source">{label}</Label>
      <div className="flex gap-2">
        <Combobox
          id="ndi-source"
          className="min-w-0 flex-1"
          value={value ?? ""}
          options={options}
          placeholder={
            !available
              ? "NDI runtime not found"
              : required
                ? "Choose a source"
                : "No preview"
          }
          clearLabel={required ? undefined : "No preview"}
          searchPlaceholder="Search NDI sources…"
          disabled={!available}
          onChange={(source) => onChange(source || undefined)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Search for NDI sources"
          disabled={!available || searching}
          onClick={() => void search()}
        >
          <RefreshCw aria-hidden className={searching ? "animate-spin" : ""} />
        </Button>
      </div>
      {ip && onUseAddress && ip !== address && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="justify-self-start"
          onClick={() => onUseAddress(ip)}
        >
          Use {ip} as the control address
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {!available
          ? (error ?? "Install the NDI runtime to show a live preview.")
          : failure ||
            (searching
              ? "Searching the network…"
              : `${sources.length} source${sources.length === 1 ? "" : "s"} found. The preview uses the camera's low-bandwidth stream.`)}
      </p>
    </div>
  );
}
