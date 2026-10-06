/**
 * The ASCII figure — a raymarched signed distance field printed as characters.
 *
 * WHY A RAYMARCHER
 *
 * The first version of this rasterised flat-shaded boxes and read as CAD. The
 * reference this is chasing is photographic: continuous tone, a soft key light
 * falling across a curved surface, deep shadow in the sockets, occlusion where
 * the hood meets the face. Polygons cannot produce any of that. Sphere-tracing an
 * SDF can, in one pass.
 *
 * Then the luminance is quantised through an 8x8 Bayer ordered dither.
 * Ordered rather than error-diffusion: Floyd-Steinberg is serial, has to run
 * over the whole grid every frame, and its error trails shimmer as the image
 * moves. Bayer is static, so the stipple is stable frame to frame and reads as
 * grain rather than noise.
 *
 * COST
 *
 * A full grid is 96x56 = 5,376 raymarches. Three things make that affordable:
 * a bounding-sphere reject discards ~60% of rays for one quadratic; each frame
 * spends a fixed time budget and resumes next frame, so a pose resolves over
 * several frames instead of blocking; and the pose is derived from scroll,
 * which only changes when the reader moves.
 */

import { useEffect, useRef } from "react";

/**
 * A wider grid than tall. The head is roughly as wide as it is long, and the
 * reference is a close frontal crop, so a portrait-shaped grid would waste most
 * of its cells on empty margins either side.
 */
/**
 * Grid size. Deliberately modest: the progressive fill has to finish quickly or
 * the image is visibly half-built on load, which reads as a broken render rather
 * than as a developing one. 112x64 keeps enough horizontal resolution for the
 * face while costing about 40% less than a square-ish grid of the same detail.
 */
const COLS = 112;
const ROWS = 64;

/**
 * A character cell is taller than it is wide — about 0.62em glyph in a 0.78em
 * line box, so one column is ~1.26 rows wider. Projecting one world unit to one
 * column squashes the subject horizontally by a fifth.
 */
const ASPECT = (72 / 128) * 1.26;

/**
 * Vertical field of view, radians. This is the ONLY zoom control, and it behaves
 * the way a lens does: smaller FOV = closer crop.
 *
 * The earlier version faked this by scaling the ray direction's x and y while
 * leaving dz at -1, which widened the FOV as the scale grew and squashed the two
 * axes by different amounts — so "zoom 2" made the subject both narrower AND
 * taller. Half the grid was also being spent on empty margin, because the grid
 * is wider than the head.
 */
const FOV = 0.92;

/**
 * A character cell is taller than it is wide: a ~0.62em glyph inside a ~0.78em
 * line box. For the subject to render undistorted, the horizontal half-extent
 * must be scaled by (COLS * 0.62) / (ROWS * 0.78).
 *
 * Note the direction: the factor is 0.62/0.78, NOT 0.78/0.62. Inverting it
 * stretched the frame to 2.24:1 and rendered the head as a squat smear a third
 * of its proper height — which looked like a rendering bug rather than an
 * arithmetic one.
 */
const TAN_X_FACTOR = (COLS / ROWS) * (0.62 / 0.78);

/** The point the camera looks at — the centre of the head. */
const TARGET_Y = -0.15;

/**
 * Bounding sphere around the HEAD ONLY.
 *
 * This is the single biggest performance lever in the whole renderer: rays that
 * miss it cost one quadratic instead of a full march, and it culls far more when
 * it is tight. An earlier sphere of radius 2.95 around the whole body subtended
 * most of the frame from the camera, so nearly every ray still marched — the
 * progressive fill could not finish and the figure looked truncated.
 *
 * It is centred on the head, not the world origin, so the intersection test below
 * has to subtract the centre rather than assume it is at zero.
 */
const BOUND_CX = 0;
const BOUND_CY = 0.35;
const BOUND_CZ = -0.2;
const BOUND = 2.05;
/**
 * March steps. Enough for grazing rays without being so expensive that the
 * progressive fill cannot complete — at 220 the grid only reached ~19 of 72 rows
 * inside the test window, which looks identical to the subject being truncated.
 */
const MAX_STEPS = 96;
const SURF = 0.002;

/**
 * Dim to bright, weighted hard toward the sparse end.
 *
 * The reference is mostly empty black with detail concentrated in the features,
 * so a perceptually even ramp fills the shadow areas with mid-density glyphs and
 * the face stops reading. `+` onward carries the actual modelling; everything
 * before it is the dither's sparse texture.
 */
const RAMP = " .'\`:;-~+*coahkbd#%@";

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

/* ------------------------------------------------------------------ *
 * SDF
 * ------------------------------------------------------------------ */

