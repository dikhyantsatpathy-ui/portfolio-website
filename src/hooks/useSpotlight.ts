import { useCallback } from "react";

/**
 * Per-element cursor spotlight. Spread the result on any card/row:
 *   const spot = useSpotlight();  <li className="spot" {...spot}>
 * It writes --lx/--ly (pointer relative to the element); the `.spot` CSS class
 * in index.css paints the radial highlight. Mouse only — touch/pen are ignored.
 */
export function useSpotlight() {
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${e.clientX - r.left}px`);
    el.style.setProperty("--ly", `${e.clientY - r.top}px`);
    el.dataset.lit = "1";
  }, []);
  const onPointerLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    delete e.currentTarget.dataset.lit;
  }, []);
  return { onPointerMove, onPointerLeave };
}
