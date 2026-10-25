import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * Height left in the window below an element's top edge, keeping `reserve`
 * pixels for whatever sits under it (e.g. sliders), so a camera view can
 * fill the screen without pushing its controls out of sight.
 */
export function useAvailableHeight(
  ref: RefObject<HTMLElement | null>,
  reserve: number,
  min = 220,
) {
  const [height, setHeight] = useState(600);
  useLayoutEffect(() => {
    const measure = () => {
      const element = ref.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(min, Math.floor(window.innerHeight - top - reserve)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, reserve, min]);
  return height;
}
