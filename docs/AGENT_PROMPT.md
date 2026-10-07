# MASTER PROMPT — Industrial-grade makeover of `dikhyantsatpathy-ui/myfirst-website`

You are a senior frontend + platform engineer. You are taking over a personal portfolio for **Dikhyant Satapathy** (software engineer, Odisha, India) and delivering a production-quality makeover: new cursor-reactive ASCII hero, a coherent design system, intuitive navigation, a proper projects experience, skills and certifications sections, a fixed email flow, a locked-down backend, and a test/CI safety net.

Read this whole document before touching code. It is long on purpose. Everything the owner asked for is in it.

---

## 0. HOW YOU MUST WORK (the loop)

You work in **phases (§6)**. For **every** phase, run this loop and do not advance until it exits clean:

```
LOOP per phase:
  1. PLAN   – list the files you will touch (max 10 lines).
  2. BUILD  – implement. Prefer data-driven code: registries + .map() loops + custom hooks (see §4). No copy-pasted JSX blocks.
  3. CHECK  – npm run lint && npm run build && npm test
  4. SEE    – npm run build && npx vite preview --port 4173 &  then
              node scripts/verify.mjs --url=http://localhost:4173 --ids=<ids that exist in this phase>
              and OPEN verify-out/*.png (mobile/tablet/desktop, top/cursor/full). Screenshots are evidence; "it compiles" is not.
  5. FIX    – anything red or ugly → go to 2. Cap: 5 iterations per phase; if still failing, stop and report exactly what and why.
  6. COMMIT – one commit per phase, imperative message, NO attribution trailers (§1.1).
```

Never claim a thing works that you did not run. If you could not run something (no network, missing secret), say so in the final report.

---

## 1. NON-NEGOTIABLES

1. **No AI attribution anywhere.** No `Co-Authored-By`, no "Generated with…", no "Claude"/"Anthropic"/"AI-generated" in commits, PR text, code comments, README, docs or the rendered site. `.claude/settings.json`, `AGENTS.md` and `.githooks/commit-msg` are already in the repo to enforce this: run `git config core.hooksPath .githooks` once. `verify.mjs` fails if the page text mentions them. After every commit run `git log -1 --format=%B`.
2. **Never invent content.** No made-up metrics, certifications, employers, skills, clients or outcomes. If data is missing: hide that section/field, or leave a marked `TODO(owner)` in admin-only UI. Never render plausible filler.
3. **Accessibility is a feature, not a phase.** WCAG 2.2 AA: text ≥ 4.5:1, targets ≥ 24 px, real `<label>`s, visible focus, skip link, Escape closes dialogs, `prefers-reduced-motion` honoured, canvas/decorative layers `aria-hidden`.
4. **Touch/mobile are first-class.** Everything cursor-driven must degrade gracefully on `pointer: coarse`. Nothing may cause horizontal scroll at 390 px.
5. **Strict TypeScript, no new `any`.** Remove existing `any` you touch.
6. **Secrets stay server-side** (`api/`). `VITE_*` is public by definition.
7. Do not delete anything not listed in §6 without saying why in the report.

---

## 2. REPO SNAPSHOT (facts, verified by reading the code)

- Stack: Vite 6, React 19, TS, Tailwind v4 (`@theme` in `src/index.css`), GSAP + ScrollTrigger + Lenis, Firebase (Firestore + Google auth for `/admin`), Vercel serverless in `api/`, Gemini chatbot.
- Entry: `src/App.tsx` (routes `/`, `/admin`, `*`) → `src/pages/Portfolio.tsx` → `src/designs/BoneBlood.tsx` (the whole page, 566 lines) + `src/designs/Sections.tsx` (Contact/Interests/Footer).
- Content: Firestore (`profiles/main`, `sections`) with static fallback in `src/data/content.ts`. Hook: `src/lib/usePortfolioContent.ts`.
- Palette in practice: `#0a0a0b` ink · `#efece4` bone · `#8b877d` dim · `#56534d` dimmer · `#c1121f` crimson (hard-coded ~80×). `index.css` `@theme` still defines an **unused amber/brass** system.
- Fonts: Fraunces (headings), JetBrains Mono (labels), Inter (loaded, apparently unused).
- Dead/legacy: `components/PinnedWork.tsx` (imported, never rendered), most of `components/ui.tsx`, `designs` ASCII `lib/AsciiFigure.tsx` (to be replaced), `api/visitor.ts`, `testFirebase.js`, `app/applet/`, `metadata.json`, `firebase-blueprint.json`, stale `README.md` (describes components that no longer exist).

### Defects already confirmed (fix all)
| # | Where | Defect |
|---|---|---|
| D1 | `Portfolio.tsx` | `sections.flatMap(s => s.items)` dumps **every** section type into "Selected work". Certificates/achievements would appear as projects. |
| D2 | `data/content.ts` + `Sections.tsx` | `github`/`linkedin` stored without `https://`; `href={github}` resolves relative to the site → 404 page. |
| D3 | `BoneBlood.tsx`, `Sections.tsx` | 3 × `mailto:` links open the OS default mail app, not Gmail. |
| D4 | `BoneBlood.tsx` | `FALLBACK_WORK`/`FALLBACK_STACK` contain **fabricated** claims ("2.1M events a day", "900ms to 40ms", Go, Redis). |
| D5 | `data/content.ts` | Project 2 copy describes a "WebGL starfield and a modelled gyro" that no longer exists. |
| D6 | `firestore.rules` | `messages` and `visitors`: `allow create: if true`, no validation → unbounded anonymous writes. `blocked_ips` public. `isAdmin()` ignores `email_verified`. Profile rule lacks `hasOnly`. Duplicate rules file in `app/applet/`. |
| D7 | `api/chat.ts` | In-memory rate limiter is per-instance (useless on Vercel) and grows unbounded; trusts `x-forwarded-for`; model id `gemini-3.5-flash` unverified; leftover `aistudio-build` UA; FACTS hard-coded and stale; stateless chat. |
| D8 | `usePortfolioContent.ts` | `getDocs` then `onSnapshot` on the same queries (double reads); unused imports. |
| D9 | `index.css`/all | Two palettes; `#56534d` text ≈ 2.6:1 contrast (own README forbids it). |
| D10 | `BoneBlood.tsx` | Section paddings all different, up to 16 rem; no shared grid; nav has no mobile variant, not sticky, no active state. |
| D11 | `AsciiFigure.tsx` | Fake SDF subject, Bayer-dither punctuation ramp, 4–12 px glyphs, glow on every glyph, hidden < 1024 px, no cursor interaction. |
| D12 | `package.json` | name `react-example`; `vite` duplicated; unused `express`, `dotenv`, `@types/express`, `react-force-graph-2d`, `d3-force`, `esbuild`, `autoprefixer`, likely `tsx`. |
| D13 | `Footer` | Shows literal text "static preview" to visitors; public `/admin` link; click-anywhere shockwave counter. |
| D14 | `index.html` | No `og:image`, `og:url`, canonical, JSON-LD, robots, sitemap. Render-blocking Google Fonts with full variable axes. |

---

## 3. INPUTS YOU NEED FROM THE OWNER (do not block on them; build with the feature hidden/empty, then list what is missing)

