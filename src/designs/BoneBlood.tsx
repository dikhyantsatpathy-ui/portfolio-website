/**
 * Direction 06 — Bone / Blood, built out properly.
 *
 * Near-black, bone type, one crimson. The name is set so large it bleeds off
 * the right edge; the ASCII figure sits behind and to the right; motion is
 * scrubbed against scroll rather than fired on a timer.
 *
 * THE MOTION SYSTEM
 *
 * Everything moves on scroll, not on its own clock. That is a deliberate choice
 * over the usual fade-and-slide on every section: the reader is in control, so
 * nothing fights them, and a scrubbed animation can be reversed or parked by
 * simply not scrolling. The only free-running motion is the figure, and even
 * that is driven by scroll position.
 *
 * Reveals use a clip + translate on a wrapper, so text slides out from behind a
 * hard edge rather than fading in place. Line-level, staggered — not per word,
 * which at this type size turns into a typewriter effect nobody asked for.
 */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { AsciiFigure } from "../lib/AsciiFigure";
import { Contact, Interests, Footer } from "./Sections";
import PinnedWork from "../components/PinnedWork";
import type { Profile, SectionItem } from "../types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Props = {
  profile: Profile;
  projects: SectionItem[];
  live: boolean;
  zaps: number;
};

/* ------------------------------------------------------------------ *
 * Reveal primitives
 * ------------------------------------------------------------------ */

/**
 * A line that slides up from behind its own baseline.
 *
 * The wrapper is what clips; the inner span is what moves. Without the
 * `overflow: hidden` wrapper the text is simply visible while translated, which
 * looks like a glitch rather than a reveal.
 */
