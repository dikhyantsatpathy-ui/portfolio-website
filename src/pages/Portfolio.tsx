/**
 * The portfolio page.
 *
 * The layout lives in `designs/BoneBlood.tsx`; this file only supplies it with
 * content and mounts the global chrome. The old inline structure (nav, about,
 * craft, contact, footer as components in this file) is gone — two parallel
 * layouts in one file is how they drift apart.
 */

import { useEffect, useState } from "react";

import EasterEggs from "../components/EasterEggs";
import SmoothScroll from "../components/SmoothScroll";
import { Chatbot } from "../components/Chatbot";
import BoneBlood from "../designs/BoneBlood";
import { usePortfolioContent } from "../lib/usePortfolioContent";

export default function Portfolio() {
  const { profile, sections, live } = usePortfolioContent();

  // Shockwave counter, driven by a custom event from EasterEggs.
  const [zaps, setZaps] = useState(0);
  useEffect(() => {
    const onZap = () => setZaps((n) => n + 1);
    window.addEventListener("ds:shockwave", onZap);
    return () => window.removeEventListener("ds:shockwave", onZap);
  }, []);

  const projects = sections.flatMap((s) => s.items ?? []);

  useEffect(() => {
    document.title = `${profile.name} — Software Engineer`;
  }, [profile.name]);

  return (
    <>
      <SmoothScroll />
      <EasterEggs />
      <Chatbot />

      {/* Skip link, the first tab stop. Without it, keyboard users tab through
          the whole nav on every page load. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-[90] focus:rounded-tile focus:bg-[#c1121f] focus:px-5 focus:py-3 focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <main id="main" tabIndex={-1}>
        <BoneBlood
          profile={profile}
          projects={projects}
          live={live}
          zaps={zaps}
        />
      </main>
    </>
  );
}
