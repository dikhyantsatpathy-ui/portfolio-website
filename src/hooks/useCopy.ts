import { useCallback, useEffect, useRef, useState } from "react";

/** Clipboard copy with a transient `copied` flag (announce it via aria-live). */
export function useCopy(resetMs = 1800) {
  const [copied, setCopied] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea"); // insecure-context fallback
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      clearTimeout(t.current);
      t.current = window.setTimeout(() => setCopied(false), resetMs);
    },
    [resetMs]
  );
  return { copied, copy };
}