| Input | Used for | If missing |
|---|---|---|
| `public/portrait.jpg` (see §5.1 spec) | hero ASCII | render hero without portrait; keep wandering-light off; log a warning in dev |
| Certifications list (title, issuer, date, verify URL) | Credentials section | section does not render |
| Project details per project (tags, repo/live URL, problem/approach/outcome, cover image) | project index/detail | show title + description only |
| `public/resume.pdf` | Résumé link | link hidden |
| `CONTACT.cc` address (optional) | Gmail CC | omitted |
| Skill groups (confirm the proposed grouping in §5.5) | Skills | use proposed grouping from existing skills only |

---

## 4. ARCHITECTURE RULES — loops and hooks, not copy-paste

The old page repeats near-identical JSX per section. Replace that with **registries rendered by loops** and **behaviour in hooks**.

### 4.1 Registries (single source of truth)
Create `src/data/registry.ts`:

```ts
import type { Grouped } from "../lib/content";
import type { Profile } from "../types";

export type SectionDef = {
  id: string;                 // DOM id AND nav anchor
  label: string;              // nav label
  /** Section renders (and shows in nav) only when this returns true. Never render empty sections. */
  when: (c: { profile: Profile; content: Grouped }) => boolean;
};

export const SECTIONS: readonly SectionDef[] = [
  { id: "work",        label: "Work",        when: ({ content }) => content.projects.length > 0 },
  { id: "about",       label: "About",       when: () => true },
  { id: "skills",      label: "Skills",      when: ({ profile }) => (profile.skillGroups?.length ?? 0) > 0 || (profile.skills?.length ?? 0) > 0 },
  { id: "credentials", label: "Credentials", when: ({ content }) => content.certificates.length + content.achievements.length > 0 },
  { id: "contact",     label: "Contact",     when: () => true },
] as const;
```

`Portfolio.tsx`:
```ts
const content = useMemo(() => groupSections(sections), [sections]);       // fixes D1
const visible = useMemo(() => SECTIONS.filter(s => s.when({ profile, content })), [profile, content]);
const active  = useActiveSection(visible.map(s => s.id));
```
Pass `visible` to `<Nav>` (loop → links, `aria-current` on `active`) and render sections by looping `visible` through a `{ [id]: Component }` map. **No hand-written `<section id=…>` blocks in a row.**

### 4.2 Hooks (already written, in `src/hooks/` — embedded in §7)
| Hook | Purpose | Use it for |
|---|---|---|
| `useCursorVars()` | writes `--mx --my --mxn --myn` on `<html>` | page bloom, hero name highlight, cursor ring |
| `useSpotlight()` | per-element `--lx/--ly` | project rows, skill groups, cert cards, nav CTA |
| `useMagnetic(strength, range)` | magnetic pull | primary CTA, Gmail button |
| `useActiveSection(ids)` | IntersectionObserver over `ids` | nav active state, progress label |
| `useProjectFilter(projects)` | derives tag chips by looping data | project index filter |
| `useCopy()` | clipboard + `copied` flag | "Copy address" |
| (existing) `useReducedMotion`, `useFinePointer`, `useMediaQuery` | | gate every motion feature |

Write any additional behaviour as a hook too (e.g. `useHoverPreview`, `useScrollLock`, `useDialog` with focus trap + Escape). Components stay presentational.

### 4.3 Loop-driven UI everywhere
Nav links, skill groups + chips, project rows, filter chips, certificate cards, social links, footer links, JSON-LD, and the verify script's section list are all produced by **looping over data**. Adding a project/skill/cert in admin must require **zero code changes**.

### 4.4 Content flow
`usePortfolioContent` → `{ profile, sections, live }` → `groupSections()` → registries → components. Replace `getDocs`+`onSnapshot` with **`onSnapshot` only** (D8). Normalise profile links with `ensureUrl()` at the boundary (D2) so components never see scheme-less URLs.

---

## 5. WORK ITEMS

### 5.1 Hero + ASCII portrait (D11)
Already built and tested in headless Chromium: `src/lib/asciiPortrait.ts` (+ wrapper `src/components/AsciiPortrait.tsx`). **Do not rewrite it; wire it in and tune it.**

