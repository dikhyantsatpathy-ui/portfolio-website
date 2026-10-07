# Agent rules for this repo

1. Never add `Co-Authored-By` trailers, "Generated with ..." footers or any AI
   attribution to commits, PRs, code, docs or the site.
2. Never invent content (metrics, certifications, employers, skills, outcomes).
   Missing data means hide the section, not write plausible filler.
3. Read `docs/AGENT_PROMPT.md` before changing anything. Work in its phases; run
   its verify loop after each phase. `docs/PLAN.md` is the shorter companion
   brief with the same intent.
4. Keep `prefers-reduced-motion`, `pointer: coarse`, keyboard and screen-reader
   behaviour working.
5. `npm run lint && npm run build` must pass before every commit.

## Layout

| Path | What lives there |
| --- | --- |
| `src/pages/` | Routes. `Portfolio.tsx` is a content supplier, not a layout. |
| `src/designs/` | The Bone / Blood layout and its sections. |
| `src/components/` | Chrome and self-contained widgets. |
| `src/hooks/` | Behaviour. Components stay presentational. |
| `src/lib/` | Framework-free logic, unit-testable without React. |
| `src/data/` | Static content fallback. What crawlers see. |
| `api/` | Vercel serverless. The only place secrets live. |
| `docs/` | The briefs this work follows. |

## Two things worth not relearning

- A file's inline `style` beats a parent's font-size. Set the value where it is
  used, or it silently does nothing.
- Anything that runs off `requestAnimationFrame` on a timer must be skipped when
  `prefers-reduced-motion` is set. A CSS override cannot reach JS-driven
  animation.