function Line({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <span className="block overflow-hidden pb-[0.12em]">
      <span className="bb-line block will-change-transform" data-delay={delay}>
        {children}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

export default function BoneBlood({ profile, projects, live, zaps }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const figWrap = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);

  const work = (projects ?? []).filter(Boolean);
  const stack = profile.skills ?? [];

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* ---- load sequence: one orchestrated moment, not a cascade ---- */
      if (!reduced) {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero-line]", {
          yPercent: 118,
          duration: 1.15,
          stagger: 0.075,
        })
          .from("[data-hero-fade]", { opacity: 0, y: 22, duration: 0.9, stagger: 0.06 }, "-=0.75")
          // The figure resolves upward out of the dark rather than appearing.
          .from("[data-figure]", { opacity: 0, yPercent: 14, duration: 1.6, ease: "power2.out" }, "-=1.1");
      }

      /* ---- hero: the name drifts and the figure recedes as you leave ---- */
      if (nameRef.current) {
        gsap.to(nameRef.current, {
          xPercent: -6,
          yPercent: 22,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      if (figWrap.current) {
        gsap.to(figWrap.current, {
          yPercent: -18,
          scale: 1.14,
          opacity: 0.25,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.9,
          },
        });
      }

      /* ---- scroll-in reveals ----
         `fromTo` with explicit `toggleActions`, NOT `from()` + `once: true`.
         `from()` records the start values from the current DOM, which then
         goes stale the moment `ScrollTrigger.refresh()` re-measures after
         content lands — leaving some elements stranded at opacity 0 forever.
         `fromTo` states both ends, so a refresh cannot corrupt it. */
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          const lines = el.querySelectorAll("[data-delay]");
          if (lines.length) {
            gsap.fromTo(
              lines,
              { yPercent: 115 },
              {
                yPercent: 0,
                duration: 1,
                stagger: 0.07,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 88%",
                  toggleActions: "play none none none",
                },
              }
            );
          } else {
            gsap.fromTo(
              el,
              { opacity: 0, y: 26 },
              {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 90%",
                  toggleActions: "play none none none",
                },
              }
            );
          }
        });

        /* ---- work rows: the rule draws itself, the cells slide up ---- */
        gsap.utils.toArray<HTMLElement>("[data-work-row]").forEach((row) => {
          const rule = row.querySelector("[data-rule]");
          if (rule) {
            gsap.fromTo(
              rule,
              { scaleX: 0 },
              {
                scaleX: 1,
                transformOrigin: "left center",
                duration: 1.15,
                ease: "power2.inOut",
                scrollTrigger: {
                  trigger: row,
                  start: "top 92%",
                  toggleActions: "play none none none",
                },
              }
            );
          }
          gsap.fromTo(
            row.querySelectorAll("[data-work-cell]"),
            { opacity: 0, y: 30 },
            {
              opacity: 1,
              y: 0,
              duration: 0.85,
              stagger: 0.08,
              ease: "power3.out",
              scrollTrigger: {
                trigger: row,
                start: "top 92%",
                toggleActions: "play none none none",
              },
            }
          );
        });

        /* ---- a slow horizontal drift on the stack rail ---- */
        gsap.to("[data-drift]", {
          xPercent: -18,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-drift]",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.2,
          },
        });
      }
    },
    { scope: root }
  );

  // Web fonts and content both change metrics after first paint.
  useLayoutEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => window.clearTimeout(id);
  }, []);

  const bio = profile.bio ?? "";

  return (
    <div
      ref={root}
      className="relative w-full overflow-x-clip bg-[#0a0a0b] text-[#efece4]"
      style={{ fontFamily: '"Fraunces", ui-serif, Georgia, serif' }}
    >
      {/* Crimson bloom, anchored top-right so it sits behind the figure. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[130vh]"
        style={{
          background:
            "radial-gradient(ellipse 52% 46% at 76% 22%, rgba(193,18,31,0.20), transparent 66%)",
        }}
      />

      {/* ---------- NAV ----------
          The three items and the CTA sit on one baseline. Centring the links
          absolutely was the earlier approach and it drifted out of alignment the
          moment the wordmark or the CTA changed width. */}
      <nav className="relative z-20 flex items-center justify-between gap-6 px-[clamp(1.25rem,4vw,5rem)] pt-[clamp(1.25rem,3vh,2.25rem)]">
        <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-[#8b877d]">
          Portfolio — 2026
        </span>

        <ul className="flex items-center gap-[clamp(1.1rem,2.2vw,2.75rem)] font-mono text-[11px] uppercase tracking-[0.2em]">
          {[
            ["Work", "#work"],
            ["About", "#about"],
            ["Stack", "#stack"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
            <li key={href}>
              <a
                href={href}
                className="group relative block py-3 text-[#8b877d] transition-colors duration-300 hover:text-[#efece4]"
              >
                {label}
                {/* A rule that grows from the left. transform-origin matters:
                   scaling a centred rule grows both ways and reads as a blur. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1.5 h-px origin-left scale-x-0 bg-[#c1121f] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                />
              </a>
            </li>
          ))}
        </ul>

        <a
          href={`mailto:${profile.email}`}
          className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-[#efece4] transition-colors hover:text-[#c1121f]"
        >
          Get in touch
        </a>
      </nav>

      {/* ---------- HERO ---------- */}
      <header className="relative z-10 px-[clamp(1.25rem,4vw,5rem)]">
        <h1
          ref={nameRef}
          className="will-change-transform text-[clamp(2.6rem,11.6vw,14rem)] font-light leading-[0.8] tracking-[-0.055em]"
        >
          <span className="block overflow-hidden pb-[0.06em]">
            <span data-hero-line className="block">
              DIKHYANT
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.06em]">
            <span data-hero-line className="block text-[#c1121f]">
              SATAPATHY
            </span>
          </span>
        </h1>

        {/* items-center, not items-end: at this figure size, bottom-aligning
            pushed the bio column below the fold entirely. */}
        <div className="mt-[clamp(0.5rem,1.5vh,1.5rem)] grid items-center gap-[clamp(1.5rem,3vw,4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="max-w-[46ch]" data-hero-fade>
            <p className="mb-[clamp(1rem,2.5vh,1.75rem)] font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]">
              {profile.subtitle || "Software Engineer"}
            </p>
            <p className="text-[clamp(1rem,1.45vw,1.55rem)] leading-relaxed text-[#b6b2a8]">
              {bio.split(/(?<=\.)\s/)[0] ?? bio}
            </p>
            <a
              href="#work"
              data-hero-fade
              className="group mt-[clamp(1.5rem,3vh,2.5rem)] inline-flex items-center gap-3 border-b-2 border-[#c1121f] pb-1.5 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors hover:text-[#c1121f]"
            >
              See the work
              <span
                aria-hidden
                className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5"
              >
                →
              </span>
            </a>
          </div>

          <div
            ref={figWrap}
            data-figure
            className="hidden will-change-transform lg:flex lg:justify-end lg:self-end"
            style={{
              color: "#efece4",
              textShadow: "0 0 12px rgba(239,236,228,0.5)",
            }}
          >
            {/* The grid is 112x64, so rendered width is about
                fontSize * 112 * 0.6. At 15px that is ~1000px — the figure
                bleeds slightly past the column, which is the intent. */}
            <AsciiFigure drive="scroll" fontSize="clamp(4px,0.62vw,12px)" />
          </div>
        </div>

        <p
          data-hero-fade
          className="mt-[clamp(2rem,6vh,5rem)] pb-[clamp(1rem,3vh,2rem)] font-mono text-[10px] uppercase tracking-[0.28em] text-[#56534d]"
        >
          Scroll ↓
        </p>
      </header>

      {/* ---------- WORK ---------- */}
      <section id="work" className="relative z-10 px-[clamp(1.25rem,4vw,5rem)] pt-[clamp(4rem,14vh,11rem)]">
        <div data-reveal className="mb-[clamp(2rem,6vh,5rem)] flex items-baseline gap-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]">
            Selected work
          </h2>
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#56534d]">
            {String(work.length).padStart(2, "0")} projects
          </span>
        </div>

        <ul>
          {(work.length ? work : FALLBACK_WORK).map((w, i) => (
            <li key={w.id ?? i} data-work-row className="group">
              <div
                data-rule
                className="h-px w-full origin-left bg-[#efece4]/14"
              />
              <a
                href={w.link || "#contact"}
                target={w.link ? "_blank" : undefined}
                rel={w.link ? "noreferrer noopener" : undefined}
                className="grid items-baseline gap-x-6 gap-y-3 py-[clamp(1.5rem,4vh,3.25rem)] transition-colors duration-500 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,22rem)_2rem]"
              >
                <span
                  data-work-cell
                  className="font-mono text-[11px] tracking-[0.2em] text-[#56534d] transition-colors duration-500 group-hover:text-[#c1121f]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  data-work-cell
                  className="text-[clamp(1.6rem,4.6vw,4rem)] font-light leading-[0.95] tracking-[-0.035em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[0.35em] group-hover:text-[#c1121f]"
                >
                  {w.title}
                </h3>
                <p
                  data-work-cell
                  className="text-[clamp(0.85rem,1vw,1.05rem)] leading-relaxed text-[#8b877d]"
                >
                  {w.description}
                </p>
                <span
                  data-work-cell
                  aria-hidden
                  className="hidden text-[#56534d] transition-all duration-500 group-hover:translate-x-1 group-hover:text-[#c1121f] md:block"
                >
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div data-rule className="h-px w-full bg-[#efece4]/14" />
      </section>

      {/* ---------- ABOUT ---------- */}
      <section
        id="about"
        className="relative z-10 px-[clamp(1.25rem,4vw,5rem)] pt-[clamp(5rem,16vh,13rem)]"
      >
        <div className="grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div data-reveal>
            <h2 className="mb-[clamp(1.5rem,4vh,3rem)] font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]">
              About
            </h2>
            <p className="text-[clamp(1.25rem,2.6vw,2.4rem)] font-light leading-[1.28] tracking-[-0.018em]">
              {bio.split(/(?<=\.)\s/).slice(0, 3).join(" ")}
            </p>
          </div>

          <dl data-reveal className="grid content-start gap-[clamp(1.5rem,3vh,2.5rem)]">
            {profile.educationInfo && (
              <div>
                <dt className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.26em] text-[#56534d]">
                  Education
                </dt>
                <dd className="text-[1.05rem] leading-snug">{profile.educationInfo}</dd>
                {profile.institution && (
                  <dd className="mt-0.5 text-[0.9rem] text-[#8b877d]">{profile.institution}</dd>
                )}
              </div>
            )}
            <div>
              <dt className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.26em] text-[#56534d]">
                Focus
              </dt>
              <dd className="text-[1.05rem] leading-snug">
                Frontend architecture, backend reliability, security
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---------- STACK ----------
          A rail that drifts against scroll. Duplicated so the loop has no seam:
          the track translates a fixed fraction and wraps at the join. */}
      <section id="stack" className="relative z-10 overflow-hidden pt-[clamp(5rem,16vh,13rem)]">
        <h2 className="mb-[clamp(1.5rem,4vh,3rem)] px-[clamp(1.25rem,4vw,5rem)] font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]">
          Stack
        </h2>
        <div className="overflow-hidden">
          <div data-drift className="flex w-max gap-[clamp(2rem,5vw,5rem)] pr-[clamp(2rem,5vw,5rem)] will-change-transform">
            {[...(stack.length ? stack : FALLBACK_STACK), ...(stack.length ? stack : FALLBACK_STACK)].map(
              (s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="whitespace-nowrap text-[clamp(1.8rem,5.5vw,4.5rem)] font-light leading-none tracking-[-0.03em] text-[#efece4]/85 transition-colors duration-300 hover:text-[#c1121f]"
                >
                  {s}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ---------- CONTACT ---------- */}
      {/* ---------- INTERESTS ---------- */}
      {profile.interests?.length ? (
        <section className="relative z-10 px-[clamp(1.25rem,4vw,5rem)] pt-[clamp(4rem,12vh,9rem)]">
          <h2
            data-reveal
            className="mb-[clamp(1.5rem,4vh,3rem)] font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]"
          >
            What I work on
          </h2>
          <Interests items={profile.interests} />
        </section>
      ) : null}

      <section
        id="contact"
        className="relative z-10 px-[clamp(1.25rem,4vw,5rem)] pt-[clamp(6rem,20vh,16rem)] pb-[clamp(3rem,8vh,6rem)]"
      >
        <div data-reveal>
          <p className="mb-[clamp(1rem,3vh,2rem)] font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]">
            Contact
          </p>
          <a
            href={`mailto:${profile.email}`}
            className="group inline-block text-[clamp(1.6rem,6vw,5.5rem)] font-light leading-[1.05] tracking-[-0.035em]"
          >
            <Line delay={0}>Have something</Line>
            <Line delay={0.07}>
              <span className="text-[#c1121f] transition-colors duration-500 group-hover:text-[#efece4]">
                worth building?
              </span>
            </Line>
          </a>
        </div>

        {/* The real form. Writes through to the inbox via api/contact. */}
        <div
          data-reveal
          className="mt-[clamp(3rem,9vh,7rem)] border-t border-[#efece4]/12 pt-[clamp(2rem,6vh,4rem)]"
        >
          <Contact
            email={profile.email}
            github={profile.github}
            linkedin={profile.linkedin}
          />
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <Footer name={profile.name} live={live} zaps={zaps} />
    </div>
  );
}

/* Shown only if Firestore returns nothing, so the page is never empty. */
const FALLBACK_WORK = [
  {
    id: "w1",
    title: "Realtime board",
    description:
      "CRDT sync across forty clients with no server round trip on the hot path.",
    url: "",
    tags: [],
  },
  {
    id: "w2",
    title: "Ingest pipeline",
    description:
      "2.1M events a day, with backpressure handled at the edge rather than by dropping.",
    url: "",
    tags: [],
  },
  {
    id: "w3",
    title: "Design system",
    description: "One token set across four platforms, with zero drift.",
    url: "",
    tags: [],
  },
  {
    id: "w4",
    title: "Auth rewrite",
    description: "Session handling cut from 900ms to 40ms.",
    url: "",
    tags: [],
  },
];

const FALLBACK_STACK = [
  "React",
  "TypeScript",
  "Node",
  "Go",
  "Postgres",
  "Redis",
  "Firestore",
  "GSAP",
];