What it does: photo → cell grid (1:1.75 cells, DPR-aware) → luminance → glyph chosen from 6 tone **bands** by hash (random alphanumeric texture like the owner's reference) → drawn from a pre-rendered **glyph atlas** (`drawImage`, no `fillText`, no `<pre>`, no text-shadow). Pointer is a **light**: glyphs in radius brighten, scramble every 80 ms, get pushed outward, turn crimson where the photo is bright; grid parallaxes/shears toward the pointer; click ripples; with no pointer (touch/idle >2.6 s/left window) a light **wanders on its own**; reduced-motion = one static frame; pauses when off-screen/hidden.

Wire-up in `BoneBlood.tsx` (split it up — see §5.2):
1. Delete `<AsciiFigure/>` and its `hidden lg:flex` grid column; delete `src/lib/AsciiFigure.tsx`.
2. Hero = one `relative min-h-[100svh] overflow-hidden` container; portrait is `absolute inset-0` **behind** the text; text column `relative z-10`:
   ```tsx
   <header className="relative min-h-[100svh] overflow-hidden px-[var(--gutter)]">
     <div ref={figWrap} data-figure className="absolute inset-0">
       <AsciiPortrait src="/portrait.jpg" focusX={isMobile ? 0.5 : 0.68}
                      fadeLeft={isMobile ? [0, 0] : [0.3, 0.52]} />
     </div>
     {isMobile && <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/30 to-ink" />}
     <div className="relative z-10 …">{/* name, subtitle, one-line bio, CTAs */}</div>
   </header>
   ```
3. Keep the GSAP scroll fade on `figWrap` (it's a plain div; still works).
4. `useCursorVars()` once in `Portfolio.tsx`. Replace the static crimson bloom with a fixed `pointer-events-none` layer:
   `radial-gradient(ellipse 40% 40% at calc(var(--mxn,.7)*100%) calc(var(--myn,.25)*100%), rgba(193,18,31,.18), transparent 70%)`.
5. Hero name: bone→crimson highlight following the pointer (`background-clip:text` + radial gradient from `--mx/--my`); static bone for reduced-motion/touch.
6. CTA ("See the work", "Open in Gmail") use `useMagnetic`.
7. Optional 12 px cursor ring (`mix-blend-mode: difference`, lerp 0.18), `pointer: fine` only, never replacing the native cursor on inputs/links.
8. Replace the shockwave ring + ⚡ counter in `EasterEggs.tsx` (D13): click ripple now lives in the ASCII. Keep Konami + `` ` `` palette; delete the dead Alt-click monogram egg.

**The photo decides the result.** Spec for `public/portrait.jpg` (tell the owner; do not fake one): **pure-black background, subject lit from one side, head-and-shoulders, centred, ~1200–1600 px tall, ≤ 300 KB, high contrast, slight blur to kill noise.** Do **not** use the Adobe-Stock-watermarked face image the owner showed you. Generator prompt if he has no photo: *"low-key studio portrait, hooded figure, head and shoulders, single strong side light from upper left, deep shadows, pure black background, high contrast, centred, no text"*. For a Courier-like glyph look add *Courier Prime* and pass `fontFamily`. Tuning knobs: `blackPoint` (raise if background shows dust), `restGain`, `radius`, `cellWidth`, `heightFit`, `focusX`.

Done when: face/hood readable at rest at 1440×900 **and** 390×844; moving the mouse visibly lights/scrambles nearby glyphs; no dropped-frame spikes in a 10 s DevTools trace; reduced-motion shows a still frame; hero text AA-legible over it.

### 5.2 Design system, layout, spacing, nav (D9, D10)
1. **Tokens** — in `index.css` `@theme`, delete brass/amber, add:
   ```css
   @theme {
     --color-ink: #0a0a0b;  --color-ink-2: #111113;
     --color-bone: #efece4; --color-dim: #a39f94; /* ≥ 7:1 on ink */  --color-mute: #8b877d; /* ≥ 5.5:1 */
     --color-blood: #c1121f; --color-blood-hi: #e0222f; --color-line: rgb(239 236 228 / 0.12);
     --spacing-gutter: clamp(1.25rem, 4vw, 5rem);
     --spacing-section: clamp(5rem, 11vh, 8.5rem);
   }
   ```
   Replace **every** hex literal in `BoneBlood.tsx`/`Sections.tsx`/`App.tsx`/`Admin.tsx`/`Chatbot.tsx` with tokens. Nothing below `--color-mute` may be used for text. Add a lint-ish check: `grep -rnE "#(56534d|8b877d|efece4|c1121f|0a0a0b)" src` must return nothing outside `index.css`.
2. **One spacing rule**: every `<section>` uses `py-[var(--spacing-section)]`; no section invents its own padding.
3. **One grid**: `.page-grid` = 12 columns, `max-w-[1600px] mx-auto px-[var(--spacing-gutter)]`; label in cols 1–3 (mono, blood), content cols 4–12; collapses to 1 column < 1024 px. Every section uses it → consistent left edge.
4. **Spotlight utility** (`index.css`) used by every interactive block:
   ```css
   .spot { position: relative; isolation: isolate; }
   .spot::before {
     content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0;
     background: radial-gradient(240px circle at var(--lx,50%) var(--ly,50%), rgb(193 18 31 / .16), transparent 70%);
     transition: opacity .3s;
   }
   .spot[data-lit]::before { opacity: 1; }
   @media (pointer: coarse), (prefers-reduced-motion: reduce) { .spot::before { display: none; } }
   ```
5. **Nav** (new `components/Nav.tsx`, loops `visible` sections): sticky, blurred ink background after 40 px scroll, active link from `useActiveSection` (`aria-current="location"`), underline grows from left; CTA = "Get in touch" (Gmail, §5.7). **Mobile < 768 px**: wordmark + menu button opening an accessible full-screen dialog (focus trap, Escape, scroll-lock, restores focus, links loop over the same `visible` array). Skip link stays first tab stop.
6. **Typography scale** — define 6 steps (`display`, `h2`, `h3`, `lead`, `body`, `label`) as CSS vars with `clamp()`; stop inlining `text-[clamp(...)]` per element. Hero name may stay huge but must not push content below the fold at 1440×900: bio + CTAs visible without scrolling.
7. **Fonts**: self-host with `@fontsource-variable/fraunces` (limit axes; `wght` 300–600, `opsz`) and `@fontsource/jetbrains-mono` (400/500); drop Inter if unused; preload the above-the-fold face; remove the Google Fonts `<link>`s. Call `ScrollTrigger.refresh()` on `document.fonts.ready` in addition to the 400 ms timeout.
8. **Split `BoneBlood.tsx`** into `components/hero/*`, `components/sections/{Work,About,Skills,Credentials,Contact}.tsx`, `components/Nav.tsx`, `components/Footer.tsx`. Target: no file > 250 lines. Move GSAP reveals into a `useReveal(scopeRef)` hook that loops `[data-reveal]`, `[data-work-row]` (keep the `fromTo` + `toggleActions` pattern and its comment about stale `from()` values — it was learned the hard way).
9. Rework 404 and Admin to the new tokens.

Done when: no hard-coded palette hex outside `index.css`; consistent section rhythm (screenshot full page at 1440 and check); no horizontal scroll at 390; nav works with keyboard + on mobile; contrast ≥ 4.5:1 everywhere (run axe via Playwright `@axe-core/playwright` — add to `scripts/verify.mjs` if not present).

### 5.3 Projects — index + live preview + detail (D4, D5)
Replace the 4-column text rows. `components/sections/Work.tsx`:
- **Data**: `content.projects` (typed `SectionItem`, extended fields already in `src/types.ts`: `slug, tags, featured, repoUrl, liveUrl, role, status, problem, approach, outcome, gallery, imageUrl`). Slug fallback = `slugify(title)`.
- **Desktop ≥ 1024 px**: two columns. Left: numbered list (loop) — title, year, up to 2 tags; `useSpotlight` on each row; hover **and keyboard focus** set the active index. Right: **sticky** preview panel that cross-fades to the active project: cover image (or CSS pattern if none), one-line summary, stack chips, `Live ↗` / `Code ↗` (`ensureUrl`, `target=_blank rel="noopener noreferrer"`). Enter/click on a row → detail view.
- **Mobile**: stacked cards, cover on top, same data; no hover dependence.
- **Filter chips** from `useProjectFilter` (`All · <tags…>`), rendered only when `showFilter`. Chips are `<button aria-pressed>`; list change is announced via an `aria-live="polite"` region ("3 projects").
- **Detail view**: add route `/work/:slug` in `App.tsx` (lazy + `Suspense` + an error boundary; `vercel.json` rewrite already serves SPA routes). Sections **Problem · Approach · Stack · Outcome · Links** + gallery; prev/next project links; `document.title` + `<meta>` updated; back link restores scroll position. Fields not supplied are **omitted** (no placeholder text). `outcome` only ever contains owner-supplied facts.
- Feature-flag the featured project first: the **Identity Document Screening System** (offline-first, tamper-evident hash chain) is the strongest; set `featured: true` in the fallback data.
- Fix D4/D5: delete `FALLBACK_WORK`, `FALLBACK_STACK`; rewrite project 2's description to match reality (a scroll-driven portfolio with a cursor-reactive ASCII hero; GSAP + Lenis; Firebase-backed admin). Delete `PinnedWork.tsx`.

Done when: adding a tag in admin creates a filter chip with no code change; keyboard-only user can browse, filter, open a detail page and return; preview never shows stale content; empty optional fields leave no gaps.

### 5.4 Credentials (new)
`components/sections/Credentials.tsx`, from `content.certificates` (+ `content.achievements` as a second list, no issuer line). Card: **title · issuer · date · "Verify ↗" (`credentialUrl`)**, optional badge image (`imageUrl`, alt = `${issuer} ${title} badge`), `useSpotlight`. Grid on desktop, list on mobile, newest first (done in `groupSections`). **Section renders only if items exist** (registry `when`). Add `id="credentials"`. No placeholders.

### 5.5 Skills (new; replaces the drifting "Stack" marquee)
`components/sections/Skills.tsx`. Data: `profile.skillGroups` (loop groups → loop chips). If absent, derive from flat `profile.skills` using this default grouping (only skills that actually exist in his list; empty groups are dropped):
```ts
export const DEFAULT_SKILL_GROUPS = [
  { id: "lang",  label: "Languages",        match: ["TypeScript","Python","C++","JavaScript"] },
  { id: "front", label: "Frontend",         match: ["React","Tailwind CSS","Vite","GSAP"] },
  { id: "back",  label: "Backend & Data",   match: ["Node.js","Firebase","PostgreSQL","Firestore"] },
  { id: "infra", label: "Infra & Tooling",  match: ["Docker","Git","Linux","CI"] },
];
// unmatched skills → a final "Other" group
```
Layout: `.page-grid`, group label left (mono), chips right, chips lit by `useSpotlight`. **No progress bars, no percentages.** Optional "Currently learning" row only if supplied. Rename nav "Stack" → "Skills", id `skills`; update the chatbot facts and any `#stack` links.

### 5.6 About / interests
Keep content; move to `.page-grid`; the "What I work on" interests list uses the same loop+spotlight card. Remove the hard-coded "Focus: Frontend architecture, backend reliability, security" from JSX → put it in profile data (`focus?: string`) with that text as the fallback.

### 5.7 Contact + email (D2, D3) — remove the form
1. **Delete the form** (the Name/Email/"What are you building?"/Send block) from `Sections.tsx`. Delete `submitContact`, `ContactPayload` and now-unused imports from `usePortfolioContent.ts`. Delete the Messages and Visitors/blocked-IP panels from `Admin.tsx`. Delete `api/visitor.ts` and `testFirebase.js`.
2. Contact block = headline "Have something worth building?" + three actions in a loop over a `CONTACT_ACTIONS` array:
   - **Open in Gmail** (primary, `useMagnetic`) → `<a href={mailtoUrl()} onClick={openMail}>`
   - **Other mail app** → plain `mailto:`
   - **Copy address** → `useCopy`; button text switches to "Copied ✓"; an `aria-live="polite"` span announces it.
   Plus GitHub, LinkedIn (via `ensureUrl`), and **Résumé ↗** if `profile.resumeUrl`/`public/resume.pdf` exists.
3. Use `openMail` on **all** email links (nav CTA, the big headline link, the address text). Source of truth is `src/lib/mail.ts` (embedded in §7): Gmail compose URL on desktop (`to`, `cc`, `su`, `body`), native `mailto:` on touch, `mailto:` kept as `href` so it works without JS.
4. Owner said "with me in the cc". A visitor emails *him*, so he can't usefully be CC'd on his own inbox; implemented as `CONTACT.cc` (optional second address). Leave `""` unless the owner supplies one, and mention this in the final report.
5. Normalise every profile link with `ensureUrl()` where the profile is read (D2).
6. Footer: remove "static preview", remove the public `/admin` link (route stays, add `noindex`), keep `` ` `` hint if the palette stays.

Done when: all three email links open a pre-filled Gmail compose tab on desktop and the system mail app on a phone; GitHub/LinkedIn open the real sites; `verify.mjs` reports no scheme-less or unsafe `_blank` links.

### 5.8 Admin
- Type every state (`useState<Message[]>`-style `any` removed); delete Messages/Visitors panels.
- Add editors for the new fields: project (`slug, tags, featured, repoUrl, liveUrl, role, status, problem, approach, outcome, gallery`), certificates (`issuer, credentialId, credentialUrl, expires, date`), profile (`skillGroups` add/rename/reorder/remove chips, `resumeUrl`, `focus`).
- Normalise URLs on save (`ensureUrl`); validate (title required, URLs well-formed) with inline errors; optimistic UI with rollback on rule denial; unsaved-changes warning.
- Rework to the new tokens; `<meta name="robots" content="noindex">` on this route.

### 5.9 Backend & security (D6, D7, D8)
**Firestore rules** — replace `firestore.rules` with (and delete `app/applet/firestore.rules`):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
          && request.auth.token.email_verified == true
          && request.auth.token.email == 'dikhyantsatpathy@gmail.com';
    }
    function isValidId(id) { return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$'); }
    function incoming() { return request.resource.data; }
    function existing() { return resource.data; }

    function isValidProfile(d) {
      return d.keys().hasOnly(['name','subtitle','bio','skills','skillGroups','interests','email','github',
                               'linkedin','twitter','location','educationInfo','institution','focus','resumeUrl',
                               'ownerId','updatedAt'])
          && d.keys().hasAll(['name','ownerId','updatedAt'])
          && d.name is string && d.name.size() <= 100
          && (!('bio' in d) || (d.bio is string && d.bio.size() <= 2000))
          && (!('skills' in d) || (d.skills is list && d.skills.size() <= 100))
          && (!('skillGroups' in d) || (d.skillGroups is list && d.skillGroups.size() <= 20))
          && d.ownerId is string && d.ownerId == request.auth.uid;
    }
    function isValidSection(d) {
      return d.keys().hasOnly(['title','type','items','order','visible','updatedAt','ownerId'])
          && d.title is string && d.title.size() <= 100
          && d.type in ['projects','achievements','certificates','custom']
          && d.items is list && d.items.size() <= 100
          && d.order is number && d.visible is bool
          && d.ownerId is string && d.ownerId == request.auth.uid;
    }

    match /profiles/{profileId} {
      allow read: if true;
      allow create: if isAdmin() && isValidId(profileId) && isValidProfile(incoming()) && incoming().updatedAt == request.time;
      allow update: if isAdmin() && isValidId(profileId) && isValidProfile(incoming()) && incoming().updatedAt == request.time
                    && incoming().ownerId == existing().ownerId;
      allow delete: if isAdmin() && isValidId(profileId);
    }
    match /sections/{sectionId} {
      allow get, list: if resource.data.visible == true || isAdmin();
      allow create: if isAdmin() && isValidId(sectionId) && isValidSection(incoming()) && incoming().updatedAt == request.time;
      allow update: if isAdmin() && isValidId(sectionId) && isValidSection(incoming()) && incoming().updatedAt == request.time
                    && incoming().ownerId == existing().ownerId;
      allow delete: if isAdmin();
    }
    // Everything else — including the removed messages/visitors/blocked_ips — is denied by default.
  }
}
```
- Add **emulator rule tests** (`@firebase/rules-unit-testing`, vitest): anon reads profiles + visible sections ✔; anon reads hidden section ✘; anon writes anything ✘; signed-in non-admin writes ✘; admin with `email_verified:false` ✘; admin valid write ✔; admin write with unknown field ✘. Add `npm run test:rules`.
- Deploy note for the owner: `firebase deploy --only firestore:rules`.
- Firebase config: keep `VITE_FIREBASE_*` path; warn in README that `firebase-applet-config.json` points at an AI-Studio project; recommend HTTP-referrer key restriction + App Check + billing alerts. **onSnapshot only** in `usePortfolioContent` (D8).

**`api/chat.ts`** (D7):
- Rate limit: remove the module-level `Map`. Use `@upstash/ratelimit` + `@upstash/redis` keyed on `req.headers["x-real-ip"]` (sliding window 5/min and 40/day) **if** `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set; otherwise fail closed with 503 in production (and document the Vercel Firewall rate-limit rule as the alternative).
- Take the **first** entry of `x-forwarded-for` only as a fallback; never trust it for limiting when `x-real-ip` exists.
- **Verify the Gemini model id against current Gemini docs before keeping `gemini-3.5-flash`.** If you cannot verify, read it from `GEMINI_MODEL` env with a documented default and say so in the report.
- Remove the `aistudio-build` User-Agent header.
- **Ground it in live content**: build `FACTS` at request time from the same data the site shows (profile + projects + skills + certs), via the Firestore REST API with the public config, cached in module scope for 5 minutes, falling back to `src/data/content.ts`. Keep the "answer only from FACTS, otherwise reply with the email fallback" instruction.
- Accept `history: {role, text}[]` (last 6 turns, each ≤ 1000 chars) from the client; validate shape and sizes; cap total body.
- `GEMINI_API_KEY` missing → 503 with a clear message; all errors logged server-side, generic to the client; add `Cache-Control: no-store`.
- `Chatbot.tsx`: send history; guard `data.text` (never render `undefined`); show a human message on 429; move bubble so it doesn't cover footer/CTAs on mobile; `aria-live` for new replies; focus management on open/close; Escape closes.
- Delete `api/visitor.ts`; keep `api/health.ts`.

### 5.10 SEO, performance, hygiene (D12, D14)
- `index.html`: `og:url`, `og:image` (1200×630 — use a screenshot of the new hero), `twitter:image`, canonical, `Person` JSON-LD (built from the fallback profile at build time or inlined), `robots.txt`, `sitemap.xml` (`/` and each `/work/:slug`).
- Perf budgets: main JS ≤ 200 kB gzip, LCP < 2.5 s, CLS < 0.05, INP < 200 ms (Lighthouse CI in the workflow; fail the job on regression). Keep Firebase dynamic-imported; lazy-load `/admin` and `/work/:slug`.
- `package.json`: rename (`dikhyant-portfolio`), dedupe `vite`, run `npx depcheck` and remove unused deps (D12), add scripts `test`, `test:rules`, `verify`. Delete `metadata.json`, `firebase-blueprint.json` (confirm unused), `app/`, `testFirebase.js`, dead `ui.tsx` exports.
- Error boundary at the route level with a friendly fallback; `Suspense` fallbacks use the new tokens.
- `README.md`: rewrite to describe the **actual** system (it currently documents a WebGL-free 3-D walker and a DS monogram that no longer exist). Include setup, env vars, content model, how to add a project/skill/cert, deploy, verify loop, rules deploy.

### 5.11 Tests, CI
- **Vitest** unit tests: `ensureUrl`, `groupSections` (hidden sections dropped, order, featured-first, certs newest-first, certificates never in projects), `gmailUrl`/`mailtoUrl` (shape, `%20` not `+`, `cc` only when set), `useProjectFilter` (tags derived, `showFilter`), `slugify`. (All of these cases already pass as a quick Node check; port them.)
- **Playwright e2e** (`e2e/`): hero renders canvas; moving the mouse changes canvas pixels; nav anchors scroll and set `aria-current`; mobile menu opens/closes with Escape; filter chips filter; detail route loads and back works; Gmail link opens `mail.google.com/mail/?view=cm…` with `to`/`su` (intercept `window.open`); reduced-motion emulation yields no rAF loop.
- `.github/workflows/ci.yml`: `npm ci` → `npm run lint` → `npm test` → `npm run build` → rules tests (emulator) → Playwright → Lighthouse CI. Enable Dependabot. Cache npm.

---

## 6. PHASES (one commit each; run the §0 loop)

| Phase | Contents | Exit criteria |
|---|---|---|
| **A. Safety & cleanup** | `git config core.hooksPath .githooks`; §5.9 rules + tests; §5.7.1 deletions; §5.10 dep/file cleanup | build green; rules tests green; `git log` clean of attribution |
| **B. Correctness** | D1 `groupSections`; D2 `ensureUrl`; D3 `mail.ts` on all links; D4/D5 content fixes; D8 `onSnapshot` | unit tests green; `verify.mjs` link checks green |
| **C. Design system** | §5.2 tokens, grid, spacing, type scale, fonts, `Nav` (+mobile dialog, active), split `BoneBlood.tsx` into registry-driven sections | no hex outside `index.css`; no overflow @390; axe clean |
| **D. Hero & cursor** | §5.1 portrait + cursor system + easter-egg cleanup | hero criteria in §5.1 |
| **E. Content sections** | §5.3 projects, §5.4 credentials, §5.5 skills, §5.6 about, §5.7 contact | criteria in each item; sections hide when empty |
| **F. Admin** | §5.8 | create/edit each new field end-to-end against the emulator |
| **G. Backend** | §5.9 chat hardening + grounding + `Chatbot.tsx` | chat answers from live facts; 429 handled; no secrets client-side |
| **H. SEO/perf/docs/CI** | §5.10, §5.11 | Lighthouse budgets met; CI green; README accurate |

---

## 7. FILES ALREADY IN THE REPO (written and verified — use them, don't reinvent)

Verification status: `asciiPortrait.ts` type-checked `--strict` **and** run in headless Chromium (rest / cursor / click screenshots, no errors, ~45 fps on software rendering). `mail.ts` and `content.ts` type-checked and unit-checked (10 assertions). Hooks type-checked `--strict` against the React API surface they use; **not yet exercised in a running React tree — your phase loop does that**. `scripts/verify.mjs` was run against a test page and correctly flagged overflow.


### `src/lib/asciiPortrait.ts`

```ts
/**
 * asciiPortrait — framework-free cursor-reactive ASCII portrait renderer.
 *
 * Input:  a high-contrast photo (subject lit on a near-black background).
 * Output: a <canvas> of glyphs whose *tone* comes from the photo's luminance and
 *         whose *behaviour* revolves around the pointer:
 *           - the pointer is a light: glyphs within its radius brighten, scramble
 *             and get pushed outward; the dark background glyphs reveal under it
 *           - the whole figure parallaxes / shears slightly toward the pointer
 *           - clicks send a ripple through the grid
 *           - with no pointer (touch, idle, left window) a light wanders on its own
 *
 * Why this looks better than the old raymarcher:
 *   1. Tone comes from a real photo, not an SDF built from ellipsoids.
 *   2. Glyph weight AND alpha both track luminance, so shadows are dim, not empty.
 *   3. Glyphs are chosen from per-tone bands by hash, so you get the "random
 *      alphanumeric" texture of the reference rather than a stippled ramp.
 *   4. Drawn from a pre-rendered glyph atlas with drawImage: no fillText per cell,
 *      no giant <pre> text node re-laid-out every frame, no per-glyph text-shadow.
 */

export type AsciiPortraitOptions = {
  /** URL of the source photo (same-origin, e.g. "/portrait.jpg"). */
  src: string;
  /** Horizontal centre of the subject inside the box, 0..1. */
  focusX?: number;
  /** Subject height as a fraction of box height. Bottom-aligned. */
  heightFit?: number;
  /** Column width in CSS px. Default: box width / 190, clamped to 6..9. */
  cellWidth?: number;
  /** Light radius in CSS px. */
  radius?: number;
  color?: string;
  /** Colour glyphs turn near the light where the photo is bright. */
  accent?: string;
  fontFamily?: string;
  /** 0..1 fade zone on the left so overlaid text stays readable: [from, to]. */
  fadeLeft?: [number, number];
  /** Brightness of the figure at rest (no light on it). */
  restGain?: number;
  /** Luminance below this is treated as pure black (kills JPEG haze / grey backdrops). 0..1 */
  blackPoint?: number;
};

const BANDS = [
  ".,'`:",
  "-_~;!i1",
  "ltfjr7+<>=Il",
  "cxnuvzoes23",
  "aVYUOQ0ZwmhkbdpqgRK",
  "B8&@#%WMRKgq$",
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const hash = (n: number) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
};

export function createAsciiPortrait(wrap: HTMLElement, opts: AsciiPortraitOptions) {
  const {
    src,
    focusX = 0.66,
    heightFit = 0.98,
    cellWidth,
    radius = 230,
    color = "#efece4",
    accent = "#c1121f",
    fontFamily = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    fadeLeft = [0.3, 0.52],
    restGain = 0.72,
    blackPoint = 0.07,
  } = opts;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.2s ease;";
  wrap.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => canvas.remove();

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;

  let disposed = false;
  let raf = 0;
  let visible = true;

  let dpr = 1, W = 0, H = 0, cw = 0, ch = 0, cols = 0, rows = 0;
  let lum = new Float32Array(0);
  let mask = new Float32Array(0);
  let seed = new Uint32Array(0);
  let bandIdx: number[][] = [];
  let atlasBone: HTMLCanvasElement | null = null;
  let atlasHot: HTMLCanvasElement | null = null;
  let rect = wrap.getBoundingClientRect();

  const ptr = { x: 0, y: 0, tx: 0, ty: 0, active: false, last: 0 };
  const ripples: { x: number; y: number; t: number }[] = [];
  const img = new Image();
  img.decoding = "async";
  let ready = false;

  function buildAtlas() {
    const chars = Array.from(new Set(BANDS.join("")));
    bandIdx = BANDS.map((b) => Array.from(b).map((c) => chars.indexOf(c)));
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = `500 100px ${fontFamily}`;
    const unit = probe.measureText("M").width / 100 || 0.6;
    const fs = cw / unit;
    const make = (fill: string) => {
      const a = document.createElement("canvas");
      a.width = cw * chars.length;
      a.height = ch;
      const c = a.getContext("2d")!;
      c.font = `500 ${fs}px ${fontFamily}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = fill;
      chars.forEach((g, i) => c.fillText(g, i * cw + cw / 2, ch / 2));
      return a;
    };
    atlasBone = make(color);
    atlasHot = make(accent);
  }

  function buildGrid() {
    rect = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width * dpr));
    H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W;
    canvas.height = H;

    const css = cellWidth ?? Math.min(9, Math.max(6, rect.width / 190));
    cw = Math.max(4, Math.round(css * dpr));
    ch = Math.round(cw * 1.75);
    cols = Math.ceil(W / cw);
    rows = Math.ceil(H / ch);
    buildAtlas();

    // Resample the photo into cell space. Drawing at cols x rows with the
    // destination rect expressed in cells means each cell averages the pixels
    // under it, and the non-square cell aspect is handled by the scaling.
    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const oc = off.getContext("2d", { willReadFrequently: true })!;
    oc.fillStyle = "#000";
    oc.fillRect(0, 0, cols, rows);
    const ih = H * heightFit;
    const iw = ih * (img.naturalWidth / img.naturalHeight);
    oc.imageSmoothingQuality = "high";
    oc.drawImage(img, (W * focusX - iw / 2) / cw, (H - ih) / ch, iw / cw, ih / ch);
    const d = oc.getImageData(0, 0, cols, rows).data;

    lum = new Float32Array(cols * rows);
    mask = new Float32Array(cols * rows);
    seed = new Uint32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const ny = (r + 0.5) / rows;
      const fadeBottom = 1 - 0.7 * smooth(0.8, 1, ny);
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const o = i * 4;
        let l = (0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]) / 255;
        l = l <= blackPoint ? 0 : Math.pow((l - blackPoint) / (1 - blackPoint), 0.85);
        lum[i] = l;
        seed[i] = hash(i + 1);
        mask[i] = smooth(fadeLeft[0], fadeLeft[1], (c + 0.5) / cols) * fadeBottom;
      }
    }
    ptr.x = ptr.tx = W * focusX;
    ptr.y = ptr.ty = H * 0.4;
  }

  function frame(now: number) {
    raf = 0;
    if (disposed || !ready) return;
    if (!visible || document.hidden) return; // resumes from the observer / visibilitychange

    if (!reduced) {
      const idle = !ptr.active || coarse || now - ptr.last > 2600;
      if (idle) {
        const t = now / 1000;
        ptr.tx = W * (focusX + 0.16 * Math.sin(t * 0.45));
        ptr.ty = H * (0.4 + 0.14 * Math.sin(t * 0.31 + 1.3));
      }
      ptr.x += (ptr.tx - ptr.x) * 0.14;
      ptr.y += (ptr.ty - ptr.y) * 0.14;
    }

    ctx!.clearRect(0, 0, W, H);
    const R = radius * dpr;
    const sig2 = (R * 0.5) * (R * 0.5);
    const cut2 = R * 1.5 * (R * 1.5);
    const nx = ptr.x / W;
    const parX = (nx - focusX) * -10 * dpr;
    const parY = (ptr.y / H - 0.4) * -6 * dpr;
    const tick = Math.floor(now / 80);

    for (let k = ripples.length - 1; k >= 0; k--) if (now - ripples[k].t > 1400) ripples.splice(k, 1);

    for (let r = 0; r < rows; r++) {
      const shear = (r / rows - 0.4) * (nx - 0.5) * -16 * dpr;
      const cy = r * ch + ch / 2;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const m = mask[i];
        if (m <= 0.001) continue;
        const base = lum[i];
        const cx = c * cw + cw / 2;
        const dx = cx - ptr.x, dy = cy - ptr.y;
        const d2 = dx * dx + dy * dy;
        let infl = 0, ox = 0, oy = 0, rip = 0;
        if (d2 < cut2) {
          infl = Math.exp(-d2 / (2 * sig2));
          const dist = Math.sqrt(d2) || 1;
          const push = infl * 9 * dpr;
          ox += (dx / dist) * push;
          oy += (dy / dist) * push;
        }
        for (let k = 0; k < ripples.length; k++) {
          const rp = ripples[k];
          const age = (now - rp.t) / 1000;
          const rdx = cx - rp.x, rdy = cy - rp.y;
          const rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          const wdt = 110 * dpr;
          const off = Math.abs(rd - age * 900 * dpr);
          if (off < wdt) {
            const q = (1 - off / wdt) * (1 - age / 1.4);
            rip += q;
            ox += (rdx / rd) * q * 12 * dpr;
            oy += (rdy / rd) * q * 12 * dpr;
          }
        }
        let b = (base * restGain + infl * (0.22 + base * 0.8) + rip * (0.2 + base * 0.5)) * m;
        if (b < 0.035) continue;
        if (b > 1) b = 1;

        const band = Math.min(5, (b * 6) | 0);
        const arr = bandIdx[band];
        const s = infl > 0.35 ? (seed[i] + tick * 40503) >>> 0 : seed[i];
        const g = arr[s % arr.length];
        const hot = infl * base > 0.3 || rip * base > 0.25;

        ctx!.globalAlpha = 0.16 + 0.84 * Math.min(1, b * 1.15);
        ctx!.drawImage(
          hot ? atlasHot! : atlasBone!,
          g * cw, 0, cw, ch,
          (c * cw + parX + shear + ox) | 0, (r * ch + parY + oy) | 0, cw, ch
        );
      }
    }
    ctx!.globalAlpha = 1;
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  const kick = () => {
    if (!raf && ready && !disposed) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return; // touch uses the wandering light
    ptr.tx = (e.clientX - rect.left) * dpr;
    ptr.ty = (e.clientY - rect.top) * dpr;
    ptr.active = true;
    ptr.last = performance.now();
  };
  const onLeave = () => { ptr.active = false; };
  const onDown = (e: PointerEvent) => {
    ripples.push({ x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr, t: performance.now() });
    if (ripples.length > 3) ripples.shift();
  };
  const onScroll = () => { rect = wrap.getBoundingClientRect(); };
  const onVis = () => { if (!document.hidden) kick(); };

  let resizeT = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => {
      if (!ready || disposed) return;
      buildGrid();
      if (reduced) frame(performance.now());
    }, 120);
  });
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  });

  img.onload = async () => {
    if (disposed) return;
    try { await document.fonts.load(`500 16px ${fontFamily}`); } catch { /* fall back to whatever resolved */ }
    if (disposed) return;
    buildGrid();
    ready = true;
    canvas.style.opacity = "1";
    ro.observe(wrap);
    io.observe(wrap);
    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVis);
      kick();
    } else {
      frame(performance.now());
    }
  };
  img.onerror = () => { /* no photo, no portrait: leave the hero clean */ };
  img.src = src;

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(resizeT);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("scroll", onScroll);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("visibilitychange", onVis);
    canvas.remove();
  };
}
```

### `src/components/AsciiPortrait.tsx`

```tsx
import { useEffect, useRef } from "react";
import { createAsciiPortrait, type AsciiPortraitOptions } from "../lib/asciiPortrait";

/**
 * Thin React wrapper. All the logic lives in lib/asciiPortrait.ts so it can be
 * tested without React. The wrapper must sit in a `position: relative` parent
 * (the hero); it fills it and never intercepts pointer events.
 */
export function AsciiPortrait(props: AsciiPortraitOptions & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { className, ...opts } = props;
  // Re-create only when the inputs that change the picture change.
  const key = [opts.src, opts.focusX, opts.heightFit, opts.cellWidth, opts.radius, opts.color, opts.accent].join("|");

  useEffect(() => {
    if (!ref.current) return;
    return createAsciiPortrait(ref.current, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} />;
}
```

### `src/hooks/useCursorVars.ts`

```ts
import { useEffect } from "react";

/**
 * Publishes the pointer as CSS variables on <html> so any element can react to
 * it with plain CSS — no per-component listeners:
 *   --mx / --my     pointer in px (viewport)
 *   --mxn / --myn   pointer 0..1 (viewport)
 * Does nothing for touch or reduced-motion users.
 *
 * Per-element spotlight (cards, rows): on that element's own pointermove, set
 * --lx/--ly to the pointer position relative to the element, then use
 *   background: radial-gradient(240px circle at var(--lx) var(--ly), rgba(193,18,31,.18), transparent 70%)
 */
export function useCursorVars() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    let raf = 0, x = 0, y = 0;
    const flush = () => {
      raf = 0;
      root.style.setProperty("--mx", `${x}px`);
      root.style.setProperty("--my", `${y}px`);
      root.style.setProperty("--mxn", (x / innerWidth).toFixed(4));
      root.style.setProperty("--myn", (y / innerHeight).toFixed(4));
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => { removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);
}
```

### `src/hooks/useSpotlight.ts`

```ts
import { useCallback } from "react";

/**
 * Per-element cursor spotlight. Spread the result on any card/row:
 *   const spot = useSpotlight();  <li className="spot" {...spot}>
 * It writes --lx/--ly (pointer relative to the element); the `.spot` CSS class
 * in index.css paints the radial highlight. Mouse only — touch/pen are ignored.
 */
export function useSpotlight() {
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${e.clientX - r.left}px`);
    el.style.setProperty("--ly", `${e.clientY - r.top}px`);
    el.dataset.lit = "1";
  }, []);
  const onPointerLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    delete e.currentTarget.dataset.lit;
  }, []);
  return { onPointerMove, onPointerLeave };
}
```

### `src/hooks/useMagnetic.ts`

```ts
import { useEffect, useRef } from "react";

