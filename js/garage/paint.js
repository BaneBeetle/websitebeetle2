/* Canvas texture factory.
   There is no Blender in this pipeline, so every "baked" thing here is
   painted at runtime into a 2D canvas: floor light pools, the gradient
   environment the car paint reflects, screen content, posters, signage.
   Text stays crisp because it is drawn at device scale, not sampled. */

import * as THREE from 'three';

export const INK = '#e9edf3';
export const INK2 = '#a7b0bd';
export const INK3 = '#6f7885';
export const BLUE = '#3b6fd4';
export const BLUE_LIT = '#7aa7ff';
export const PANEL = '#161a21';

const FONT_D = '"Archivo Black","Archivo",system-ui,sans-serif';
const FONT_S = '"Archivo",system-ui,sans-serif';
const FONT_M = '"JetBrains Mono",ui-monospace,Menlo,monospace';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  return { c, x, w, h };
}

export function toTexture(c, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.needsUpdate = true;
  return t;
}

/* ---- text helpers ------------------------------------------------- */

export function line(x, text, { font = FONT_S, size = 24, weight = 400, color = INK,
                                x: px = 0, y: py = 0, align = 'left', track = 0,
                                upper = false } = {}) {
  x.save();
  x.font = `${weight} ${size}px ${font}`;
  x.fillStyle = color;
  x.textBaseline = 'alphabetic';
  const s = upper ? text.toUpperCase() : text;
  if (!track) {
    x.textAlign = align;
    x.fillText(s, px, py);
  } else {
    // manual tracking: canvas has no letter-spacing everywhere yet
    const chars = [...s];
    const width = chars.reduce((a, ch) => a + x.measureText(ch).width + track, -track);
    let cx = align === 'center' ? px - width / 2 : align === 'right' ? px - width : px;
    x.textAlign = 'left';
    for (const ch of chars) { x.fillText(ch, cx, py); cx += x.measureText(ch).width + track; }
  }
  x.restore();
}

export function wrap(x, text, { font = FONT_S, size = 20, weight = 400, color = INK2,
                                x: px = 0, y: py = 0, max = 400, leading = 1.5 } = {}) {
  x.save();
  x.font = `${weight} ${size}px ${font}`;
  x.fillStyle = color;
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  const words = String(text).split(/\s+/);
  let cur = '', y = py;
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (x.measureText(test).width > max && cur) {
      x.fillText(cur, px, y); y += size * leading; cur = w;
    } else cur = test;
  }
  if (cur) { x.fillText(cur, px, y); y += size * leading; }
  x.restore();
  return y;
}

export const fonts = { display: FONT_D, sans: FONT_S, mono: FONT_M };

/* ---- environment -------------------------------------------------- */

/* Equirect gradient the car's clearcoat reflects. Two ceiling strip
   lights read as long highlights down the flanks, which is the single
   cue that makes painted metal look like painted metal. */
