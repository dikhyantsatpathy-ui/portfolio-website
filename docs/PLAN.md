# Portfolio overhaul — brief for the coding agent

Repo: `dikhyantsatpathy-ui/myfirst-website` (Vite 6 · React 19 · TS · Tailwind v4 · GSAP/Lenis · Firebase · Vercel `api/`).
Owner: Dikhyant. Palette stays **near-black `#0a0a0b` / bone `#efece4` / crimson `#c1121f`**, Fraunces + mono labels.

**How this was produced:** read-through of the whole `src/`, `api/`, `firestore.rules`, config. The site was **not run** (no network for `npm install` here). Findings marked **[code-read]** come from reading code; the ASCII renderer in §1 is the one piece that **was built and tested in headless Chromium** (no errors, ~45 fps on software rendering, screenshots checked at rest / cursor / click). Everything else: verify by running it.

Work in the phases at the bottom. Do not skip §0 and §9.

---

## 0. Hard rules for this task

1. **Never add `Co-Authored-By` trailers, "Generated with…" footers, or any AI attribution** to commits, PRs, code comments, README or the site. Owner has said so explicitly. See §9.
2. **Never invent content.** No fake metrics, certifications, employers, skills or project outcomes. If data is missing, render nothing (hide the section) or leave a clearly marked `TODO` in the admin fallback, never plausible-sounding filler.
3. Keep `prefers-reduced-motion`, `pointer: coarse`, keyboard and screen-reader behaviour intact (README claims WCAG 2.2 AA; hold to it).

---

## 1. The ASCII portrait (the headline problem)

### 1.1 Why it looks bad now — `src/lib/AsciiFigure.tsx`  [code-read]