/**
 * Magnetic pull: the element drifts up to `strength` px toward the pointer when
 * the pointer is within `range` px of its centre. Mouse + motion-OK only.
 *   const ref = useMagnetic<HTMLAnchorElement>();  <a ref={ref}>…
 */
export function useMagnetic<T extends HTMLElement>(strength = 8, range = 90) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      const k = d < range + Math.max(r.width, r.height) / 2 ? strength / (range * 0.5) : 0;
      tx = k ? Math.max(-strength, Math.min(strength, dx * k * 0.4)) : 0;
      ty = k ? Math.max(-strength, Math.min(strength, dy * k * 0.4)) : 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [strength, range]);

  return ref;
}
```

### `src/hooks/useActiveSection.ts`

```ts
import { useEffect, useState } from "react";

/**
 * Which section is under the reading line? Loops over `ids`, observes each
 * element, returns the id currently crossing the viewport's middle band.
 * Drives the active state in the nav.
 */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join("|");

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}
```

### `src/hooks/useProjectFilter.ts`

```ts
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
```

### `src/hooks/useCopy.ts`

```ts
import { useCallback, useEffect, useRef, useState } from "react";

/** Clipboard copy with a transient `copied` flag (announce it via aria-live). */
export function useCopy(resetMs = 1800) {
  const [copied, setCopied] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea"); // insecure-context fallback
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      clearTimeout(t.current);
      t.current = window.setTimeout(() => setCopied(false), resetMs);
    },
    [resetMs]
  );
  return { copied, copy };
}
```

### `src/lib/mail.ts`

```ts
/**
 * Email links. `mailto:` opens the OS default mail app (often not Gmail).
 * On desktop we open Gmail's compose window; on touch devices we keep mailto,
 * which the Gmail app handles. The mailto href stays on the <a> so it still
 * works without JS.
 */
