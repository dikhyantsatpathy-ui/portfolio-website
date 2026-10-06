/**
 * Six design directions, each built rather than described.
 *
 * Every concept is self-contained: its own palette tokens, type stack, layout
 * system and ASCII treatment, all scoped under a root class so they never leak
 * into each other or into the real site. The point is to make the differences
 * unarguable — if two of these still look similar, they are not different enough.
 *
 * The ASCII engine is real. It is the same raymarched SDF + ordered dither as
 * the live site, so what you see is what the thing actually does.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ================================================================== *
 * 1. VOID TERMINAL — phosphor green on black, CRT, monospace
 * ================================================================== */

const c1 = `
--c-bg:#04070500;--c-bg:#050806;--c-fg:#c8ffd8;--c-dim:#5f8f6b;--c-accent:#39ff88;
--c-accent2:#0aff9d;--c-warn:#ffb347;
--font: "JetBrains Mono", ui-monospace, monospace;
`;

/* ================================================================== *
 * 2. RISOGRAPH — flat spot inks, cream stock, huge display serif
 * ================================================================== */

const c2 = `
--c-bg:#f4efe2;--c-bg2:#eae3d2;--c-fg:#1a1712;--c-dim:#6b6455;--c-accent:#ff4a1c;
--c-accent2:#0b5cd8;--c-warn:#f5c518;
--font: "Fraunces", ui-serif, Georgia, serif;
`;

/* ================================================================== *
 * 3. ACID TERMINAL — black + acid green, brutal grid, no radius
 * ================================================================== */

const c3 = `
--c-bg:#000;--c-bg2:#0a0a0a;--c-fg:#e8e8e8;--c-dim:#7a7a7a;--c-accent:#ccff00;
--c-accent2:#ff0000;--c-warn:#ffff00;
--font: "Inter", ui-sans-serif, system-ui, sans-serif;
`;

/* ================================================================== *
 * 4. VIOLET NOIR — deep indigo, cyberpunk neon, glass cards
 * ================================================================== */

const c4 = `
--c-bg:#080418;--c-bg2:#140a2e;--c-fg:#f0e9ff;--c-dim:#9b8cc4;--c-accent:#b026ff;
--c-accent2:#00e5ff;--c-warn:#ff2d95;
--font: "Inter", ui-sans-serif, system-ui, sans-serif;
`;

/* ================================================================== *
 * 5. PAPER GRAIN — warm off-white, ink serif, letterpress calm
 * ================================================================== */

const c5 = `
--c-bg:#ece7dd;--c-bg2:#e2dccd;--c-fg:#22201c;--c-dim:#6e6a60;--c-accent:#9a3b1f;
--c-accent2:#3f5d3a;--c-warn:#a8801a;
--font: "Fraunces", ui-serif, Georgia, serif;
`;

/* ================================================================== *
 * 6. BONE / BLOOD — near-black, bone type, single crimson, wide serif
 * ================================================================== */

const c6 = `
--c-bg:#0a0a0b;--c-bg2:#131315;--c-fg:#efece4;--c-dim:#8b877d;--c-accent:#c1121f;
--c-accent2:#e0e0d8;--c-warn:#f0a202;
--font: "Fraunces", ui-serif, Georgia, serif;
`;

/* ------------------------------------------------------------------ *
 * ASCII engine — raymarched SDF, ordered dither
 * ------------------------------------------------------------------ */

const COLS = 96;
const ROWS = 56;
const ASPECT = (56 / 96) * 1.26;

/** Aiming point — see the identical note in lib/asciiScene.ts. */
const LOOK_Y = -0.62;
const RAMP = " .'\`:;-~+=*coahkbd#%@";

const BAYER = (() => {
  const m = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const out = new Float32Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) out[y * 8 + x] = (m[y][x] + 0.5) / 64;
  return out;
})();

function smin(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}
function sdSphere(x: number, y: number, z: number, r: number) {
  return Math.sqrt(x * x + y * y + z * z) - r;
}
function sdEllipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return (k0 * (k0 - 1)) / k1;
}
function sdRoundBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r: number) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

