import { useEffect, useState } from "react";
import { api } from "@/api";

const INTERVAL_MS = 125;

// Polls a camera's NDI preview while enabled. Polling is what keeps the
// receiver connected; it disconnects shortly after polling stops.
export function useNdiPreview(deviceId: string, enabled: boolean) {
  const [frame, setFrame] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // The bitmap on screen may still be redrawn (e.g. on resize) until the
    // next frame renders, so each is closed one frame late.
    let shown: ImageBitmap | null = null;
    let previous: ImageBitmap | null = null;
    const tick = async () => {
      try {
        const blob = await api.ndiPreview(deviceId);
        if (blob && !cancelled) {
          const bitmap = await createImageBitmap(blob);
          if (cancelled) bitmap.close();
          else {
            previous?.close();
            previous = shown;
            shown = bitmap;
            setFrame(bitmap);
          }
        }
        if (!cancelled) setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
      if (!cancelled) timer = setTimeout(tick, INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setFrame(null);
      // Let the cleared state render before releasing the bitmaps.
      requestAnimationFrame(() => {
        previous?.close();
        shown?.close();
      });
    };
  }, [deviceId, enabled]);
  return { frame: enabled ? frame : null, error: enabled ? error : "" };
}
