import { useEffect, useRef } from "react";

/**
 * Magnetic pull: the element drifts up to `strength` px toward the pointer when
 * the pointer is within `range` px of its centre. Mouse + motion-OK only.
 *   const ref = useMagnetic<HTMLAnchorElement>();  <a ref={ref}>…
 */
export function useMagnetic<T extends HTMLElement>(strength = 8, range = 90) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      const k = d < range + Math.max(r.width, r.height) / 2 ? strength / (range * 0.5) : 0;
      tx = k ? Math.max(-strength, Math.min(strength, dx * k * 0.4)) : 0;
      ty = k ? Math.max(-strength, Math.min(strength, dy * k * 0.4)) : 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [strength, range]);

  return ref;
}