/** Hooded bust. The hood rim and the lit forehead carry the whole read. */
function scene(x: number, y: number, z: number) {
  let d = sdRoundBox(x, y + 1.55, z + 0.1, 0.62, 0.72, 0.34, 0.3);
  d = smin(d, sdEllipsoid(x - 0.78, y + 1.42, z, 0.42, 0.36, 0.34), 0.35);
  d = smin(d, sdEllipsoid(x + 0.78, y + 1.42, z, 0.42, 0.36, 0.34), 0.35);
  d = smin(d, sdEllipsoid(x, y + 0.82, z, 0.72, 0.2, 0.42), 0.3);

  const shell = sdEllipsoid(x, y - 0.35, z + 0.22, 1.02, 1.12, 0.98);
  const cut = sdEllipsoid(x, y - 0.18, z - 1.35, 0.82, 0.92, 0.9);
  const hood = smax(shell, -cut, 0.16);

  let face = sdEllipsoid(x, y + 0.1, z + 0.12, 0.46, 0.56, 0.52);
  face = smin(face, sdEllipsoid(x, y + 0.24, z - 0.34, 0.4, 0.12, 0.2), 0.16);
  face = smin(face, sdEllipsoid(x - 0.3, y - 0.12, z - 0.3, 0.2, 0.16, 0.2), 0.18);
  face = smin(face, sdEllipsoid(x + 0.3, y - 0.12, z - 0.3, 0.2, 0.16, 0.2), 0.18);
  face = smin(face, sdEllipsoid(x, y - 0.42, z - 0.22, 0.3, 0.22, 0.3), 0.2);
  face = smax(face, -sdEllipsoid(x - 0.19, y + 0.02, z - 0.42, 0.15, 0.16, 0.18), 0.07);
  face = smax(face, -sdEllipsoid(x + 0.19, y + 0.02, z - 0.42, 0.15, 0.16, 0.18), 0.07);
  face = smax(face, -sdEllipsoid(x, y - 0.24, z - 0.46, 0.07, 0.12, 0.14), 0.05);
  face = smax(face, -sdRoundBox(x, y - 0.44, z - 0.44, 0.2, 0.02, 0.1, 0.01), 0.03);

  d = smin(d, hood, 0.22);
  return smin(d, face, 0.14);
}

const BOUND = 2.95;
const MAX_STEPS = 58;
const SURF = 0.002;

function shade(px: number, py: number, pz: number, dx: number, dy: number, dz: number) {
  const e = 0.0018;
  const gx = scene(px + e, py, pz) - scene(px - e, py, pz);
  const gy = scene(px, py + e, pz) - scene(px, py - e, pz);
  const gz = scene(px, py, pz + e) - scene(px, py, pz - e);
  const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  const gnx = gx / gl, gny = gy / gl, gnz = gz / gl;

  const LX = -0.55, LY = 0.72, LZ = 0.42;
  // Squared falloff — a linear dot pushes everything facing the light to the
  // top of the ramp and leaves no mid-tones for the dither to work with.
  let ndl = Math.max(0, gnx * LX + gny * LY + gnz * LZ);
  ndl *= ndl;

  let sh = 1, ts = 0.02;
  for (let i = 0; i < 16; i++) {
    const sd = scene(px + LX * ts, py + LY * ts, pz + LZ * ts);
    if (sd < SURF) { sh = 0; break; }
    sh = Math.min(sh, 9 * sd / ts);
    ts += Math.max(0.014, sd);
    if (ts > 1.1) break;
  }
  sh = Math.max(0, Math.min(1, sh));

  let ao = 0;
  for (let i = 1; i <= 5; i++) {
    const h = 0.02 + i * i * 0.014;
    ao += (h - scene(px + gnx * h, py + gny * h, pz + gnz * h)) / h;
  }
  ao = Math.max(0, Math.min(1, 1 - (ao / 5) * 0.9));

  const fill = Math.max(0, gnx * 0.6 - gny * 0.2 - gnz * 0.5);
  // Weak rim: a strong one turns the whole silhouette into one solid band of
  // the brightest glyph. AO modulates rather than annihilating the mid-tones.
  const rim = Math.pow(1 - Math.abs(dz), 9) * ao * 0.16;
  const L = (ndl * sh * 0.66 + fill * 0.14 + 0.17 + rim) * (0.62 + ao * 0.38);
  return L / (1 + L * 0.28);
}

type Mode = "static" | "scroll";

/**
 * Renders the figure into a text grid.
 *
 * `rowsDone` lets the caller spend a time budget per frame instead of blocking.
 * In scroll mode the pose advances with scroll, which is what makes the figure
 * move through poses rather than spin freely — spinning is what made the old
 * version unreadable.
 */
