import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Crosshair, MoveHorizontal, MoveVertical, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { clamp, frameFor, targetAt } from "@/lib/ptz";
import type { PtzLimits, PtzPosition } from "@/lib/ptz";

export function PtzPositionControl({
  target,
  observed,
  limits,
  disabled,
  onChange,
}: {
  target: PtzPosition;
  observed?: PtzPosition | null;
  limits: PtzLimits;
  disabled: boolean;
  onChange: (position: PtzPosition) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !size.width || !size.height) return;
    const context = element.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(size.width * ratio);
    element.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = "#111113";
    context.fillRect(0, 0, size.width, size.height);
    context.lineWidth = 1;
    for (let line = 1; line < 8; line++) {
      context.strokeStyle = line === 4 ? "#45454b" : "#242428";
      context.beginPath();
      context.moveTo((size.width * line) / 8, 0);
      context.lineTo((size.width * line) / 8, size.height);
      context.stroke();
      context.beginPath();
      context.moveTo(0, (size.height * line) / 8);
      context.lineTo(size.width, (size.height * line) / 8);
      context.stroke();
    }
    const drawFrame = (
      position: PtzPosition,
      color: string,
      draft: boolean,
    ) => {
      const frame = frameFor(position, limits, size.width, size.height);
      context.strokeStyle = color;
      context.lineWidth = draft ? 2 : 1.5;
      context.setLineDash(draft ? [] : [5, 4]);
      if (draft) {
        context.fillStyle = "#60a5fa18";
        context.fillRect(frame.x, frame.y, frame.width, frame.height);
      }
      context.strokeRect(frame.x, frame.y, frame.width, frame.height);
      context.setLineDash([]);
      const x = frame.x + frame.width / 2,
        y = frame.y + frame.height / 2;
      context.beginPath();
      context.moveTo(x - 5, y);
      context.lineTo(x + 5, y);
      context.moveTo(x, y - 5);
      context.lineTo(x, y + 5);
      context.stroke();
    };
    if (observed) drawFrame(observed, "#6ee7b7", false);
    drawFrame(target, "#93c5fd", true);
    context.fillStyle = "#92929d";
    context.font = "10px ui-monospace, monospace";
    context.fillText("−X", 9, size.height - 10);
    context.fillText("+X", size.width - 24, size.height - 10);
    context.fillText("+Y", 9, 17);
    context.fillText("−Y", 9, size.height - 27);
  }, [target, observed, limits.pan, limits.tilt, limits.zoom, size]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange({
      ...target,
      ...targetAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        limits,
        rect.width,
        rect.height,
      ),
    });
  }
  function key(event: KeyboardEvent<HTMLCanvasElement>) {
    if (
      disabled ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const multiplier = event.shiftKey ? 10 : 1;
    const panStep = Math.max(1, Math.round(limits.pan / 100)) * multiplier;
    const tiltStep = Math.max(1, Math.round(limits.tilt / 100)) * multiplier;
    onChange({
      ...target,
      pan: clamp(
        target.pan +
          (event.key === "ArrowRight"
            ? panStep
            : event.key === "ArrowLeft"
              ? -panStep
              : 0),
        -limits.pan,
        limits.pan,
      ),
      tilt: clamp(
        target.tilt +
          (event.key === "ArrowUp"
            ? tiltStep
            : event.key === "ArrowDown"
              ? -tiltStep
              : 0),
        -limits.tilt,
        limits.tilt,
      ),
    });
  }
  return (
    <section
      aria-label="PTZ target framing"
      className="rounded-xl border bg-background/60 p-4"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium">
          <Crosshair className="size-4 text-muted-foreground" />
          Target frame
        </span>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1.5 text-[10px]">
            <span className="size-1.5 rounded-full bg-blue-300" />
            Target
          </Badge>
          {observed && (
            <Badge variant="outline" className="gap-1.5 text-[10px]">
              <span className="size-1.5 rounded-full bg-emerald-300" />
              Readback
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_2rem] gap-4">
        <div className="relative aspect-video overflow-hidden rounded-lg border">
          <canvas
            ref={canvas}
            role="img"
            aria-label={`PTZ target map: X ${target.pan}, Y ${target.tilt}, zoom ${target.zoom}. Arrow keys adjust position; Shift moves faster.`}
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onKeyDown={key}
            onPointerDown={(event) => {
              if (disabled || event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              point(event);
            }}
            onPointerMove={(event) => {
              if (
                !disabled &&
                event.currentTarget.hasPointerCapture(event.pointerId)
              )
                point(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
            Target X {target.pan}, Y {target.tilt}, zoom {target.zoom}.
          </canvas>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MoveVertical
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <Slider
            aria-label="Target Y (tilt)"
            orientation="vertical"
            className="min-h-0 flex-1 data-[orientation=vertical]:h-auto data-[orientation=vertical]:min-h-0"
            min={-limits.tilt}
            max={limits.tilt}
            step={1}
            value={[target.tilt]}
            disabled={disabled}
            onValueChange={([tilt]) => onChange({ ...target, tilt })}
          />
          <span className="text-[10px] text-muted-foreground">Y</span>
        </div>
      </div>
      <div className="mt-4 mr-12 space-y-5">
        <div className="space-y-3">
          <Label className="flex justify-between text-xs">
            <span className="flex items-center gap-2">
              <MoveHorizontal className="size-3.5" />X · Pan
            </span>
            <output className="font-mono text-muted-foreground">
              {target.pan}
            </output>
          </Label>
          <Slider
            aria-label="Target X (pan)"
            min={-limits.pan}
            max={limits.pan}
            step={1}
            value={[target.pan]}
            disabled={disabled}
            onValueChange={([pan]) => onChange({ ...target, pan })}
          />
        </div>
        <div className="space-y-3">
          <Label className="flex justify-between text-xs">
            <span className="flex items-center gap-2">
              <ZoomIn className="size-3.5" />
              Zoom · Wide → Tele
            </span>
            <output className="font-mono text-muted-foreground">
              {target.zoom}
            </output>
          </Label>
          <Slider
            aria-label="Target zoom"
            min={0}
            max={limits.zoom}
            step={1}
            value={[target.zoom]}
            disabled={disabled}
            onValueChange={([zoom]) => onChange({ ...target, zoom })}
          />
        </div>
      </div>
      <p className="mt-4 mb-1 text-[11px] text-muted-foreground">
        Click or drag to set X/Y, then apply the target below. Frame size shows
        relative zoom; optical field of view is uncalibrated.
      </p>
    </section>
  );
}
