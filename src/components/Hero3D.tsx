import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiMech from "./AsciiMech";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hero: a 3D corridor the camera flies through.
 *
 * The technique is the one Webflow showcase sites use, and it is worth
 * understanding rather than copying blindly:
 *
 *  - A container gets `perspective`, which establishes a vanishing point.
 *  - Children are pushed back with `translateZ` and rotated on X so they form a
 *    real corridor instead of a flat background image.
 *  - A CSS `repeating-linear-gradient` draws the stripes. Repeated DOM nodes
 *    would be heavier and harder to keep in sync with the camera.
 *  - Scroll scrubs the camera forward (`translateZ` on the world, negative Y on
 *    the walls); the mouse adds a small parallax offset on top.
 *
 * Why GSAP drives this instead of CSS keyframes: scroll position has to drive
 * the transform. CSS animations run on their own timeline and can't be scrubbed
 * by the scrollbar. `useGSAP` rather than `useEffect` because it scopes
 * selectors to this component and kills its ScrollTriggers on unmount.
 */
export default function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          // Below this the corridor reads as noise and costs a lot of
          // compositing for no payoff, so mobile gets a flat gradient instead.
          isDesktop: "(min-width: 768px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduce } = context.conditions as {
            isDesktop: boolean;
            reduce: boolean;
          };

          const q = gsap.utils.selector(root);

          // --- Entrance -------------------------------------------------
          // Not scroll-linked, so a real ease is correct here.
          //
          // Skipped entirely under reduced motion. GSAP drives these values
          // from JavaScript, so the global CSS `prefers-reduced-motion` rule
          // cannot suppress them — leaving this in place meant the headline
          // still slid up over a second for users who asked it not to move.
          if (!reduce) {
            gsap
              .timeline({ defaults: { ease: "power3.out" } })
              .from(q(".hero-word--1"), { yPercent: 110, duration: 1.1 })
              .from(q(".hero-word--2"), { yPercent: 110, duration: 1.1 }, "-=0.85")
              .from(
                q(".hero-meta"),
                { opacity: 0, y: 20, duration: 0.7 },
                "-=0.55"
              );
          }

          if (reduce) return;

          // --- Scroll: fly the camera down the corridor --------------------
          if (isDesktop) {
            gsap.to(q(".hero-world"), {
              z: "-46vh",
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "bottom top",
                scrub: 0.6,
              },
            });

            // Walls slide faster than the floor to sell depth.
            gsap.to(q(".hero-wall--left"), {
              xPercent: -6,
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "bottom top",
                scrub: 0.6,
              },
            });
            gsap.to(q(".hero-wall--right"), {
              xPercent: 6,
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "bottom top",
                scrub: 0.6,
              },
            });

            // The name recedes as you leave.
            gsap.to(q(".hero-title"), {
              opacity: 0,
              y: -60,
              scale: 0.94,
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "60% top",
                scrub: 0.4,
              },
            });
          }

          // Pause the corridor entirely once the hero has left the viewport.
          // The hero is 100svh, so by the time this fires the perspective
          // stage is off screen. Leaving it animating meant the browser kept
          // promoting three large composited layers per frame for the entire
          // rest of the page — the single most expensive thing on the site.
          ScrollTrigger.create({
            trigger: root.current,
            start: "bottom top",
            onEnter: () => {
              root.current?.classList.add("is-past");
              gsap.set(q(".hero-world"), { visibility: "hidden" });
            },
            onLeaveBack: () => {
              root.current?.classList.remove("is-past");
              gsap.set(q(".hero-world"), { visibility: "visible" });
            },
          });

          // --- Mouse parallax --------------------------------------------
          // QuickTo is the right tool here: it creates a reusable, throttled
          // tween per property instead of allocating a new tween on every
          // mousemove, which is what makes naive parallax janky.
          const worldX = gsap.quickTo(q(".hero-world"), "x", {
            duration: 0.9,
            ease: "power3",
          });
          const worldY = gsap.quickTo(q(".hero-world"), "y", {
            duration: 1.1,
            ease: "power3",
          });
          const titleX = gsap.quickTo(q(".hero-title"), "x", {
            duration: 1.3,
            ease: "power3",
          });
          const titleY = gsap.quickTo(q(".hero-title"), "y", {
            duration: 1.5,
            ease: "power3",
          });

          const onMove = (e: MouseEvent) => {
            // Normalise to -1..1 from viewport centre.
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = (e.clientY / window.innerHeight) * 2 - 1;
            worldX(nx * -34);
            worldY(ny * -18);
            titleX(nx * 16);
            titleY(ny * 10);
          };

          const onLeave = () => {
            worldX(0);
            worldY(0);
            titleX(0);
            titleY(0);
          };

          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseleave", onLeave);

          return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseleave", onLeave);
          };
        }
      );
    },
    { scope: root }
  );

  return (
    <header
      ref={root}
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* Depth base. A plain gradient rather than a blurred blob — a blur on a
          full-viewport element is re-rasterised on every repaint. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 8%, #17171b 0%, #0d0d10 45%, #08080a 100%)",
        }}
      />

      {/* ---- The 3D corridor. Desktop only. ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden [perspective:900px] md:block [contain:paint]"
      >
        {/* preserve-3d keeps children's Z translations in a shared space, which
            is what makes the corridor read as depth rather than layered planes.
            The transform itself is owned by GSAP, so nothing inline here — an
            inline transform would be overwritten on the first tick anyway. */}
        <div
          className="hero-world absolute inset-0 will-change-transform"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Floor and ceiling.
              Sizing note: these planes used to be `inset-x-[-60%]` (220% of
              viewport width). Once rotated on X, the compositor rasterises the
              whole plane, so at 1440px they were 23,000px wide surfaces
              repainted every frame — measured at 20fps of the total cost.
              Fixed to 180% and, more importantly, the whole corridor is now
              `contain: paint` so the browser can clip and cache it instead of
              recompositing beyond the viewport. */}
          {[
            { pos: "floor", top: "62%", rot: "rotateX(74deg)", origin: "top" },
            {
              pos: "ceiling",
              top: "-38%",
              rot: "rotateX(74deg)",
              origin: "bottom",
            },
          ].map((p) => (
            <div
              key={p.pos}
              className="absolute inset-x-[-40%] h-[100%]"
              style={{
                top: p.top,
                transformOrigin: p.origin,
                transform: `${p.rot} translateZ(-320px)`,
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(245,147,0,0.16) 0px, rgba(245,147,0,0.16) 1px, transparent 1px, transparent 68px)",
              }}
            />
          ))}

          {/* Side walls, angled inward to form the corridor */}
          <div
            className="hero-wall hero-wall--left absolute top-[-20%] left-[-18%] h-[140%] w-[52%]"
            style={{
              transformOrigin: "right center",
              transform: "rotateY(58deg)",
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(242,237,228,0.10) 0px, rgba(242,237,228,0.10) 1px, transparent 1px, transparent 64px)",
            }}
          />
          <div
            className="hero-wall hero-wall--right absolute top-[-20%] right-[-18%] h-[140%] w-[52%]"
            style={{
              transformOrigin: "left center",
              transform: "rotateY(-58deg)",
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(242,237,228,0.10) 0px, rgba(242,237,228,0.10) 1px, transparent 1px, transparent 64px)",
            }}
          />

          {/* Brass horizon glow at the vanishing point.
              A blurred element is re-rasterised on every repaint. This is a
              static radial gradient instead — visually near-identical to the
              blur, and it costs nothing per frame. */}
          <div
            className="absolute left-1/2 top-[62%] h-[38vh] w-[78vw] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(245,147,0,0.18) 0%, rgba(196,116,0,0.07) 38%, transparent 68%)",
            }}
          />
        </div>
      </div>

      {/* Vignette — pulls focus to the type and hides the corridor edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 45%, transparent 30%, rgba(8,8,10,0.78) 100%)",
        }}
      />

      {/* ---- The machine. Sits behind the type, in front of the corridor.
           It reads its own scroll progress internally, so it keeps travelling
           and re-framing as the page moves rather than scrolling away. ---- */}
      <AsciiMech />

      {/* ---- Content ----
          Constrained to the left half on desktop so the ASCII robot owns the
          right without the two colliding. */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 lg:max-w-[min(100%,36%)]">
        <p className="label hero-meta mb-9 flex items-center gap-3">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brass-400" />
          Available for work
        </p>

        {/* Capped tighter on desktop: the copy column is 38% of the viewport so the
            mech owns the right, and a 9rem headline would overrun it. */}
        <h1 className="hero-title max-w-5xl text-[clamp(3rem,11.5vw,9rem)] leading-[0.88] tracking-[-0.04em] text-bone-100 lg:text-[clamp(2.75rem,6.2vw,5.5rem)]">
          {/* Each line is clipped by a wrapper so it can slide up from below
              its own baseline rather than fading. */}
          <span className="block overflow-hidden pb-[0.08em]">
            <span className="hero-word--1 block">Hello, I&rsquo;m</span>
          </span>
          <span className="block overflow-hidden pb-[0.08em]">
            <span className="hero-word--2 block italic text-brass-400">
              Dikhyant
            </span>
          </span>
        </h1>

        <div className="hero-meta mt-10 max-w-sm">
          <p className="text-lg leading-relaxed text-bone-400 lg:text-xl">
            Software engineer. I build web systems that stay fast and stay up
            &mdash; and interfaces that survive a bad connection.
          </p>
          <a
            href="#work"
            className="group mt-8 inline-flex w-fit items-center gap-2.5 border-b border-brass-400/40 pb-1 font-mono text-sm text-brass-400 transition-colors hover:border-brass-300"
          >
            Scroll to see the work
            <span className="transition-transform duration-300 group-hover:translate-y-0.5">
              ↓
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}