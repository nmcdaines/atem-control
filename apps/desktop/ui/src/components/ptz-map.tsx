import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Crosshair, Scan, ShieldCheck, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { adjustZoom, clamp } from "@/lib/ptz";
import { useAvailableHeight } from "@/lib/use-available-height";
import {
  clampToLimits,
  frameRect,
  fromView,
  layout,
  limitsBounds,
  mapExtent,
  padRect,
  previewCells,
  rangeFromCorners,
  rangeRect,
  toView,
  withinLimits,
} from "@/lib/ptz-map";
import type { Limits, Position } from "@/lib/ptz-map";
import type {
  CameraCalibration,
  CameraState,
  PanoramaInfo,
  PtzRange,
} from "@/bindings";

const MIN_HEIGHT = 200;
/** Room kept under the map for the zoom slider and hint. */
const BELOW_MAP = 120;
/** Space shown around the safe area, as a fraction of its size. */
const SAFE_AREA_MARGIN = 0.08;
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
  onGo,
}: {
  /** Moves the camera to the target (pan, tilt and zoom). */
  onGo?: () => void;
  calibration: CameraCalibration;
  range: PtzRange;
  panorama?: PanoramaInfo | null;
  panoramaImage: ImageBitmap | null;
  observed?: CameraState | null;
  moving: boolean;
  target: Position;
  onChange: (target: Position) => void;
  preview?: ImageBitmap | null;
  limits: Limits;
  /** Saves a rectangle or a polygon; both null clears the limits. */
  onSaveLimits: (limits: Limits) => void;
  zoomLimit: number;
  disabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(640);
  const [editing, setEditing] = useState<"rect" | "polygon" | null>(null);
  const [draft, setDraft] = useState<{ from: Point; to: Point } | null>(null);
  const [outline, setOutline] = useState<Point[]>([]);
  const hasLimits = !!(limits.rect || limits.polygon?.length);
  const stopEditing = () => {
    setDraft(null);
    setOutline([]);
    setEditing(null);
  };
  // `extent` is the whole room; `view` is what the map shows. With soft
  // limits the map frames the safe area, so the shot isn't tiny; while
  // editing limits it shows the whole room so you can draw anywhere.
  const extent = mapExtent(calibration, range, panorama);
  const [wholeRoom, setWholeRoom] = useState(false);
  const bounds = limitsBounds(calibration, limits);
  const view =
    bounds && !wholeRoom && !editing
      ? padRect(bounds, SAFE_AREA_MARGIN, extent)
      : extent;
  const aspect = (view.right - view.left) / (view.top - view.bottom);
  // Fill the window's height where the map's proportions allow.
  const frame = useRef<HTMLDivElement>(null);
  const maxHeight = useAvailableHeight(frame, BELOW_MAP, MIN_HEIGHT);
  const height = Math.round(clamp(width / aspect, MIN_HEIGHT, maxHeight));
  const map = layout(view, width, height);
  const geometry = JSON.stringify([
    calibration,
    range,
    panorama?.created_at,
    view,
  ]);

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
      // Shade everything outside the allowed area.
      const allowedArea = new Path2D();
      if (limits.polygon?.length) {
        limits.polygon.forEach((p, i) => {
          const v = toView(calibration, p.pan, p.tilt);
          const px = map.toPx(v.x, v.y);
          if (i) allowedArea.lineTo(px.x, px.y);
          else allowedArea.moveTo(px.x, px.y);
        });
        allowedArea.closePath();
      } else if (limits.rect) {
        const area = map.rect(rangeRect(calibration, limits.rect));
        allowedArea.rect(area.x, area.y, area.width, area.height);
      }
      if (limits.polygon?.length || limits.rect) {
        const shade = new Path2D();
        shade.rect(0, 0, width, height);
        shade.addPath(allowedArea);
        context.fillStyle = "rgba(0, 0, 0, 0.55)";
        context.fill(shade, "evenodd");
        context.strokeStyle = "#fbbf24";
        context.setLineDash([6, 4]);
        context.lineWidth = 1.5;
        context.stroke(allowedArea);
        context.setLineDash([]);
      }
      if (shown.current) {
        const view = map.rect(frameRect(calibration, shown.current));
        if (preview) {
          try {
            // Drawn in cells placed by angle so it lines up with the
            // panorama; cells overlap slightly to hide sub-pixel seams.
            for (const cell of previewCells(
              calibration,
              shown.current,
              preview.width,
              preview.height,
            )) {
              const at = map.rect(cell.rect);
              context.drawImage(
                preview,
                cell.sx,
                cell.sy,
                cell.sw,
                cell.sh,
                at.x - 0.25,
                at.y - 0.25,
                at.width + 0.5,
                at.height + 0.5,
              );
            }
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
      if (outline.length) {
        context.strokeStyle = "#fbbf24";
        context.fillStyle = "#fbbf24";
        context.lineWidth = 2;
        context.beginPath();
        outline.forEach((point, i) => {
          const px = map.toPx(point.x, point.y);
          if (i) context.lineTo(px.x, px.y);
          else context.moveTo(px.x, px.y);
        });
        context.stroke();
        if (outline.length >= 3) {
          // The closing edge that saving will add.
          const [first, last] = [outline[0], outline[outline.length - 1]];
          const a = map.toPx(last.x, last.y);
          const b = map.toPx(first.x, first.y);
          context.setLineDash([4, 4]);
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
          context.setLineDash([]);
        }
        for (const point of outline) {
          const px = map.toPx(point.x, point.y);
          context.fillRect(px.x - 3, px.y - 3, 6, 6);
        }
      }
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
  }, [width, height, geometry, draft, outline]);

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
    const amount = ((view.right - view.left) / 100) * (event.shiftKey ? 10 : 1);
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
              <div
                role="group"
                aria-label="Limit shape"
                className="flex rounded-md border"
              >
                {(["rect", "polygon"] as const).map((shape) => (
                  <Button
                    key={shape}
                    type="button"
                    size="xs"
                    variant={editing === shape ? "secondary" : "ghost"}
                    aria-pressed={editing === shape}
                    onClick={() => {
                      setDraft(null);
                      setOutline([]);
                      setEditing(shape);
                    }}
                  >
                    {shape === "rect" ? "Rectangle" : "Polygon"}
                  </Button>
                ))}
              </div>
              {editing === "polygon" && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!outline.length}
                  onClick={() => setOutline(outline.slice(0, -1))}
                >
                  Undo point
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                disabled={editing === "rect" ? !draft : outline.length < 3}
                onClick={() => {
                  if (editing === "rect" && draft)
                    onSaveLimits({
                      rect: rangeFromCorners(calibration, draft.from, draft.to),
                      polygon: null,
                    });
                  if (editing === "polygon")
                    onSaveLimits({
                      rect: null,
                      polygon: outline.map((point) => {
                        const raw = fromView(calibration, point.x, point.y);
                        return {
                          pan: Math.round(raw.pan),
                          tilt: Math.round(raw.tilt),
                        };
                      }),
                    });
                  stopEditing();
                }}
              >
                Save limits
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={stopEditing}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {hasLimits && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-pressed={wholeRoom}
                  onClick={() => setWholeRoom(!wholeRoom)}
                >
                  {wholeRoom ? "Show safe area" : "Show whole room"}
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  setEditing(limits.polygon?.length ? "polygon" : "rect")
                }
              >
                <ShieldCheck aria-hidden />
                {hasLimits ? "Edit limits" : "Set limits"}
              </Button>
              {hasLimits && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onSaveLimits({ rect: null, polygon: null })}
                >
                  Clear limits
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div
        ref={frame}
        className="relative w-full overflow-hidden rounded-lg border"
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Camera map: target pan ${target.pan}, tilt ${target.tilt}, zoom ${target.zoom}${
            observed
              ? `; camera at pan ${observed.pan}, tilt ${observed.tilt}, zoom ${observed.zoom}`
              : ""
          }. ${editing === "polygon" ? "Click to add corners of the allowed area." : editing ? "Drag to draw the allowed area." : "Click or drag to aim; scroll or pinch to zoom; arrow keys adjust."}`}
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
            if (editing === "polygon") {
              if (outline.length < 64) setOutline([...outline, point]);
              return;
            }
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
          onDoubleClick={() => {
            // The first click already aimed there.
            if (!disabled && !editing) onGo?.();
          }}
          onPointerMove={(event) => {
            if (
              disabled ||
              !event.currentTarget.hasPointerCapture(event.pointerId)
            )
              return;
            if (editing === "rect") {
              const point = at(event);
              setDraft((d) => d && { ...d, to: point });
              return;
            }
            if (editing) return;
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
        <div className="flex items-center gap-4">
          <Slider
            aria-label="Target zoom"
            className="flex-1"
            min={0}
            max={zoomLimit}
            step={1}
            value={[target.zoom]}
            disabled={disabled}
            onValueChange={([zoom]) => change({ ...target, zoom })}
          />
          {onGo && (
            <Button
              type="button"
              disabled={disabled || !!editing}
              onClick={onGo}
            >
              Go
            </Button>
          )}
        </div>
      </div>
      <p className="mt-3 mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Scan className="size-3.5" />
        {editing === "polygon"
          ? "Click around the area the camera may show, one corner at a time, then save."
          : editing
            ? "Drag across the map to draw the area the camera may show, then save."
            : "Click or drag to aim, scroll or pinch to zoom, then Go (or double-click to aim and go). The green box follows the camera."}
      </p>
    </section>
  );
}
