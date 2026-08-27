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

/* ---- holography -------------------------------------------------- */

/* The bench panes are painted on nothing. Additive blending means black
   is invisible, so the whole language has to be built out of light: one
   hue family, and brightness carrying every level of the hierarchy. Four
   steps is enough, and holding to four is what keeps a dense pane from
   turning into confetti. */
export const HOLO_HI = '#e4f2ff';    // the one thing per pane you must read
export const HOLO = '#a8ccff';       // the workhorse
export const HOLO_MID = '#6f9edb';   // supporting text, dense tiers
export const HOLO_DIM = '#3d6ba6';   // rules, brackets, anything inactive

/* The pane itself: a whisper of fill so the glass has presence, the
   scanlines that say it is being drawn rather than printed, and corner
   brackets at a fixed inset. The brackets are the reason four panes of
   four different sizes read as one instrument, so the inset and the tick
   never scale with the canvas. */
export function holoFrame(x, w, h, { wash = 0.022, scan = 0.042, dim = HOLO_DIM } = {}) {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, `rgba(122,167,255,${wash})`);
  g.addColorStop(0.58, `rgba(122,167,255,${wash * 0.3})`);
  g.addColorStop(1.00, `rgba(122,167,255,${wash * 0.85})`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  x.fillStyle = `rgba(168,204,255,${scan})`;
  for (let y = 2; y < h; y += 4) x.fillRect(0, y, w, 1);

  const inset = 13, tick = 27;
  x.strokeStyle = dim; x.lineWidth = 2.5;
  for (const [cx, cy, sx, sy] of [
    [inset, inset, 1, 1], [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1],
  ]) {
    x.beginPath();
    x.moveTo(cx, cy + sy * tick);
    x.lineTo(cx, cy);
    x.lineTo(cx + sx * tick, cy);
    x.stroke();
  }
}

/* The three-part header the room already speaks in: the board over Iron
   Bark's dock and the caption under the field-test frame are both built
   this way, so the bench inherits it rather than inventing a fifth
   dialect. Returns the baseline of the hairline under it. */
export function holoHead(x, w, name, sub, right, { y = 46, size = 22 } = {}) {
  let px = 26;
  const put = (t, weight, color) => {
    line(x, t, { font: FONT_M, size, weight, color, x: px, y, track: 2.5, upper: true });
    x.font = `${weight} ${size}px ${FONT_M}`;
    px += [...t].reduce((a, ch) => a + x.measureText(ch).width + 2.5, -2.5) + 13;
  };
  put(name, 700, HOLO);
  if (sub) { put('//', 400, HOLO_DIM); put(sub, 400, HOLO_MID); }
  if (right) {
    line(x, right, {
      font: FONT_M, size: size - 4, color: HOLO_DIM,
      x: w - 26, y, align: 'right', track: 2.5, upper: true,
    });
  }
  const ry = y + 16;
  x.fillStyle = HOLO_DIM;
  x.globalAlpha = 0.55; x.fillRect(26, ry, w - 52, 1.5); x.globalAlpha = 1;
  return ry;
}

/* A hairline between data rows. At this density boxes would be noise, so
   nothing on a pane is ever drawn inside a container. */
export function holoRule(x, x0, y, w, alpha = 0.3) {
  x.save();
  x.globalAlpha = alpha;
  x.fillStyle = HOLO_DIM;
  x.fillRect(x0, y, w, 1);
  x.restore();
}

/* A stroked chip. The one affordance shape on the bench: tags, states and
   the open-link control are all this, at one radius of nothing, so the
   panes keep a single corner language. */
export function holoChip(x, text, { px = 0, y = 0, h = 30, size = 14, pad = 12,
                                    color = HOLO, stroke = HOLO_DIM, alpha = 1 } = {}) {
  x.save();
  x.globalAlpha = alpha;
  x.font = `400 ${size}px ${FONT_M}`;
  const t = text.toUpperCase();
  const tw = [...t].reduce((a, ch) => a + x.measureText(ch).width + 1.6, -1.6);
  const w = tw + pad * 2;
  x.strokeStyle = stroke; x.lineWidth = 1.5;
  x.strokeRect(px + 0.5, y + 0.5, w, h);
  line(x, t, { font: FONT_M, size, color, x: px + pad, y: y + h / 2 + size * 0.36, track: 1.6 });
  x.restore();
  return w;
}

/* ---- the drone's scan ---------------------------------------------- */

/* One accent for the whole scan, in two brightnesses, and nothing else.
   Green rather than the room's blues on purpose: every light in this
   garage is already cool, so an ice-cyan beam would read as more room
   lighting instead of as an instrument doing a job. Green separates by
   hue instead of by brightness, which is what lets the whole effect stay
   dim and still say "a sensor is running". The door opener's LED and the
   arm's busy light are both green, so the room has the precedent. The
   hue is nudged a few degrees cooler than the survey photograph's, which
   was measured over warm ground, so it belongs to this concrete. */
export const SCAN = '#2fc661';
export const SCAN_LIT = '#80f0a5';

/* Every rgba() below is mixed from those two and nothing else, because a
   palette that is locked in a comment is not locked. `a` is the alpha,
   and `lift` walks a colour toward white for the one place that needs a
   hotter core than the accent itself. */
const rgba = (hex, a = 1, lift = 0) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * lift);
  return `rgba(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)},${a})`;
};

