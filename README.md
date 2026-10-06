# Portfolio

Personal site for **Dikhyant Satapathy** — software engineer.

A scroll-driven single page: a 3D mech walker rendered as ASCII text crosses the
viewport, over a CSS 3D corridor, with a pinned horizontal project track.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite 6 |
| UI | React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme` in `src/index.css`, no config file) |
| The mech | Software rasteriser in `src/components/AsciiMech.tsx` — no WebGL |
| Scroll | Lenis + GSAP ScrollTrigger (`useGSAP`) |
| Content | Firestore, with a static fallback in `src/data/content.ts` |
| Deploy | Vercel (frontend + `api/`) · Firebase (auth, Firestore, rules) |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in VITE_FIREBASE_* and GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

```bash
npm run lint                 # tsc --noEmit
npm run build                # production build to dist/
```

## The ASCII walker

There is no WebGL and no Three.js. The walker is real 3D geometry rasterised in
software and printed as characters:

1. The hull, cockpit, cannons and four articulated legs are built from boxes into
   triangles with flat normals.
2. Each frame: transform, project with a perspective divide, rasterise into a
   z-buffer.
3. Each covered cell stores shaded luminance.
4. Luminance picks a glyph from a density ramp — so shading *is* character
   density, and the mid-tones fall out of geometry and light.

Doing it this way gives real foreshortening and self-occlusion, and it removed a
536 kB dependency, a GPU context and a shader compile. The page now ships no
canvas at all.

Two decisions came from testing rather than taste:

- **It's a walker, not a humanoid.** A biped's silhouette collapses when it turns
  edge-on; a slab hull reads identically from every angle. The yaw band is also
  narrowed to ±0.34 rad — a full rotation spends too long past 70° off frontal,
  where the model is just noise.
- **The camera sits below the hull and looks up.** That single choice is most of
  why it reads as enormous.

## How it fits together

- **Content** lives in Firestore and is edited through `/admin`.
  `src/data/content.ts` holds a static copy used for first paint and as a
  fallback, so the page still renders if Firestore is slow, empty, or blocked.
- **Scroll drives the framing.** Page height *is* the length of the journey
  (~6,900px); scroll progress drives the mech's transform.
- **Secrets** stay server-side in `api/`. Nothing in `src/` may hold a secret —
  `VITE_*` values are public by definition.

## Accessibility

Verified against WCAG 2.2 AA, not assumed:

- All text meets 4.5:1 (or 3:1 for large); `--color-bone-700` is 2.9:1 and is
  never used for text.
- Interactive targets ≥24×24 (SC 2.5.8).
- Form fields have real `<label>` elements — a placeholder is not a label.
- Visible `focus-visible` rings, a skip link as the first tab stop, and a
  properly labelled modal that closes on Escape.
- `prefers-reduced-motion` disables Lenis, pinning, the hero entrance and the
  mech loop, which then renders a single static frame. JS-driven animation is
  gated per component, because the CSS override cannot reach it.

## Performance

61fps rAF, no canvas on the page at all. The text grid is written as one
`textContent` assignment, throttled to ~20fps. Main bundle is ~190 kB gzip.

## Easter eggs

| Trigger | Result |
| --- | --- |
| Konami code | Overdrive — signal red, hotter glow |
| Click anywhere | Shockwave ring; counter appears in the footer |
| `sabotage()` in the console, or press `` ` `` | Command palette |
| Type `hire` | Overdrive burst |
| Alt-click the `DS/` monogram | Blueprint — inverted to dark ink on paper |

## Deploying

The repo is not yet linked to a Vercel project, so `vercel` will prompt for
login on first use:

```bash
vercel link      # one-time: pick or create the project
vercel --prod
```

`vercel.json` excludes `/api/` from the SPA rewrite so the serverless functions
stay reachable.

## Agent tooling

`.agents/` (git-ignored) holds project rules and agent skills for working on this
repo. See `.agents/skills/SOURCES.md` for provenance and licences, and
`.agents/rules/` for the stack, palette, motion and accessibility conventions
this codebase holds itself to.