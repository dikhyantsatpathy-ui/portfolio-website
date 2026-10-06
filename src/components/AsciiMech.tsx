import { useEffect, useRef } from "react";
import { useFinePointer, useReducedMotion } from "../lib/hooks";

/**
 * AsciiMech — a 3D mech rendered entirely as ASCII text.
 *
 * HOW THIS WORKS, and why it looks like the reference rather than like a
 * sprite sheet:
 *
 * The reference effect is a *real 3D model* whose rendered luminance is mapped
 * to characters. That is exactly what this does, in software:
 *
 *   1. The mech is built from boxes -> triangles with flat normals.
 *   2. Each frame: transform, project with a perspective divide, cull back
 *      faces, and rasterise into a z-buffer.
 *   3. Each covered cell stores a shaded luminance.
 *   4. Luminance selects a glyph from a density ramp, so the surface shading
 *      becomes character density — the mid-tones fall out of geometry and
 *      light rather than being painted on.
 *
 * Doing it this way (rather than from rectangles, or with WebGL) is what gives
 * real foreshortening, self-occlusion and a silhouette that changes as the
 * model turns.
 *
 * Bloom and the wet highlight come from CSS text-shadow rather than per-cell
 * work, which is effectively free.
 *
 * PERFORMANCE: rasterisation is O(covered cells). At a 190x66 grid with ~110
 * triangles that is a few thousand cell writes per frame, throttled to ~20fps.
 * The grid is written as a single textContent assignment — one DOM write.
 */

const COLS = 168;
const ROWS = 64;

// Glyphs dim -> bright. Density is the only thing carrying shading, so the
// ramp has to be perceptually even.
const RAMP = " .:-=+*#%@";

