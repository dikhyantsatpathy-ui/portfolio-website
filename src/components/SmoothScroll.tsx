import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scroll, driven by GSAP's ticker.
 *
 * This is the standard pairing from the GSAP docs, and the details matter:
 *  - `lenis.raf(time * 1000)` because the GSAP ticker reports seconds while
 *    Lenis expects milliseconds.
 *  - `lagSmoothing(0)` so a slow frame doesn't get "corrected" by skipping
 *    ahead, which otherwise fights ScrollTrigger and causes jitter.
 *  - `lenis.on('scroll', ScrollTrigger.update)` keeps pinned/scrubbed triggers
 *    in sync with the interpolated scroll position, not the native one.
 *
 * Disabled entirely under `prefers-reduced-motion`: smooth-scrolling is exactly
 * the kind of vestibular trigger that setting exists to suppress, and honouring
 * it means falling back to native scroll rather than a gentler version of it.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      // Native touch scrolling already feels right on mobile; hijacking it
      // fights the OS momentum and is the most common Lenis complaint.
      syncTouch: false,
      touchMultiplier: 1.6,
    });

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    // Anchor links (nav, "see the work") must go through Lenis or the
    // browser jumps natively and the two scroll systems fight each other.
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href?.startsWith("#")) return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -72 });
    };

    document.addEventListener("click", onClick);

    // Content streams in from Firestore after first paint, and the pinned
    // sections measure their own height. Both invalidate the scroll positions
    // ScrollTrigger cached at mount, which shows up as pinned sections that
    // never unpin or scrub. Re-measuring once things settle fixes it.
    const refresh = () => ScrollTrigger.refresh();
    const timers = [
      window.setTimeout(refresh, 400),
      window.setTimeout(refresh, 1200),
    ];

    // Fonts landing late changes section heights, so refresh on load too.
    window.addEventListener("load", refresh);

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", refresh);
      document.removeEventListener("click", onClick);
      lenis.destroy();
      gsap.ticker.remove(raf);
    };
  }, []);

  return null;
}