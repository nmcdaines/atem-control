import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
  // Extra text that matches searches without being shown.
  keywords?: string;
};

// A searchable single-select. An empty value means nothing is selected; pass
// `clearLabel` to offer that as a choice.
export function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
  searchPlaceholder = "Search…",
  disabled,
  className,
}: {
  id?: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const needle = query.trim().toLowerCase();
  const matches = [
    ...(clearLabel && !needle ? [{ value: "", label: clearLabel }] : []),
    ...options.filter((option) =>
      `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`
        .toLowerCase()
        .includes(needle),
    ),
  ];
  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);
  const selected = options.find((option) => option.value === value);
  const choose = (next: string) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };
  const toggle = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(
        Math.max(
          0,
          (clearLabel ? [{ value: "" }, ...options] : options).findIndex(
            (option) => option.value === value,
          ),
        ),
      );
    }
  };
  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) =>
        matches.length ? (index + step + matches.length) % matches.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const match = matches[active];
      if (match) choose(match.value);
    }
  }
  return (
    <Popover.Root open={open} onOpenChange={toggle}>
      <Popover.Trigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown aria-hidden className="opacity-50" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-(--radix-popover-trigger-width) min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <Input
            autoFocus
            role="searchbox"
            aria-label={searchPlaceholder}
            aria-controls={listId}
            aria-activedescendant={
              matches[active] ? `${listId}-${active}` : undefined
            }
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={key}
            className="mb-1 h-8"
          />
          <div id={listId} role="listbox" className="max-h-64 overflow-y-auto">
            {matches.length ? (
              matches.map((option, index) => (
                <div
                  key={option.value || "__clear"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    index === active && "bg-accent text-accent-foreground",
                    !option.value && "text-muted-foreground",
                  )}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option.value)}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      option.value !== value && "invisible",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {"hint" in option && option.hint && (
                    <span className="ml-auto truncate text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No matches
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
