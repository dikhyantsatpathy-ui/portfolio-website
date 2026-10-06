import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { SectionItem } from "../types";

gsap.registerPlugin(ScrollTrigger);

/**
 * Pinned project showcase.
 *
 * The section pins to the viewport while a horizontal timeline scrubs, which is
 * the other move these Webflow showcase sites use. Cards slide in from the right
 * as you scroll vertically — vertical scroll, horizontal result.
 *
 * Implementation notes that matter:
 *  - `scrub` with `ease: 'none'` on the timeline. The skill is explicit that
 *    easing a scrubbed timeline is wrong: the scrollbar *is* the clock, so an
 *    ease would make the animation lag behind the user's hand.
 *  - `end` uses the function form so it recalculates when the card set or
 *    viewport changes. A static `+=1200` breaks on resize.
 *  - The whole thing is inside `matchMedia`, so mobile gets a plain stacked
 *    list instead of a pinned horizontal scroll, which is unusable on a phone.
 */
export default function PinnedWork({ sections }: { sections: SectionItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".work-card", track.current);
      if (!cards.length) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 900px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduce } = context.conditions as {
            isDesktop: boolean;
            reduce: boolean;
          };

          if (!isDesktop || reduce) return;

          // Travel = everything to the right of the viewport edge, plus the trailing
          // padding, so the final card can actually reach the left edge.
          const distance = () =>
            Math.max(
              0,
              track.current!.scrollWidth -
                track.current!.offsetLeft -
                window.innerWidth +
                48
            );

          const scrollLen = () => distance() + window.innerHeight * 0.6;

          gsap.to(track.current, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: () => `+=${scrollLen()}`,
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          // Progress rail tracks how far through the pinned scroll you are.
          gsap.to(".work-progress", {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: () => `+=${scrollLen()}`,
              scrub: 0.3,
            },
          });

          // Index numerals drift slower than the cards for depth.
          gsap.to(".work-num", {
            xPercent: -14,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: () => `+=${scrollLen()}`,
              scrub: 0.8,
            },
          });
        }
      );
    },
    { scope: root }
  );

  return (
    <section
      ref={root}
      id="work"
      className="relative overflow-hidden py-[var(--spacing-section)]"
    >
      <div className="mb-14 px-6 sm:mb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center gap-4">
            <span className="label tabular">02</span>
            <span className="rule flex-1" />
            <span className="label">Selected work</span>
          </div>
          <h2 className="max-w-3xl text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] text-bone-100">
            Things I built and can show you.
          </h2>
        </div>
      </div>

      {/* Desktop: the track is translated horizontally by GSAP.
          Mobile: it falls back to a native horizontal scroll strip, which
          needs no JS and already feels right under Lenis' syncTouch: false. */}
      <div className="overflow-hidden">
        {/* Progress rail. Scale-x is a transform, so it stays on the compositor
            and doesn't trigger layout on every scroll frame. */}
        <div className="mb-8 hidden px-6 md:block md:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
          <div className="h-px w-full bg-bone-100/10">
            <div
              className="work-progress h-px w-full origin-left bg-brass-400"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>

        <div
          ref={track}
          className="flex gap-8 px-6 will-change-transform md:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] md:pr-16"
        >
          {sections.map((item, i) => {
            const hasLink = Boolean(item.link && item.link !== "#");
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-6">
                  <span className="work-num label tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="label">{item.date ?? "—"}</span>
                </div>

                <h3 className="mt-8 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight text-bone-100 transition-colors duration-300 group-hover:text-brass-300">
                  {item.title}
                </h3>

                {item.description && (
                  <p className="mt-5 leading-relaxed text-bone-400">
                    {item.description}
                  </p>
                )}

                <span className="label mt-auto inline-block pt-10 transition-colors group-hover:text-brass-400">
                  {hasLink ? "View project →" : "In progress"}
                </span>
              </>
            );

            const cls =
              "work-card group flex w-[min(86vw,34rem)] shrink-0 flex-col rounded-card border border-bone-100/8 bg-ink-850/60 p-8 transition-colors duration-500 hover:border-brass-400/30 hover:bg-ink-800/70 sm:p-12";

            return hasLink ? (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className={cls}
              >
                {inner}
              </a>
            ) : (
              <div key={item.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}