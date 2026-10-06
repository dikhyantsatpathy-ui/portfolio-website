import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "../lib/utils";
import { useReducedMotion } from "../lib/hooks";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ==========================================================================
   SplitText — per-line/per-word scroll reveal.
   The Webflow-showcase move: wrap each line in an overflow-hidden box and slide
   the text up from below its own baseline. Scoped with useGSAP so the
   ScrollTriggers are killed on unmount.

   Splits on the client after mount so SSR/first paint still has real text in
   the DOM — important for SEO and for what a screen reader announces.
   ========================================================================== */

export function SplitReveal({
  text,
  className,
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const root = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const lines = gsap.utils.toArray<HTMLElement>(".split-line", root.current);
      if (!lines.length) return;

      gsap.from(lines, {
        yPercent: 108,
        duration: 1,
        ease: "power3.out",
        stagger: 0.075,
        scrollTrigger: {
          trigger: root.current,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    },
    { scope: root }
  );

  return (
    <Tag ref={root as React.RefObject<HTMLHeadingElement>} className={className}>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.1em]">
          <span className="split-line block will-change-transform">{line}</span>
        </span>
      ))}
    </Tag>
  );
}

/* ==========================================================================
   Reveal — scroll-triggered entrance.
   Kept intentionally simple: opacity + a small y offset. Anything more elaborate
   competes with the content for attention.
   ========================================================================== */

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });

  // Under reduced motion the content is rendered already visible with no
  // transition at all. The global CSS `prefers-reduced-motion` override cannot
  // reach this, because Motion drives these values from JavaScript rather than
  // from a CSS transition — so it has to be handled here.
  if (reduced) {
    return (
      <div ref={ref} className={className}>
        <Tag>{children}</Tag>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Tag>{children}</Tag>
    </motion.div>
  );
}

/* ==========================================================================
   MagneticLink — the button that leans toward the cursor.
   Uses a spring on a single transform, so it returns smoothly instead of
   snapping back the instant the pointer leaves.
   ========================================================================== */

export function MagneticLink({
  children,
  href,
  className,
  strength = 0.28,
  external,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
  strength?: number;
  external?: boolean;
  onClick?: () => void;
}) {
  // Holds whichever element actually rendered, so the spring works whether this
  // is an <a> or a <button>. A callback ref sidesteps React 19's invariant ref
  // types, which won't widen HTMLElement to the concrete tag type.
  const ref = useRef<HTMLElement | null>(null);
  const setRef = useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };

    const tick = () => {
      cx += (tx - cx) * 0.15;
      cy += (ty - cy) * 0.15;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength, reduced]);

  const cls = cn(
    "inline-flex items-center justify-center gap-2.5 rounded-tile px-6 py-3.5 font-medium transition-colors duration-300 will-change-transform",
    className
  );

  if (href) {
    return (
      <a
        ref={setRef}
        href={href}
        className={cls}
        {...(external
          ? { target: "_blank", rel: "noreferrer noopener" }
          : {})}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button ref={setRef} className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

/* ==========================================================================
   SectionHeader — the shared rhythm for every section on the page.
   Enforces consistent eyebrow / heading / rule structure so sections read as
   one document instead of a pile of independently-designed blocks.
   ========================================================================== */

export function SectionHeader({
  index,
  eyebrow,
  title,
  lede,
}: {
  index: string;
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="mb-14 sm:mb-20">
      <div className="mb-6 flex items-center gap-4">
        <span className="label tabular">{index}</span>
        <span className="rule flex-1" />
        <span className="label">{eyebrow}</span>
      </div>
      <h2 className="max-w-3xl text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] text-bone-100">
        {title}
      </h2>
      {lede ? (
        <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-bone-400">
          {lede}
        </p>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   CopyButton — copies text and confirms inline. Announces via aria-live so
   screen readers get the confirmation too.
   ========================================================================== */

export function CopyButton({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked by permissions or insecure context. Failing
      // silently is acceptable here — the email is also a real mailto link.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-tile border border-bone-100/12 px-6 py-3.5 font-medium text-bone-200 transition-colors duration-300 hover:border-brass-400/50 hover:text-bone-100",
          className
        )}
      >
        {children}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? `${value} copied to clipboard` : ""}
      </span>
    </>
  );
}