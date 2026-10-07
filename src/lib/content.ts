import type { Section, SectionItem, SectionType } from "../types";

/** Prepend https:// when a stored link has no scheme (relative hrefs 404). */
export function ensureUrl(raw?: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(v)) return v;
  return `https://${v}`;
}

export type Grouped = Record<SectionType, SectionItem[]>;

/**
 * Split Firestore sections by `type`, honouring `visible` and `order`.
 * Replaces `sections.flatMap(s => s.items)`, which put certificates and
 * achievements into "Selected work".
 */
export function groupSections(sections: Section[]): Grouped {
  const out: Grouped = { projects: [], achievements: [], certificates: [], custom: [] };
  [...sections]
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.order - b.order)
    .forEach((s) => {
      (s.items ?? []).filter(Boolean).forEach((it) => out[s.type]?.push(it));
    });
  // Newest first for dated lists (ISO-ish strings sort correctly; others keep order).
  (["certificates", "achievements"] as const).forEach((k) =>
    out[k].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  );
  // Featured projects first, stable otherwise.
  out.projects.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  return out;
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
