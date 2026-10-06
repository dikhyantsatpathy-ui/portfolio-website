# Portfolio

Personal site for **Dikhyant Satapathy** — software engineer.

A scroll-driven single page: a WebGL starfield and a modelled gyroscope that
descends through the viewport as you scroll, over a CSS 3D corridor.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite 6 |
| UI | React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme` in `src/index.css`, no config file) |
| 3D | Three.js (lazy-loaded, one WebGL context) |
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

## How it fits together

- **Content** lives in Firestore and is edited through `/admin`. `src/data/content.ts`
  holds a static copy used for first paint and as a fallback, so the page still
  renders if Firestore is slow, empty, or blocked by rules. Firestore wins once it
  responds.
- **The 3D scene** (`src/components/HeroMachine.tsx`) owns a single `WebGLRenderer`.
  The starfield and the gyro share it — a second renderer would mean a second
  full-viewport render target.
- **Scroll drives everything.** The page is ~6,900px tall specifically so the
  scene has room to be a journey; scroll progress maps to poses, and scroll
  *velocity* adds to the starfield's forward speed.
- **Secrets** stay server-side in `api/`. Nothing in `src/` may hold a secret —
  `VITE_*` values are public by definition.

## Accessibility

Verified against WCAG 2.2 AA, not assumed:

- All text meets 4.5:1 (or 3:1 for large); the decorative token `--color-bone-700`
  is 2.71:1 and is never used for text.
- Interactive targets ≥24×24 (SC 2.5.8).
- Form fields have real `<label>` elements — a placeholder is not a label.
- Visible `focus-visible` rings, a skip link as the first tab stop, and a properly
  labelled modal that closes on Escape.
- `prefers-reduced-motion` disables Lenis, pinning, and the animation loop; the
  3D scene renders a single static frame.

## Performance

60fps idle and while scrolling at 1024×640, 1440×900 and 1920×1080. Kept there by:
capping pixel ratio (1.5 for the 3D scene), a 32fps frame budget, one draw call
for the whole starfield, `contain` on the composited layers, pausing offscreen
scenes, and avoiding `filter: blur()` / `mix-blend-mode` on full-viewport
elements.

## Easter eggs

| Trigger | Result |
| --- | --- |
| Konami code | Overdrive — magenta palette, faster spin, red-hot core |
| Click anywhere | Shockwave + camera kick; counter appears in the footer |
| Drag | Spin the machine, with inertia |
| `sabotage()` in the console, or press `` ` `` | Command palette |
| Type `hire` | Overdrive burst |
| Alt-click the `DS/` monogram | Blueprint — warm amber schematic mode |

## Agent tooling

`.agents/` (git-ignored) holds project rules and agent skills for working on this
repo. See `.agents/skills/SOURCES.md` for provenance and licences, and
`.agents/rules/` for the stack, palette, motion and accessibility conventions
this codebase holds itself to.