export function envTexture() {
  const { c, x, w, h } = canvas(1024, 512);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, '#20262f');
  g.addColorStop(0.42, '#161b23');
  g.addColorStop(0.52, '#0d1015');
  g.addColorStop(1.00, '#05070a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  // two strip lights across the ceiling band
  for (const cy of [0.16, 0.30]) {
    const gg = x.createLinearGradient(0, h * cy - 26, 0, h * cy + 26);
    gg.addColorStop(0, 'rgba(220,232,255,0)');
    gg.addColorStop(0.5, 'rgba(226,238,255,0.92)');
    gg.addColorStop(1, 'rgba(220,232,255,0)');
    x.fillStyle = gg; x.fillRect(0, h * cy - 26, w, 52);
  }
  // a cool bounce off the far wall so the flanks are not dead black
  const b = x.createRadialGradient(w * 0.72, h * 0.58, 10, w * 0.72, h * 0.58, w * 0.30);
  b.addColorStop(0, 'rgba(86,120,190,0.30)');
  b.addColorStop(1, 'rgba(86,120,190,0)');
  x.fillStyle = b; x.fillRect(0, 0, w, h);

  const t = toTexture(c, { srgb: false });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/* ---- floor -------------------------------------------------------- */

/* Sealed concrete with painted light pools, a parking box, and floor
   stencils. The stencils are the menu: the room tells you where to go
   instead of a nav bar doing it. */
export function floorTexture(stencils) {
  const S = 2048;
  const { c, x, w, h } = canvas(S, S);
  x.fillStyle = '#171b21'; x.fillRect(0, 0, w, h);

  // concrete mottle
  for (let i = 0; i < 5200; i++) {
    const r = 2 + Math.random() * 26;
    x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${0.010 + Math.random() * 0.022})`;
    x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, 6.284); x.fill();
  }
  // control joints
  x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 4;
  for (const p of [0.333, 0.666]) {
    x.beginPath(); x.moveTo(p * w, 0); x.lineTo(p * w, h); x.stroke();
    x.beginPath(); x.moveTo(0, p * h); x.lineTo(w, p * h); x.stroke();
  }

  // light pools, painted not computed
  x.globalCompositeOperation = 'lighter';
  const pools = [[0.5, 0.30, 0.44, 1.0], [0.5, 0.70, 0.40, 0.8], [0.86, 0.52, 0.20, 0.55], [0.14, 0.46, 0.20, 0.5]];
  for (const [px, py, pr, pa] of pools) {
    const g = x.createRadialGradient(px * w, py * h, 4, px * w, py * h, pr * w);
    g.addColorStop(0, `rgba(150,172,206,${0.30 * pa})`);
    g.addColorStop(0.45, `rgba(110,132,168,${0.12 * pa})`);
    g.addColorStop(1, 'rgba(90,110,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  x.globalCompositeOperation = 'source-over';

  // corner darkening reads as contact occlusion at the walls
  const vg = x.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  x.fillStyle = vg; x.fillRect(0, 0, w, h);

  // parking box, worn
  x.save();
  x.globalAlpha = 0.5;
  x.strokeStyle = '#d8c26a'; x.lineWidth = 9;
  x.setLineDash([90, 26]);
  x.strokeRect(w * 0.30, h * 0.24, w * 0.40, h * 0.53);
  x.restore();

  // stencils: "PROJECTS -> WORKBENCH" style wayfinding, painted on concrete
  x.save();
  x.globalAlpha = 0.42;
  for (const s of stencils) {
    x.save();
    x.translate(s.u * w, s.v * h);
    x.rotate((s.rot || 0) * Math.PI / 180);
    line(x, s.text, { font: FONT_D, size: s.size || 40, color: '#c9d4e6', align: 'center', track: 5, upper: true });
    x.restore();
  }
  x.restore();

  return toTexture(c);
}

/* ---- surfaces ----------------------------------------------------- */

export function wallTexture(tint = '#1c212a') {
  const { c, x, w, h } = canvas(1024, 512);
  x.fillStyle = tint; x.fillRect(0, 0, w, h);
  // painted breeze block: courses of blocks with mortar lines
  const rows = 10, cols = 10, bh = h / rows, bw = w / cols;
  for (let r = 0; r < rows; r++) {
    for (let cI = 0; cI < cols; cI++) {
      const off = (r % 2) * bw * 0.5;
      const px = cI * bw + off - bw, py = r * bh;
      x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${0.012 + Math.random() * 0.026})`;
      x.fillRect(px + 3, py + 3, bw - 6, bh - 6);
    }
    x.strokeStyle = 'rgba(0,0,0,0.30)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, r * bh); x.lineTo(w, r * bh); x.stroke();
  }
  for (let cI = 0; cI <= cols; cI++) {
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cI * bw, 0); x.lineTo(cI * bw, h); x.stroke();
  }
  // top-lit falloff so walls are brighter near the ceiling lights
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.4, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return toTexture(c);
}

