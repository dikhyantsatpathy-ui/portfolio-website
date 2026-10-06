import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "../lib/hooks";
import { OVERDRIVE_EVENT, SHOCKWAVE_EVENT, PALETTE_EVENT } from "./EasterEggs";

/**
 * The centrepiece: a brass gyroscope that lives in the centre-right of the
 * viewport and stays with you as you scroll.
 *
 * Why Three.js rather than more CSS 3D: this needs real geometry, PBR metal,
 * bloom and a shadow-catching floor. CSS can fake a corridor, but it cannot do
 * anisotropic metal or a glowing core.
 *
 * Design intent — "industrial":
 *  - Machined-brass PBR (metalness ~1, low roughness) lit by a warm key light
 *    and a cool rim, which is what makes metal read as metal. Without the rim
 *    light, brass goes flat and muddy.
 *  - Concentric gimbal rings that counter-rotate. Real gyroscopes are about
 *    nested axes; the motion has to obey that or the eye reads it as noise.
 *  - The model is built from primitives rather than a loaded GLB so there is
 *    no asset to 404, no download cost, and it stays under a few kB of code.
 *
 * Scroll behaviour (the "morph" the user asked for): the rig lerps between
 * positions across discrete scroll zones, so it appears to travel and re-frame
 * rather than merely fading. Position, rotation and scale are all driven from
 * one normalised progress value.
 *
 * Performance rules:
 *  - Cap pixel ratio at 2. Beyond that you pay for nothing visible.
 *  - Pause the loop entirely when off-screen or when the tab is hidden.
 *  - Prefer `setAnimationLoop` so Three can stop it cleanly.
 *  - Under prefers-reduced-motion, render a single static frame and stop.
 */

type Zone = {
  /** Scroll progress 0..1 at which this pose is fully reached. */
  at: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  spin: number;
  tilt: number;
};

/** Target frame interval. ~32fps: indistinguishable from 60 for a slow
    mechanical spin, and roughly half the render cost. */
const FRAME_BUDGET = 1 / 32;

/** Discrete poses the rig moves between as the page scrolls.
 *
 * The machine now genuinely *travels down* the viewport rather than nudging
 * inside it — Y runs from +6.5 above the camera to -9 below it across the page,
 * so it descends past the reader the way the reference's astronaut does.
 * It also recedes in Z and shrinks as it goes, so it reads as flying away into
 * the distance as well as downward.
 *
 * Z is held well back (negative) through the prose sections so the machine
 * never sits on top of body copy.
 */
/** Discrete poses the rig moves between as the page scrolls.
 *
 * CONSTRAINT — these must stay inside the frustum or the machine vanishes and
 * the page reads as static. At 1440x900 with the camera at z=7.4 and a 38deg
 * vertical FOV, the visible half-height at the rig's depth d is d * tan(19deg):
 *
 *     z =  0.0  ->  d 7.4  ->  halfW 4.08   halfH 2.55
 *     z = -3.0  ->  d 10.4  ->  halfW 5.73   halfH 3.58
 *     z = -5.0  ->  d 12.4  ->  halfW 6.83   halfH 4.27
 *
 * The rig's own radius is 2.05 * scale, so it must satisfy
 * |x| + 2.05*scale < halfW and |y| + 2.05*scale < halfH.
 * An earlier revision used y: 6.5 in the hero, which is more than double the
 * visible half-height — the machine was off-screen for the entire page.
 */
const POSES: Zone[] = [
  // Hero: right of the headline. 2.6 + 1.27 = 3.87 < 4.08.
  { at: 0.0, x: 2.6, y: -0.2, z: 0.0, scale: 0.62, spin: 0.0, tilt: 0.12 },
  // Descends and grows as the hero scrolls away.
  { at: 0.14, x: 1.6, y: -1.0, z: -2.0, scale: 0.72, spin: 1.2, tilt: -0.08 },
  // About/prose: right of the text column, dropped back but clearly present.
  { at: 0.3, x: 2.8, y: -1.6, z: -4.0, scale: 0.62, spin: 2.0, tilt: 0.16 },
  // Swings to the left as the next section arrives.
  { at: 0.46, x: -3.0, y: -2.4, z: -4.5, scale: 0.58, spin: 2.9, tilt: -0.14 },
  // Pinned work track: right and far back so the cards own the screen.
  { at: 0.62, x: 3.6, y: -1.0, z: -6.0, scale: 0.55, spin: 3.8, tilt: 0.1 },
  // Craft: back toward centre, rising.
  { at: 0.8, x: -2.4, y: 0.3, z: -3.0, scale: 0.7, spin: 4.8, tilt: -0.12 },
  // Contact: comes forward and settles low-right, like arriving. z=+1 puts the
  // rig at distance 6.4, where halfH is only 2.2 — so y must stay small or it
  // drops out of frame (measured: y=-2.2 at z=+1 was off-screen).
  { at: 1.0, x: 1.9, y: -0.9, z: 0.4, scale: 0.72, spin: 6.0, tilt: 0.0 },
];