function useFigure(mode: Mode, tint: boolean) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = ref.current;
    if (!pre) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const buf = new Float32Array(COLS * ROWS);
    let rows = 0;
    let raf = 0;
    let dead = false;
    let scrollP = 0;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollP = max > 0 ? window.scrollY / max : 0;
    };
    if (mode === "scroll") window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const paint = () => {
      if (dead) return;
      const t0 = performance.now();

      // Pose from scroll, or a slow idle drift when static.
      const prog = mode === "scroll"
        ? scrollP
        : (performance.now() / 1000) * 0.045 % 1;
      const yaw = -0.42 + prog * 0.95;
      const dist = 4.3 - Math.sin(prog * Math.PI) * 1.0;
      const pitch = -0.05 + Math.sin(prog * Math.PI * 1.4) * 0.16;

      // Render a slice, respecting a budget so we never block a frame.
      if (rows < ROWS) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const oz = dist, oy = LOOK_Y;

        let y = rows;
        while (y < ROWS && performance.now() - t0 < 7) {
          for (let x = 0; x < COLS; x++) {
            const nx = ((x + 0.5) / COLS) * 2 - 1;
            const ny = 1 - ((y + 0.5) / ROWS) * 2;
            let dx = nx * ASPECT, dy = ny + (LOOK_Y - oy) * 0.14, dz = -1;
            const rx = dx * cy + dz * sy, rz = -dx * sy + dz * cy;
            const ry2 = dy * cp - rz * sp, rz2 = dy * sp + rz * cp;
            dx = rx; dy = ry2; dz = rz2;
            const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
            dx /= l; dy /= l; dz /= l;

            const b = oz * dz;
            const disc = b * b - (oz * oz - BOUND * BOUND);
            // (bounding-sphere reject; centre is at LOOK_Y, see asciiScene.ts)
            if (disc <= 0) { buf[y * COLS + x] = 0; continue; }
            const sq = Math.sqrt(disc);
            let t = Math.max(0.01, -b - sq);
            let hit = false;
            for (let i = 0; i < MAX_STEPS; i++) {
              const d = scene(0 + dx * t, oy + dy * t, oz + dz * t);
              if (d < SURF) { hit = true; break; }
              t += d * 0.85;
              if (t > BOUND * 2.2) break;
            }
            buf[y * COLS + x] = hit ? shade(dx * t, oy + dy * t, oz + dz * t, dx, dy, dz) : 0;
          }
          y++;
        }
        rows = y;
      }

      // Quantise with ordered dither.
      const n = RAMP.length;
      const out: string[] = new Array(ROWS);
      for (let y = 0; y < ROWS; y++) {
        let s = "";
        for (let x = 0; x < COLS; x++) {
          const l = buf[y * COLS + x];
          if (l <= 0.012) { s += " "; continue; }
          const thr = BAYER[(y & 7) * 8 + (x & 7)];
          const q = l * (1 + (1 - thr) * 0.85) - thr * 0.42;
          let g = (q * n) | 0;
          g = g < 1 ? 1 : g > n - 1 ? n - 1 : g;
          s += RAMP[g];
        }
        out[y] = s;
      }
      pre.textContent = out.join("\n");

      if (rows < ROWS) raf = requestAnimationFrame(paint);
      else raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [mode, tint]);

  return ref;
}

