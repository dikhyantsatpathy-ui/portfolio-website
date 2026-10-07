import { useEffect } from "react";

/**
 * Publishes the pointer as CSS variables on <html> so any element can react to
 * it with plain CSS — no per-component listeners:
 *   --mx / --my     pointer in px (viewport)
 *   --mxn / --myn   pointer 0..1 (viewport)
 * Does nothing for touch or reduced-motion users.
 *
 * Per-element spotlight (cards, rows): on that element's own pointermove, set
 * --lx/--ly to the pointer position relative to the element, then use
 *   background: radial-gradient(240px circle at var(--lx) var(--ly), rgba(193,18,31,.18), transparent 70%)
 */
export function useCursorVars() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    let raf = 0, x = 0, y = 0;
    const flush = () => {
      raf = 0;
      root.style.setProperty("--mx", `${x}px`);
      root.style.setProperty("--my", `${y}px`);
      root.style.setProperty("--mxn", (x / innerWidth).toFixed(4));
      root.style.setProperty("--myn", (y / innerHeight).toFixed(4));
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => { removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);
}