| Cause | Detail |
|---|---|
| Fake subject | The "hooded bust" is an SDF built from ~12 ellipsoids/boxes. It can't have a real face, fabric folds or photographic tone, so it reads as a blob no matter how the shading is tuned. |
| Wrong glyph strategy | An 8×8 **Bayer dither** over a punctuation ramp (`` .'`:;-~+*coahkbd#%@ ``) produces a stable stipple/noise pattern, not tone. The reference image gets its look from **mixed letters/digits chosen per tone band**, with **bright = dense & bold, dark = thin & dim**. |
| Tiny, mushy glyphs | `fontSize: clamp(4px, 0.62vw, 12px)` → 6 px at 1024 px wide. Below ~7 px the glyph shapes are gone and it's just grey fog. |
| Glow on everything | `text-shadow: 0 0 10px currentColor` on **every** character, including the dark ones, smears the whole grid. |
| Low resolution | 112×64 cells for a figure that is meant to fill the hero. |
| CPU raymarch on scroll | Re-marches 7k rays; the "progressive fill" is visibly half-built after any scroll. |
| One giant `<pre>` | Whole grid rewritten as one `textContent` each frame, relayout every time. |
| No cursor interaction | It is driven only by scroll position. |
| Hidden below 1024 px | `hidden lg:flex` + early-return in the effect → phones/tablets get **no** figure. |
| Boxed in a grid column | Lives in a 50% column next to the bio, so it can never feel like the page "revolves" around it. |

### 1.2 The replacement (already written and tested)

Drop these in (paths mirror the repo):

- `src/lib/asciiPortrait.ts` — framework-free renderer: `createAsciiPortrait(wrapEl, opts) → dispose()`. Strict-mode type-checked.
- `src/components/AsciiPortrait.tsx` — 20-line React wrapper.
- `src/lib/useCursorVars.ts` — publishes pointer as CSS vars for the rest of the page (§2).

How it works: loads a photo → resamples into a cell grid (cell aspect 1:1.75, DPR-aware) → per-cell luminance → glyph picked from one of 6 tone **bands** by hash (random alphanumeric texture) → drawn from a **pre-rendered glyph atlas** with `drawImage` (no `fillText` per cell, no `<pre>`, no text-shadow). Alpha *and* glyph density both follow luminance, so shadows are dim, not empty.

Cursor behaviour (all in the one file):
- **Pointer is a light.** Within `radius` px, glyphs brighten, **scramble** (re-roll glyph every 80 ms), get **pushed outward**, and where the photo is bright they turn **crimson**. Dark background glyphs only become visible under the light.
- **Parallax + shear.** Whole grid shifts ~10 px against the pointer, rows shear slightly, so the head appears to turn toward you.
- **Click = ripple** travelling through the grid (max 3 at once).
- **No pointer** (touch, idle >2.6 s, cursor left window) → a light **wanders on its own** along a Lissajous path, so the portrait is never dead and works on phones.
- **Reduced motion** → one static frame, no listeners, no loop.
- Pauses when off-screen / tab hidden (`IntersectionObserver`, `visibilitychange`). Cleans up everything on dispose.
- Options: `src, focusX, heightFit, cellWidth, radius, color, accent, fontFamily, fadeLeft, restGain, blackPoint`.

### 1.3 Wire-up in `src/designs/BoneBlood.tsx`

1. Delete the `<AsciiFigure …/>` block and its `lg:` grid column. Make the hero a single `relative` container with `min-h-[100svh]`.
2. Put the portrait **behind** the text, full-bleed:
   ```tsx
   <header className="relative min-h-[100svh] overflow-hidden px-[clamp(1.25rem,4vw,5rem)]">
     <div ref={figWrap} data-figure className="absolute inset-0">
       <AsciiPortrait src="/portrait.jpg" focusX={0.68} />
     </div>
     <div className="relative z-10"> {/* name, subtitle, bio, CTA */} </div>
   </header>
   ```
   The renderer already fades its left 30–52 % so text stays legible. On mobile use `focusX={0.5}` and `fadeLeft={[0,0]}` with a dark gradient overlay behind the text instead.
3. Keep the existing GSAP scroll fade on `figWrap` (opacity/scale as you leave the hero) — it still works because the wrapper is a plain div.
4. Delete `src/lib/AsciiFigure.tsx`, the `?look=&zoom=&geo=` query-param debug code goes with it.
5. Call `useCursorVars()` once in `Portfolio.tsx`.
6. Replace the static crimson bloom in the hero with one that follows the pointer:
   `background: radial-gradient(ellipse 40% 40% at calc(var(--mxn,.7)*100%) calc(var(--myn,.25)*100%), rgba(193,18,31,.18), transparent 70%)` (fixed-position, `pointer-events-none`).

### 1.4 The source photo — this decides 80 % of the result

**Code can't fix a bad input.** The tested renderer needs a photo with a **pure-black background and the subject lit from one side** (the reference image you posted has exactly that look). Pipeline for the owner:

1. Use **his own photo** (or a licensed/AI-generated hooded portrait). **Do not use the second reference** (the face one): it carries a visible *Adobe Stock* watermark and is not licensed for the site.
2. Cut out the background (remove.bg, Photoshop "Select Subject", or `rembg`), fill with **#000**.
3. Crop head-and-shoulders, subject centred, ~1200–1600 px tall. Square-ish or portrait.
4. Contrast: Levels/Curves so shadows crush to near-black and highlights hit ~90 %; **single hard key light from one side** is what makes ASCII read. Flat, evenly lit photos turn to mush. Slight blur (0.5–1 px) to kill sensor noise.
5. Save as `public/portrait.jpg` (or `.webp`), ≤300 KB.
6. If he has no suitable photo, an image-generator prompt that works for this look: *"low-key studio portrait, hooded figure, head and shoulders, single strong side light from upper left, deep shadows, pure black background, high contrast, centred, no text"* — then make sure he's happy with the licence terms of the generator he uses.

Tuning knobs once the real photo is in: `blackPoint` (raise if the background shows dust), `restGain` (figure brightness at rest), `radius` (light size), `cellWidth` (smaller = finer detail, costs frames), `heightFit`/`focusX` (framing). For a Courier-style look like the reference, add *Courier Prime* (Google Fonts) and pass `fontFamily`.

**Accept when:** face/hood shapes are recognisable at rest on a 1440×900 and a 390×844 viewport; moving the mouse visibly lights/scrambles glyphs near it; no frame budget warnings; `prefers-reduced-motion` shows one still frame.

---

## 2. "Everything revolves around the cursor" — page-level system

Only on `pointer: fine` and not reduced-motion. Never hide the native cursor on links/inputs.

- **CSS vars** from `useCursorVars()`: `--mx --my --mxn --myn` on `<html>`.
- **Spotlight on interactive blocks** (project rows/cards, skill groups, cert cards): on `pointermove` set `--lx/--ly` relative to the element; add an overlay `radial-gradient(240px circle at var(--lx) var(--ly), rgba(193,18,31,.16), transparent 70%)`.
- **Hero name** gets a bone→crimson highlight mask following `--mx/--my` (`background-clip:text` with radial gradient).
- **Magnetic CTA** (the "See the work" link, Gmail button): translate ≤8 px toward the pointer when within 80 px. `MagneticLink` already exists in `components/ui.tsx` — reuse it instead of rewriting.
- **Click ripple** in the ASCII replaces the separate shockwave ring in `EasterEggs.tsx` (delete the ring + the footer ⚡ counter; keep Konami + the `` ` `` palette if wanted).
- Optional small cursor ring (`mix-blend-mode: difference`), 12 px, lerped at 0.18.

---

## 3. Layout, spacing, type — why it "feels odd"  [code-read]

1. **Inconsistent, huge vertical rhythm.** Section top paddings are all different: work `clamp(4rem,14vh,11rem)`, about `clamp(5rem,16vh,13rem)`, stack `clamp(5rem,16vh,13rem)`, interests `clamp(4rem,12vh,9rem)`, contact `clamp(6rem,20vh,16rem)`. That is up to **16 rem of dead space between every section**, uneven. → One token `--section-y: clamp(5rem, 11vh, 8.5rem)` used by every section.
2. **No shared grid.** Each section invents its own columns. → One 12-col grid: label in cols 1–3 (mono, crimson), content in cols 4–12. Same left gutter everywhere (`px-[clamp(1.25rem,4vw,5rem)]` is fine, keep it and put a `max-w-[1600px] mx-auto` on content).
3. **Two palettes.** `index.css` `@theme` defines an amber/brass system (`brass-400 #ffb545`) and a different ink scale, while `BoneBlood.tsx`/`Sections.tsx` hardcode `#c1121f #efece4 #8b877d #56534d #0a0a0b` ~80 times. `App.tsx` 404 and `Admin.tsx` still use brass. → Define crimson/bone tokens in `@theme` (`--color-blood`, `--color-bone`, `--color-bone-dim`, `--color-ink`), replace hex literals, delete unused brass tokens.
4. **Contrast violation of your own rule.** README: *bone-700 must never be text.* `#56534d` on `#0a0a0b` ≈ **2.6:1** and is used for "Scroll ↓", project index numbers, the "N projects" counter, footer text and the form placeholders. → Raise to ≥ `#8b877d` (≈ 5.6:1) or ≥4.5:1.
5. **Nav** is one row: wordmark + 4 links + CTA, with no mobile variant → will overflow/wrap at 390 px. Not sticky, no active-section state. → Mobile: wordmark + hamburger (accessible dialog); desktop: sticky with blur, active link via `IntersectionObserver`.
6. **Hero** name is `11.6vw / leading .8` and then a `items-center` two-column row, then `Scroll ↓` — vertical space is spent on the name and the figure is squeezed in the leftover. Solved by §1.3 (figure behind, text over).
7. Fraunces loads with the full `opsz 9..144, wght 300..900` axis plus **Inter** (not used by BoneBlood) and JetBrains Mono from Google, render-blocking. → Self-host with `@fontsource-variable/fraunces` (limit axes), drop Inter if unused, `font-display: swap`, preload the one above-the-fold font.
8. Refresh ScrollTrigger on `document.fonts.ready` as well as the 400 ms timeout.

---

## 4. Projects — a better way to view them

**Current:** `BoneBlood.tsx` renders a 4-column text row per project (no image, no tags, no detail). `PinnedWork.tsx` (a pinned horizontal track) is imported but never rendered → dead.

**Target — "index + live preview", with a detail view:**

- **Desktop:** two columns. Left: numbered project list (title, year, 1–2 tags). Right: **sticky preview panel** that swaps on hover/focus — cover image/video loop, one-line summary, stack chips, `Live ↗` / `Code ↗`. Cursor spotlight on the active row (§2).
- **Mobile:** stacked cards, cover on top.
- **Filter chips** above the list (`All · Security · Full-stack · Systems`), derived from `tags`. Hide the control if every project has the same tag.
- **Detail view:** route `/work/:slug` (add to `App.tsx`; `vercel.json` rewrite already handles SPA routes) — or an accessible dialog if you'd rather not add routes. Sections: **Problem · Approach · Stack · Outcome · Links**, plus a gallery. Outcome only contains facts the owner supplies.
- Put the **Identity Document Screening System** first and mark it `featured` — it's clearly the strongest piece (offline-first, tamper-evident hash chain).
- Remove the `FALLBACK_WORK` array in `BoneBlood.tsx`: it contains **fabricated claims** ("2.1M events a day", "session handling cut from 900 ms to 40 ms", "CRDT sync across forty clients"). It's dead in practice because `fallbackSections` wins, but delete it.
- Fix stale copy: project 2 in `data/content.ts` still describes "a WebGL starfield and a modelled gyro".
- Delete `PinnedWork.tsx` unless you decide to use it.

**Data model** (`src/types.ts`) — extend `SectionItem` (all optional, so existing Firestore docs stay valid; the `sections` rule only restricts top-level keys, `items` is a free list):

```ts
export interface SectionItem {
  id: string; title: string; description?: string; link?: string; imageUrl?: string; date?: string;
  slug?: string; tags?: string[]; featured?: boolean;
  repoUrl?: string; liveUrl?: string; role?: string; status?: "shipped" | "wip";
  problem?: string; approach?: string; outcome?: string; gallery?: string[];
  // certificates / achievements
  issuer?: string; credentialId?: string; credentialUrl?: string; expires?: string;
}
```

### ⚠ Bug that blocks the skills/certs work  [code-read]
`Portfolio.tsx`: `const projects = sections.flatMap((s) => s.items ?? [])` — it flattens **every** section into "projects". Admin already lets him create `achievements` and `certificates` sections; the moment he does, they appear in **Selected work**. Fix: group by `type`, pass `projects`, `certificates`, `achievements` separately, and respect `visible`/`order`.

---

## 5. Skills section (new)

Replace the drifting **Stack** marquee (`data-drift` — unreadable, uncategorised, and `FALLBACK_STACK` lists Go/Redis the owner never claimed).

- Data: add `skillGroups?: { id: string; label: string; items: string[] }[]` to `Profile`; keep `skills: string[]` as a flat fallback (render as one group "Toolkit" if `skillGroups` absent). Fallback content from the existing list, grouped:
  - Languages: TypeScript, Python, C++
  - Frontend: React, Tailwind CSS, Vite
  - Backend & Data: Node.js, Firebase, PostgreSQL
  - Infra & Tooling: Docker
  - (Security stays in "What I work on".)
- Layout: 12-col; group label left, chips right; chips get the cursor spotlight. Optional "Currently learning" row only if he supplies items.
- **No progress bars / percentages** (meaningless, and invites questions he can't answer).
- Nav label "Stack" → "Skills"; keep `#stack` or rename to `#skills` and update the nav array + chatbot facts.
- Admin: add an editor for groups (add/rename/reorder/remove chips).

## 6. Certifications (new)

- Rendered from sections with `type === "certificates"`, newest first: **title · issuer · date · "Verify ↗" (`credentialUrl`)**, optional badge image. Grid of cards on desktop, list on mobile; cursor spotlight.
- **If there are none, the section does not render.** Do not add placeholders. **Owner must supply the real list** (name, issuer, date, verification link). Ask him for it.
- Admin: the Certificates section type exists; add fields `issuer, credentialId, credentialUrl, expires`.
- Nav: add "Credentials" only when the section has items.
- Also render `achievements` (same list component, no issuer line) if present.

---

## 7. Remove the contact form, fix the email link

### 7.1 Remove the form (third screenshot)
- Delete `Contact()`'s `<form>` and its state in `src/designs/Sections.tsx`; keep the left column (email, GitHub, LinkedIn) and make it the whole contact block.
- Delete `submitContact`, `ContactPayload` and unused imports (`addDoc`, `serverTimestamp`, `doc`) from `src/lib/usePortfolioContent.ts`.
- Delete the **Messages** panel and the **Visitors/blocked IPs** panels from `src/pages/Admin.tsx` (visitors are never written anywhere — `api/visitor.ts` only echoes the caller's IP — so that panel is permanently empty).
- Delete `api/visitor.ts`, `testFirebase.js` (a script that writes to the production DB with hardcoded config).
- Firestore rules: see §8.
- If he *also* meant the floating chat bubble (Gemini chatbot) say so — it's a separate component (`Chatbot.tsx`) and I've left it in; one-line removal in `Portfolio.tsx`.

### 7.2 Why "mailto" doesn't open Gmail properly
`mailto:` hands off to whatever the **OS default mail app** is. On most Windows/Chrome setups that's Outlook, a "pick an app" prompt, or nothing — never Gmail web. There are three `mailto:` links (nav "Get in touch", the big "Have something worth building?" headline, and the email in the contact block). Fix: on desktop open **Gmail's compose URL** (supports `to`, `cc`, `su`, `body`); on touch devices keep `mailto:` (the Gmail app handles it); keep `mailto:` as the `href` so it still works without JS.

New file `src/lib/mail.ts`:

```ts
export const CONTACT = {
  to: "dikhyantsatpathy@gmail.com",
  cc: "",                                   // owner: put the address to CC here (see note)
  subject: "Project inquiry",
  body: "Hi Dikhyant,\n\nI came across your portfolio and wanted to talk about …\n\n",
};
const enc = encodeURIComponent;           // %20 not '+': mailto does not decode '+'

export const gmailUrl = (m = CONTACT) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(m.to)}` +
  (m.cc ? `&cc=${enc(m.cc)}` : "") + `&su=${enc(m.subject)}&body=${enc(m.body)}`;

export const mailtoUrl = (m = CONTACT) =>
  `mailto:${m.to}?` + [m.cc && `cc=${enc(m.cc)}`, `subject=${enc(m.subject)}`, `body=${enc(m.body)}`]
    .filter(Boolean).join("&");

export const isTouch = () => matchMedia("(pointer: coarse)").matches;

/** onClick for every email link: Gmail web on desktop, native mailto on touch. */
export function openMail(e: React.MouseEvent) {
  if (isTouch()) return;                    // let the mailto href run
  e.preventDefault();
  window.open(gmailUrl(), "_blank", "noopener,noreferrer");
}
```

Use on all three: `<a href={mailtoUrl()} onClick={openMail}>`. In the contact block add three explicit actions: **Open in Gmail** (primary) · **Other mail app** (`mailto`) · **Copy address** (reuse `CopyButton` from `ui.tsx`, with a "Copied" state announced via `aria-live`).

> **Ambiguity to confirm with the owner:** "with me in the cc". A visitor emails *him*, so CC-ing him on his own inbox is redundant. Assumed meaning: `to` = him, `cc` = an optional second address (`CONTACT.cc`), subject and body pre-filled. If he meant something else, only `CONTACT` changes.

### 7.3 Related link bug  [code-read]
`fallbackProfile.github` is `"github.com/dikhyantsatpathy-ui"` and `linkedin` is `"linkedin.com/in/…"` — **no protocol**. `Contact` renders `href={github}`, which the browser resolves **relative to the site** (`yoursite/github.com/...` → the 404 page). Add `ensureUrl()` (prepend `https://` if no scheme) and apply it to every profile link; also normalise on save in Admin. Verify what's stored in Firestore.

---

## 8. Backend & security  [code-read]

### 8.1 `firestore.rules`
- **`messages`: `allow create: if true` with no validation** → anyone can write unlimited, unbounded documents (cost + abuse). The form is going away → remove the whole `messages` match (default-deny applies).
- **`visitors`: `allow create, update: if true`** → same problem, and nothing uses it. Remove. Remove `blocked_ips` too (public-readable, no enforcement anywhere).
- **`isAdmin()`** trusts `request.auth.token.email` alone → add `&& request.auth.token.email_verified == true`.
- **`isValidProfile`** only does `hasAll([...])`; add `hasOnly([...])` listing: `name, subtitle, bio, skills, skillGroups, interests, email, github, linkedin, twitter, location, educationInfo, institution, ownerId, updatedAt` plus size caps on `bio` (≤2000) and `skills`/`skillGroups` lists.
- Section rules are fine; items stay free-form (extended in §4), keep `items.size() <= 100`.
- The leading `match /{document=**} { allow … if false }` is harmless (rules are OR-ed) but misleading; delete it and rely on default-deny.
- **Two copies** of the rules exist (`firestore.rules`, `app/applet/firestore.rules`). `firebase.json` uses the root one. Delete `app/applet/`.
- Deploy: `firebase deploy --only firestore:rules`. Add a **Firestore security-rules test** (emulator) covering: anon can read profiles/visible sections; anon cannot write anything; non-admin Google user cannot write; unverified-email admin cannot write.

### 8.2 `api/chat.ts` (Gemini)
- **Rate limit does not work on Vercel.** A module-level `Map` is per serverless instance and resets on cold start; it also grows unbounded. `x-forwarded-for` can be a comma list and is client-influenced. → Use **Vercel Firewall rate-limit rule** on `/api/chat`, or Upstash `@upstash/ratelimit` keyed on `x-real-ip`. Add a hard daily cost cap + billing alert on the Gemini key.
- **Model id `gemini-3.5-flash`** — I could not verify this exists. Check against current Gemini docs before shipping; a wrong id means the bot is silently broken.
- Remove the `'User-Agent': 'aistudio-build'` header (AI Studio leftover).
- **Grounding is too thin and goes stale.** The FACTS block is hard-coded (and still says sections: "toolkit"). → Build FACTS at request time from the same content as the site (profile + projects + skills + certs), cached for a few minutes. Otherwise the bot answers "I don't have that detail" to almost everything.
- Add short **conversation history** (last ~6 turns) from the client; today every message is stateless.
- Client: `Chatbot.tsx` does `data.text` with no guard → can render `undefined`. Guard it; add a visible rate-limit message for 429.
- Add `GEMINI_API_KEY` presence check at boot → clear 503, not a generic 500.

### 8.3 Firebase project/config
- `firebase-applet-config.json` (committed) points at an **AI Studio–generated project** (`crafty-catalyst-471nt`) and a named DB. API keys for Firebase web apps are public by design, but make sure: the key has **HTTP-referrer restrictions** in Google Cloud Console, **App Check** is on for Firestore, and the owner actually controls the project's billing. Prefer migrating to his own project via the `VITE_FIREBASE_*` vars already supported in `firebase.ts`.
- `usePortfolioContent.ts` does `getDocs` **and then** `onSnapshot` for the same data (double reads). Use `onSnapshot` only. Remove unused destructured imports.
- Keep the static fallback in `data/content.ts` in sync with live content (it is what crawlers and slow connections see).

### 8.4 Repo hygiene
- `package.json`: name is `react-example`; `vite` is listed in both deps and devDeps; **unused**: `express`, `dotenv`, `@types/express`, `react-force-graph-2d`, `d3-force`, `esbuild`, `autoprefixer` (Tailwind v4 doesn't need it), probably `tsx`. Run `npx depcheck`, remove, rename the package.
- Delete AI-Studio artefacts: `metadata.json`, `firebase-blueprint.json` (confirm unused), `app/`, `testFirebase.js`; decide on `skills-lock.json` (agent tooling).
- `README.md` is **stale**: it describes an `AsciiMech.tsx` WebGL-free 3-D walker, a "61 fps, no canvas" claim and an Alt-click `DS/` monogram — none exist any more (the easter egg for it is dead code). Rewrite after this work.
- Add `.github/workflows/ci.yml`: `npm ci && npm run lint && npm run build` on PRs; enable Dependabot.
- Admin: replace `any[]` state with real types; move `/admin` out of the public footer link; add `<meta name="robots" content="noindex">` on that route.

### 8.5 SEO / sharing
`index.html` has no `og:image`, `og:url`, canonical, `robots.txt`, or JSON-LD. Add a 1200×630 OG image (the ASCII portrait screenshot works well), `og:url`, `twitter:image`, a `Person` JSON-LD block, `robots.txt`, `sitemap.xml`. Footer shows the text "static preview" when Firestore is slow — remove it from public view.

### 8.6 Nice-to-haves (backend-adjacent)
- Replace the dead visitor tracking with **Vercel Web Analytics** or Plausible (no PII, no DB writes).
- **Résumé**: `public/resume.pdf` + "Résumé ↗" in nav/contact (owner supplies the file).
- Optional **Cal.com / Calendly** link as an alternative to email.

---

## 9. Remove the "Claude committed" attribution

**What I found:** searched the whole source — there is **no** Claude/Anthropic text on the site itself. What he's seeing is **git/GitHub attribution**: Claude Code appends `Co-Authored-By: Claude <noreply@anthropic.com>` to commit messages (and a "Generated with Claude Code" footer to PRs). GitHub turns that trailer into a **co-author/contributor** entry. The zip has no `.git`, so I could not inspect the actual history — check it.

**Stop it happening again** — in `.claude/settings.json` (project) *and* `~/.claude/settings.json`:
```json
{ "attribution": { "commit": "", "pr": "" } }
```
(`includeCoAuthoredBy` is the deprecated older key; `attribution` replaced it.) There are reports of the model still adding the trailer despite the setting, so also:
1. Add to `CLAUDE.md` / `AGENTS.md`: *"Never add Co-Authored-By trailers or AI attribution to commits or PRs."*
2. Add a `commit-msg` hook that strips them (`.git/hooks/commit-msg`, `chmod +x`):
   ```sh
   #!/bin/sh
   sed -i '/^[Cc]o-[Aa]uthored-[Bb]y:.*\(Claude\|anthropic\)/d; /Generated with.*Claude/d' "$1"
   ```
3. Check there is no `.github/workflows/claude*.yml` or installed "Claude" GitHub App adding commits/comments (none in the zip).

**Clean existing history** (he must run this himself; it rewrites SHAs and needs a force-push):
```sh
git clone --mirror git@github.com:dikhyantsatpathy-ui/myfirst-website.git backup.git   # backup first
pip install git-filter-repo
cd myfirst-website
git filter-repo --force --message-callback '
import re
m = re.sub(rb"(?im)^(co-authored-by:.*(claude|anthropic).*|.*generated with \[?claude code.*)\r?\n?", b"", message)
return m.rstrip() + b"\n"
'
git remote add origin git@github.com:dikhyantsatpathy-ui/myfirst-website.git   # filter-repo removes it
git push --force-with-lease origin --all && git push --force origin --tags
```
If commits are **authored/committed by** a Claude identity (not just trailed), also pass `--mailmap` mapping that name/email to his own. Delete any `claude/*` branches. GitHub's contributors graph can take a while to refresh; if "Claude" still shows after a day, contact GitHub support. Anyone with a clone/fork will need to re-clone.

---

## 10. Phased task list

**Phase A — safety & cleanup (do first)**
1. §9 settings + hook + CLAUDE.md rule. 2. §8.1 rules rewrite + deploy + rule tests. 3. §7.1 remove form/Messages/Visitors/`api/visitor.ts`/scratch files. 4. §8.4 dependency + file cleanup.

**Phase B — correctness bugs**
5. §4 `flatMap` bug (group by `type`). 6. §7.3 `ensureUrl`. 7. §7.2 `mail.ts` + three links + copy button. 8. Delete `FALLBACK_WORK`/`FALLBACK_STACK`, fix stale project copy.

**Phase C — look & feel**
9. §3 tokens, spacing scale, 12-col grid, contrast, nav (mobile + sticky + active), fonts. 10. §1 portrait + hero rework (needs `public/portrait.jpg` from the owner). 11. §2 cursor system.

**Phase D — new content**
12. §4 project index + preview + detail route. 13. §5 skills. 14. §6 certifications. 15. Admin editors for the new fields.

**Phase E — backend polish & docs**
16. §8.2 chat hardening + grounded FACTS. 17. §8.3 Firebase config. 18. §8.5 SEO/OG. 19. CI + README rewrite.

### Acceptance checklist
- [ ] `npm run lint` and `npm run build` pass; no unused deps.
- [ ] Hero: portrait recognisable, reacts to cursor, wanders on touch, still frame under reduced motion; text legible over it at 390 / 768 / 1440 px.
- [ ] No horizontal scroll at 390 px; nav works on mobile.
- [ ] All three email links open Gmail compose on desktop (To/subject/body filled, CC if set) and the native mail app on a phone; copy button works.
- [ ] GitHub/LinkedIn links open the real sites.
- [ ] Adding a `certificates` section in Admin never shows items under "Selected work".
- [ ] Anonymous Firestore writes are rejected (test in emulator).
- [ ] `git log --format=%B | grep -i -E "claude|anthropic"` returns nothing.
- [ ] Lighthouse: Accessibility ≥ 95, no text under 4.5:1.
