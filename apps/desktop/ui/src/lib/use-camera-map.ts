import { useEffect, useState } from "react";
import { api } from "@/api";
import type { CameraState, DeviceState } from "@/bindings";

const LIVE_INTERVAL_MS = 100;

// Loads a camera's stored panorama, reloading when a new scan replaces it.
export function usePanorama(deviceId: string, createdAt?: number) {
  const [image, setImage] = useState<ImageBitmap | null>(null);
  useEffect(() => {
    if (createdAt === undefined) return;
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    void api
      .panorama(deviceId)
      .then((blob) => (blob ? createImageBitmap(blob) : null))
      .then((bitmap) => {
        if (cancelled) bitmap?.close();
        else {
          loaded = bitmap;
          setImage(bitmap);
        }
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
      setImage(null);
      requestAnimationFrame(() => loaded?.close());
    };
  }, [deviceId, createdAt]);
  return createdAt === undefined ? null : image;
}

// While a camera moves ("commanded" feedback), polls its position quickly so
// the map can follow it; otherwise uses the regular snapshot state.
export function useLiveCamera(deviceId: string, state?: DeviceState) {
  const moving = state?.feedback === "commanded";
  const [live, setLive] = useState<CameraState | null>(null);
  useEffect(() => {
    if (!moving) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await api.deviceState(deviceId);
        if (!cancelled) setLive(next.camera);
      } catch {
        // The snapshot poll reports errors; keep the last sample.
      }
      if (!cancelled) timer = setTimeout(tick, LIVE_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLive(null);
    };
  }, [deviceId, moving]);
  return { camera: (moving && live) || state?.camera || null, moving };
}
