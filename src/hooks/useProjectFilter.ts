import { useMemo, useState } from "react";
import type { SectionItem } from "../types";

/**
 * Tag filter for the project index. Derives the chip list from the data (loop
 * over items → unique tags) so adding a tag in admin needs no code change.
 * `showFilter` is false when filtering would be pointless.
 */
export function useProjectFilter(projects: SectionItem[]) {
  const [active, setActive] = useState<string>("All");

  const tags = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return ["All", ...Array.from(set)];
  }, [projects]);

  const filtered = useMemo(
    () => (active === "All" ? projects : projects.filter((p) => p.tags?.includes(active))),
    [projects, active]
  );

  return { tags, active, setActive, filtered, showFilter: tags.length > 2 };
}