export const CONTACT = {
  to: "dikhyantsatpathy@gmail.com",
  /** Optional CC address. Leave "" to omit. */
  cc: "",
  subject: "Project inquiry",
  body: "Hi Dikhyant,\n\nI came across your portfolio and wanted to talk about …\n\n",
};

const enc = encodeURIComponent; // %20, not '+': mailto does not decode '+'

export const gmailUrl = (m = CONTACT) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(m.to)}` +
  (m.cc ? `&cc=${enc(m.cc)}` : "") +
  `&su=${enc(m.subject)}&body=${enc(m.body)}`;

export const mailtoUrl = (m = CONTACT) =>
  `mailto:${m.to}?` +
  [m.cc && `cc=${enc(m.cc)}`, `subject=${enc(m.subject)}`, `body=${enc(m.body)}`]
    .filter(Boolean)
    .join("&");

const isTouch = () => matchMedia("(pointer: coarse)").matches;

/** onClick for every email link: Gmail web on desktop, native mailto on touch. */
export function openMail(e: { preventDefault(): void }) {
  if (isTouch()) return;
  e.preventDefault();
  window.open(gmailUrl(), "_blank", "noopener,noreferrer");
}
```

### `src/lib/content.ts`

```ts
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
```

### `scripts/verify.mjs`