function samplePoses(p: number, out: Zone) {
  let i = 0;
  while (i < POSES.length - 2 && p > POSES[i + 1].at) i++;
  const a = POSES[i];
  const b = POSES[i + 1];
  // Smoothstep between poses so the motion eases rather than hinging.
  const raw = (p - a.at) / (b.at - a.at || 1);
  const t = Math.max(0, Math.min(1, raw));
  const e = t * t * (3 - 2 * t);
  out.x = a.x + (b.x - a.x) * e;
  out.y = a.y + (b.y - a.y) * e;
  out.z = a.z + (b.z - a.z) * e;
  out.scale = a.scale + (b.scale - a.scale) * e;
  out.spin = a.spin + (b.spin - a.spin) * e;
  out.tilt = a.tilt + (b.tilt - a.tilt) * e;
  return out;
}

export default function HeroMachine() {
  const mountRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---- Renderer ------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    // Tone mapping + sRGB output, or the brass reads muddy/washed.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 7.4);

    // ---- Lighting ------------------------------------------------------
    // Warm key from upper-left, cool rim from lower-right behind. The rim is
    // what separates the metal from the dark background.
    const key = new THREE.DirectionalLight(0xdce8ff, 3.1);
    key.position.set(4, 5, 6);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x3b7bff, 2.6);
    rim.position.set(-5, -2, -4);
    scene.add(rim);

    const fill = new THREE.AmbientLight(0x9fb4e0, 0.42);
    scene.add(fill);

    // The glowing core, which also lights its own surroundings.
    const coreLight = new THREE.PointLight(0x3b7bff, 1.8, 9, 2);
    scene.add(coreLight);

    // ---- Materials -----------------------------------------------------
    // Anodised blue-steel. High metalness with a low roughness is what makes
    // it read as machined metal rather than plastic; the env map gives it
    // something to reflect.
    const brass = new THREE.MeshStandardMaterial({
      color: 0x5f7fd6,
      metalness: 1.0,
      roughness: 0.2,
      envMapIntensity: 1.6,
    });

    const darkBrass = new THREE.MeshStandardMaterial({
      color: 0x2a3a63,
      metalness: 1.0,
      roughness: 0.44,
      envMapIntensity: 1.2,
    });

    const steel = new THREE.MeshStandardMaterial({
      color: 0xc3d3f0,
      metalness: 1.0,
      roughness: 0.28,
      envMapIntensity: 1.4,
    });

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x2b4fd6,
      emissive: 0x2f6bff,
      // Kept low on purpose. ACES tone mapping plus a high emissive clips the
      // core to flat white and you lose the faceting that makes it read as a
      // solid object.
      emissiveIntensity: 0.95,
      metalness: 0.4,
      roughness: 0.3,
    });

    // ---- Geometry ------------------------------------------------------
    const rig = new THREE.Group();
    scene.add(rig);

    // Environment: without an env map, metalness=1 has nothing to reflect and
    // renders nearly black. A tiny generated gradient is cheap and fixes it.
    const envCanvas = document.createElement("canvas");
    envCanvas.width = 64;
    envCanvas.height = 64;
    const ec = envCanvas.getContext("2d")!;
    const grad = ec.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, "#26365e");
    grad.addColorStop(0.5, "#0a0e1c");
    grad.addColorStop(1, "#182038");
    ec.fillStyle = grad;
    ec.fillRect(0, 0, 64, 64);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.colorSpace = THREE.SRGBColorSpace;
    scene.environment = envTex;

    // Outer gimbal ring
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.115, 28, 160),
      brass
    );
    outerRing.rotation.x = Math.PI / 2;
    rig.add(outerRing);

    // Bolt heads around the outer ring — the detail that sells "machined".
    const boltGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, steel);
      bolt.position.set(Math.cos(a) * 2.05, 0.13, Math.sin(a) * 2.05);
      bolt.rotation.z = a;
      rig.add(bolt);
    }

    // Middle gimbal — counter-rotates on a different axis
    const midRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.095, 26, 140),
      darkBrass
    );
    midRing.rotation.y = Math.PI / 2;
    rig.add(midRing);

    // Inner ring, tilted
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.08, 24, 120),
      brass
    );
    innerRing.rotation.x = Math.PI / 2.6;
    rig.add(innerRing);

    // Rotor disc: the spinning element
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.86, 0.09, 64, 1, false),
      steel
    );
    rotor.rotation.x = Math.PI / 2;
    rig.add(rotor);

    // Cut-outs in the rotor so light gets through it — reads as engineered.
    const slotGeo = new THREE.BoxGeometry(0.1, 0.12, 0.94);
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Mesh(slotGeo, darkBrass);
      slot.rotation.z = (i / 6) * Math.PI;
      rotor.add(slot);
    }

    // Glowing core at the centre
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), coreMat);
    rig.add(core);

    // Halo shell around the core, additive so it reads as light not geometry.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x3b7bff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    rig.add(halo);

    // Axis pylon through the middle
    const pylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 4.4, 16),
      steel
    );
    pylon.rotation.z = Math.PI / 2;
    rig.add(pylon);

    // End caps on the pylon
    const capGeo = new THREE.ConeGeometry(0.11, 0.3, 20);
    const capL = new THREE.Mesh(capGeo, brass);
    capL.position.x = -2.3;
    capL.rotation.z = Math.PI / 2;
    rig.add(capL);
    const capR = new THREE.Mesh(capGeo, brass);
    capR.position.x = 2.3;
    capR.rotation.z = -Math.PI / 2;
    rig.add(capR);

    // ---- Starfield -----------------------------------------------------
    // The "cosmic scroll" mechanic: a particle field that streams toward the
    // camera as you scroll, so scrolling genuinely flies you through space
    // instead of paging past a static image.
    //
    // This lives in the same scene as the machine on purpose. A second
    // WebGLRenderer would mean a second full-viewport render target and double
    // the fill cost, which is exactly what made an earlier build expensive.
    const STAR_COUNT = 1400;

    let sseed = 1337;
    const rnd = () => {
      // Seeded LCG: identical field on every load. A Math.random() field
      // reshuffles on re-render and reads as noise rather than as a place.
      sseed = (sseed * 16807) % 2147483647;
      return sseed / 2147483647;
    };

    const starPos = new Float32Array(STAR_COUNT * 3);
    const starCol = new Float32Array(STAR_COUNT * 3);
    const starSpd = new Float32Array(STAR_COUNT);

    const cBlue = new THREE.Color(0x8fb4ff);
    const cWhite = new THREE.Color(0xffffff);
    const cCyan = new THREE.Color(0x4fd8ff);
    const cTmp = new THREE.Color();

    for (let i = 0; i < STAR_COUNT; i++) {
      // Cylinder shell, so the field surrounds the camera instead of sitting
      // in a flat slab in front of it.
      const radius = 14 + rnd() * 70;
      const theta = rnd() * Math.PI * 2;
      starPos[i * 3] = Math.cos(theta) * radius;
      starPos[i * 3 + 1] = Math.sin(theta) * radius;
      starPos[i * 3 + 2] = -rnd() * 260;

      const r = rnd();
      cTmp.copy(r > 0.86 ? cCyan : r > 0.45 ? cBlue : cWhite);
      starCol[i * 3] = cTmp.r;
      starCol[i * 3 + 1] = cTmp.g;
      starCol[i * 3 + 2] = cTmp.b;

      // Nearer stars streak faster. Per-star speed is what sells depth.
      starSpd[i] = 0.6 + rnd() * 1.6;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));

    // A PointsMaterial with no `map` renders each point as a hard SQUARE. A tiny
    // generated radial-gradient sprite is what makes them read as stars.
    const starSpriteCanvas = document.createElement("canvas");
    starSpriteCanvas.width = 32;
    starSpriteCanvas.height = 32;
    const sctx = starSpriteCanvas.getContext("2d")!;
    const sgrad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    sgrad.addColorStop(0, "rgba(255,255,255,1)");
    sgrad.addColorStop(0.35, "rgba(255,255,255,0.75)");
    sgrad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 32, 32);
    const starTex = new THREE.CanvasTexture(starSpriteCanvas);

    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      sizeAttenuation: true,
      vertexColors: true,
      map: starTex,
      alphaTest: 0.01,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ---- Pointer interaction ------------------------------------------
    // Drag anywhere on the page to spin. Listeners are on `window` rather than
    // the canvas because the canvas is pointer-events-none (it sits behind the
    // content and must not steal clicks from links and buttons).
    let dragging = false;
    let lastX = 0;
    let dragSpin = 0;
    let dragVel = 0;

    const onDown = (e: PointerEvent) => {
      // Only left/middle button, and not when starting on a real control.
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button, input, textarea, select, [role='button']")) return;
      dragging = true;
      lastX = e.clientX;
      document.body.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragSpin += dx * 0.006;
      dragVel = dx * 0.006;
    };
    const onUp = () => {
      dragging = false;
      document.body.style.cursor = "";
    };

    document.body.style.cursor = "grab";
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // ---- Section bounds ----------------------------------------------
    // Measured once and cached. Calling getBoundingClientRect() inside the
    // scroll handler forces a synchronous layout on every scroll event, which is
    // a classic cause of scroll jank. Declared here, above `resize`, because
    // resize() refreshes it — referencing it later throws a TDZ ReferenceError
    // that blanks the whole page.
    function readZones() {
      const vh = window.innerHeight;
      const bounds = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const top = el.getBoundingClientRect().top + window.scrollY;
        return { top, bottom: top + el.offsetHeight };
      };
      return {
        vh,
        about: bounds("about"),
        work: bounds("work"),
        craft: bounds("craft"),
        contact: bounds("contact"),
        docHeight: document.documentElement.scrollHeight,
      };
    }

    let zones = readZones();

    // ---- Sizing --------------------------------------------------------
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      // Capped at 1.5, not 2. A 1440x900 hero at dpr 2 is a 5.2 megapixel
      // render target; at 1.5 it is 2.9MP. The machine is a smooth metal
      // object with no fine detail, so the difference is invisible and the
      // fill cost is not.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Layout changed, so cached section bounds are stale.
      zones = readZones();
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- Overdrive reaction ------------------------------------------
    // When the Konami code fires, the whole rig flares: faster spin, hotter
    // core, red-shifted key light. Reads as the machine powering up.
    let overdrive = false;
    let blueprint = false;
    let flare = 0;
    const onOverdrive = (e: Event) => {
      overdrive = (e as CustomEvent<boolean>).detail;
    };
    window.addEventListener(OVERDRIVE_EVENT, onOverdrive);

    // Blueprint mode is a class on <html>. The GL materials can't read CSS, so they
    // are shifted explicitly — taking the state from the event payload rather
    // than re-reading the class, which can already have been toggled back.
    // The base palette is blue, so blueprint flips to the warm counter-mode.
    const applyPalette = (on: boolean) => {
      // Read by the render loop each frame so it can compose with overdrive.
      blueprint = on;
      brass.color.setHex(on ? 0xd9713f : 0x5f7fd6);
      darkBrass.color.setHex(on ? 0x8a3f1c : 0x2a3a63);
      steel.color.setHex(on ? 0xf2ddc8 : 0xc3d3f0);
      key.color.setHex(on ? 0xffd9b8 : 0xdce8ff);
      key.intensity = on ? 2.6 : 3.1;
      rim.color.setHex(on ? 0xff9a4d : 0x3b7bff);
      coreMat.emissive.setHex(on ? 0xff7a1a : 0x2f6bff);
      coreLight.color.setHex(on ? 0xff7a1a : 0x3b7bff);
    };
    // Materials are declared earlier in this effect, so the palette can be
    // applied immediately and the listener bound now.
    const onPalette = (e: Event) => {
      applyPalette(Boolean((e as CustomEvent<boolean>).detail));
    };

    // Covers blueprint mode being toggled before this effect ran.
    applyPalette(document.documentElement.classList.contains("blueprint"));
    // Must be `window`, not `document`: these events are dispatched on window,
    // and window is the top of the propagation path — a dispatch there never
    // reaches document listeners.
    window.addEventListener(PALETTE_EVENT, onPalette);

    // Clicks land on the DOM, not the canvas (it's pointer-events-none), so
    // this listens at the window level but skips real controls — clicking a
    // link should navigate, not detonate something.
    const onClickKick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("a, button, input, textarea, select, [role='button']")) return;
      // This component is the single dispatcher for shockwaves. EasterEggs only
      // listens — if it dispatched too, one click would cascade into four.
      window.dispatchEvent(new CustomEvent(SHOCKWAVE_EVENT));
      flare = 1;
    };
    window.addEventListener("click", onClickKick);

    // ---- Loop ----------------------------------------------------------
    let scrollTarget = 0;
    let scrollSmooth = 0;
    let visible = true;
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const pose: Zone = { ...POSES[0] };

    const onScroll = () => {
        const y = window.scrollY;
        const max = zones.docHeight - window.innerHeight;
        scrollTarget = max > 0 ? y / max : 0;

        // Scroll velocity. This is what makes the starfield surge when you flick
        // the wheel and settle when you stop — the responsiveness that makes
        // the page feel like flying rather than paging.
        const delta = y - lastScrollY;
        lastScrollY = y;
        // Clamped so a violent trackpad flick can't fling the field.
        scrollVelocity = Math.max(-320, Math.min(320, delta));
      };

      onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Content streams in from Firestore and the pinned section changes page
    // height, which invalidates the cached bounds. Re-measure after the dust
    // settles rather than on every scroll frame.
    const remeasure = () => {
      zones = readZones();
      onScroll();
    };
    const timers = [
      window.setTimeout(remeasure, 500),
      window.setTimeout(remeasure, 1500),
    ];
    window.addEventListener("load", remeasure);

    const io = new IntersectionObserver(
      ([e]) => {
        // No threshold check needed: the mount is fixed and full-viewport, so it
        // is "intersecting" whenever the document itself is on screen.
        visible = document.visibilityState === "visible" && e.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(mount);

    let running = true;

    if (reduced) {
      // Single static frame. Rendered, not animated.
      samplePoses(0, pose);
      rig.position.set(pose.x, pose.y, pose.z);
      rig.scale.setScalar(pose.scale);
      renderer.render(scene, camera);
    } else {
      let last = performance.now();
      let elapsed = 0;

      renderer.setAnimationLoop(() => {
        const now = performance.now();
        // Clamp dt so a backgrounded tab doesn't teleport the animation.
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        // Time-based frame skipping. At 32fps the scene is visually identical
        // to 60 and costs roughly half as much, which matters because this is a
        // full-viewport render target.
        if (dt < FRAME_BUDGET) return;

        elapsed += dt;

        // ---- Starfield: the scroll journey -------------------------------
        // Stars stream toward the camera. Idle drift keeps the scene alive when
        // the user isn't scrolling; scroll velocity adds a surge on top, so a
        // flick of the wheel visibly accelerates you forward.
        const starStep = (7 + Math.abs(scrollVelocity) * 2.1) * dt;
        const starArr = starGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < STAR_COUNT; i++) {
          const zi = i * 3 + 2;
          starArr[zi] += starStep * starSpd[i];
          // Wrap past the camera back to the far end. Wrapping rather than
          // resetting is what makes the field continuous instead of blinking.
          if (starArr[zi] > 22) starArr[zi] -= 280;
        }
        starGeo.attributes.position.needsUpdate = true;

        // Roll the field so it never reads as a flat sheet.
        stars.rotation.z = elapsed * 0.014;
        stars.rotation.y = elapsed * 0.022;
        stars.rotation.x = Math.sin(elapsed * 0.14) * 0.1;

        // Fade the field out over the contact form, where it would compete
        // with the form fields for attention.
        starMat.opacity = scrollSmooth > 0.86 ? 0.28 : 0.9;

        scrollVelocity *= 0.9;

        // Damp scroll so the rig glides instead of snapping between zones.
        scrollSmooth += (scrollTarget - scrollSmooth) * Math.min(1, dt * 3.2);
        samplePoses(scrollSmooth, pose);

        rig.position.set(pose.x, pose.y, pose.z);
        rig.scale.setScalar(pose.scale);

        // Tumble faster the deeper you scroll, so the descent builds.
        const dive = 1 + scrollSmooth * 1.9;
        dragVel *= 0.94;
        dragSpin += dragVel;
        rig.rotation.x = pose.tilt + Math.sin(elapsed * 0.5) * 0.06;
        rig.rotation.z = Math.sin(elapsed * 0.33) * 0.04;

        // Gimbals counter-rotate on their own axes.
        innerRing.rotation.y = elapsed * 0.46 * dive;

        // Core pulse.
        const pulse = 1 + Math.sin(elapsed * 2.1) * 0.09;
        core.scale.setScalar(pulse);

        // Overdrive: everything ramps. Multiplied into the base values so the
        // normal look is untouched when it's off.
        const od = overdrive ? 1 : 0;
        flare *= 0.94; // click kick decays

        // Blueprint is a palette, not a pulse. Overdrive wins when both are on.
        // These are set here rather than only in applyPalette because the loop
        // runs continuously and would otherwise stomp the palette each frame.
        const bp = blueprint ? 1 : 0;

        coreLight.intensity =
          (1.4 + Math.sin(elapsed * 2.1) * 0.45) * (1 + od * 1.8 + flare * 1.4);
        coreLight.color.setHex(od ? 0xff2f6a : bp ? 0xff7a1a : 0x3b7bff);
        coreMat.emissiveIntensity =
          (0.9 + Math.sin(elapsed * 2.1) * 0.25) * (1 + od * 1.4 + flare);
        coreMat.emissive.setHex(od ? 0xff1f5c : bp ? 0xff7a1a : 0x2f6bff);
        (halo.material as THREE.MeshBasicMaterial).opacity =
          0.16 * (1 + od * 1.8 + flare * 1.2);
        key.intensity = (bp ? 2.6 : 3.1) * (1 + od * 0.7);
        key.color.setHex(od ? 0xffb4c8 : bp ? 0xffd9b8 : 0xdce8ff);
        rim.color.setHex(bp ? 0xff9a4d : od ? 0xff2f6a : 0x3b7bff);

        // Idle spin speeds up under overdrive, and with the dive multiplier.
        const speed = (1 + od * 2.6) * dive;
        rig.rotation.y = pose.spin + dragSpin + elapsed * 0.16 * speed;
        rotor.rotation.y = elapsed * 2.6 * speed;
        outerRing.rotation.z = elapsed * 0.22 * speed;
        midRing.rotation.z = -elapsed * 0.34 * speed;

        // Camera drifts slowly. The dip is deliberately small: a large vertical
        // camera offset shifts the frustum and invalidates every POSES entry,
        // which is how the machine previously ended up off-screen.
        camera.position.x = Math.sin(elapsed * 0.22) * 0.22;
        camera.position.y = Math.cos(elapsed * 0.19) * 0.16 - scrollSmooth * 0.45;
        camera.position.z = 7.4 - flare * 0.9;
        camera.lookAt(0, -scrollSmooth * 0.55, 0);

        if (visible && running) renderer.render(scene, camera);
      });
    }

    // ---- Teardown ------------------------------------------------------
    return () => {
      running = false;
      renderer.setAnimationLoop(null);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", remeasure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("click", onClickKick);
      // Was registered on `window`, so it must be removed from `window`.
      // Mismatched add/remove targets leak the listener: under StrictMode's
      // double-mount it accumulated, and one click fired N shockwaves.
      window.removeEventListener("click", onClickKick);
      window.removeEventListener(OVERDRIVE_EVENT, onOverdrive);
      window.removeEventListener(PALETTE_EVENT, onPalette);
      document.body.style.cursor = "";

      // Explicit disposal. Three does not free GPU resources on unmount, and
      // this component mounts for the life of the page.
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      envTex.dispose();
      starGeo.dispose();
      starMat.dispose();
      starTex.dispose();
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
    };
  }, [reduced]);

  return (
    // Fixed, not absolute: the machine persists for the whole page and is
    // re-framed by scroll, which is the effect being asked for. It sits behind
    // content (z-0) and is pointer-events-none so it never blocks links —
    // the drag-to-spin is handled on a window-level listener instead.
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden select-none md:block"
    />
  );
}