export function doorTexture() {
  const { c, x, w, h } = canvas(512, 1024);
  x.fillStyle = '#1a1f27'; x.fillRect(0, 0, w, h);
  const slat = 46;
  for (let y = 0; y < h; y += slat) {
    const g = x.createLinearGradient(0, y, 0, y + slat);
    g.addColorStop(0, '#232935');
    g.addColorStop(0.45, '#1b212a');
    g.addColorStop(0.55, '#12161d');
    g.addColorStop(1, '#232935');
    x.fillStyle = g; x.fillRect(0, y, w, slat);
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, y + slat - 4, w, 4);
  }
  const v = x.createLinearGradient(0, 0, w, 0);
  v.addColorStop(0, 'rgba(0,0,0,0.5)');
  v.addColorStop(0.5, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  return toTexture(c);
}

/* Carbon weave. The Karbonius airbox is the one part of the bay a car
   person will look straight at, and flat black plastic will not pass. */
export function carbonTexture(scale = 30, repeat = 18) {
  const S = 512;
  const { c, x, w, h } = canvas(S, S);
  x.fillStyle = '#0e1014'; x.fillRect(0, 0, w, h);
  const cell = S / scale;
  for (let iy = 0; iy < scale; iy++) {
    for (let ix = 0; ix < scale; ix++) {
      const over = (ix + iy) % 2 === 0;
      const px = ix * cell, py = iy * cell;
      const g = over
        ? x.createLinearGradient(px, py, px + cell, py)
        : x.createLinearGradient(px, py, px, py + cell);
      g.addColorStop(0, '#0d0f13');
      g.addColorStop(0.45, '#191d23');
      g.addColorStop(0.55, '#1c2027');
      g.addColorStop(1, '#0d0f13');
      x.fillStyle = g;
      x.fillRect(px, py, cell, cell);
    }
  }
  // clearcoat sheen across the weave
  const s2 = x.createLinearGradient(0, 0, w, h);
  s2.addColorStop(0, 'rgba(255,255,255,0.10)');
  s2.addColorStop(0.45, 'rgba(255,255,255,0.015)');
  s2.addColorStop(1, 'rgba(255,255,255,0.09)');
  x.fillStyle = s2; x.fillRect(0, 0, w, h);
  const t = toTexture(c, { repeat: [repeat, repeat], aniso: 8 });
  return t;
}

/* radial falloff used for blob shadows and light pools on props */
export function blobTexture(soft = 0.55) {
  const { c, x, w, h } = canvas(256, 256);
  const g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.80)');
  g.addColorStop(soft, 'rgba(0,0,0,0.30)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return toTexture(c, { srgb: false });
}

/* The corona of a lit ring, which is not the same shape as the glow of a
   lamp: a disc gradient is brightest in the middle, and the middle of an
   angel eye is the projector, which is dark. This peaks on the ring line at
   half the sprite's radius and falls away both inward and outward, so the
   light lands on the bowl and the glass rather than filling the hole. The
   tail carries a whisper of violet — the dusk photographs have it. */