/* The beam is brightest a little under the sensor and gone before it
   reaches the floor, which is the honest way round: light spreads and
   thins, and leaving the bottom empty is what lets the footprint do the
   landing instead of the two fighting over the same few centimetres.

   Two things keep it from reading as a solid green wedge, which is what
   the first cut of this was. The very tip is taken back down, so the
   apex is a soft source rather than the sharp point of a triangle; and
   the body is held low and let out slowly, so what carries the shape is
   the ribs rather than a filled silhouette. The ribs are also the only
   reason a slow spin is visible at all: a smooth gradient turning looks
   like nothing whatsoever. */
export function scanConeTexture() {
  const { c, x, w, h } = canvas(128, 128);
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  // v runs 0 at the base, 1 at the apex: the top of the canvas is the apex
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, rgba(SCAN_LIT, 0.10));   // soft tip, not a point
  g.addColorStop(0.09, rgba(SCAN_LIT, 0.34));
  g.addColorStop(0.22, rgba(SCAN, 0.24, 0.30));
  g.addColorStop(0.50, rgba(SCAN, 0.11));
  g.addColorStop(0.80, rgba(SCAN, 0.03));
  g.addColorStop(1.00, rgba(SCAN, 0));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  /* Six ribs, and they fade out toward the floor with everything else so
     the beam dissolves rather than stopping. */
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const cx = (i + 0.5) * (w / 6);
    const s = x.createLinearGradient(cx - 6, 0, cx + 6, 0);
    s.addColorStop(0, rgba(SCAN_LIT, 0));
    s.addColorStop(0.5, rgba(SCAN_LIT, 0.30));
    s.addColorStop(1, rgba(SCAN_LIT, 0));
    x.fillStyle = s; x.fillRect(cx - 6, 0, 12, h);
  }
  const fade = x.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0.00, 'rgba(0,0,0,1)');
  fade.addColorStop(0.55, 'rgba(0,0,0,0.62)');
  fade.addColorStop(1.00, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = fade; x.fillRect(0, 0, w, h);
  return toTexture(c, { srgb: false });
}

/* The surveyed patch under the beam: the reference photograph's ground
   grammar, which is a measured grid rather than a pool of light. Faded
   radially to nothing so the patch has no edge to give away that it is a
   square, and the centre cross is where the sensor is looking. */
export function scanGridTexture() {
  const { c, x, w, h } = canvas(256, 256);
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  x.strokeStyle = rgba(SCAN, 0.55);
  x.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const p = (i / 8) * w;
    x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.stroke();
    x.beginPath(); x.moveTo(0, p); x.lineTo(w, p); x.stroke();
  }
  // the cross at the aim point, a shade brighter than the ruling
  x.strokeStyle = rgba(SCAN_LIT, 0.80);
  x.beginPath(); x.moveTo(w / 2, h / 2 - 16); x.lineTo(w / 2, h / 2 + 16);
  x.moveTo(w / 2 - 16, h / 2); x.lineTo(w / 2 + 16, h / 2); x.stroke();
  // radial falloff, punched through with destination-in so it eats alpha
  const g = x.createRadialGradient(w / 2, h / 2, w * 0.10, w / 2, h / 2, w * 0.50);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return toTexture(c, { srgb: false });
}

/* A single line. The lock-on sweep is one plane wearing this, walked
   through the target once, which is all a scan line ever is.

   The falloff is deliberately brutal, and the first cut of this was the
   one real mistake in the effect. Ramping the alpha from the edge of the
   plane inward turned the whole plane into a soft glow, and since the
   car's glass is transparent and writes no depth, that glow came
   straight through the windscreen and washed the whole glasshouse green
   from the engine bay station. Kept inside a tenth of the plane it is a
   line crossing the glass instead of a tint filling it, which is both
   the correct reading and the safe one. */
export function scanSweepTexture() {
  const { c, x, w, h } = canvas(64, 64);
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0.00, rgba(SCAN, 0));
  g.addColorStop(0.45, rgba(SCAN, 0));
  g.addColorStop(0.47, rgba(SCAN, 0.20));
  g.addColorStop(0.50, rgba(SCAN_LIT, 0.95, 0.28));   // the core, lifted toward white
  g.addColorStop(0.53, rgba(SCAN, 0.20));
  g.addColorStop(0.55, rgba(SCAN, 0));
  g.addColorStop(1.00, rgba(SCAN, 0));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return toTexture(c, { srgb: false });
}

/* The recognition label, in the grammar of the project's own detector
   output: a name and a confidence, set small and left aligned off a tick
   that points back at the corner of the box it belongs to. The real
   frames put red text straight on the image; red would read as an alarm
   in here and would fight everything else, so the scan accent carries it
   and the layout does the rest of the work. */
export function detectLabel(text) {
  const { c, x, w, h } = canvas(256, 64);
  x.font = `500 26px ${FONT_M}`;
  x.textBaseline = 'middle';
  x.textAlign = 'left';
  // the tick: a short rule the text sits off, the way the frames hang
  // their label off the top left corner of the box
  x.strokeStyle = SCAN_LIT; x.lineWidth = 3;
  x.beginPath(); x.moveTo(3, 12); x.lineTo(3, 52); x.stroke();
  x.fillStyle = SCAN_LIT;
  x.fillText(text, 14, 33);
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
