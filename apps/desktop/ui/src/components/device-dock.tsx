import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  House,
  Square,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/status";
import { clamp } from "@/lib/ptz";
import { api } from "@/api";
import { kind } from "@/editor";
import type { Command, Device, DeviceState, Snapshot } from "@/bindings";

type Task = (work: () => Promise<unknown>) => Promise<void>;
const storageKey = "device-dock-expanded";

// Moves pan/tilt to 0/0 and then zoom to 0.
export function homeCamera(deviceId: string, panSpeed = 8, tiltSpeed = 8) {
  return api
    .execute(deviceId, {
      type: "pan_tilt",
      pan: 0,
      tilt: 0,
      pan_speed: panSpeed,
      tilt_speed: tiltSpeed,
    })
    .then(() => api.execute(deviceId, { type: "zoom", position: 0 }));
}

function loadExpanded(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function DeviceDock({
  snapshot,
  disabled,
  task,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  task: Task;
}) {
  const [expanded, setExpanded] = useState(loadExpanded);
  const toggle = (id: string) => {
    const next = expanded.includes(id)
      ? expanded.filter((e) => e !== id)
      : [...expanded, id];
    setExpanded(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Remembering panels is a convenience; ignore unavailable storage.
    }
  };
  const dock = useRef<HTMLElement>(null);
  const empty = !snapshot.config.devices.length;
  useEffect(() => {
    const element = dock.current;
    const root = document.documentElement;
    if (!element) return;
    // Lets the page reserve space so its last content can scroll clear of the dock.
    const observer = new ResizeObserver(([entry]) =>
      root.style.setProperty(
        "--dock-height",
        `${entry.borderBoxSize[0].blockSize}px`,
      ),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--dock-height");
    };
  }, [empty]);
  if (empty) return null;
  return (
    <aside
      ref={dock}
      aria-label="Device dock"
      className="fixed right-4 bottom-4 z-40 flex max-h-[calc(100vh-2rem)] w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto"
    >
      {snapshot.config.devices.map((device) => {
        const state = snapshot.devices.find((s) => s.device_id === device.id);
        const open = expanded.includes(device.id);
        const body = `dock-${device.id}`;
        return (
          <section
            key={device.id}
            className="rounded-xl border bg-card/95 text-card-foreground shadow-lg backdrop-blur"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={open}
              aria-controls={body}
              onClick={() => toggle(device.id)}
            >
              <span className="truncate">{device.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Status
                  state={state}
                  simulated={device.connection.type === "simulation"}
                />
                {open ? (
                  <ChevronDown aria-hidden className="size-4" />
                ) : (
                  <ChevronUp aria-hidden className="size-4" />
                )}
              </span>
            </button>
            {open && (
              <div id={body} className="border-t px-3 pt-2 pb-3">
                {kind(device) === "atem" ? (
                  <SwitcherDock
                    device={device}
                    state={state}
                    disabled={disabled}
                    task={task}
                  />
                ) : (
                  <CameraDock
                    device={device}
                    state={state}
                    disabled={disabled}
                    task={task}
                  />
                )}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}

function SwitcherDock({
  device,
  state,
  disabled,
  task,
}: {
  device: Device;
  state?: DeviceState;
  disabled: boolean;
  task: Task;
}) {
  const switcher = state?.switcher;
  if (!switcher)
    return <p className="text-xs text-muted-foreground">No switcher state.</p>;
  const execute = (command: Command) =>
    void task(() => api.execute(device.id, command));
  const bus = (label: string, type: "set_program" | "set_preview") => (
    <div role="group" aria-label={`${device.name} ${label}`}>
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1">
        {switcher.inputs.map((input) => {
          const live =
            (type === "set_program" ? switcher.program : switcher.preview) ===
            input.id;
          return (
            <Button
              key={input.id}
              size="xs"
              disabled={disabled}
              title={input.long_name}
              aria-pressed={live}
              variant={
                live
                  ? type === "set_program"
                    ? "program"
                    : "preview"
                  : "outline"
              }
              onClick={() => execute({ type, input: input.id })}
            >
              {input.short_name || input.id}
            </Button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      {bus("Program", "set_program")}
      {bus("Preview", "set_preview")}
      <div className="grid grid-cols-2 gap-1 pt-1">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => execute({ type: "cut" })}
        >
          CUT
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => execute({ type: "auto" })}
        >
          AUTO
        </Button>
      </div>
    </div>
  );
}

function CameraDock({
  device,
  state,
  disabled,
  task,
}: {
  device: Device;
  state?: DeviceState;
  disabled: boolean;
  task: Task;
}) {
  const current = state?.camera;
  const limits =
    device.connection.type === "visca"
      ? {
          pan: device.connection.pan_limit,
          tilt: device.connection.tilt_limit,
          zoom: device.connection.zoom_limit,
        }
      : { pan: 32767, tilt: 32767, zoom: 16384 };
  const execute = (command: Command) =>
    void task(() => api.execute(device.id, command));
  // Nudges are relative to the last observed position.
  const nudge = (pan: number, tilt: number) =>
    current &&
    execute({
      type: "pan_tilt",
      pan: clamp(
        current.pan + Math.round((pan * limits.pan) / 20),
        -limits.pan,
        limits.pan,
      ),
      tilt: clamp(
        current.tilt + Math.round((tilt * limits.tilt) / 20),
        -limits.tilt,
        limits.tilt,
      ),
      pan_speed: 8,
      tilt_speed: 8,
    });
  const zoom = (direction: number) =>
    current &&
    execute({
      type: "zoom",
      position: clamp(
        current.zoom + Math.round((direction * limits.zoom) / 10),
        0,
        limits.zoom,
      ),
    });
  const moving = disabled || !current;
  const pad = (
    label: string,
    Icon: typeof ArrowUp,
    onClick: () => void,
    className?: string,
    blocked = moving,
  ) => (
    <Button
      size="icon-sm"
      variant="outline"
      aria-label={`${device.name} ${label}`}
      title={label}
      disabled={blocked}
      className={className}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </Button>
  );
  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] text-muted-foreground">
        {current
          ? `P ${current.pan} · T ${current.tilt} · Z ${current.zoom}`
          : "Position unknown — read it on the Cameras page"}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-1">
          {pad("Tilt up", ArrowUp, () => nudge(0, 1), "col-start-2")}
          {pad("Pan left", ArrowLeft, () => nudge(-1, 0), "col-start-1")}
          {pad(
            "Home",
            House,
            () => void task(() => homeCamera(device.id)),
            undefined,
            disabled,
          )}
          {pad("Pan right", ArrowRight, () => nudge(1, 0))}
          {pad("Tilt down", ArrowDown, () => nudge(0, -1), "col-start-2")}
        </div>
        <div className="flex flex-col gap-1">
          {pad("Zoom in", ZoomIn, () => zoom(1))}
          {pad("Zoom out", ZoomOut, () => zoom(-1))}
        </div>
        <Button
          size="sm"
          variant="destructive"
          aria-label={`${device.name} stop`}
          className="self-stretch"
          onClick={() => execute({ type: "stop" })}
        >
          <Square aria-hidden />
          STOP
        </Button>
      </div>
    </div>
  );
}