export function haloTexture() {
  const { c, x, w, h } = canvas(256, 256);
  const g = x.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
  for (const [t, a, rgb] of [
    [0.00, 0.06, '255,255,255'],
    [0.20, 0.10, '255,255,255'],
    [0.32, 0.22, '255,255,255'],
    [0.42, 0.48, '255,255,255'],
    [0.47, 0.80, '255,255,255'],
    [0.50, 1.00, '255,255,255'],   // the ring sits here
    [0.53, 0.80, '255,253,255'],
    [0.58, 0.55, '253,248,255'],
    [0.66, 0.32, '250,243,255'],
    [0.76, 0.17, '245,236,255'],
    [0.88, 0.06, '239,230,255'],
    [1.00, 0.00, '234,226,255'],
  ]) g.addColorStop(t, `rgba(${rgb},${a})`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return toTexture(c);
}

/* The falloff carries as much as the colour does: `mid` is where the glow
   still has body and `edge` is the long tail it dies into. The defaults are
   the cool cast the strip lights and the bench glow were built on; the
   signal bulb passes a warm amber through instead. */
export function glowTexture(color = '#cfe0ff', mid = '150,180,240', edge = '120,150,220') {
  const { c, x, w, h } = canvas(128, 128);
  const g = x.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.25, `rgba(${mid},0.45)`);
  g.addColorStop(1, `rgba(${edge},0)`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return toTexture(c);
}

/* ---- the car's own environment ------------------------------------ */

/* envTexture() above is the room's, and every prop in the garage is tuned
   against it — so the car gets its own rather than the room getting a new
   one. Same garage, photographed properly.

   The reference shots of the real car are all one lesson: what makes paint
   read as paint is the value ORDER, not the brightness. Roof and hood are
   the brightest things on the car because a horizontal panel reflects the
   zenith; the flanks sit well below them because a vertical panel averages
   the horizon against the floor; the sill is nearly black. So the zenith
   here is genuinely lit, there is one narrow bright line at the horizon to
   draw the shoulder streak, and everything under it falls off a cliff.
   Raising the whole thing instead only makes a brighter toy — that was the
   first attempt, and a real outdoor sky HDRI was the second: both lit the
   sills as brightly as the roof and the car went flat.

   Left as an equirect CanvasTexture on purpose. Assigning it to
   material.envMap hands it to the renderer's cubeUV path, which PMREMs it
   the same way scene.environment is already handled, so the car needs no
   generator and no renderer reference to light itself. */
export function carEnvTexture() {
  const { c, x, w, h } = canvas(1024, 512);

  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.000, '#6b7a91');   // lit ceiling, and so the hood
  g.addColorStop(0.100, '#647388');
  g.addColorStop(0.340, '#54627b');
  g.addColorStop(0.440, '#414e64');
  g.addColorStop(0.474, '#8496b4');
  g.addColorStop(0.492, '#c2d2ea');   // the horizon line, and so the streak
  g.addColorStop(0.503, '#171c23');   // floor starts, hard
  g.addColorStop(0.600, '#0c0f14');
  g.addColorStop(1.000, '#04060a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  /* The room's two ceiling tubes, as the long highlights they draw. Kept
     narrow and under full strength on purpose: the clearcoat lays a white
     specular over the blue, so a wide bright ceiling does not read as a
     brighter blue, it reads as silver. At 26px and full alpha the hood and
     the tops of the fenders went grey at close range — the paint was gone.
     Narrow bands leave a defined sheen sitting on a panel that is still
     Interlagos. */
  for (const cy of [0.15, 0.29]) {
    const gg = x.createLinearGradient(0, h * cy - 17, 0, h * cy + 17);
    gg.addColorStop(0, 'rgba(226,238,255,0)');
    gg.addColorStop(0.5, 'rgba(240,248,255,0.70)');
    gg.addColorStop(1, 'rgba(226,238,255,0)');
    x.fillStyle = gg; x.fillRect(0, h * cy - 17, w, 34);
  }

  /* The door opening: one strong off-axis source, so walking round the car
     sweeps a highlight down its flank instead of finding the same wash at
     every angle. Kept tight for the same reason as the tubes — wide, it
     silvered the whole side the door faces, which showed up worst from the
     home view where that flank is most of the car. */
  const d = x.createRadialGradient(w * 0.30, h * 0.478, 6, w * 0.30, h * 0.478, w * 0.14);
  d.addColorStop(0, 'rgba(216,232,255,0.58)');
  d.addColorStop(0.5, 'rgba(172,198,238,0.23)');
  d.addColorStop(1, 'rgba(150,180,225,0)');
  x.fillStyle = d; x.fillRect(0, 0, w, h);

  const t = toTexture(c, { srgb: false });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