```js
#!/usr/bin/env node
/**
 * Browser verification loop. Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/verify.mjs --url=http://localhost:4173 --ids=work,about,skills,contact
 * Needs: npm i -D playwright && npx playwright install chromium   (or CHROME_PATH=/path/to/chrome)
 * Exits non-zero on any failure; screenshots land in verify-out/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=").slice(1).join("=");
const URL_ = arg("url", "http://localhost:4173");
const IDS = arg("ids", "work,about,skills,contact").split(",").filter(Boolean);
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
mkdirSync("verify-out", { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox"],
});
const failures = [];
const fail = (vp, msg) => { failures.push(`[${vp}] ${msg}`); console.log(`FAIL [${vp}] ${msg}`); };
const pass = (vp, msg) => console.log(`ok   [${vp}] ${msg}`);

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(m.text()));
  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  await page.screenshot({ path: `verify-out/${vp.name}-top.png` });
  await page.mouse.move(vp.width * 0.7, vp.height * 0.4, { steps: 8 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `verify-out/${vp.name}-cursor.png` });
  await page.screenshot({ path: `verify-out/${vp.name}-full.png`, fullPage: true });

  const r = await page.evaluate((ids) => {
    const links = [...document.querySelectorAll("a[href]")].map((a) => ({
      href: a.getAttribute("href") || "",
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel") || "",
    }));
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      missing: ids.filter((id) => !document.getElementById(id)),
      badRelative: links.filter((l) => /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(l.href)).map((l) => l.href),
      unsafeBlank: links.filter((l) => l.target === "_blank" && !/noopener/.test(l.rel)).map((l) => l.href),
      aiMention: /claude|anthropic/i.test(document.body.innerText),
      emptyButtons: [...document.querySelectorAll("button,a")].filter(
        (el) => !el.textContent?.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title")
      ).length,
      imgNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
    };
  }, IDS);

  r.overflowX > 1 ? fail(vp.name, `horizontal overflow ${r.overflowX}px`) : pass(vp.name, "no horizontal overflow");
  r.missing.length ? fail(vp.name, `missing section ids: ${r.missing}`) : pass(vp.name, "section ids present");
  r.badRelative.length ? fail(vp.name, `scheme-less links: ${r.badRelative}`) : pass(vp.name, "no scheme-less links");
  r.unsafeBlank.length ? fail(vp.name, `_blank without noopener: ${r.unsafeBlank}`) : pass(vp.name, "_blank links safe");
  r.aiMention ? fail(vp.name, "page text mentions Claude/Anthropic") : pass(vp.name, "no AI attribution in page text");
  r.emptyButtons ? fail(vp.name, `${r.emptyButtons} links/buttons with no accessible name`) : pass(vp.name, "controls have names");
  r.imgNoAlt ? fail(vp.name, `${r.imgNoAlt} <img> without alt`) : pass(vp.name, "images have alt");
  errors.length ? fail(vp.name, `console/page errors: ${errors.join(" | ")}`) : pass(vp.name, "no console errors");
  await page.close();
}
await browser.close();
if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nAll checks passed. Now LOOK at verify-out/*.png before declaring done.");
```

