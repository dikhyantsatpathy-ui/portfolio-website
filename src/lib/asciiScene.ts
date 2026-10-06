/**
 * AsciiScene — a hooded figure rendered as ASCII, raymarched in software.
 *
 * WHY THIS IS A RAYMARCHER AND NOT A MESH
 *
 * The previous version rasterised boxes with flat shading. It read as CAD:
 * hard facets, no soft shadow, no occlusion, so it could never look like the
 * photographic references it was chasing. Those images are continuous-tone — a
 * soft key light falling across a curved surface, deep shadow in the eye
 * sockets, ambient occlusion where the hood meets the face. Flat-shaded polygons
 * cannot produce any of that.
 *
 * So the subject is a signed distance field, sphere-traced per character cell.
 * That buys, in one stroke:
 *
 *   - continuous shading, so tone survives dithering instead of banding
 *   - soft shadows (raymarched toward the light) and ambient occlusion
 *   - a smooth organic silhouette, from smooth-min blended primitives
 *   - no triangles, no winding, no z-buffer, no mesh to author
 *
 * Then the luminance is quantised through an ordered Bayer dither before being
 * mapped onto glyphs. Ordered rather than error-diffusion: Floyd-Steinberg is
 * serial and would have to run over the whole grid every frame, and its error
 * trails shimmer when the image moves. Bayer is a static 8x8 threshold grid, so
 * the stipple is stable frame to frame — which is what makes it read as film
 * grain rather than as noise.
 *
 * RENDER COST
 *
 * A full grid is 192x128 = 24,576 raymarches, which is far too much for one
 * frame. Three things make it affordable:
 *
 *   1. A bounding-sphere reject. Most rays miss the subject entirely and cost
 *      ~10 ops instead of a full march. This alone removes ~60% of the work.
 *   2. Progressive rendering with a per-frame time budget, so a pose resolves
 *      over a few frames instead of blocking. First paint shows a partially
 *      resolved image, which reads as a photograph developing.
 *   3. Poses are rendered lazily — only when scroll approaches them.
 *
 * Scroll does not re-raymarch. It blends between already-rendered poses and
 * applies a transform, which is what keeps it at full frame rate while scrolling.
 */

/* ------------------------------------------------------------------ *
 * Grid
 * ------------------------------------------------------------------ */

const COLS = 192;
const ROWS = 128;

/**
 * A character cell is taller than it is wide (~0.62em glyph in a ~0.78em line
 * box), so projecting one world unit per column squashes the subject
 * horizontally. This restores true proportions.
 */
const ASPECT = (128 / 192) * 1.26;

/* ------------------------------------------------------------------ *
 * Glyph ramp
 * ------------------------------------------------------------------ */

/**
 * Dim to bright. Weighted toward the sparse end, because the subject is mostly
 * shadow and the references read as a dark image with a lit focal area — a ramp
 * weighted to the dense end turns the whole figure into a grey slab.
 */
const RAMP = " .'\`:;-~+=*coahkbd#%@";

/** Bayer 8x8 ordered-dither threshold matrix, normalised to 0..1. */
const BAYER = (() => {
  // Built by recursion: B(2n) = [[4B, 4B+2], [4B+3, 4B+1]]. Cheaper to write
  // out than to derive, and it is a constant.
  const m = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const out = new Float32Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) out[y * 8 + x] = (m[y][x] + 0.5) / 64;
  return out;
})();

/* ------------------------------------------------------------------ *
 * SDF primitives
 * ------------------------------------------------------------------ */

