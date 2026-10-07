import { useEffect, useRef } from "react";
import { createAsciiPortrait, type AsciiPortraitOptions } from "../lib/asciiPortrait";

/**
 * Thin React wrapper. All the logic lives in lib/asciiPortrait.ts so it can be
 * tested without React. The wrapper must sit in a `position: relative` parent
 * (the hero); it fills it and never intercepts pointer events.
 */
export function AsciiPortrait(props: AsciiPortraitOptions & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { className, ...opts } = props;
  // Re-create only when the inputs that change the picture change.
  const key = [opts.src, opts.focusX, opts.heightFit, opts.cellWidth, opts.radius, opts.color, opts.accent].join("|");

  useEffect(() => {
    if (!ref.current) return;
    return createAsciiPortrait(ref.current, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} />;
}