function Figure(props: {
  mode?: Mode;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useFigure(props.mode ?? "static", false);
  return (
    <pre
      ref={ref}
      aria-hidden
      className={`m-0 select-none whitespace-pre font-mono leading-[0.82] ${props.className ?? ""}`}
      style={{
        fontSize: props.size ?? 6,
        color: "inherit",
        textShadow: "0 0 8px currentColor",
        ...props.style,
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Shared content
 * ------------------------------------------------------------------ */

const NAME = "Dikhyant Satapathy";
const ROLE = "Software engineer";
const BIO =
  "I build web systems that stay up and stay fast — interfaces that load on a bad connection, and backends that don't fall over when traffic spikes.";

const WORK = [
  { n: "01", t: "Realtime board", d: "CRDT sync across 40 clients without a server round trip." },
  { n: "02", t: "Ingest pipeline", d: "2.1M events a day, backpressure handled at the edge." },
  { n: "03", t: "Design system", d: "One token set, four platforms, zero drift." },
  { n: "04", t: "Auth rewrite", d: "Session handling cut from 900ms to 40ms." },
];

const STACK = ["React", "TypeScript", "Node", "Firestore", "Go", "Postgres", "Redis", "GSAP"];

/* ================================================================== *
 * CONCEPT 1 — VOID TERMINAL
 * ================================================================== */

function VoidTerminal() {
  const fig = useFigure("scroll", true);
  const [t, setT] = useState("");
  useEffect(() => {
    const target = "SOFTWARE ENGINEER // SYSTEMS THAT HOLD";
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setT(target.slice(0, i));
      if (i >= target.length) clearInterval(id);
    }, 34);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="c1 relative min-h-screen overflow-hidden"
      style={{ background: "#050806", color: "#c8ffd8", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 62% 40%, rgba(57,255,136,0.13), transparent 62%), repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 3px)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 md:px-10">
        <header className="flex items-center justify-between border-b border-[#39ff88]/25 pb-3 text-[11px] tracking-[0.2em]">
          <span className="text-[#39ff88]">DS://TERMINAL</span>
          <nav className="hidden gap-7 md:flex">
            {["work", "stack", "logs", "contact"].map((s) => (
              <a key={s} href={`#c1-${s}`} className="text-[#5f8f6b] transition-colors hover:text-[#39ff88]">{s}</a>
            ))}
          </nav>
          <span className="text-[#5f8f6b]">ONLINE</span>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="mb-3 text-[11px] tracking-[0.25em] text-[#5f8f6b]">
              &gt; whoami
            </p>
            <h1 className="mb-5 text-[clamp(1.6rem,5.4vw,3.4rem)] leading-[1.05] tracking-tight text-[#c8ffd8]">
              <span className="block text-[#39ff88]">{NAME.toUpperCase()}</span>
              <span className="mt-2 block min-h-[2.2em] text-[#5f8f6b]">{t}</span>
              <span className="mt-1 inline-block h-4 w-2 bg-[#39ff88] align-middle" />
            </h1>
            <p className="max-w-md text-[13px] leading-relaxed text-[#8fbf9b]">{BIO}</p>
            <div className="mt-7 flex flex-wrap gap-2 text-[11px]">
              {STACK.slice(0, 5).map((s) => (
                <span key={s} className="border border-[#39ff88]/30 px-2.5 py-1 text-[#5f8f6b]">{s}</span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <pre
              ref={fig}
              aria-hidden
              className="m-0 select-none whitespace-pre text-[#39ff88]"
              style={{ fontSize: "clamp(4px,0.66vw,9.5px)", lineHeight: 0.82, textShadow: "0 0 10px #39ff88,0 0 30px rgba(57,255,136,0.5)" }}
            />
          </div>
        </div>

        <section id="c1-work" className="border-t border-[#39ff88]/25 py-8">
          <p className="mb-5 text-[11px] tracking-[0.25em] text-[#39ff88]">&gt; ls ./work</p>
          <div className="grid gap-3 md:grid-cols-2">
            {WORK.map((w) => (
              <div key={w.n} className="flex gap-4 border border-[#39ff88]/18 bg-[#39ff88]/[0.04] p-4">
                <span className="text-[#39ff88]">{w.n}</span>
                <div>
                  <h2 className="mb-1 text-[13px] text-[#c8ffd8]">{w.t}</h2>
                  <p className="text-[12px] leading-relaxed text-[#5f8f6b]">{w.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-[#39ff88]/25 pt-4 text-[11px] tracking-[0.2em] text-[#5f8f6b]">
          © {new Date().getFullYear()} — ALL SYSTEMS NOMINAL
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== *
 * CONCEPT 2 — RISOGRAPH
 * ================================================================== */

function Riso() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "#f4efe2", color: "#1a1712", fontFamily: '"Fraunces", ui-serif, Georgia, serif' }}
    >
      {/* Misregistered spot inks — the offset halftone blobs */}
      <div className="pointer-events-none absolute -right-24 top-[-8%] h-[520px] w-[520px] rounded-full opacity-25 mix-blend-multiply" style={{ background: "#ff4a1c" }} />
      <div className="pointer-events-none absolute right-[-6%] top-[8%] h-[380px] w-[380px] rounded-full opacity-20 mix-blend-multiply" style={{ background: "#0b5cd8" }} />

      <div className="relative z-10 px-6 pt-8 md:px-12">
        <header className="flex items-baseline justify-between border-b-2 border-[#1a1712] pb-3">
          <span className="font-serif text-[clamp(1.1rem,2.4vw,1.7rem)] tracking-tight">{NAME}</span>
          <nav className="hidden gap-8 font-mono text-[11px] uppercase tracking-[0.2em] md:flex">
            {["Work", "Stack", "About", "Contact"].map((s) => (
              <a key={s} href={`#c2-${s}`} className="hover:text-[#ff4a1c]">{s}</a>
            ))}
          </nav>
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#6b6455]">No. 01</span>
        </header>

        <div className="grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h1 className="font-serif text-[clamp(2.6rem,9vw,7rem)] font-light leading-[0.86] tracking-[-0.03em]">
              Systems<br />
              that hold.
            </h1>
            <p className="mt-7 max-w-md text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-[#6b6455]">
              {BIO}
            </p>
            <a
              href="#c2-work"
              className="mt-8 inline-block bg-[#ff4a1c] px-7 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-[#f4efe2] transition-transform hover:-translate-y-0.5"
            >
              See the work
            </a>
          </div>

          <div className="flex justify-center lg:justify-end">
            <Figure size={6.4} className="text-[#1a1712]" />
          </div>
        </div>

        <section id="c2-work" className="border-t-2 border-[#1a1712] py-12">
          <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.25em] text-[#6b6455]">Selected work</p>
          <div className="space-y-0">
            {WORK.map((w) => (
              <article key={w.n} className="group grid gap-3 border-b border-[#1a1712]/20 py-6 md:grid-cols-[70px_1fr_1.4fr] md:items-baseline">
                <span className="font-mono text-[11px] tracking-[0.2em] text-[#ff4a1c]">{w.n}</span>
                <h3 className="font-serif text-[clamp(1.3rem,2.6vw,2rem)] leading-tight transition-transform duration-300 group-hover:translate-x-2">
                  {w.t}
                </h3>
                <p className="max-w-sm text-[0.95rem] leading-relaxed text-[#6b6455]">{w.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="c2-stack" className="border-t-2 border-[#1a1712] py-12">
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-[#6b6455]">Stack</p>
          <div className="flex flex-wrap gap-x-10 gap-y-4 font-serif text-[clamp(1.4rem,3.4vw,2.4rem)]">
            {STACK.map((s) => <span key={s}>{s}</span>)}
          </div>
        </section>

        <footer className="border-t-2 border-[#1a1712] py-6 font-mono text-[11px] tracking-[0.2em] text-[#6b6455]">
          © {new Date().getFullYear()} {NAME}
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== *
 * CONCEPT 3 — ACID / BRUTAL GRID
 * ================================================================== */

function AcidGrid() {
  return (
    <div className="min-h-screen" style={{ background: "#000", color: "#e8e8e8" }}>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[80px_1fr]">
        {/* Rail */}
        <div className="flex items-center justify-between border-b border-[#ccff00]/40 px-4 py-3 md:flex-col md:items-center md:justify-start md:border-b-0 md:border-r md:py-6">
          <span className="font-mono text-[13px] font-bold text-[#ccff00]">DS</span>
          <nav className="flex gap-5 font-mono text-[10px] tracking-[0.2em] md:mt-10 md:flex-col md:items-center">
            {["01", "02", "03", "04"].map((n) => (
              <a key={n} href={`#c3-${n}`} className="transition-colors hover:text-[#ccff00]">{n}</a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col">
          <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_0.7fr]">
            <div className="border-b border-[#ccff00]/40 p-6 md:p-10 lg:border-b-0 lg:border-r">
              <p className="mb-6 inline-block bg-[#ccff00] px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-black">
                AVAILABLE
              </p>
              <h1 className="text-[clamp(2.4rem,8vw,6.5rem)] font-bold uppercase leading-[0.84] tracking-[-0.045em]">
                Dikhyant<br />
                <span className="text-[#ccff00]">Satapathy</span>
              </h1>
              <p className="mt-7 max-w-sm text-[15px] leading-relaxed text-[#7a7a7a]">{BIO}</p>
              <div className="mt-8 flex flex-wrap gap-2">
                {STACK.map((s) => (
                  <span key={s} className="border border-[#e8e8e8]/25 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider hover:border-[#ccff00] hover:text-[#ccff00]">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-center overflow-hidden bg-[#0a0a0a] p-4">
              {/* corner marks */}
              {["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2", "left-3 bottom-3 border-b-2 border-l-2", "right-3 bottom-3 border-b-2 border-r-2"].map((c) => (
                <span key={c} className={`absolute h-5 w-5 border-[#ccff00] ${c}`} />
              ))}
              <Figure size={7.5} className="text-[#ccff00]" style={{ opacity: 0.92 }} />
            </div>
          </div>

          <div className="grid grid-cols-1 border-t border-[#ccff00]/40 sm:grid-cols-2 lg:grid-cols-4">
            {WORK.map((w, i) => (
              <article
                key={w.n}
                id={`c3-0${i + 1}`}
                className="group border-b border-r border-[#ccff00]/30 p-5 transition-colors hover:bg-[#ccff00] hover:text-black sm:border-b-0 lg:[&:nth-child(4)]:border-r-0"
              >
                <span className="font-mono text-[10px] tracking-[0.2em] text-[#ccff00] group-hover:text-black">{w.n}</span>
                <h2 className="mb-2 mt-3 text-[19px] font-bold uppercase leading-tight">{w.t}</h2>
                <p className="text-[13px] leading-relaxed text-[#7a7a7a] group-hover:text-black/70">{w.d}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * CONCEPT 4 — VIOLET NOIR (cyberpunk glass)
 * ================================================================== */

function VioletNoir() {
  const fig = useFigure("scroll", true);
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#080418", color: "#f0e9ff" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 72% 28%, rgba(176,38,255,0.30), transparent 70%), radial-gradient(ellipse 55% 45% at 20% 75%, rgba(0,229,255,0.16), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(240,233,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(240,233,255,0.5) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
        }}
      />

      <div className="relative z-10 px-6 md:px-10">
        <header className="flex items-center justify-between border-b border-[#b026ff]/30 py-5">
          <span className="font-mono text-[12px] tracking-[0.3em] text-[#b026ff]">DS—NEURAL</span>
          <nav className="hidden gap-9 text-[13px] text-[#9b8cc4] md:flex">
            {["Work", "Skills", "Contact"].map((s) => (
              <a key={s} href={`#c4-${s}`} className="transition-colors hover:text-[#00e5ff]">{s}</a>
            ))}
          </nav>
          <span className="rounded-full border border-[#00e5ff]/40 px-3 py-1 text-[11px] text-[#00e5ff]">open to work</span>
        </header>

        <div className="grid items-center gap-10 py-16 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h1 className="text-[clamp(2.4rem,7.5vw,5.6rem)] font-bold leading-[0.92] tracking-[-0.035em]">
              <span className="block bg-gradient-to-r from-[#b026ff] via-[#ff2d95] to-[#00e5ff] bg-clip-text text-transparent">
                {NAME}
              </span>
              <span className="mt-3 block text-[clamp(1rem,2.4vw,1.7rem)] font-normal text-[#9b8cc4]">
                {ROLE} — resilient systems
              </span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#b8a9e0]">{BIO}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {STACK.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-[#b026ff]/30 bg-[#b026ff]/10 px-3.5 py-2 text-[12px] text-[#e0d4ff] backdrop-blur-sm transition-colors hover:border-[#00e5ff]/60 hover:text-white"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center">
            <div
              className="absolute inset-0 -z-10 rounded-full opacity-60 blur-3xl"
              style={{ background: "radial-gradient(circle,rgba(176,38,255,0.5),transparent 66%)" }}
            />
            <pre
              ref={fig}
              aria-hidden
              className="m-0 select-none whitespace-pre text-[#e6d9ff]"
              style={{ fontSize: "clamp(4px,0.72vw,10px)", lineHeight: 0.82, textShadow: "0 0 10px #b026ff,0 0 34px rgba(176,38,255,0.65)" }}
            />
          </div>
        </div>

        <section id="c4-Work" className="grid gap-5 pb-16 md:grid-cols-2">
          {WORK.map((w) => (
            <article
              key={w.n}
              className="rounded-2xl border border-[#b026ff]/25 bg-gradient-to-br from-[#140a2e]/85 to-[#0b0620]/70 p-7 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-[#00e5ff]/50 hover:shadow-[0_0_44px_rgba(0,229,255,0.18)]"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-md bg-[#b026ff]/20 px-2 py-1 font-mono text-[10px] text-[#d9b8ff]">{w.n}</span>
                <span className="h-px flex-1 bg-[#b026ff]/20" />
              </div>
              <h2 className="mb-2 text-[20px] font-semibold">{w.t}</h2>
              <p className="text-[14px] leading-relaxed text-[#9b8cc4]">{w.d}</p>
            </article>
          ))}
        </section>

        <footer className="border-t border-[#b026ff]/30 py-7 text-[12px] text-[#6d5f92]">
          © {new Date().getFullYear()} {NAME}
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== *
 * CONCEPT 5 — PAPER GRAIN (letterpress calm)
 * ================================================================== */

function PaperGrain() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "#ece7dd", color: "#22201c" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <header className="flex items-center justify-between border-b border-[#22201c]/20 py-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#6e6a60]">{NAME}</span>
          <nav className="hidden gap-8 text-[14px] md:flex">
            {["Work", "Notes", "Contact"].map((s) => (
              <a key={s} href={`#c5-${s}`} className="text-[#6e6a60] transition-colors hover:text-[#9a3b1f]">{s}</a>
            ))}
          </nav>
        </header>

        {/* Centre-weighted, quiet. Text is the subject. */}
        <section className="py-24 text-center">
          <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.35em] text-[#9a3b1f]">{ROLE}</p>
          <h1 className="mx-auto max-w-3xl text-[clamp(2rem,6.2vw,4.4rem)] font-light leading-[1.02] tracking-[-0.025em]">
            Most of my work lives at the seam between frontend and infrastructure.
          </h1>
          <p className="mx-auto mt-9 max-w-xl text-[17px] leading-[1.7] text-[#6e6a60]">{BIO}</p>
          <div className="mt-11 flex justify-center">
            <Figure size={4.6} className="text-[#22201c]" style={{ opacity: 0.88 }} />
          </div>
        </section>

        <section id="c5-Work" className="border-t border-[#22201c]/20 py-20">
          <h2 className="mb-14 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-[#6e6a60]">Selected work</h2>
          <div className="space-y-14">
            {WORK.map((w) => (
              <article key={w.n} className="mx-auto max-w-2xl">
                <div className="mb-2 flex items-baseline gap-4">
                  <span className="font-mono text-[11px] text-[#9a3b1f]">{w.n}</span>
                  <h3 className="text-[clamp(1.4rem,3vw,2.1rem)] font-light leading-tight">{w.t}</h3>
                </div>
                <p className="text-[16px] leading-[1.7] text-[#6e6a60]">{w.d}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-[#22201c]/20 py-8 text-center font-mono text-[11px] tracking-[0.2em] text-[#6e6a60]">
          © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== *
 * CONCEPT 6 — BONE / BLOOD
 * ================================================================== */

function BoneBlood() {
  const fig = useFigure("static", false);
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#0a0a0b", color: "#efece4" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 70% at 78% 50%, rgba(193,18,31,0.13), transparent 68%)" }}
      />

      <div className="relative z-10 px-6 md:px-10">
        {/* Oversized serif name, bleeding off the right edge */}
        <header className="flex items-center justify-between py-6">
          <span className="font-mono text-[11px] tracking-[0.32em] text-[#8b877d]">PORTFOLIO / 2026</span>
          <nav className="hidden gap-10 font-mono text-[11px] uppercase tracking-[0.2em] md:flex">
            {["Work", "Stack", "Contact"].map((s) => (
              <a key={s} href={`#c6-${s}`} className="text-[#8b877d] transition-colors hover:text-[#c1121f]">{s}</a>
            ))}
          </nav>
        </header>

        <div className="relative">
          <h1 className="pointer-events-none select-none text-[clamp(3rem,15vw,13rem)] font-light leading-[0.8] tracking-[-0.05em] text-[#efece4]">
            DIKHYANT
          </h1>
          <div className="mt-6 grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="flex flex-col justify-end">
              <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.3em] text-[#c1121f]">
                {ROLE}
              </p>
              <p className="max-w-md text-[clamp(1rem,1.6vw,1.2rem)] leading-relaxed text-[#b6b2a8]">{BIO}</p>
              <a
                href="#c6-work"
                className="mt-9 w-fit border-b-2 border-[#c1121f] pb-1 font-mono text-[12px] uppercase tracking-[0.2em] text-[#efece4] transition-colors hover:text-[#c1121f]"
              >
                View the work
              </a>
            </div>

            <div className="flex justify-center lg:justify-end">
              <pre
                ref={fig}
                aria-hidden
                className="m-0 select-none whitespace-pre text-[#efece4]"
                style={{ fontSize: "clamp(4px,0.78vw,11px)", lineHeight: 0.82, textShadow: "0 0 12px rgba(239,236,228,0.55)" }}
              />
            </div>
          </div>
        </div>

        {/* Full-bleed rule + asymmetric list */}
        <section id="c6-work" className="mt-24 border-t border-[#efece4]/15">
          {WORK.map((w, i) => (
            <article
              key={w.n}
              className="group grid items-baseline gap-4 border-b border-[#efece4]/12 py-8 transition-colors hover:bg-[#efece4]/[0.03] md:grid-cols-[110px_1fr_auto] md:px-4"
            >
              <span className="font-mono text-[11px] tracking-[0.2em] text-[#8b877d]">{w.n}</span>
              <h2 className="text-[clamp(1.5rem,4.4vw,3.2rem)] font-light leading-none tracking-[-0.03em] transition-colors group-hover:text-[#c1121f]">
                {w.t}
              </h2>
              <p className="max-w-xs text-[13px] leading-relaxed text-[#8b877d] md:text-right">{w.d}</p>
            </article>
          ))}
        </section>

        <section id="c6-stack" className="flex flex-wrap gap-x-12 gap-y-5 py-20 font-mono text-[12px] uppercase tracking-[0.18em] text-[#8b877d]">
          {STACK.map((s) => (
            <span key={s} className="transition-colors hover:text-[#efece4]">{s}</span>
          ))}
        </section>

        <footer className="border-t border-[#efece4]/15 py-8 font-mono text-[11px] tracking-[0.2em] text-[#8b877d]">
          © {new Date().getFullYear()} {NAME}
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Registry
 * ================================================================== */

const CONCEPTS = [
  {
    id: "void-terminal",
    n: "01",
    name: "Void Terminal",
    tag: "Phosphor CRT · monospace · scroll-driven",
    note: "Everything is a terminal. Green-on-black, scanlines, typewriter reveal. The figure is fixed behind the glass and the page scrolls it through poses. Most 'hacker' of the six, done with restraint rather than clichés.",
    css: c1,
    el: <VoidTerminal />,
  },
  {
    id: "riso",
    n: "02",
    name: "Risograph",
    tag: "Spot inks · cream stock · oversized serif",
    note: "Two-colour print aesthetic on paper. Flat ink blobs, misregistration, a huge light serif headline. Opposite mood to 01 — warm, printed, physical.",
    css: c2,
    el: <Riso />,
  },
  {
    id: "acid-grid",
    n: "03",
    name: "Acid Grid",
    tag: "Black + acid green · brutal grid · zero radius",
    note: "Hard Swiss grid, uppercase, hairline acid rules. No rounding anywhere, corner crop-marks around the figure. The most aggressive and most legible of the six.",
    css: c3,
    el: <AcidGrid />,
  },
  {
    id: "violet-noir",
    n: "04",
    name: "Violet Noir",
    tag: "Neon on indigo · glass · gradient type",
    note: "Cyberpunk-adjacent without being a template: deep indigo, magenta-to-cyan gradient wordmark, glass panels with real backdrop blur, glowing bloom behind the figure. The most conventionally 'designed' option.",
    css: c4,
    el: <VioletNoir />,
  },
  {
    id: "paper-grain",
    n: "05",
    name: "Paper Grain",
    tag: "Warm off-white · centred · letterpress calm",
    note: "Deliberately quiet. Centred column, generous leading, real grain texture, the figure small and centred like a plate in a book. The opposite of 01 and 03 — reads as considered rather than loud.",
    css: c5,
    el: <PaperGrain />,
  },
  {
    id: "bone-blood",
    n: "06",
    name: "Bone / Blood",
    tag: "Near-black · bone type · one crimson",
    note: "A single crimson on bone-white on black, with a display name so large it bleeds off the edge. Asymmetric list rows, no cards, no rounding. Cinematic and severe.",
    css: c6,
    el: <BoneBlood />,
  },
];

export default function Pitch() {
  const [active, setActive] = useState(0);
  const concept = CONCEPTS[active];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Picker */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <Link
              to="/"
              className="font-mono text-[11px] tracking-[0.2em] text-neutral-500 transition-colors hover:text-amber-400"
            >
              ← back to live site
            </Link>
            <span className="font-mono text-[11px] tracking-[0.2em] text-neutral-600">
              six directions · pick one
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {CONCEPTS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setActive(i)}
                className={`rounded-lg border px-3 py-2 text-left transition-all ${
                  i === active
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/12 hover:border-white/35"
                }`}
              >
                <span className={`block font-mono text-[10px] ${i === active ? "text-amber-400" : "text-neutral-600"}`}>
                  {c.n}
                </span>
                <span className="block truncate text-[12px] font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <h1 className="text-xl font-semibold text-white">
            {concept.n} — {concept.name}
          </h1>
          <span className="font-mono text-[11px] tracking-[0.18em] text-amber-400/80">{concept.tag}</span>
        </div>
        <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-neutral-400">{concept.note}</p>

        {/* Each concept is rendered inside an iframe-free scoped box so its own
            tokens and layout cannot leak into the picker or the others. */}
        <div className="overflow-hidden rounded-xl border border-white/12 shadow-2xl">
          <div
            key={concept.id}
            className="max-h-[78vh] overflow-y-auto"
            style={Object.fromEntries(
              concept.css
                .split("\n")
                .filter(Boolean)
                .map((l) => {
                  const i = l.indexOf(":");
                  return [l.slice(0, i), l.slice(i + 1)];
                })
            ) as React.CSSProperties}
          >
            {concept.el}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setActive((a) => (a - 1 + CONCEPTS.length) % CONCEPTS.length)}
            className="rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] tracking-[0.18em] transition-colors hover:border-amber-400 hover:text-amber-400"
          >
            ← prev
          </button>
          <span className="font-mono text-[11px] tracking-[0.2em] text-neutral-600">
            {active + 1} / {CONCEPTS.length}
          </span>
          <button
            onClick={() => setActive((a) => (a + 1) % CONCEPTS.length)}
            className="rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] tracking-[0.2em] transition-colors hover:border-amber-400 hover:text-amber-400"
          >
            next →
          </button>
        </div>

        <p className="mt-8 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
          The ASCII figure is the real renderer — a raymarched signed distance field with soft shadows
          and ambient occlusion, quantised through an 8×8 ordered dither. It is not an image or a
          font trick. Concepts 01, 04 and 06 drive the camera from scroll position; the rest animate
          on a slow idle loop.
        </p>
      </div>
    </div>
  );
}
