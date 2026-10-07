import { describe, it, expect } from "vitest";

import { ensureUrl, groupSections, slugify } from "../src/lib/content";
import { gmailUrl, mailtoUrl, CONTACT } from "../src/lib/mail";
import type { Section, SectionItem } from "../src/types";

/* ------------------------------------------------------------------ *
 * ensureUrl
 * ------------------------------------------------------------------ */

describe("ensureUrl", () => {
  it("prepends https:// when the stored link has no scheme", () => {
    // This is the D2 bug: "github.com/x" as an href resolves relative to the
    // site and 404s.
    expect(ensureUrl("github.com/dikhyantsatpathy-ui")).toBe(
      "https://github.com/dikhyantsatpathy-ui"
    );
    expect(ensureUrl("linkedin.com/in/dikhyant")).toBe(
      "https://linkedin.com/in/dikhyant"
    );
  });

  it("leaves an existing scheme alone", () => {
    expect(ensureUrl("https://a.dev")).toBe("https://a.dev");
    expect(ensureUrl("http://a.dev")).toBe("http://a.dev");
    expect(ensureUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(ensureUrl("tel:+911234567890")).toBe("tel:+911234567890");
  });

  it("leaves root-relative and fragment links alone", () => {
    expect(ensureUrl("/work/thing")).toBe("/work/thing");
    expect(ensureUrl("#contact")).toBe("#contact");
  });

  it("returns an empty string for missing or blank input", () => {
    expect(ensureUrl(undefined)).toBe("");
    expect(ensureUrl("")).toBe("");
    expect(ensureUrl("   ")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(ensureUrl("  github.com/x  ")).toBe("https://github.com/x");
  });
});

/* ------------------------------------------------------------------ *
 * slugify
 * ------------------------------------------------------------------ */

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Identity Document Screening System")).toBe(
      "identity-document-screening-system"
    );
  });

  it("collapses runs and trims leading/trailing hyphens", () => {
    expect(slugify("  --A  B!! C--  ")).toBe("a-b-c");
  });

  it("strips characters a URL path cannot carry", () => {
    expect(slugify("Realtime board / v2")).toBe("realtime-board-v2");
  });
});

/* ------------------------------------------------------------------ *
 * groupSections — the D1 bug
 * ------------------------------------------------------------------ */

const item = (over: Partial<SectionItem> = {}): SectionItem => ({
  id: "i",
  title: "t",
  ...over,
});

const section = (over: Partial<Section> = {}): Section => ({
  title: "s",
  type: "projects",
  items: [],
  order: 0,
  visible: true,
  updatedAt: "2026-01-01",
  ownerId: "o",
  ...over,
});

describe("groupSections", () => {
  it("never puts certificates or achievements into projects", () => {
    // The bug: flatMap over all sections dumped every type into "Selected
    // work", so adding a certificates section in admin surfaced it there.
    const g = groupSections([
      section({ type: "projects", items: [item({ title: "P" })] }),
      section({ type: "certificates", items: [item({ title: "C" })] }),
      section({ type: "achievements", items: [item({ title: "A" })] }),
    ]);
    expect(g.projects.map((p) => p.title)).toEqual(["P"]);
    expect(g.certificates.map((p) => p.title)).toEqual(["C"]);
    expect(g.achievements.map((p) => p.title)).toEqual(["A"]);
  });

  it("drops sections marked not visible", () => {
    const g = groupSections([
      section({ visible: false, items: [item({ title: "hidden" })] }),
      section({ visible: true, items: [item({ title: "shown" })] }),
    ]);
    expect(g.projects.map((p) => p.title)).toEqual(["shown"]);
  });

  it("orders sections by `order` ascending", () => {
    const g = groupSections([
      section({ order: 2, items: [item({ title: "third" })] }),
      section({ order: 1, items: [item({ title: "second" })] }),
      section({ order: 3, items: [item({ title: "first" })] }),
    ]);
    expect(g.projects.map((p) => p.title)).toEqual(["second", "third", "first"]);
  });

  it("puts featured projects first and is otherwise stable", () => {
    const g = groupSections([
      section({
        items: [
          item({ title: "a" }),
          item({ title: "b", featured: true }),
          item({ title: "c" }),
        ],
      }),
    ]);
    expect(g.projects.map((p) => p.title)).toEqual(["b", "a", "c"]);
  });

  it("sorts certificates newest first", () => {
    const g = groupSections([
      section({
        type: "certificates",
        items: [
          item({ title: "old", date: "2023-05-01" }),
          item({ title: "new", date: "2026-01-15" }),
          item({ title: "mid", date: "2024-09-09" }),
        ],
      }),
    ]);
    expect(g.certificates.map((c) => c.title)).toEqual(["new", "mid", "old"]);
  });

  it("tolerates a section with no items array", () => {
    const g = groupSections([
      { ...section(), items: undefined as unknown as SectionItem[] },
    ]);
    expect(g.projects).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * mail
 * ------------------------------------------------------------------ */

describe("gmailUrl", () => {
  it("targets Gmail compose with to/subject/body", () => {
    const u = new URL(gmailUrl());
    expect(u.origin + u.pathname).toBe(
      "https://mail.google.com/mail/"
    );
    expect(u.searchParams.get("view")).toBe("cm");
    expect(u.searchParams.get("fs")).toBe("1");
    expect(u.searchParams.get("to")).toBe(CONTACT.to);
    expect(u.searchParams.get("su")).toBe(CONTACT.subject);
    expect(u.searchParams.get("body")).toBe(CONTACT.body);
  });

  it("omits cc entirely when it is unset", () => {
    expect(gmailUrl()).not.toContain("cc=");
  });

  it("includes cc only when one is configured", () => {
    const u = new URL(gmailUrl({ ...CONTACT, cc: "second@example.com" }));
    expect(u.searchParams.get("cc")).toBe("second@example.com");
  });

  it("encodes spaces as %20, not +", () => {
    // mailto does not decode "+" as a space; using it silently mangles the
    // subject line.
    expect(gmailUrl()).not.toContain("+");
    expect(gmailUrl()).toContain("%20");
  });
});

describe("mailtoUrl", () => {
  it("builds a mailto with subject and body", () => {
    expect(mailtoUrl()).toBe(
      `mailto:${CONTACT.to}?subject=${encodeURIComponent(CONTACT.subject)}` +
        `&body=${encodeURIComponent(CONTACT.body)}`
    );
  });

  it("adds cc before subject when set", () => {
    const u = mailtoUrl({ ...CONTACT, cc: "second@example.com" });
    expect(u).toContain("cc=second%40example.com");
    expect(u.indexOf("cc=")).toBeLessThan(u.indexOf("subject="));
  });

  it("uses %20 for spaces", () => {
    expect(mailtoUrl()).not.toContain("+");
  });
});