### `.githooks/commit-msg`

```sh
#!/bin/sh
# Strip AI attribution trailers. Enable once per clone:  git config core.hooksPath .githooks
sed -i.bak '/^[Cc]o-[Aa]uthored-[Bb]y:.*\(Claude\|[Aa]nthropic\)/d; /Generated with.*Claude/d' "$1" && rm -f "$1.bak"
```

### `.claude/settings.json`

```json
{ "attribution": { "commit": "", "pr": "" } }
```

### `AGENTS.md`

```md
# Agent rules for this repo

1. Never add `Co-Authored-By` trailers, "Generated with …" footers or any AI attribution to commits, PRs, code, docs or the site.
2. Never invent content (metrics, certifications, employers, skills, outcomes). Missing data => hide the section.
3. Read `AGENT_PROMPT.md` before changing anything. Work in its phases; run its verify loop after each phase.
4. Keep `prefers-reduced-motion`, `pointer: coarse`, keyboard and screen-reader behaviour working.
5. `npm run lint && npm run build` must pass before every commit.
```

`src/types.ts` — already extended with the optional fields below (existing Firestore docs stay valid; the `sections` rule only restricts top-level keys):

```ts
// SectionItem += slug, tags, featured, repoUrl, liveUrl, role, status, problem, approach, outcome, gallery,
//                issuer, credentialId, credentialUrl, expires
// Profile     += skillGroups?: SkillGroup[]; resumeUrl?: string;   (add `focus?: string` yourself, §5.6)
// new:  export interface SkillGroup { id: string; label: string; items: string[] }
```

