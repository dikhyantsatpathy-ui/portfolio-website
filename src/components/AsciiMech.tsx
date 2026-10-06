import { useEffect, useRef } from "react";
import { useFinePointer, useReducedMotion } from "../lib/hooks";

/**
 * AsciiWalker — a 3D mech walker rendered entirely as ASCII text.
 *
 * WHY A WALKER AND NOT A BIPED
 *
 * The earlier version was a humanoid built from ~14 boxes, and it turned out to
 * be unreadable. Two reasons, both structural rather than cosmetic:
 *
 *   1. A humanoid's silhouette collapses when it turns edge-on. The reference
 *      (an AT-AT) is a wide slab: its outline is nearly the same from every
 *      angle, so it stays legible while rotating. Silhouette stability across
 *      the yaw range matters far more than limb articulation.
 *   2. It span a full 360 degrees of yaw. Anything past about 70 degrees off the
 *      frontal reads as noise at character resolution.
 *
 * So: a four-legged slab hull, a camera *below* the thing looking up (which is
 * what makes it feel enormous), and yaw oscillating inside a narrow legible
 * band rather than spinning.
 *
 * HOW THE RENDER WORKS
 *
 * Real 3D geometry, rasterised in software:
 *
 *   1. Boxes -> triangles with flat normals, placed through a 3-axis transform.
 *   2. Per frame: transform, project with a perspective divide, rasterise into a
 *      z-buffer storing shaded luminance per cell.
 *   3. Luminance selects a glyph from a density ramp, so shading *is* character
 *      density — the mid-tones fall out of geometry and light.
 *
 * There is no WebGL and no Three.js. Bloom is CSS text-shadow.
 */

const COLS = 120;
const ROWS = 60;

/**
 * Character cells are not square. A monospace glyph is about 0.62em wide and the
 * line box is 0.78em tall, so one column is ~1.26 rows wider than it is tall.
 * Projecting one world unit to one column therefore squashes the model
 * horizontally by a fifth — enough to make a walker look wrong without it being
 * obvious why. Multiplying screen X by this restores the true proportions.
 */
const ASPECT_X = 1.26;

// Glyphs dim -> bright. This ramp has to be perceptually even, because density
// is the only channel carrying shading.
const RAMP = " .,:;irsXA253hMHGS#9B&@";

type V3 = [number, number, number];
// `e` marks an emissive surface (the cockpit windows). Emissive geometry has to
// be flagged at build time — deciding it later from the world-space normal is
// not possible, because by then the normal has been rotated into view space.
type Tri = { a: V3; b: V3; c: V3; n: V3; e?: boolean };

/* ------------------------------------------------------------------ *
 * Placement
 * ------------------------------------------------------------------ */

/**
 * A rigid transform: rotate by rx, ry, rz (applied Z, then Y, then X) and
 * translate. Emitting every box through this is what lets the legs articulate
 * without the caller doing any trigonometry.
 */
type Xf = {
  rx: number; ry: number; rz: number;
  tx: number; ty: number; tz: number;
};

const IDENT: Xf = { rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0 };

/** Append a transformed offset to a base translation. */
function at(xf: Xf, tx: number, ty: number, tz: number): Xf {
  return { ...xf, tx: xf.tx + tx, ty: xf.ty + ty, tz: xf.tz + tz };
}

function xform(p: V3, xf: Xf): V3 {
  let [x, y, z] = p;

  if (xf.rz) {
    const c = Math.cos(xf.rz), s = Math.sin(xf.rz);
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
  }
  if (xf.ry) {
    const c = Math.cos(xf.ry), s = Math.sin(xf.ry);
    const nx = x * c + z * s;
    z = -x * s + z * c;
    x = nx;
  }
  if (xf.rx) {
    const c = Math.cos(xf.rx), s = Math.sin(xf.rx);
    const ny = y * c - z * s;
    z = y * s + z * c;
    y = ny;
  }
  return [x + xf.tx, y + xf.ty, z + xf.tz];
}

function xformDir(n: V3, xf: Xf): V3 {
  return xform(n, { ...xf, tx: 0, ty: 0, tz: 0 });
}

/**
 * Emit a box in local space as two triangles per face, with outward normals
 * taken from the cross product.
 *
 * Only the four side faces plus the top are emitted. The bottom face is never
 * visible from a camera below the model, and skipping it halves the triangle
 * count for no visual loss.
 */