function smin(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}
function sdEllipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return (k0 * (k0 - 1)) / k1;
}
function sdRoundBox(
  x: number, y: number, z: number,
  bx: number, by: number, bz: number, r: number
) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return (
    Math.sqrt(ox * ox + oy * oy + oz * oz) +
    Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r
  );
}

/**
 * A hooded bust. Built from blended primitives rather than an anatomical skull
 * because the reference is a hooded figure in near-darkness: the hood rim and
 * the lit forehead do most of the reading, and the face is largely shadow.
 * That is convenient — it means the silhouette carries the image, which is the
 * one thing an SDF does better than a mesh.
 */
function scene(x: number, y: number, z: number) {
  // Torso and shoulders.
  let d = sdRoundBox(x, y + 1.55, z + 0.1, 0.62, 0.72, 0.34, 0.3);
  d = smin(d, sdEllipsoid(x - 0.78, y + 1.42, z, 0.42, 0.36, 0.34), 0.35);
  d = smin(d, sdEllipsoid(x + 0.78, y + 1.42, z, 0.42, 0.36, 0.34), 0.35);
  d = smin(d, sdEllipsoid(x, y + 0.82, z, 0.72, 0.2, 0.42), 0.3);

  // Hood: a shell with the face opening carved out. The rim this leaves is the
  // strongest read in the whole image.
  const shell = sdEllipsoid(x, y - 0.35, z + 0.22, 1.02, 1.12, 0.98);
  const cut = sdEllipsoid(x, y - 0.18, z - 1.35, 0.82, 0.92, 0.9);
  const hood = smax(shell, -cut, 0.16);

  // Skull, with the sockets and nasal cavity subtracted. Those subtractions are
  // what make it a skull rather than an egg once the light rakes across.
  let face = sdEllipsoid(x, y + 0.1, z + 0.12, 0.46, 0.56, 0.52);
  face = smin(face, sdEllipsoid(x, y + 0.24, z - 0.34, 0.4, 0.12, 0.2), 0.16);
  face = smin(face, sdEllipsoid(x - 0.3, y - 0.12, z - 0.3, 0.2, 0.16, 0.2), 0.18);
  face = smin(face, sdEllipsoid(x + 0.3, y - 0.12, z - 0.3, 0.2, 0.16, 0.2), 0.18);
  face = smin(face, sdEllipsoid(x, y - 0.42, z - 0.22, 0.3, 0.22, 0.3), 0.2);
  face = smax(face, -sdEllipsoid(x - 0.19, y + 0.02, z - 0.42, 0.15, 0.16, 0.18), 0.07);
  face = smax(face, -sdEllipsoid(x + 0.19, y + 0.02, z - 0.42, 0.15, 0.16, 0.18), 0.07);
  face = smax(face, -sdEllipsoid(x, y - 0.24, z - 0.46, 0.07, 0.12, 0.14), 0.05);
  face = smax(face, -sdRoundBox(x, y - 0.44, z - 0.44, 0.2, 0.02, 0.1, 0.01), 0.03);

  return smin(smin(d, hood, 0.22), face, 0.14);
}