function smin(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Sphere. Exact SDF. */
function sdSphere(x: number, y: number, z: number, r: number) {
  return Math.sqrt(x * x + y * y + z * z) - r;
}

/**
 * Ellipsoid. Not an exact SDF — this is the standard bound, which underestimates
 * distance near the surface. The march compensates with a step scale below 1.
 */
function sdEllipsoid(
  x: number, y: number, z: number,
  rx: number, ry: number, rz: number
) {
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return (k0 * (k0 - 1)) / k1;
}

/** Rounded box. Exact. */
function sdRoundBox(
  x: number, y: number, z: number,
  bx: number, by: number, bz: number, r: number
) {
  const qx = Math.abs(x) - bx + r;
  const qy = Math.abs(y) - by + r;
  const qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

/**
 * The subject: a hooded bust.
 *
 * Built from blended primitives rather than a skull model, because the
 * references are hooded figures in near-darkness — the hood rim and the lit
 * forehead do almost all of the reading, and the face itself is largely shadow.
 * That is fortunate: it means the silhouette carries the image, which is the
 * one thing an SDF is genuinely better at than a mesh.
 */
function scene(x: number, y: number, z: number) {
  /* ---- torso ---- */
  let d = sdRoundBox(x, y + 1.55, z + 0.1, 0.62, 0.72, 0.34, 0.3);
  // Shoulders, blended on so there are no seams.
  d = smin(d, sdEllipsoid(x - 0.78, y + 1.42, z, 0.42, 0.36, 0.34), 0.35);
  d = smin(d, sdEllipsoid(x + 0.78, y + 1.42, z, 0.42, 0.36, 0.34), 0.35);
  // Collar.
  d = smin(d, sdEllipsoid(x, y + 0.82, z, 0.72, 0.2, 0.42), 0.3);

  /* ---- hood shell ---- */
  const shell = sdEllipsoid(x, y - 0.35, z + 0.22, 1.02, 1.12, 0.98);
  // Carve the face opening. A generous cut is what produces the hood rim, and
  // the rim is the strongest read in the whole image.
  const cut = sdEllipsoid(x, y - 0.18, z - 1.35, 0.82, 0.92, 0.9);
  let hood = smax(shell, -cut, 0.16);

  /* ---- skull ---- */
  const skull = sdEllipsoid(x, y + 0.1, z + 0.12, 0.46, 0.56, 0.52);
  // Brow ridge and cheekbones give the face structure under raking light.
  let face = smin(skull, sdEllipsoid(x, y + 0.24, z - 0.34, 0.4, 0.12, 0.2), 0.16);
  face = smin(face, sdEllipsoid(x - 0.3, y - 0.12, z - 0.3, 0.2, 0.16, 0.2), 0.18);
  face = smin(face, sdEllipsoid(x + 0.3, y - 0.12, z - 0.3, 0.2, 0.16, 0.2), 0.18);
  // Jaw.
  face = smin(face, sdEllipsoid(x, y - 0.42, z - 0.22, 0.3, 0.22, 0.3), 0.2);
  // Eye sockets and nasal cavity, subtracted. These are what make it a skull
  // rather than an egg once the light rakes across them.
  face = smax(face, -sdEllipsoid(x - 0.19, y + 0.02, z - 0.42, 0.15, 0.16, 0.18), 0.07);
  face = smax(face, -sdEllipsoid(x + 0.19, y + 0.02, z - 0.42, 0.15, 0.16, 0.18), 0.07);
  face = smax(face, -sdEllipsoid(x, y - 0.24, z - 0.46, 0.07, 0.12, 0.14), 0.05);
  // Teeth line.
  face = smax(face, -sdRoundBox(x, y - 0.44, z - 0.44, 0.2, 0.02, 0.1, 0.01), 0.03);

  // Hood joins the shoulders; the skull sits inside the opening.
  d = smin(d, hood, 0.22);
  d = smin(d, face, 0.14);

  return d;
}

/* ------------------------------------------------------------------ *
 * Poses
 * ------------------------------------------------------------------ */

type Pose = { yaw: number; pitch: number; dist: number; shift: number };

/**
 * The figure's centre of mass is well below the origin — the torso runs from
 * y = 0.2 down to y = -2.27, while the hood crown only reaches y = +0.77. So
 * the origin is roughly at the neck, and aiming at it pushes the whole body
 * into the bottom of the frame. Every pose aims at LOOK_AT instead.
 */
const LOOK_Y = -0.62;

const POSES: Pose[] = [
  { yaw: -0.34, pitch: -0.06, dist: 4.2, shift: 0 },
  { yaw: -0.1, pitch: 0.02, dist: 3.9, shift: 0.03 },
  { yaw: 0.16, pitch: 0.08, dist: 3.6, shift: 0.06 },
  { yaw: 0.4, pitch: 0.12, dist: 3.4, shift: 0.09 },
];

/* ------------------------------------------------------------------ *
 * Renderer
 * ------------------------------------------------------------------ */

/**
 * Bounding-sphere radius, centred on the scene origin.
 *
 * Must cover the FARTHEST point, not the widest. The torso bottom sits at
 * y = -2.27 and the hood crown at y = +0.77, so the corner distance from the
 * origin is about 2.5 — an earlier value of 2.05 silently amputated the
 * shoulders and left a hard vertical seam down the figure. Anything poking
 * outside this sphere is skipped entirely, not clipped softly, so an
 * underestimate is a visible hole rather than a subtle error.
 */
const BOUND = 2.95;
const MAX_STEPS = 64;
const SURF = 0.0018;

export type SceneState = {
  /** Luminance per pose, or null while unrendered. */
  buffers: (Float32Array | null)[];
  /** How many rows of each pose are resolved. */
  rows: number[];
};

export function createSceneState(): SceneState {
  return {
    buffers: POSES.map(() => new Float32Array(COLS * ROWS)),
    rows: POSES.map(() => 0),
  };
}

/**
 * Sphere-trace one pose, resuming at `fromRow` and stopping at `toRow`.
 *
 * Returns the next unrendered row, so the caller can spend a time budget and
 * come back next frame.
 */
export function renderPose(
  buf: Float32Array,
  fromRow: number,
  toRow: number,
  pose: Pose
) {
  const cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw);
  const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  const ox = 0, oy = LOOK_Y + pose.shift, oz = pose.dist;

  // Aim at the figure's mass, not the world origin. The ray must start at the
  // camera and be offset so the subject sits centred in the frame.
  const ty = LOOK_Y - oy;

  for (let y = fromRow; y < toRow; y++) {
    for (let x = 0; x < COLS; x++) {
      // Ray through this character cell, centred on the cell.
      const nx = ((x + 0.5) / COLS) * 2 - 1;
      const ny = 1 - ((y + 0.5) / ROWS) * 2;

      // Camera basis, then the ray direction. `ty` shifts the aim point down
      // the screen so the torso is centred rather than the neck.
      let dx = nx * ASPECT;
      let dy = ny + ty * 0.14;
      let dz = -1;
      // Yaw the ray, then pitch it.
      const rx = dx * cy + dz * sy;
      const rz = -dx * sy + dz * cy;
      dx = rx; dz = rz;
      const ry = dy * cp - dz * sp;
      const rz2 = dy * sp + dz * cp;
      dy = ry; dz = rz2;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= len; dy /= len; dz /= len;

      // Bounding-sphere reject. The subject is centred near the origin, so this
      // discards every background ray for the cost of one quadratic.
      const b = ox * dx + oy * dy + oz * dz;
      const disc = b * b - (ox * ox + oy * oy + oz * oz - BOUND * BOUND);
      if (disc <= 0) { buf[y * COLS + x] = 0; continue; }
      const sq = Math.sqrt(disc);
      let t = Math.max(0.01, -b - sq);

      let hit = 0;
      for (let i = 0; i < MAX_STEPS; i++) {
        const d = scene(ox + dx * t, oy + dy * t, oz + dz * t);
        if (d < SURF) { hit = 1; break; }
        // Under-stepping: the ellipsoid primitive is not a true distance
        // bound, so 0.85 avoids overshooting through the surface.
        t += d * 0.85;
        if (t > BOUND * 2.2) break;
      }

      if (!hit) { buf[y * COLS + x] = 0; continue; }

      /* ---- shading ---- */
      const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;

      // Gradient normal, central differences.
      const e = 0.0015;
      const gx = scene(px + e, py, pz) - scene(px - e, py, pz);
      const gy = scene(px, py + e, pz) - scene(px, py - e, pz);
      const gz = scene(px, py, pz + e) - scene(px, py, pz - e);
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      const gnx = gx / gl, gny = gy / gl, gnz = gz / gl;

      // Key light, high and camera-left. The references are lit from one side
      // and fall off hard; a symmetric light would flatten the whole figure.
      const LX = -0.55, LY = 0.72, LZ = 0.42;
      let ndl = Math.max(0, gnx * LX + gny * LY + gnz * LZ);
      // Squared falloff. A linear dot pushes every surface facing the light
      // into the top of the ramp, which destroys the mid-tones — and the
      // mid-tones are the entire reason this reads as a photograph rather than
      // as a silhouette. Squaring keeps the lit areas in the middle of the
      // range where the dither has something to work with.
      ndl *= ndl;

      // Soft shadow: march toward the light. Penumbra comes from the distance
      // travelled, which is what makes the terminator gradual instead of hard.
      let sh = 1;
      let ts = 0.02;
      for (let i = 0; i < 18; i++) {
        const sd = scene(px + LX * ts, py + LY * ts, pz + LZ * ts);
        if (sd < SURF) { sh = 0; break; }
        sh = Math.min(sh, 9 * sd / ts);
        ts += Math.max(0.012, sd);
        if (ts > 1.1) break;
      }
      sh = Math.max(0, Math.min(1, sh));

      // Ambient occlusion, 5 taps along the normal.
      let ao = 0;
      for (let i = 1; i <= 5; i++) {
        const h = 0.02 + i * i * 0.012;
        ao += (h - scene(px + gnx * h, py + gny * h, pz + gnz * h)) / h;
      }
      ao = Math.max(0, Math.min(1, 1 - ao / 5 * 0.9));

      // Cool fill from the opposite side keeps shadow from going dead flat.
      const fill = Math.max(0, gnx * 0.6 - gny * 0.2 - gnz * 0.5);

      // Ambient is generous on purpose. A hooded figure is mostly in shadow, and
      // an earlier low ambient crushed the interior to the bottom of the ramp —
      // which reads as a hollow outline, not a body. Real photographic
      // shadows sit around a fifth of the range, not at zero.
      let L = ndl * sh * 0.66 + fill * 0.14 + 0.17;
      // AO modulates rather than annihilates. Multiplying down to 0.3 was
      // removing the mid-tones the dither needs.
      L *= 0.62 + ao * 0.38;

      // Rim light along the hood edge — a thin bright separation. Deliberately
      // weak: a strong rim turns the whole silhouette into one solid band of
      // the brightest glyph, which is the opposite of a photograph.
      const rim = Math.pow(1 - Math.abs(dz), 9) * ao * 0.16;

      // Filmic knee rather than a hard clamp, so the brightest few percent
      // separate instead of flattening into one solid value.
      L += rim;
      L = L / (1 + L * 0.28);

      buf[y * COLS + x] = L;
    }
  }
  return toRow;
}

/* ------------------------------------------------------------------ *
 * Quantisation
 * ------------------------------------------------------------------ */

/**
 * Blend two rendered poses and quantise to glyphs via ordered dithering.
 *
 * `mix` < 1 cross-fades toward pose b. Rows beyond either pose's resolved depth
 * render as background, which produces the "developing" look on first paint.
 */
export function quantise(
  a: Float32Array,
  b: Float32Array | null,
  mix: number,
  rowsA: number,
  rowsB: number,
  out: string[]
) {
  const n = RAMP.length;

  for (let y = 0; y < ROWS; y++) {
    let row = "";
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const thr = BAYER[(y & 7) * 8 + (x & 7)];

      let l = 0;
      if (y < rowsA) l = a[i];
      if (b && y < rowsB) l = l + (b[i] - l) * mix;

      if (l <= 0.012) { row += " "; continue; }

      // Ordered dither: offset the quantisation threshold per cell. Expanding
      // by (1 - thr) means a cell only reaches the next glyph when its tone
      // clears a threshold that varies across the image, which is what breaks
      // flat areas into stipple.
      const q = l * (1 + (1 - thr) * 0.85) - thr * 0.42;
      let g = (q * n) | 0;
      if (g < 1) g = 1;
      else if (g > n - 1) g = n - 1;
      row += RAMP[g];
    }
    out[y] = row;
  }
}