function box(tris: Tri[], xf: Xf, sx: number, sy: number, sz: number, emissive = false) {
  const x = sx / 2, y = sy / 2, z = sz / 2;

  const local: V3[] = [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
  ];
  const corners = local.map((c) => xform(c, xf));

  // Winding: viewed from outside, counter-clockwise. Correct winding matters
  // here because the front-face sign is used for lighting contrast — a box
  // wound backwards is dimmer than it should be.
  const faces: [number, number, number][] = [
    [4, 5, 6], [4, 6, 7], // front  +z
    [1, 0, 3], [1, 3, 2], // back   -z
    [0, 4, 7], [0, 7, 3], // left   -x
    [5, 1, 2], [5, 2, 6], // right  +x
    [3, 7, 6], [3, 6, 2], // top    +y
  ];

  for (const [i, j, k] of faces) {
    const a = corners[i], b = corners[j], c = corners[k];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    nx /= len; ny /= len; nz /= len;
    tris.push({ a, b, c, n: xformDir([nx, ny, nz], xf), e: emissive });
  }
}

/* ------------------------------------------------------------------ *
 * The walker
 * ------------------------------------------------------------------ */

/** Hull half-extents, used by both the geometry and the camera framing. */
const HULL = { x: 1.18, y: 0.5, z: 0.72 };
const LEG_Y = 1.22;

/**
 * Four legs, diagonal gait (a trot: front-left with rear-right, and the other
 * pair opposite). `phase` drives the whole cycle.
 */
function buildLeg(tris: Tri[], hipX: number, hipZ: number, swing: number) {
  const THIGH = 0.66;
  const SHIN = 0.62;

  // Hip ball.
  box(tris, at(IDENT, hipX, LEG_Y, hipZ), 0.3, 0.26, 0.3);

  // Thigh swings about the hip on X.
  const thigh: Xf = { ...IDENT, rx: swing, tx: hipX, ty: LEG_Y, tz: hipZ };
  box(tris, at(thigh, 0, -THIGH / 2, 0), 0.26, THIGH, 0.28);
  // Hydraulic actuator alongside the thigh.
  box(tris, at(thigh, 0.19, -THIGH * 0.4, -0.1), 0.09, THIGH * 0.6, 0.09);

  // Knee.
  const kneeY = LEG_Y - Math.cos(swing) * THIGH;
  const kneeZ = hipZ + Math.sin(swing) * THIGH;
  box(tris, at(IDENT, hipX, kneeY, kneeZ), 0.24, 0.2, 0.26);

  // Shin counter-rotates so the foot plants flat.
  const shin: Xf = { ...IDENT, rx: -swing * 1.35, tx: hipX, ty: kneeY, tz: kneeZ };
  box(tris, at(shin, 0, -SHIN / 2, 0), 0.21, SHIN, 0.24);
  box(tris, at(shin, -0.15, -SHIN * 0.35, 0), 0.07, SHIN * 0.5, 0.08);

  // Ankle joint and the foot itself.
  const footY = kneeY - Math.cos(-swing * 1.35) * SHIN;
  const footZ = kneeZ + Math.sin(-swing * 1.35) * SHIN;
  box(tris, at(IDENT, hipX, footY, footZ), 0.22, 0.14, 0.24);
  // Three toe pads, so the foot reads as a foot and not a cube.
  for (const t of [-0.1, 0, 0.1]) {
    box(tris, at(IDENT, hipX + t * 0.6, footY - 0.09, footZ + 0.16), 0.12, 0.07, 0.16);
  }
}