---

## 8. FINAL REPORT (required format)

When finished, reply with:
1. **Per phase**: what changed (files), the commands you ran, pass/fail, iterations used.
2. **Evidence**: paths to the `verify-out/` screenshots you actually opened, Lighthouse scores, test counts.
3. **Not verified / could not run**, with reasons (e.g. no Gemini key, no emulator).
4. **Owner action list**: `portrait.jpg`, certifications, project details, résumé, optional `CONTACT.cc`, `firebase deploy --only firestore:rules`, set `UPSTASH_*` + `GEMINI_API_KEY` (+ `GEMINI_MODEL`) in Vercel, key restrictions + App Check in Google Cloud, **and the history scrub below**.
5. Confirm `git log --format=%B | grep -iE "claude|anthropic"` is empty.

### Owner-only: scrub existing history (do NOT run this yourself; it rewrites SHAs and needs a force-push)
```sh
git clone --mirror git@github.com:dikhyantsatpathy-ui/myfirst-website.git backup.git   # backup first
pip install git-filter-repo
cd myfirst-website
git filter-repo --force --message-callback '
import re
m = re.sub(rb"(?im)^(co-authored-by:.*(claude|anthropic).*|.*generated with \[?claude code.*)\r?\n?", b"", message)
return m.rstrip() + b"\n"
'
git remote add origin git@github.com:dikhyantsatpathy-ui/myfirst-website.git
git push --force-with-lease origin --all && git push --force origin --tags
```
If commits are *authored* by a Claude identity (not just trailed), also pass `--mailmap` mapping it to the owner. Delete any `claude/*` branches. GitHub's contributor graph can lag; if it persists after a day, contact GitHub support. Everyone with a clone/fork must re-clone.
