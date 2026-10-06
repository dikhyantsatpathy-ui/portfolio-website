/**
 * The sections that live below the hero: contact, interests, footer.
 *
 * These were all still working before the layout revamp — the contact form hits
 * `api/contact` through `submitContact`, and the chatbot talks to `api/chat`.
 * They are rebuilt here rather than copied from the old page so they use the
 * Bone / Blood type and colour system instead of the retired indigo tokens.
 */

import { useState } from "react";
import { ArrowUpRight, Github, Linkedin, Send } from "lucide-react";

import { submitContact } from "../lib/usePortfolioContent";
import type { Interest, Profile } from "../types";

/* ------------------------------------------------------------------ *
 * Contact
 * ------------------------------------------------------------------ */

export function Contact({
  email,
  github,
  linkedin,
}: Pick<Profile, "email" | "github" | "linkedin">) {
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

  // Real <label> elements, visually hidden. A placeholder is not a label: it
  // vanishes on focus and screen readers may skip it (SC 3.3.2, 4.1.2).
  const field =
    "w-full rounded-tile border border-[#efece4]/12 bg-[#efece4]/[0.03] px-5 py-4 text-[#efece4] placeholder:text-[#56534d] transition-colors duration-300 focus:border-[#c1121f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c1121f]";

  return (
    <div className="grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <a
          href={`mailto:${email}`}
          className="group inline-flex items-center gap-3 text-[clamp(1.15rem,2vw,1.7rem)] text-[#efece4] transition-colors hover:text-[#c1121f]"
        >
          {email}
          <ArrowUpRight
            className="h-5 w-5 text-[#56534d] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            strokeWidth={1.5}
          />
        </a>

        <ul className="mt-[clamp(2rem,4vh,3.5rem)] flex flex-wrap gap-x-[clamp(1.25rem,2.5vw,2.5rem)] gap-y-3">
          {github && (
            <li>
              <a
                href={github}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 py-2 text-sm text-[#8b877d] transition-colors hover:text-[#c1121f]"
              >
                <Github className="h-4 w-4" strokeWidth={1.5} />
                GitHub
              </a>
            </li>
          )}
          {linkedin && (
            <li>
              <a
                href={linkedin}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 py-2 text-sm text-[#8b877d] transition-colors hover:text-[#c1121f]"
              >
                <Linkedin className="h-4 w-4" strokeWidth={1.5} />
                LinkedIn
              </a>
            </li>
          )}
        </ul>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Honeypot. Bots fill it, humans never see it. `tabIndex={-1}` keeps it
            out of the tab order but still submitted, which is what makes it
            work. */}
        <div aria-hidden className="absolute left-[-9999px]">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

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
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-tile bg-[#c1121f] px-6 py-4 font-medium text-white transition-colors duration-300 hover:bg-[#a01019] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent"
              ? "Sent — thanks"
              : "Send message"}
          {status === "idle" && <Send className="h-4 w-4" strokeWidth={2} />}
        </button>

        {error && (
          <p role="alert" className="text-sm text-[#ff5a4d]">
            {error}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {status === "sent" ? "Message sent successfully" : ""}
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Interests
 * ------------------------------------------------------------------ */

export function Interests({ items }: { items?: Interest[] }) {
  if (!items?.length) return null;

  return (
    <ul className="grid gap-px overflow-hidden border-y border-[#efece4]/10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <li
          key={it.id}
          data-reveal
          className="group bg-[#0a0a0b] p-[clamp(1.25rem,2.5vw,2rem)] transition-colors duration-500 hover:bg-[#efece4]/[0.03]"
          style={{ transitionDelay: `${i * 40}ms` }}
        >
          <h3 className="mb-2 text-[clamp(1rem,1.3vw,1.2rem)] text-[#efece4] transition-colors group-hover:text-[#c1121f]">
            {it.title}
          </h3>
          <p className="text-sm leading-relaxed text-[#8b877d]">{it.description}</p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

export function Footer({ name, live, zaps }: { name: string; live: boolean; zaps: number }) {
  return (
    <footer className="relative z-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-[#efece4]/12 px-[clamp(1.25rem,4vw,5rem)] py-[clamp(1.5rem,4vh,3rem)] font-mono text-[10px] uppercase tracking-[0.22em] text-[#56534d]">
      <span>
        © {new Date().getFullYear()} {name}
      </span>

      <div className="flex flex-wrap items-center gap-x-[clamp(1rem,2vw,2rem)] gap-y-2">
        {!live && <span>static preview</span>}
        {/* Visible payoff for the click easter egg. */}
        {zaps > 0 && (
          <span className="tabular text-[#c1121f]/80" title="Every click counts">
            ⚡ {zaps}
          </span>
        )}
        <span>
          <kbd className="rounded-sm border border-[#efece4]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#8b877d]">
            `
          </kbd>{" "}
          for commands
        </span>
        <a
          href="/admin"
          className="-my-1.5 inline-flex items-center py-1.5 text-[#8b877d] transition-colors hover:text-[#efece4]"
        >
          admin
        </a>
      </div>
    </footer>
  );
}