function buildWalker(phase: number) {
  const tris: Tri[] = [];

  /* ---- hull: the dominant mass. Everything else is trim. ---- */

  // Main slab.
  box(tris, at(IDENT, 0, LEG_Y + 0.34, 0), HULL.x * 2, HULL.y * 2, HULL.z * 2);

  // Belly plate, slightly inset — creates a shadow line under the hull that
  // separates it from the legs when viewed from below.
  box(tris, at(IDENT, 0, LEG_Y + 0.06, 0.04), HULL.x * 1.78, 0.14, HULL.z * 1.7);

  // Upper deck.
  box(tris, at(IDENT, 0, LEG_Y + 0.72, -0.06), HULL.x * 1.5, 0.18, HULL.z * 1.5);

  // Prow: the front of an AT-AT steps forward and down. Angled with rz so the
  // silhouette has a direction.
  box(tris, { ...IDENT, rx: -0.34, tx: 0, ty: LEG_Y + 0.42, tz: HULL.z * 0.86 },
    HULL.x * 1.34, 0.42, 0.5);
  box(tris, { ...IDENT, rx: -0.5, tx: 0, ty: LEG_Y + 0.2, tz: HULL.z * 1.16 },
    HULL.x * 1.1, 0.3, 0.34);

  /* ---- cockpit ---- */

  // Neck, then the head. Full depth on the neck so the two never separate.
  box(tris, at(IDENT, 0, LEG_Y + 0.74, HULL.z * 0.5), 0.66, 0.22, 0.44);
  box(tris, at(IDENT, 0, LEG_Y + 0.9, HULL.z * 0.66), 0.6, 0.26, 0.36);

  // Three viewport windows — the focal point. Emissive, so they sit at the top
  // of the ramp regardless of how the key light happens to fall.
  for (const w of [-0.19, 0, 0.19]) {
    box(tris, at(IDENT, w, LEG_Y + 0.92, HULL.z * 0.83),
      w === 0 ? 0.14 : 0.12, 0.1, 0.04, true);
  }

  // Sensor mast. Adds a distinctive spike to the top outline, which is what
  // makes the silhouette recognisable when it is small.
  box(tris, at(IDENT, 0, LEG_Y + 1.16, -0.18), 0.08, 0.5, 0.08);
  box(tris, at(IDENT, 0, LEG_Y + 1.42, -0.18), 0.14, 0.1, 0.14);

  /* ---- armament ---- */

  // Side cannons, angled slightly outward.
  for (const s of [-1, 1]) {
    box(tris, { ...IDENT, rz: s * 0.1, tx: s * (HULL.x + 0.22), ty: LEG_Y + 0.5, tz: 0.3 },
      0.3, 0.3, 0.9);
    box(tris, { ...IDENT, rz: s * 0.1, tx: s * (HULL.x + 0.22), ty: LEG_Y + 0.5, tz: 0.82 },
      0.16, 0.16, 0.34);
  }

  /* ---- hull trim, for surface detail ---- */

  // Ribbed flank plating. Small repeated boxes read as machined panel lines.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      box(tris, at(IDENT, s * (HULL.x + 0.02), LEG_Y + 0.34, -0.5 + i * 0.25),
        0.05, 0.5, 0.1);
    }
  }
  // Ventral fins along the belly — very visible from a low camera.
  for (let i = 0; i < 4; i++) {
    box(tris, at(IDENT, -0.72 + i * 0.48, LEG_Y + 0.14, -HULL.z * 0.9), 0.3, 0.1, 0.24);
  }
  // Dorsal spine blocks.
  for (let i = 0; i < 3; i++) {
    box(tris, at(IDENT, 0, LEG_Y + 0.84, -0.5 + i * 0.3), 0.7, 0.1, 0.16);
  }

  /* ---- legs ---- */

  // Diagonal gait: FL+RR together, FR+RL opposite.
  const a = Math.sin(phase) * 0.3;
  const b = Math.sin(phase + Math.PI) * 0.3;
  buildLeg(tris, -0.72, 0.44, a);   // front left
  buildLeg(tris, 0.72, 0.44, b);    // front right
  buildLeg(tris, -0.72, -0.44, b);   // rear left
  buildLeg(tris, 0.72, -0.44, a);   // rear right

  return tris;
}

/* ------------------------------------------------------------------ *
 * Rasteriser
 * ------------------------------------------------------------------ */

const zbuf = new Float32Array(COLS * ROWS);
const lum = new Float32Array(COLS * ROWS);

