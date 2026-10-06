import { useEffect, useState } from "react";
import { ArrowUpRight, Github, Linkedin, Mail, Send } from "lucide-react";

import Hero3D from "../components/Hero3D";
import EasterEggs from "../components/EasterEggs";
import PinnedWork from "../components/PinnedWork";
import SmoothScroll from "../components/SmoothScroll";
import {
  Reveal,
  MagneticLink,
  SectionHeader,
  CopyButton,
} from "../components/ui";
import {
  usePortfolioContent,
  submitContact,
} from "../lib/usePortfolioContent";
import { fallbackProfile, socialLinks } from "../data/content";
import { cn } from "../lib/utils";

/* ==========================================================================
   Navigation
   ========================================================================== */

function Nav() {
  const links = [
    { href: "#work", label: "Work" },
    { href: "#craft", label: "Craft" },
    { href: "#about", label: "About" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-bone-100/8 bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a
          href="#top"
          className="flex items-center py-2 font-mono text-sm tracking-tight text-bone-200 transition-colors hover:text-brass-400"
        >
          DS<span aria-hidden="true" className="text-bone-500">/</span>
        </a>

        <ul className="hidden items-center gap-8 sm:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm text-bone-400 transition-colors duration-300 hover:text-bone-100"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href={`mailto:${fallbackProfile.email}`}
          // py-1.5 brings the hit area to >=24px tall without changing the
          // visual weight (SC 2.5.8).
          className="-my-1.5 inline-flex items-center py-1.5 font-mono text-xs tracking-wide text-bone-500 transition-colors hover:text-brass-400"
        >
          get in touch
        </a>
      </div>
    </nav>
  );
}

/* ==========================================================================
   About
   ========================================================================== */

function About({
  bio,
  educationInfo,
  institution,
}: {
  bio: string;
  educationInfo?: string;
  institution?: string;
}) {
  return (
    <section id="about" className="px-6 py-[var(--spacing-section)]">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          index="01"
          eyebrow="About"
          title="I care about the parts users never see."
        />

        <div className="grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="text-[clamp(1.25rem,2.4vw,1.75rem)] leading-[1.45] tracking-[-0.01em] text-bone-200">
              {bio}
            </p>
          </Reveal>

          <Reveal delay={0.12} className="lg:col-span-5 lg:pl-8">
            <dl className="space-y-6">
              <div>
                <dt className="label mb-1.5">Education</dt>
                <dd className="text-bone-200">{educationInfo}</dd>
                <dd className="mt-1 text-sm text-bone-600">{institution}</dd>
              </div>
              <div>
                <dt className="label mb-1.5">Focus</dt>
                <dd className="text-bone-200">
                  Frontend architecture, backend reliability, security
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Craft — skills marquee + interest grid
   ========================================================================== */

function Craft({
  skills,
  interests,
}: {
  skills: string[];
  interests?: import("../types").Interest[];
}) {
  // Two identical groups inside one track. The track translates -50%, which
  // lands exactly on the seam between them — so the loop has no visible jump.
  // Spacing comes from padding on the items rather than `gap`, because a gap
  // would offset the two groups by half a gap and the seam would not line up.
  const group = (keyPrefix: string) =>
    skills.map((s, i) => (
      <span
        key={`${keyPrefix}-${s}-${i}`}
        className="shrink-0 rounded-tile border border-bone-100/8 bg-ink-850/60 px-5 py-3 font-mono text-sm text-bone-400 transition-colors duration-300 hover:border-brass-400/30 hover:text-brass-300"
      >
        {s}
      </span>
    ));

  return (
    <section id="craft" className="py-[var(--spacing-section)]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          index="03"
          eyebrow="Toolkit"
          title="Tools I reach for, and why."
        />
      </div>

      <div
        className="relative overflow-hidden py-2"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div
          className="flex w-max will-change-transform motion-reduce:animate-none"
          style={{ animation: "var(--animate-marquee)" }}
        >
          <div className="flex shrink-0 gap-3 pr-3">{group("a")}</div>
          {/* Duplicate is decorative; screen readers already read group one. */}
          <div className="flex shrink-0 gap-3 pr-3" aria-hidden="true">
            {group("b")}
          </div>
        </div>
      </div>

      {interests?.length ? (
        <div className="mx-auto mt-24 max-w-6xl px-6">
          <ul className="grid gap-px overflow-hidden rounded-card border border-bone-100/8 bg-bone-100/8 sm:grid-cols-2">
            {interests.map((it, i) => (
              <Reveal as="li" key={it.id} delay={i * 0.05}>
                <div className="group h-full bg-ink-900 p-8 transition-colors duration-500 hover:bg-ink-850">
                  <h3 className="mb-3 text-lg text-bone-100 transition-colors group-hover:text-brass-300">
                    {it.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-bone-600">
                    {it.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/* ==========================================================================
   Contact
   ========================================================================== */

function Contact({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await submitContact({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      message: String(fd.get("message") ?? ""),
      website: String(fd.get("website") ?? ""),
    });

    if (result.ok) {
      setStatus("sent");
      e.currentTarget.reset();
      setTimeout(() => setStatus("idle"), 4000);
    } else {
      setStatus("idle");
      setError(result.error);
    }
  };

  // `focus:outline-none` was paired with only a border-colour change, which is
  // a weak indicator and fails SC 2.4.11. The focus-visible ring is the real
  // one; the border tint is just the accompanying colour shift.
  const field =
    "w-full rounded-tile border border-bone-100/10 bg-ink-850/60 px-5 py-4 text-bone-100 placeholder:text-bone-600 transition-colors duration-300 focus:border-brass-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400";

  return (
    <section id="contact" className="px-6 py-[var(--spacing-section)]">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          index="04"
          eyebrow="Contact"
          title="Have something worth building?"
          lede="Send a note and I'll get back to you. This form writes straight to my inbox."
        />

        <div className="grid gap-16 lg:grid-cols-2">
          <Reveal>
            <a
              href={`mailto:${email}`}
              className="group inline-flex items-center gap-3 text-[clamp(1.25rem,2.5vw,1.75rem)] text-bone-100 transition-colors hover:text-brass-300"
            >
              <Mail className="h-5 w-5 text-bone-700" strokeWidth={1.5} />
              {email}
              <ArrowUpRight
                className="h-4 w-4 text-bone-700 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </a>

            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
              {socialLinks.map((s) => (
                <li key={s.handle}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 py-1 text-sm text-bone-500 transition-colors hover:text-brass-400"
                  >
                    {s.handle === "github" ? (
                      <Github className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <Linkedin className="h-4 w-4" strokeWidth={1.5} />
                    )}
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <form onSubmit={onSubmit} className="space-y-4">
              <div aria-hidden className="absolute left-[-9999px]">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Real <label> elements, visually hidden but present. A placeholder is not a
                  label — it vanishes on focus and screen readers may skip it
                  (SC 3.3.2, 4.1.2). `peer` drives the focus ring off the real
                  control. */}
              <label htmlFor="c-name" className="sr-only">
                Your name
              </label>
              <input
                id="c-name"
                type="text"
                name="name"
                required
                placeholder="Name"
                autoComplete="name"
                aria-required="true"
                className={field}
              />

              <label htmlFor="c-email" className="sr-only">
                Your email
              </label>
              <input
                id="c-email"
                type="email"
                name="email"
                required
                placeholder="Email"
                autoComplete="email"
                aria-required="true"
                className={field}
              />

              <label htmlFor="c-message" className="sr-only">
                Your message
              </label>
              <textarea
                id="c-message"
                name="message"
                required
                rows={5}
                placeholder="What are you building?"
                aria-required="true"
                className={`${field} resize-y`}
              />

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-tile bg-brass-400 px-6 py-4 font-medium text-ink-900 transition-colors duration-300 hover:bg-brass-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "sending"
                  ? "Sending…"
                  : status === "sent"
                    ? "Sent — thanks"
                    : "Send message"}
                {status === "idle" && (
                  <Send className="h-4 w-4" strokeWidth={2} />
                )}
              </button>

              {error && (
                <p role="alert" className="text-sm text-copper-400">
                  {error}
                </p>
              )}
              <p aria-live="polite" className="sr-only">
                {status === "sent" ? "Message sent successfully" : ""}
              </p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function Portfolio() {
  const { profile, sections, live } = usePortfolioContent();

  // Shockwave counter, shared with the machine via a custom event.
  const [zaps, setZaps] = useState(0);
  useEffect(() => {
    const onZap = () => setZaps((n) => n + 1);
    window.addEventListener("ds:shockwave", onZap);
    return () => window.removeEventListener("ds:shockwave", onZap);
  }, []);

  const skills = profile.skills?.length ? profile.skills : fallbackProfile.skills;
  const projects = sections.flatMap((s) => s.items ?? []);

  useEffect(() => {
    document.title = `${profile.name} — Software Engineer`;
  }, [profile.name]);

  return (
    <div className="relative grain min-h-screen bg-ink-900 text-bone-100">
      <SmoothScroll />
      <EasterEggs />

      {/* Skip link — first tab stop. Off-screen until focused, then visible.
          Without it, keyboard users tab through the nav on every page load. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-[80] focus:rounded-tile focus:bg-brass-500 focus:px-5 focus:py-3 focus:font-medium focus:text-ink-900"
      >
        Skip to content
      </a>

      <Nav />

      <main id="main" tabIndex={-1}>
        <Hero3D />
        {/* The DS monogram links to #top. */}
        <span id="top" className="sr-only" aria-hidden="true" />

        <About
          bio={profile.bio || fallbackProfile.bio}
          educationInfo={profile.educationInfo}
          institution={profile.institution}
        />

        <PinnedWork sections={projects} />

        <Craft skills={skills} interests={profile.interests} />

        <Contact email={profile.email || fallbackProfile.email} />
      </main>

      <footer className="relative z-10 border-t border-bone-100/8 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-bone-700">
            © {new Date().getFullYear()} {profile.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {!live && (
              <span className="font-mono text-xs text-bone-700">
                static preview
              </span>
            )}
            {/* Visible payoff for the click easter egg. */}
            {zaps > 0 && (
              <span
                className="font-mono text-xs tabular text-brass-400/70"
                title="Every click on the machine counts"
              >
                ⚡ {zaps}
              </span>
            )}
            <span className="font-mono text-xs text-bone-700">
              <kbd className="rounded-sm border border-bone-100/15 px-1.5 py-0.5 font-mono text-[10px] text-bone-600">
                `
              </kbd>{" "}
              for commands
            </span>
            <a
              href="/admin"
              className="-my-1.5 inline-flex items-center py-1.5 font-mono text-xs text-bone-500 transition-colors hover:text-bone-300"
            >
              admin
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}