function shade(px: number, py: number, pz: number, dz: number, exposure = 1) {
  // Gradient normal by central differences.
  const e = 0.0018;
  const gx = scene(px + e, py, pz) - scene(px - e, py, pz);
  const gy = scene(px, py + e, pz) - scene(px, py - e, pz);
  const gz = scene(px, py, pz + e) - scene(px, py, pz - e);
  const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  const nx = gx / gl, ny = gy / gl, nzz = gz / gl;

  // Key light, high and camera-left. Squared falloff: a linear dot pushes every
  // surface facing the light to the top of the ramp and leaves no mid-tones for
  // the dither to work with.
  const LX = -0.55, LY = 0.72, LZ = 0.42;
  let ndl = Math.max(0, nx * LX + ny * LY + nzz * LZ);
  ndl *= ndl;

  // Soft shadow, marched toward the light.
  let sh = 1, ts = 0.02;
  for (let i = 0; i < 16; i++) {
    const sd = scene(px + LX * ts, py + LY * ts, pz + LZ * ts);
    if (sd < SURF) { sh = 0; break; }
    sh = Math.min(sh, 9 * sd / ts);
    ts += Math.max(0.014, sd);
    if (ts > 1.1) break;
  }
  sh = Math.max(0, Math.min(1, sh));

  // Ambient occlusion, 5 taps along the normal.
  let ao = 0;
  for (let i = 1; i <= 5; i++) {
    const h = 0.02 + i * i * 0.014;
    ao += (h - scene(px + nx * h, py + ny * h, pz + nzz * h)) / h;
  }
  ao = Math.max(0, Math.min(1, 1 - (ao / 5) * 0.9));

  const fill = Math.max(0, nx * 0.6 - ny * 0.2 - nzz * 0.5);
  // Weak rim. A strong one fuses the whole silhouette into one solid band of
  // the brightest glyph, which is the opposite of a photograph.
  const rim = Math.pow(1 - Math.abs(dz), 9) * ao * 0.14;

  // The ambient floor matters more than it looks. Too low and every surface
  // turned away from the key light falls under the 0.012 quantise cutoff, so the
  // figure renders as a few bright patches with the rest missing entirely —
  // which reads as a framing bug rather than as shadow.
  let L = (ndl * sh * 0.8 + fill * 0.12 + 0.16 + rim) * (0.62 + ao * 0.38) * exposure;

  L = Math.pow(L, 0.8);
  L = L * L * (3 - 2 * L) * 0.22 + L * 0.78;

  return Math.min(1, L / (1 + L * 0.22));
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export type FigureHandle = {
  /** Advance the pose. Called on scroll; not from an animation loop. */
  setProgress: (p: number) => void;
};

/**
 * `drive` selects what moves the camera:
 *  - "scroll" reads window.scrollY (the reader pushes the figure through poses)
 *  - "idle"  loops slowly on its own, for figures not tied to scroll
 */
export function AsciiFigure({
  drive = "idle",
  fontSize = 6,
  className,
  style,
  onProgress,
}: {
  drive?: "scroll" | "idle";
  /**
   * The grid is a fixed 96x56 characters, so `fontSize` IS the scale control:
   * rendered width is roughly `fontSize * 96 * 0.6` and height
   * `fontSize * 56 * 0.82`. Sizing the parent instead does nothing — the
   * inline font-size here wins over inheritance, which silently pinned the
   * figure at 6px and made every attempt to scale it look broken.
   */
  fontSize?: number | string;
  className?: string;
  style?: React.CSSProperties;
  onProgress?: (p: number) => void;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    // Skip entirely on narrow viewports. The figure is hidden by CSS there, and
    // a `display: none` wrapper still mounts this component — so without this
    // the raymarcher runs at full cost behind an invisible element.
    const mq = window.matchMedia("(min-width: 1024px)");
    if (!mq.matches) return;

    const onMq = (e: MediaQueryListEvent) => {
      if (!e.matches) dead = true;
    };
    mq.addEventListener("change", onMq);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Camera overrides, for tuning without an edit-reload cycle.
    //   ?look=-0.62&zoom=0.58&dist=4.35&yaw=-0.2
    const q = new URLSearchParams(window.location.search);
    const num = (k: string, fallback: number) => {
      const v = parseFloat(q.get(k) ?? "");
      return Number.isFinite(v) ? v : fallback;
    };
    const LOOK = num("look", TARGET_Y);
    const F = num("fov", FOV);
    const DIST = num("dist", 4.2);
    // Centred at rest. A non-zero base yaw swings the subject off to one side
    // by roughly tan(yaw) * dist, which is most of the frame at these angles.
    const YAW0 = num("yaw", 0);
    const EXPO = num("ex", 1);
    const TAN_Y = Math.tan(F / 2);
    const TAN_X = TAN_Y * TAN_X_FACTOR;
    const buf = new Float32Array(COLS * ROWS);
    let rows = 0;
    let raf = 0;
    // Declared before the mq handler above can reference it.
    let dead = false;
    let dirty = true;

    const onScroll = () => {
      if (drive !== "scroll") return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current = max > 0 ? window.scrollY / max : 0;
      dirty = true;
      onProgress?.(progressRef.current);
    };
    if (drive === "scroll") {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    const paint = () => {
      if (dead) return;
      const t0 = performance.now();

      const p = drive === "idle" ? (performance.now() / 1000) * 0.028 % 1 : progressRef.current;

      // Pose. Frontal and close, with only a narrow sway — the reference is a
      // head-on crop, and turning far enough to see the hood profile turns the
      // whole thing into an unreadable lump at character resolution.
      const yaw = YAW0 + p * 0.36;
      const dist = DIST - Math.sin(p * Math.PI) * 0.5;
      const pitch = -0.02 + Math.sin(p * Math.PI * 1.2) * 0.06;

      // Re-render when the pose changed. Re-marching on every pixel of scroll
      // is wasteful and reads as noise, not detail.
      if (dirty) {
        // A pose change invalidates the WHOLE buffer, so restart from the top.
        //
        // This is the bug that made the figure look frozen: without the reset,
        // a repaint started at `y = ROWS`, the `y < ROWS` guard was already
        // false, no rows were written, and `dirty` was cleared anyway — so the
        // grid kept the first pose it ever rendered, forever.
        rows = 0;
      }

      if (rows < ROWS) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const oz = dist, oy = LOOK;

        let y = rows;
        // Always advance at least one row, then keep going while the frame
        // budget allows. A bare `while (y < ROWS && elapsed < budget)` can be
        // false on entry, which would render nothing and stall the fill.
        do {
          for (let x = 0; x < COLS; x++) {
            const ndcX = ((x + 0.5) / COLS) * 2 - 1;
            const ndcY = 1 - ((y + 0.5) / ROWS) * 2;
            // Proper pinhole ray: the half-extents come from the FOV, and the
            // horizontal one is widened to match the non-square character cell.
            let dx = ndcX * TAN_X;
            let dy = ndcY * TAN_Y;
            let dz = -1;
            const rx = dx * cy + dz * sy, rz = -dx * sy + dz * cy;
            const ry = dy * cp - rz * sp, rz2 = dy * sp + rz * cp;
            dx = rx; dy = ry; dz = rz2;
            const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
            dx /= l; dy /= l; dz /= l;

            // Ray vs bounding sphere centred on the head. `oc` is camera minus
            // centre; assuming the centre is the world origin (as an earlier
            // version did) made the test wrong whenever the aim point moved off
            // y = 0.
            const ocx = -BOUND_CX;
            const ocy = oy - BOUND_CY;
            const ocz = oz - BOUND_CZ;
            const b = ocx * dx + ocy * dy + ocz * dz;
            const disc =
              b * b - (ocx * ocx + ocy * ocy + ocz * ocz - BOUND * BOUND);
            if (disc <= 0) { buf[y * COLS + x] = 0; continue; }
            const sq = Math.sqrt(disc);
            let t = Math.max(0.01, -b - sq);
            let hit = false;
            for (let i = 0; i < MAX_STEPS; i++) {
              const d = scene(dx * t, oy + dy * t, oz + dz * t);
              if (d < SURF) { hit = true; break; }
              // Under-step: the ellipsoid primitive is not a true distance
              // bound, so 0.85 avoids tunnelling through the surface.
              t += d * 0.85;
              // Distance-relative, NOT an absolute cap. `t` grows with camera
              // distance, so a fixed ceiling puts the whole figure beyond the
              // cutoff the moment the camera pulls back — and the frame renders
              // empty with no error anywhere.
              if (t > dist + BOUND + 0.5) break;
            }
            buf[y * COLS + x] = hit ? shade(dx * t, oy + dy * t, oz + dz * t, dz, EXPO) : 0;
          }
          y++;
          // Then keep going while there is budget left.
        } while (y < ROWS && performance.now() - t0 < 30);

        rows = y;
        // Only clear `dirty` once the whole grid holds the new pose. Clearing
        // it mid-fill would strand the remaining rows showing the old one.
        if (rows >= ROWS) dirty = false;
      }

      // Quantise through the ordered dither.
      const n = RAMP.length;
      const out: string[] = new Array(ROWS);
      // `?geo=1` prints the raw silhouette with no shading at all, which is how
      // you tell a framing bug from a tone-curve bug — they look identical in a
      // screenshot otherwise.
      const geo = q.get("geo") === "1";
      for (let y = 0; y < ROWS; y++) {
        let s = "";
        for (let x = 0; x < COLS; x++) {
          const l = buf[y * COLS + x];
          if (l <= 0) { s += " "; continue; }
          if (geo) { s += "@"; continue; }
          if (l <= 0.012) { s += " "; continue; }
          const thr = BAYER[(y & 7) * 8 + (x & 7)];
          const q2 = l * (1 + (1 - thr) * 0.85) - thr * 0.42;
          let g = (q2 * n) | 0;
          g = g < 1 ? 1 : g > n - 1 ? n - 1 : g;
          s += RAMP[g];
        }
        out[y] = s;
      }
      pre.textContent = out.join("\n");

      if (!reduced) raf = requestAnimationFrame(paint);
    };

    if (reduced) {
      // One static frame, then stop. The loop must not run at all.
      paint();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(paint);
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onMq);
    };
  }, [drive, onProgress]);

  return (
    <pre
      ref={preRef}
      aria-hidden
      className={`m-0 select-none whitespace-pre font-mono leading-[0.82] ${className ?? ""}`}
      style={{ fontSize, color: "inherit", textShadow: "0 0 10px currentColor", ...style }}
    />
  );
}
