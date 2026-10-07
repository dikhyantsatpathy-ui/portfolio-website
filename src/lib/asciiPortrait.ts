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