type V3 = [number, number, number];
type Tri = { a: V3; b: V3; c: V3; n: V3 };

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** Axis-aligned box, emitted as 12 triangles with outward normals. */
function box(
  tris: Tri[],
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number
) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2;
  const y0 = cy - sy / 2, y1 = cy + sy / 2;
  const z0 = cz - sz / 2, z1 = cz + sz / 2;

  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ] as V3[];

  const faces: [number[], V3][] = [
    [[0, 3, 2], [1, 0, 0]],   // back  -z
    [[4, 5, 6], [0, 0, 1]],   // front +z
    [[0, 4, 7], [0, 0, 1]],   // left  -x
    [[1, 5, 6], [0, 0, 1]],   // right +x
    [[3, 7, 6], [1, 0, 0]],   // top   +y
    [[0, 1, 2], [0, -1, 0]],  // bottom
  ];

  for (const [idx, n] of faces) {
    // Vertex order matters for the normal. Recompute it from the cross product
    // rather than trusting the hand-written table.
    const a = v[idx[0]], b = v[idx[1]], c = v[idx[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    tris.push({ a, b, c, n: [nx, ny, nz] });
    void n;
  }
}

/** A limb segment: a box pivoting about its top edge. */
function limb(
  tris: Tri[],
  hipX: number, hipY: number, hipZ: number,
  len: number, thick: number,
  angle: number, axis: "x" | "z"
) {
  const s = Math.sin(angle), c = Math.cos(angle);
  const rot = (px: number, py: number, pz: number): V3 =>
    axis === "x"
      ? [px, py * c - pz * s, py * s + pz * c]
      : [px * c - pz * s, py, px * s + pz * c];

  // Half-length segment hanging from the pivot.
  const d = len / 2;

  // Build the segment in local space then rotate about the pivot.
  const local: Tri[] = [];
  box(local, 0, -d, 0, thick, len, thick);
  for (const t of local) {
    const ra = rot(0, t.a[1], t.a[2]);
    const rb = rot(0, t.b[1], t.b[2]);
    const rc = rot(0, t.c[1], t.c[2]);
    tris.push({
      a: [t.a[0] + hipX, ra[1], ra[2]],
      b: [t.b[0] + hipX, rb[1], rb[2]],
      c: [t.c[0] + hipX, rc[1], rc[2]],
      n: axis === "x" ? [t.n[0], t.n[1] * c - t.n[2] * s, t.n[1] * s + t.n[2] * c] : t.n,
    });
  }
}

/** The mech. Bulky walker proportions — the silhouette has to survive being
    only ~40 characters wide, so the masses are deliberately heavy. */
function buildMech(phase: number) {
  const tris: Tri[] = [];

  // Torso: layered hull so it reads as machined rather than a single slab.
  box(tris, 0, 1.78, 0, 1.34, 0.62, 0.86);      // main hull
  box(tris, 0, 2.16, -0.08, 1.06, 0.2, 0.62);   // deck
  box(tris, 0, 1.5, 0.42, 0.86, 0.34, 0.14);     // chest vent

  // Bridge the deck and the cockpit. The deck sits at the back and the cockpit
  // at the front, so as the model yaws they swing apart and the head reads as
  // detached. One full-depth block keeps them joined at every angle.
  box(tris, 0, 2.14, 0.22, 0.8, 0.34, 0.86);
  box(tris, 0, 2.04, 0.52, 0.62, 0.34, 0.4);
  // Visor eyes — lit, so they read as the focal point.
  box(tris, -0.16, 2.05, 0.72, 0.2, 0.12, 0.04);
  box(tris, 0.16, 2.05, 0.72, 0.2, 0.12, 0.04);

  // Shoulders / pauldrons.
  box(tris, -0.8, 1.9, 0.04, 0.36, 0.46, 0.6);
  box(tris, 0.8, 1.9, 0.04, 0.36, 0.46, 0.6);

  // Arm cannons.
  box(tris, -0.88, 1.42, 0.24, 0.19, 0.62, 0.19);
  box(tris, 0.88, 1.42, 0.24, 0.19, 0.62, 0.19);

  // Hips.
  box(tris, 0, 1.36, 0, 0.88, 0.28, 0.56);

  // Legs. Thigh swings, shin counter-swings so the foot plants.
  const swing = Math.sin(phase) * 0.32;
  const swing2 = Math.sin(phase + Math.PI) * 0.32;

  for (const s of [-1, 1]) {
    const a = s < 0 ? swing : swing2;
    const hx = s * 0.3;
    limb(tris, hx, 1.3, 0, 0.6, 0.34, a, "x");
    const kneeY = 1.3 - Math.cos(a) * 0.6;
    const kneeZ = Math.sin(a) * 0.6;
    // Knee joint.
    box(tris, hx, kneeY, kneeZ, 0.36, 0.2, 0.36);
    // Shin counter-rotates.
    const b = -a * 1.5;
    limb(tris, hx, kneeY, kneeZ, 0.58, 0.28, b, "x");
    // Foot.
    box(
      tris,
      hx,
      kneeY - Math.cos(b) * 0.58 - 0.06,
      kneeZ + Math.sin(b) * 0.58 + 0.08,
      0.4, 0.14, 0.5
    );
  }

  return tris;
}

/* ------------------------------------------------------------------ *
 * Rasteriser
 * ------------------------------------------------------------------ */

const zbuf = new Float32Array(COLS * ROWS);
const lum = new Float32Array(COLS * ROWS);

export default function AsciiMech() {
  const preRef = useRef<HTMLPreElement>(null);
  const finePointer = useFinePointer();
  const reduced = useReducedMotion();
  const interactive = finePointer && !reduced;

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    const W = COLS, H = ROWS;
    // Camera framing.
    // The model spans roughly y = 0.66 (feet) to y = 2.31 (top of the head
    // bridge), so its vertical centre is about 1.5. Screen Y has to be measured
    // relative to THAT, not to the world origin — projecting absolute y against
    // CY pushes the whole mech up past the top of the grid and crops it, which
    // reads as the head floating free of the body.
    const CENTER_Y = 1.5;
    const CAM_Z = 7.2;
    // inv = FOCAL / CAM_Z. At 4.35 the 1.65-unit-tall model spans ~62 of the
    // 64 rows, so it fills the frame without cropping.
    const FOCAL = H * 4.35;
    const CX = W * 0.5;
    const CY = H * 0.52;

    // Scratch buffers for the projected vertices, reused every frame.
    const sx = new Float32Array(3);
    const sy = new Float32Array(3);
    const sz = new Float32Array(3);

    // Trails: recent model transforms, drawn faint behind the live model.
    const TRAIL = 4;
    const trailYaw: number[] = [];
    const trailPhase: number[] = [];

    let raf = 0;
    let last = performance.now();
    let start = performance.now();
    let lastPaint = 0;
    let yaw = 0.5;
    let phase = 0;
    let ptrX = 0, ptrY = 0;
    let ptrSX = 0, ptrSY = 0;

    const onPointer = (e: PointerEvent) => {
      ptrX = (e.clientX / window.innerWidth) * 2 - 1;
      ptrY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (interactive) window.addEventListener("pointermove", onPointer, { passive: true });

    /** Draw one instance of the model into the buffers. */
    const drawModel = (
      modelYaw: number,
      modelPhase: number,
      dim: number,
      cxOff: number
    ) => {
      const tris = buildMech(modelPhase);
      const cy = Math.cos(modelYaw), syw = Math.sin(modelYaw);
      // Slight downward tilt so we look at it from just below — the
      // foreshortening is most of what makes it read as a big object.
      const pitch = 0.2;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);

      for (const t of tris) {
        // Rotate + translate each vertex, then project.
        let ok = true;
        for (let i = 0; i < 3; i++) {
          const v = i === 0 ? t.a : i === 1 ? t.b : t.c;
          let px = v[0], py = v[1], pz = v[2];
          // yaw about Y
          let rx = px * cy + pz * syw;
          let rz = -px * syw + pz * cy;
          let ry = py;
          // pitch about X
          const ry2 = ry * cp - rz * sp;
          const rz2 = ry * sp + rz * cp;
          ry = ry2; rz = rz2;

          const zc = CAM_Z - rz;
          if (zc <= 0.2) { ok = false; break; }
          const inv = FOCAL / zc;
          sx[i] = CX + cxOff + rx * inv;
          // Centre on the model's mid-height, not the world origin.
          sy[i] = CY - (ry - CENTER_Y) * inv;
          sz[i] = zc;
        }
        if (!ok) continue;

        // Signed area, used for the barycentric fill below.
        const area =
          (sx[1] - sx[0]) * (sy[2] - sy[0]) -
          (sy[1] - sy[0]) * (sx[2] - sx[0]);
        if (Math.abs(area) < 1e-6) continue;
        // No backface culling: the winding of a procedurally generated box is
        // easy to get backwards, and the z-buffer resolves occlusion correctly
        // either way. Culling on the wrong sign would drop every visible face.

        // Flat shading: rotate the normal the same way and light it.
        let nx = t.n[0], ny = t.n[1], nz = t.n[2];
        let nrx = nx * cy + nz * syw;
        let nrz = -nx * syw + nz * cy;
        let nry = ny * cp - nrz * sp;
        nrz = ny * sp + nrz * cp;

        // Two-sided lighting (abs of the dot product) so the result does not depend
        // on whether a face's winding happens to point in or out.
        const key = Math.abs(nrx * -0.45 + nry * 0.72 + nrz * 0.52);
        const fill = Math.abs(nrx * 0.5 - nry * 0.35 - nrz * 0.6);
        let L = 0.16 + key * 0.8 + fill * 0.28;
        // Rim light picks out the silhouette against the black.
        const rim = Math.pow(1 - Math.min(1, Math.abs(nrz)), 3) * 0.55;
        L = Math.min(1.35, L + rim);
        L *= dim;

        // Screen bounds.
        let minX = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
        let maxX = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
        let minY = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
        let maxY = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
        if (minX > maxX || minY > maxY) continue;

        const inv0 = 1 / sz[0], inv1 = 1 / sz[1], inv2 = 1 / sz[2];

        for (let y = minY; y <= maxY; y++) {
          const py = y + 0.5;
          for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5;
            // Barycentric via edge functions, normalised so the inside test is
            // independent of the winding direction.
            const w1 =
              (sx[2] - sx[1]) * (py - sy[1]) - (sy[2] - sy[1]) * (px - sx[1]);
            const w2 =
              (sx[0] - sx[2]) * (py - sy[2]) - (sy[0] - sy[2]) * (px - sx[2]);
            const l0 = w1 / area;
            const l1 = w2 / area;
            const l2 = 1 - l0 - l1;
            if (l0 < 0 || l1 < 0 || l2 < 0) continue;

            // Perspective-correct depth.
            const z = 1 / (l0 * inv0 + l1 * inv1 + l2 * inv2);
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

      // Trails first, faintest and oldest.
      for (let i = 0; i < trailYaw.length; i++) {
        const age = (trailYaw.length - i) / trailYaw.length;
        drawModel(trailYaw[i], trailPhase[i], 0.16 + age * 0.2, 0);
      }
      // The live model.
      drawModel(yaw, phase, 1, 0);

      // Downward motion streaks — reads as the walker moving through dust.
      const buf = new Array<string>(H);
      for (let y = 0; y < H; y++) {
        let row = "";
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const L = lum[i];
          if (L <= 0.004) {
            // Sparse vertical rain in the empty field. The hash includes y so
            // the streaks scatter down the column; without it, a single x
            // lights up for every row and renders as a hard vertical rule.
            const h1 = Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t * 6)) * 43758.5453;
            const s = h1 - Math.floor(h1);
            const density = 0.002 + (y / H) * 0.006;
            row += s < density ? "." : " ";
            continue;
          }
          const g = Math.min(0.999, L) * RAMP.length;
          row += RAMP[g | 0];
        }
        buf[y] = row;
      }
      pre.textContent = buf.join("\n");

      // Record this transform for the trail history.
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

      if (!reduced) {
        // Slow turn + walk cycle. Pointer nudges the turn rate.
        const t = (now - start) / 1000;
        phase += dt * 2.1;
        yaw += dt * (0.16 + ptrSX * 0.22);
        ptrSX += (ptrX - ptrSX) * 0.05;
        ptrSY += (ptrY - ptrSY) * 0.05;

        if (now - lastPaint > 50) {
          lastPaint = now;
          paint(now);
        }
        void t;
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

  // Scroll framing: the model drifts and scales as you travel the page.
  useEffect(() => {
    const el = preRef.current;
    if (!el || reduced) return;

    let raf = 0;
    let smooth = 0;
    const onFrame = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      smooth += (p - smooth) * 0.07;
      const x = Math.sin(smooth * Math.PI * 1.1) * 10;
      const y = -smooth * 8;
      const scale = 1 - Math.sin(smooth * Math.PI) * 0.22;
      const rot = Math.sin(smooth * Math.PI * 1.3) * 1.2;
      el.style.transform = `translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}vh, 0) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
      el.style.opacity = String(1 - Math.sin(smooth * Math.PI) * 0.4);
      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden select-none overflow-hidden md:flex md:items-center md:justify-end md:pr-[2vw]"
    >
      <pre
        ref={preRef}
        className="ascii-mech m-0 whitespace-pre text-center font-mono leading-[0.8] text-bone-100"
        // The glow is what sells the "lit from within" look in the reference,
        // and text-shadow does it without any per-cell cost.
        style={{
          fontSize: "clamp(3px, 0.72vw, 11px)",
          textShadow:
            "0 0 6px rgba(255,255,255,0.55), 0 0 18px rgba(255,255,255,0.22)",
        }}
      />
    </div>
  );
}