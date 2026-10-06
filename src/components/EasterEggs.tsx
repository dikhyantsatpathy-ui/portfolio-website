import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

/* ==========================================================================
   EasterEggs — the stuff people only find if they poke at it.

   Included, in the order they're likely to be found:
     1. Konami code        -> overdrive: the page goes loud.
     2. Click the gyro     -> fires a shockwave ring + increments a counter
                              that's visible on the model in the footer.
     3. "sabotage" console -> a tiny command palette, because engineers read
                              the console and will find this within seconds.
     4. Type "hire"        -> anything, anywhere.
     5. Alt-click the DS   -> flips the palette to a hidden "blueprint" mode.

   None of these block content, none of them trap focus, and all of them
   degrade to nothing under prefers-reduced-motion.
   ========================================================================== */

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

/** Fires a custom event the machine listens for. */
export const OVERDRIVE_EVENT = "ds:overdrive";
export const SHOCKWAVE_EVENT = "ds:shockwave";
export const PALETTE_EVENT = "ds:palette";

export default function EasterEggs() {
  const [overdrive, setOverdrive] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shockwaves, setShockwaves] = useState<number[]>([]);
  const [booted, setBooted] = useState(false);
  const [consoleInput, setConsoleInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  // Declared before the effects that call it. The machine is the single
  // dispatcher of this event; this only renders the visual.
  const burst = useCallback(() => {
    window.dispatchEvent(new CustomEvent(SHOCKWAVE_EVENT));
  }, []);

  // ---- Konami ---------------------------------------------------------
  useEffect(() => {
    let input: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      input.push(e.key);
      input = input.slice(-KONAMI.length);
      if (input.join(",") === KONAMI.join(",")) {
        setOverdrive((v) => !v);
        // Let the class apply before the flash so the transition is visible.
        requestAnimationFrame(() => {
          document.documentElement.classList.toggle("overdrive", !overdrive);
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overdrive]);

  // Broadcast state so other components (the machine) can react.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(OVERDRIVE_EVENT, { detail: overdrive }));
  }, [overdrive]);

  // ---- "sabotage" in the console --------------------------------------
  useEffect(() => {
    // Type into the real console to find it; opens an in-page palette instead.
    const w = window as unknown as Record<string, unknown>;
    if (w.sabotage) return;

    w.sabotage = (...args: unknown[]) => {
      setPaletteOpen(true);
      if (args.length) {
        // e.g. sabotage("email") prefills the command.
        setConsoleInput(String(args[0] ?? ""));
      }
      console.info(
        "%csabotage()%c — commands: about, work, contact, email, hire, clear",
        "color:#e0b968;font-weight:bold",
        "color:#7a7267"
      );
    };
    Object.defineProperty(w.sabotage, "name", { value: "sabotage" });

    return () => {
      delete w.sabotage;
    };
  }, []);

  useEffect(() => {
    if (paletteOpen) inputRef.current?.focus();
  }, [paletteOpen]);

  // ---- Alt-click the DS monogram -------------------------------------
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest('a[href="#top"]')) return;
      e.preventDefault();
      const on = document.documentElement.classList.toggle("blueprint");
      // The 3D scene has its own materials, so it can't read the CSS class.
      window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: on }));
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  // ---- Typing "hire" anywhere ----------------------------------------
  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      buf = (buf + e.key.toLowerCase()).slice(-8);
      if (buf.endsWith("hire")) {
        setOverdrive(true);
        document.documentElement.classList.add("overdrive");
        burst();
        window.setTimeout(() => setOverdrive(false), 4200);
        window.setTimeout(
          () => document.documentElement.classList.remove("overdrive"),
          4600
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [burst]);

  // ---- Click-to-shockwave -------------------------------------------
  // The machine is the single dispatcher. This only renders the visual, so a
  // click produces exactly one burst instead of cascading.
  useEffect(() => {
    const onBurst = () => {
      const id = nextId.current++;
      setShockwaves((s) => [...s, id]);
      window.setTimeout(
        () => setShockwaves((s) => s.filter((i) => i !== id)),
        1400
      );
    };
    window.addEventListener(SHOCKWAVE_EVENT, onBurst);
    return () => window.removeEventListener(SHOCKWAVE_EVENT, onBurst);
  }, []);

  // ---- Keyboard shortcut to open the palette -------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Backtick, the dev's favourite key.
      if (e.key === "`" && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  const run = (cmd: string) => {
    const target = cmd.trim().toLowerCase();
    setConsoleInput("");
    switch (target) {
      case "about":
        document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "work":
        document.getElementById("work")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "contact":
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "email":
        window.location.href = "mailto:dikhyantsatpathy@gmail.com";
        break;
      case "hire":
        burst();
        setOverdrive(true);
        window.setTimeout(() => setOverdrive(false), 2600);
        break;
      case "clear":
        setPaletteOpen(false);
        break;
    }
  };

  return (
    <>
      {/* Shockwave rings, fired on demand from anywhere. */}
      {shockwaves.map((id) => (
        <span
          key={id}
          aria-hidden
          className="pointer-events-none fixed left-1/2 top-1/2 z-[60] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass-400/60"
          style={{
            animation: "shockwave 1.3s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        />
      ))}

      {/* Command palette. role="dialog" + aria-modal tells assistive tech this is
          a modal context; the label names it (SC 4.1.2). Escape closes it
          (SC 2.1.2) and focus moves in on open. */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-900/80 px-6 pt-[18vh] backdrop-blur-sm"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-md overflow-hidden rounded-card border border-brass-400/25 bg-ink-850 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-bone-100/10 px-5 py-4">
              <span className="font-mono text-xs text-brass-400">sabotage</span>
              <span className="text-xs text-bone-500">
                about · work · contact · email · hire · clear
              </span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(consoleInput);
              }}
            >
              <label htmlFor="sabotage-cmd" className="sr-only">
                Type a command
              </label>
              <input
                id="sabotage-cmd"
                ref={inputRef}
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="type a command, Esc to close"
                className="w-full bg-transparent px-5 py-4 font-mono text-sm text-bone-100 outline-none placeholder:text-bone-600"
                aria-label="Command"
                autoComplete="off"
                spellCheck={false}
              />
            </form>
          </div>
        </div>
      )}

      {/* Boot / hint line. Fades in once, then gets out of the way. */}
      <div
        className={cn(
          "pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 font-mono text-[11px] text-bone-700 transition-opacity duration-1000",
          booted ? "opacity-0" : "opacity-100"
        )}
      >
        try the konami code
      </div>

      <Boot onDone={() => setBooted(true)} />
    </>
  );
}

/** Small delay so the hint reads before disappearing. Never blocks anything. */
function Boot({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return null;
}

export function overdriveOn() {
  document.documentElement.classList.add("overdrive");
}

export function overdriveOff() {
  document.documentElement.classList.remove("overdrive");
}

export function triggerShockwave() {
  window.dispatchEvent(new CustomEvent(SHOCKWAVE_EVENT));
}