import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Crosshair, Scan, ShieldCheck, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { adjustZoom, clamp } from "@/lib/ptz";
import {
  clampToLimits,
  frameRect,
  layout,
  mapExtent,
  rangeFromCorners,
  rangeRect,
  withinLimits,
} from "@/lib/ptz-map";
import type { Position } from "@/lib/ptz-map";
import type {
  CameraCalibration,
  CameraState,
  PanoramaInfo,
  PtzRange,
} from "@/bindings";

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 460;
/** Time constant for the current-view box gliding between position samples. */
const GLIDE_MS = 120;

type Point = { x: number; y: number };

/**
 * A calibrated camera map: the panorama, the camera's current view with its
 * live feed, the target view, and the soft-limit region.
 */
export function PtzMap({
  calibration,
  range,
  panorama,
  panoramaImage,
  observed,
  moving,
  target,
  onChange,
  preview,
  limits,
  onSaveLimits,
  zoomLimit,
  disabled,
}: {
  calibration: CameraCalibration;
  range: PtzRange;
  panorama?: PanoramaInfo | null;
  panoramaImage: ImageBitmap | null;
  observed?: CameraState | null;
  moving: boolean;
  target: Position;
  onChange: (target: Position) => void;
  preview?: ImageBitmap | null;
  limits?: PtzRange | null;
  onSaveLimits: (limits: PtzRange | null) => void;
  zoomLimit: number;
  disabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(640);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ from: Point; to: Point } | null>(null);
  const extent = mapExtent(calibration, range, panorama);
  const aspect = (extent.right - extent.left) / (extent.top - extent.bottom);
  const height = Math.round(clamp(width / aspect, MIN_HEIGHT, MAX_HEIGHT));
  const map = layout(extent, width, height);
  const geometry = JSON.stringify([calibration, range, panorama?.created_at]);

  // Inputs the animation loop reads without restarting.
  const latest = useRef({ target, observed, preview, panoramaImage, limits });
  latest.current = { target, observed, preview, panoramaImage, limits };
  const shown = useRef<Position | null>(null);
  const change = (next: Position) => {
    const clamped = clampToLimits(calibration, limits, {
      ...next,
      zoom: Math.round(clamp(next.zoom, 0, zoomLimit)),
    });
    latest.current.target = clamped;
    onChange(clamped);
  };

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element.parentElement!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const { target, observed, preview, panoramaImage, limits } =
        latest.current;
      // Glide the current view towards the latest sample.
      if (observed) {
        const from = shown.current ?? observed;
        const k = 1 - Math.exp(-(now - last) / GLIDE_MS);
        shown.current = {
          pan: from.pan + (observed.pan - from.pan) * k,
          tilt: from.tilt + (observed.tilt - from.tilt) * k,
          zoom: from.zoom + (observed.zoom - from.zoom) * k,
        };
      } else shown.current = null;
      last = now;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#111113";
      context.fillRect(0, 0, width, height);
      const whole = map.rect(extent);
      if (panoramaImage) {
        context.globalAlpha = 0.85;
        context.drawImage(
          panoramaImage,
          whole.x,
          whole.y,
          whole.width,
          whole.height,
        );
        context.globalAlpha = 1;
      } else {
        context.strokeStyle = "#242428";
        context.lineWidth = 1;
        for (let line = 1; line < 8; line++) {
          const x = whole.x + (whole.width * line) / 8;
          const y = whole.y + (whole.height * line) / 8;
          context.beginPath();
          context.moveTo(x, whole.y);
          context.lineTo(x, whole.y + whole.height);
          context.moveTo(whole.x, y);
          context.lineTo(whole.x + whole.width, y);
          context.stroke();
        }
      }
      if (limits) {
        const area = map.rect(rangeRect(calibration, limits));
        context.fillStyle = "rgba(0, 0, 0, 0.55)";
        context.beginPath();
        context.rect(0, 0, width, height);
        context.rect(area.x, area.y, area.width, area.height);
        context.fill("evenodd");
        context.strokeStyle = "#fbbf24";
        context.setLineDash([6, 4]);
        context.lineWidth = 1.5;
        context.strokeRect(area.x, area.y, area.width, area.height);
        context.setLineDash([]);
      }
      if (shown.current) {
        const view = map.rect(frameRect(calibration, shown.current));
        if (preview) {
          try {
            context.drawImage(preview, view.x, view.y, view.width, view.height);
          } catch {
            // A bitmap released between frames is skipped until the next one.
          }
        }
        context.strokeStyle = "#6ee7b7";
        context.lineWidth = 2;
        context.strokeRect(view.x, view.y, view.width, view.height);
      }
      const goal = map.rect(frameRect(calibration, target));
      const allowed = withinLimits(calibration, limits, target);
      context.strokeStyle = allowed ? "#93c5fd" : "#f87171";
      context.fillStyle = allowed ? "#60a5fa18" : "#f8717118";
      context.lineWidth = 2;
      context.setLineDash([5, 4]);
      context.fillRect(goal.x, goal.y, goal.width, goal.height);
      context.strokeRect(goal.x, goal.y, goal.width, goal.height);
      context.setLineDash([]);
      const centre = {
        x: goal.x + goal.width / 2,
        y: goal.y + goal.height / 2,
      };
      context.beginPath();
      context.moveTo(centre.x - 6, centre.y);
      context.lineTo(centre.x + 6, centre.y);
      context.moveTo(centre.x, centre.y - 6);
      context.lineTo(centre.x, centre.y + 6);
      context.stroke();
      if (draft) {
        const a = map.toPx(draft.from.x, draft.from.y);
        const b = map.toPx(draft.to.x, draft.to.y);
        context.strokeStyle = "#fbbf24";
        context.lineWidth = 2;
        context.strokeRect(
          Math.min(a.x, b.x),
          Math.min(a.y, b.y),
          Math.abs(a.x - b.x),
          Math.abs(a.y - b.y),
        );
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // Snapshots arrive as new objects several times a second, so the loop is
    // keyed on content; `map` and `extent` derive from these inputs.
  }, [width, height, geometry, draft]);

  // Wheel zoom, registered non-passively so the page doesn't scroll.
  const live = useRef({ disabled, editing, change, zoomLimit });
  live.current = { disabled, editing, change, zoomLimit };
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      const { disabled, editing, change, zoomLimit } = live.current;
      if (disabled || editing) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      const fraction = -pixels / (event.ctrlKey ? 200 : 1000);
      const current = latest.current.target;
      change({
        ...current,
        zoom: adjustZoom(current.zoom, fraction, zoomLimit),
      });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const at = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return map.toView(event.clientX - rect.left, event.clientY - rect.top);
  };
  const aim = (point: Point) => {
    // Commands take whole camera units.
    const pan = Math.round(point.x * calibration.pan_direction);
    const tilt = Math.round(point.y * calibration.tilt_direction);
    change({ ...latest.current.target, pan, tilt });
  };
  function release(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) pinch.current = null;
  }
  function key(event: KeyboardEvent<HTMLCanvasElement>) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const step = steps[event.key];
    if (disabled || editing || !step) return;
    event.preventDefault();
    const amount =
      ((extent.right - extent.left) / 100) * (event.shiftKey ? 10 : 1);
    const current = latest.current.target;
    change({
      ...current,
      pan: Math.round(
        current.pan + step[0] * amount * calibration.pan_direction,
      ),
      tilt: Math.round(
        current.tilt + step[1] * amount * calibration.tilt_direction,
      ),
    });
  }

  return (
    <section
      aria-label="Camera map"
      className="rounded-xl border bg-background/60 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium">
          <Crosshair className="size-4 text-muted-foreground" />
          Camera map
          {moving && (
            <Badge variant="outline" className="text-[10px]">
              Moving
            </Badge>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-[10px]">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Current
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-[10px]">
            <span className="size-1.5 rounded-full bg-blue-300" />
            Target
          </Badge>
          {editing ? (
            <>
              <Button
                type="button"
                size="xs"
                disabled={!draft}
                onClick={() => {
                  if (draft)
                    onSaveLimits(
                      rangeFromCorners(calibration, draft.from, draft.to),
                    );
                  setDraft(null);
                  setEditing(false);
                }}
              >
                Save limits
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={disabled}
                onClick={() => setEditing(true)}
              >
                <ShieldCheck aria-hidden />
                {limits ? "Edit limits" : "Set limits"}
              </Button>
              {limits && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onSaveLimits(null)}
                >
                  Clear limits
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded-lg border">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Camera map: target pan ${target.pan}, tilt ${target.tilt}, zoom ${target.zoom}${
            observed
              ? `; camera at pan ${observed.pan}, tilt ${observed.tilt}, zoom ${observed.zoom}`
              : ""
          }. ${editing ? "Drag to draw the allowed area." : "Click or drag to aim; scroll or pinch to zoom; arrow keys adjust."}`}
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          style={{ height }}
          className={`block w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${editing ? "cursor-cell" : "cursor-crosshair"}`}
          onKeyDown={key}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = at(event);
            if (editing) {
              setDraft({ from: point, to: point });
              return;
            }
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            if (pointers.current.size === 2)
              pinch.current = {
                distance: spread(),
                zoom: latest.current.target.zoom,
              };
            else if (pointers.current.size === 1) aim(point);
          }}
          onPointerMove={(event) => {
            if (
              disabled ||
              !event.currentTarget.hasPointerCapture(event.pointerId)
            )
              return;
            if (editing) {
              const point = at(event);
              setDraft((d) => d && { ...d, to: point });
              return;
            }
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            if (pinch.current && pointers.current.size === 2) {
              const ratio = spread() / Math.max(1, pinch.current.distance);
              change({
                ...latest.current.target,
                zoom: adjustZoom(
                  pinch.current.zoom,
                  Math.log2(Math.max(ratio, 0.01)) / 2,
                  zoomLimit,
                ),
              });
            } else if (!pinch.current) aim(at(event));
          }}
          onPointerUp={release}
          onPointerCancel={release}
        />
      </div>
      <div className="mt-4 space-y-3">
        <Label className="flex justify-between text-xs">
          <span className="flex items-center gap-2">
            <ZoomIn className="size-3.5" />
            Target zoom · Wide → Tele
          </span>
          <output className="font-mono text-muted-foreground">
            {target.zoom}
          </output>
        </Label>
        <Slider
          aria-label="Target zoom"
          min={0}
          max={zoomLimit}
          step={1}
          value={[target.zoom]}
          disabled={disabled}
          onValueChange={([zoom]) => change({ ...target, zoom })}
        />
      </div>
      <p className="mt-3 mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Scan className="size-3.5" />
        {editing
          ? "Drag across the map to draw the area the camera may show, then save."
          : "Click or drag to aim, scroll or pinch to zoom, then apply the target. The green box follows the camera."}
      </p>
    </section>
  );
}