export default function AsciiWalker() {
  const preRef = useRef<HTMLPreElement>(null);
  const finePointer = useFinePointer();
  const reduced = useReducedMotion();
  const interactive = finePointer && !reduced;

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    const W = COLS, H = ROWS;

    // Model vertical extent: feet reach roughly LEG_Y - 1.4, the mast tip
    // LEG_Y + 1.47. Framing is measured from the hull, not the origin — see the
    // note in project rules; projecting absolute y crops the model and makes
    // the head look detached.
    // Camera sits below the hull centre and looks up. This is the single
    // biggest reason the thing reads as enormous.
    const CAM_Z = 6.0;
    const ELEV = -0.3;

    /* ---- framing, derived rather than guessed ----
     *
     * The walker spans y = FOOT_Y (the bottom of the feet) up to MAST_Y (the tip
     * of the sensor mast). Deriving FOCAL from those two numbers — instead of
     * picking a multiple of the row count — means the framing survives a change
     * to the grid size or to the model's proportions. A hand-tuned multiple was
     * wrong by 3x and pushed a 2.8-unit model onto a 60-row grid.
     */
    const FOOT_Y = LEG_Y - 1.38;
    const MAST_Y = LEG_Y + 1.47;
    const MODEL_H = MAST_Y - FOOT_Y;
    const CENTER_Y = (FOOT_Y + MAST_Y) / 2;

    // Rows per world unit, chosen so the model occupies FILL of the grid height.
    const FILL = 0.82;
    const ROWS_PER_UNIT = (H * FILL) / MODEL_H;
    const FOCAL = ROWS_PER_UNIT * CAM_Z;

    const CX = W * 0.5;
    const CY = H * 0.5;

    const sx = new Float32Array(3);
    const sy = new Float32Array(3);
    const sz = new Float32Array(3);

    const TRAIL = 3;
    const trailYaw: number[] = [];
    const trailPhase: number[] = [];

    let raf = 0;
    let last = performance.now();
    const start = performance.now();
    let lastPaint = 0;
    let phase = 0;
    let yaw = 0.42;
    let ptrX = 0, ptrSX = 0;

    const onPointer = (e: PointerEvent) => {
      ptrX = (e.clientX / window.innerWidth) * 2 - 1;
    };
    if (interactive) window.addEventListener("pointermove", onPointer, { passive: true });

    const drawWalker = (modelYaw: number, modelPhase: number, dim: number) => {
      const tris = buildWalker(modelPhase);
      const cy = Math.cos(modelYaw), syw = Math.sin(modelYaw);
      const ce = Math.cos(ELEV), se = Math.sin(ELEV);

      for (const t of tris) {
        let ok = true;
        for (let i = 0; i < 3; i++) {
          const v = i === 0 ? t.a : i === 1 ? t.b : t.c;
          // Yaw about the vertical axis.
          const rx = v[0] * cy + v[2] * syw;
          const rz = -v[0] * syw + v[2] * cy;
          // Then tilt the camera: rotating the world about X by ELEV.
          const ry = v[1] * ce - rz * se;
          const rz2 = v[1] * se + rz * ce;

          const zc = CAM_Z - rz2;
          if (zc <= 0.2) { ok = false; break; }
          const inv = FOCAL / zc;
          sx[i] = CX + rx * inv * ASPECT_X;
          sy[i] = CY - (ry - CENTER_Y) * inv;
          sz[i] = zc;
        }
        if (!ok) continue;

        const area =
          (sx[1] - sx[0]) * (sy[2] - sy[0]) -
          (sy[1] - sy[0]) * (sx[2] - sx[0]);
        if (Math.abs(area) < 1e-6) continue;

        // Normal under the same rotation as the geometry.
        const nx = t.n[0], ny = t.n[1], nz = t.n[2];
        const nrx = nx * cy + nz * syw;
        const nrz = -nx * syw + nz * cy;
        const nry = ny * ce - nrz * se;
        const nrz2 = ny * se + nrz * ce;

        // Key light from above-left-front, matching where the eye goes. Two
        // sided so shading does not depend on winding.
        const key = Math.abs(nrx * -0.42 + nry * 0.66 + nrz2 * 0.62);
        const fill = Math.abs(nrx * 0.55 - nry * 0.3 - nrz2 * 0.5);
        let L = 0.1 + key * 0.82 + fill * 0.3;

        // Rim: faces turned away from camera still get a hot edge, which is
        // what separates the silhouette from the black background.
        const rim = Math.pow(1 - Math.min(1, Math.abs(nrz2)), 4) * 0.5;
        L = Math.min(1.35, L + rim);

        L *= t.e ? 1.3 : dim;

        let minX = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
        let maxX = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
        let minY = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
        let maxY = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
        if (minX > maxX || minY > maxY) continue;

        const i0 = 1 / sz[0], i1 = 1 / sz[1], i2 = 1 / sz[2];

        for (let y = minY; y <= maxY; y++) {
          const py = y + 0.5;
          for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5;
            // Barycentric, normalised by the signed area so the inside test
            // works for either winding.
            const w1 =
              (sx[2] - sx[1]) * (py - sy[1]) - (sy[2] - sy[1]) * (px - sx[1]);
            const w2 =
              (sx[0] - sx[2]) * (py - sy[2]) - (sy[0] - sy[2]) * (px - sx[2]);
            const l0 = w1 / area;
            const l1 = w2 / area;
            const l2 = 1 - l0 - l1;
            if (l0 < 0 || l1 < 0 || l2 < 0) continue;

            const z = 1 / (l0 * i0 + l1 * i1 + l2 * i2);
            const idx = y * W + x;
            if (z <= zbuf[idx]) continue;
            zbuf[idx] = z;
            lum[idx] = L;
          }
        }
      }
    };

    const paint = (now: number) => {
      const t = (now - start) / 1000;

      zbuf.fill(0);
      lum.fill(0);

      // Ghost trail, very faint. Enough to suggest motion smear, not enough
      // to read as a second object.
      for (let i = 0; i < trailYaw.length; i++) {
        const age = (trailYaw.length - i) / trailYaw.length;
        drawWalker(trailYaw[i], trailPhase[i], 0.1 + age * 0.1);
      }
      drawWalker(yaw, phase, 1);

      const buf = new Array<string>(H);
      for (let y = 0; y < H; y++) {
        let row = "";
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const L = lum[i];

          if (L <= 0.004) {
            // Falling vertical streaks. The hash must include y, otherwise a
            // single column lights on every row and renders as a hard rule.
            const h = Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t * 9)) * 43758.5453;
            const f = h - Math.floor(h);
            const density = 0.001 + (y / H) * 0.004;
            row += f < density ? (y > H * 0.55 ? "." : "'") : " ";
            continue;
          }

          const g = Math.min(0.999, L) * RAMP.length;
          row += RAMP[g | 0];
        }
        buf[y] = row;
      }
      pre.textContent = buf.join("\n");

      trailYaw.push(yaw);
      trailPhase.push(phase);
      if (trailYaw.length > TRAIL) {
        trailYaw.shift();
        trailPhase.shift();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Advance `last` only when a frame is actually painted. Updating it every
      // tick pins dt to one display interval, which defeats any frame budget
      // and silently freezes the scene.
      ptrSX += (ptrX - ptrSX) * 0.04;

      phase += dt * 1.9;
      // Narrow legible yaw band. A full rotation makes a figure this detailed
      // unreadable; oscillating around a three-quarter view keeps the prow,
      // cannons and cockpit in frame at all times.
      yaw = 0.42 + Math.sin(now / 5200) * 0.34 + ptrSX * 0.26;

      if (now - lastPaint > 55) {
        lastPaint = now;
        paint(now);
      }

      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      paint(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [interactive, reduced]);

  // Scroll framing: the walker drifts and scales as you travel the page.
  useEffect(() => {
    const el = preRef.current;
    if (!el || reduced) return;

    let raf = 0;
    let smooth = 0;
    const onFrame = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      smooth += (p - smooth) * 0.07;
      const x = Math.sin(smooth * Math.PI * 1.1) * 9;
      const y = -smooth * 7;
      const scale = 1 - Math.sin(smooth * Math.PI) * 0.2;
      const rot = Math.sin(smooth * Math.PI * 1.3) * 1;
      el.style.transform =
        `translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}vh, 0) ` +
        `scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
      el.style.opacity = String(1 - Math.sin(smooth * Math.PI) * 0.38);
      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden select-none overflow-hidden md:flex md:items-center md:justify-end md:pr-[6vw]"
    >
      <pre
        ref={preRef}
        className="ascii-mech m-0 whitespace-pre text-center font-mono leading-[0.78] text-bone-100"
        // Bloom from CSS rather than per-cell work — effectively free, and it
        // is what sells the lit-from-within look.
        style={{
          fontSize: "clamp(3px, 0.66vw, 10px)",
          textShadow:
            "0 0 5px rgba(255,255,255,0.6), 0 0 16px rgba(255,255,255,0.24), 0 0 40px rgba(255,255,255,0.1)",
        }}
      />
    </div>
  );
}
