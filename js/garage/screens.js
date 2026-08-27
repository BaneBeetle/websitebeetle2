/* In-scene screens and printed matter.
   Content is drawn into 2D canvases at runtime and uploaded as textures,
   so text stays crisp and nothing has to be pre-rendered at build time.
   The same strings also exist as real DOM in index.html; this is the
   look, that is the record. */

import * as THREE from 'three';
import * as P from './paint.js';
import { PROJECTS, PAPER, EDUCATION, EXPERIENCE, CAR, PERSON } from './content.js';

const W = 1024, H = 640;

/* Crossfade material: two samplers mixed by uProgress, the cheapest way
   to make a screen change feel like a screen and not a texture swap. */
export function screenMaterial(texA, texB) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tA: { value: texA }, tB: { value: texB },
      uProgress: { value: 0 }, uTime: { value: 0 }, uOn: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tA; uniform sampler2D tB;
      uniform float uProgress; uniform float uTime; uniform float uOn;
      varying vec2 vUv;
      void main(){
        vec4 a = texture2D(tA, vUv);
        vec4 b = texture2D(tB, vUv);
        vec4 c = mix(a, b, smoothstep(0.0, 1.0, uProgress));
        // scanline and a slow vertical sweep: a screen that is on
        float scan = 0.965 + 0.035 * sin(vUv.y * 900.0);
        float sweep = 0.03 * smoothstep(0.0, 0.06, abs(fract(vUv.y - uTime * 0.06) - 0.5));
        gl_FragColor = vec4(c.rgb * scan * uOn + sweep * uOn, 1.0);
      }`,
  });
}

function bg(x, w, h) {
  x.fillStyle = '#0c0f14'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w * 0.5, h * 0.1, 20, w * 0.5, h * 0.1, w * 0.9);
  g.addColorStop(0, 'rgba(59,111,212,0.16)');
  g.addColorStop(1, 'rgba(59,111,212,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,0.045)'; x.lineWidth = 1;
  for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(0, i * h / 8); x.lineTo(w, i * h / 8); x.stroke(); }
}

function chrome(x, w, h, label, right) {
  x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, 0, w, 52);
  x.fillStyle = P.BLUE; x.fillRect(0, 50, w, 2);
  P.line(x, label, { font: P.fonts.mono, size: 17, weight: 600, color: P.INK, x: 26, y: 34, track: 3, upper: true });
  if (right) P.line(x, right, { font: P.fonts.mono, size: 15, color: P.INK3, x: w - 26, y: 34, align: 'right', track: 2, upper: true });
}

/* ---- monitor: the project index ----------------------------------- */

export function screenIndex() {
  const { c, x } = P.canvas(W, H);
  bg(x, W, H);
  chrome(x, W, H, 'workbench', `${PROJECTS.length} builds`);

  let y = 116;
  for (const p of PROJECTS) {
    x.fillStyle = 'rgba(255,255,255,0.035)';
    x.fillRect(26, y - 30, W - 52, 74);
    x.fillStyle = P.BLUE; x.fillRect(26, y - 30, 3, 74);
    P.line(x, p.title, { font: P.fonts.sans, size: 25, weight: 600, color: P.INK, x: 46, y: y + 2 });
    P.line(x, p.kicker, { font: P.fonts.sans, size: 17, color: P.INK2, x: 46, y: y + 28 });
    P.line(x, p.date, { font: P.fonts.mono, size: 14, color: P.INK3, x: W - 46, y: y + 2, align: 'right', track: 1.5, upper: true });
    y += 86;
  }
  return P.toTexture(c);
}

export function screenProject(p) {
  const { c, x } = P.canvas(W, H);
  bg(x, W, H);
  chrome(x, W, H, p.tag || 'project', p.date);

  P.line(x, p.title, { font: P.fonts.display, size: 52, color: P.INK, x: 30, y: 130, upper: true });
  P.line(x, p.kicker, { font: P.fonts.sans, size: 22, color: P.BLUE_LIT, x: 32, y: 166 });
  let y = P.wrap(x, p.body, { size: 20, color: P.INK2, x: 32, y: 214, max: W - 380, leading: 1.5 });

  for (const b of p.bullets.slice(0, 2)) {
    x.fillStyle = P.BLUE; x.fillRect(32, y + 2, 12, 2);
    y = P.wrap(x, b, { size: 17, color: P.INK2, x: 56, y: y + 8, max: W - 410, leading: 1.45 }) + 10;
  }

  // tag rail down the right edge
  let ty = 120;
  for (const t of p.tags) {
    x.strokeStyle = '#2b323d'; x.lineWidth = 2;
    const wgt = 200;
    x.strokeRect(W - 26 - wgt, ty, wgt, 38);
    P.line(x, t, { font: P.fonts.mono, size: 14, color: P.INK2, x: W - 26 - wgt / 2, y: ty + 25, align: 'center', track: 1.5, upper: true });
    ty += 48;
  }

  if (p.href) {
    x.fillStyle = P.BLUE; x.fillRect(30, H - 84, 300, 52);
    P.line(x, p.hrefLabel || 'Open', { font: P.fonts.display, size: 18, color: '#ffffff', x: 180, y: H - 51, align: 'center', track: 2, upper: true });
  }
  P.line(x, 'back to index', { font: P.fonts.mono, size: 15, color: P.INK3, x: W - 30, y: H - 51, align: 'right', track: 2, upper: true });
  return P.toTexture(c);
}

/* idle: a boost gauge sweeping, because an idle screen should still be on */
export function screenIdle(t = 0) {
  const { c, x } = P.canvas(W, H);
  bg(x, W, H);
  chrome(x, W, H, 'workbench', 'idle');
  const cx = W / 2, cy = H / 2 + 40, r = 150;
  x.strokeStyle = '#232a34'; x.lineWidth = 16;
  x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 2.22); x.stroke();
  const sweep = 0.5 + 0.5 * Math.sin(t * 1.3);
  x.strokeStyle = P.BLUE; x.lineWidth = 16;
  x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 0.78 + sweep * Math.PI * 1.44); x.stroke();
  P.line(x, 'CLICK', { font: P.fonts.display, size: 46, color: P.INK, x: cx, y: cy + 6, align: 'center', track: 6 });
  P.line(x, 'to open the bench', { font: P.fonts.mono, size: 16, color: P.INK3, x: cx, y: cy + 40, align: 'center', track: 2, upper: true });
  return P.toTexture(c);
}

/* ---- printed matter for the research wall ------------------------- */

export function paperTexture() {
  const { c, x, w, h } = P.canvas(768, 1024);
  x.fillStyle = '#eceade'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(0, 0, w, 6);
  P.line(x, 'AERA 2025', { font: P.fonts.mono, size: 22, weight: 700, color: '#3b6fd4', x: 56, y: 96, track: 5 });
  P.line(x, 'Denver, Colorado', { font: P.fonts.mono, size: 17, color: '#7a7f88', x: 56, y: 126, track: 2 });
  let y = P.wrap(x, PAPER.title, { font: P.fonts.display, size: 38, color: '#161a20', x: 56, y: 208, max: w - 112, leading: 1.16 });
  y = P.wrap(x, PAPER.blurb, { size: 21, color: '#4a4f58', x: 56, y: y + 34, max: w - 112, leading: 1.5 });
  P.line(x, PAPER.speaker, { font: P.fonts.sans, size: 20, weight: 600, color: '#161a20', x: 56, y: y + 46 });
  P.line(x, PAPER.date, { font: P.fonts.mono, size: 16, color: '#7a7f88', x: 56, y: y + 74, track: 2, upper: true });
  // body columns, drawn as rules: it is a paper seen across a garage
  x.fillStyle = 'rgba(0,0,0,0.11)';
  for (let i = 0; i < 22; i++) {
    const col = i % 2, row = (i / 2) | 0;
    x.fillRect(56 + col * 348, 700 + row * 24, 300 - (Math.random() * 70 | 0), 5);
  }
  x.fillStyle = P.BLUE; x.fillRect(56, h - 92, 250, 46);
  P.line(x, 'READ THE PAPER', { font: P.fonts.display, size: 19, color: '#fff', x: 181, y: h - 60, align: 'center', track: 2 });
  return P.toTexture(c);
}

export function noteTexture(title, lines, accent = P.BLUE) {
  const { c, x, w, h } = P.canvas(512, 384);
  x.fillStyle = '#e8e4d6'; x.fillRect(0, 0, w, h);
  x.fillStyle = accent; x.fillRect(0, 0, w, 10);
  const size = title.length > 12 ? 26 : 34;
  P.line(x, title, { font: P.fonts.display, size, color: '#181c22', x: 32, y: 84, upper: true });
  let y = 130;
  for (const l of lines) {
    y = P.wrap(x, l, { size: 20, color: '#4c515a', x: 32, y, max: w - 64, leading: 1.4 }) + 12;
  }
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(0,0,0,${0.015 + Math.random() * 0.03})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 8, 1 + Math.random() * 3);
  }
  return P.toTexture(c);
}

export function schoolTexture(e) {
  return noteTexture(e.school.split(' ')[0] === 'University' ? 'UC Irvine' : 'Columbia',
    [e.degree, e.when, e.note || e.where].filter(Boolean));
}

/* signboard hung from the ceiling: the menu, as furniture */
export function signTexture() {
  const { c, x, w, h } = P.canvas(1024, 256);
  x.fillStyle = '#12161c'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#39414d'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  P.line(x, "BRIAN'S GARAGE", { font: P.fonts.display, size: 74, color: P.INK, x: w / 2, y: 108, align: 'center', track: 7 });
  P.line(x, 'CLICK AND DRAG TO LOOK AROUND', { font: P.fonts.mono, size: 24, color: P.BLUE_LIT, x: w / 2, y: 170, align: 'center', track: 6 });
  P.line(x, 'CLICK ANYTHING THAT LOOKS LIKE IT OPENS', { font: P.fonts.mono, size: 17, color: P.INK3, x: w / 2, y: 206, align: 'center', track: 3 });
  return P.toTexture(c);
}

export function touchSignTexture() {
  const { c, x, w, h } = P.canvas(1024, 256);
  x.fillStyle = '#12161c'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#39414d'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  P.line(x, "BRIAN'S GARAGE", { font: P.fonts.display, size: 74, color: P.INK, x: w / 2, y: 108, align: 'center', track: 7 });
  P.line(x, 'DRAG TO LOOK AROUND', { font: P.fonts.mono, size: 24, color: P.BLUE_LIT, x: w / 2, y: 170, align: 'center', track: 6 });
  P.line(x, 'TAP ANYTHING THAT LOOKS LIKE IT OPENS', { font: P.fonts.mono, size: 17, color: P.INK3, x: w / 2, y: 206, align: 'center', track: 3 });
  return P.toTexture(c);
}

/* Iron Bark's behavior board. The four states are the ones in the real
   state machine, and the board redraws in place rather than swapping
   between eight pre-rendered textures. */
export const DOG_PHASES = ['IDLE', 'FOLLOW', 'SEARCH', 'EXPLORE'];

export function behaviorCanvas() {
  return P.canvas(768, 300);
}

export function drawBehavior(cv, phase, flash) {
  const { x, w, h } = cv;
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#0a0d12'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#222932'; x.lineWidth = 4; x.strokeRect(8, 8, w - 16, h - 16);

  P.line(x, 'IRON BARK', { font: P.fonts.mono, size: 30, weight: 700, color: P.INK, x: 40, y: 66, track: 3 });
  P.line(x, '//', { font: P.fonts.mono, size: 30, weight: 400, color: P.BLUE, x: 232, y: 66, track: 2 });
  P.line(x, 'behavior', { font: P.fonts.mono, size: 30, weight: 400, color: P.INK2, x: 286, y: 66, track: 1 });

  const bw = 150, bh = 62, gap = 22, y0 = 110;
  const prev = (phase + DOG_PHASES.length - 1) % DOG_PHASES.length;
  DOG_PHASES.forEach((name, i) => {
    const px = 40 + i * (bw + gap);
    const active = i === phase;
    if (active) {
      // the active state stays solid so the sequence reads as stepping.
      // the flash is the moment of arrival, not a flicker.
      x.fillStyle = flash > 0.5 ? '#1d3a72' : '#12244e';
      x.fillRect(px, y0, bw, bh);
      x.strokeStyle = flash > 0.5 ? '#cfe0ff' : P.BLUE_LIT;
      x.lineWidth = flash > 0.5 ? 5 : 4;
    } else {
      x.strokeStyle = '#2b323d'; x.lineWidth = 3;
    }
    x.strokeRect(px, y0, bw, bh);
    P.line(x, name, {
      font: P.fonts.mono, size: name.length > 6 ? 24 : 27,
      weight: active ? 700 : 400,
      color: active ? '#ffffff' : P.INK3,
      x: px + bw / 2, y: y0 + 41, align: 'center', track: 2,
    });
    if (i < DOG_PHASES.length - 1) {
      // the connector into the active box lights as the state arrives
      const carrying = flash > 0.25 && i === prev && phase !== 0;
      x.strokeStyle = carrying ? P.BLUE_LIT : '#2b323d';
      x.lineWidth = carrying ? 5 : 3;
      x.beginPath(); x.moveTo(px + bw, y0 + bh / 2); x.lineTo(px + bw + gap, y0 + bh / 2); x.stroke();
    }
  });

  P.line(x, 'YOLOv11 + ArcFace + VLM  //  Pi 5 + GPU', {
    font: P.fonts.mono, size: 23, color: P.INK3, x: 40, y: 250, track: 1.5,
  });
}

/* The caption strip under the field-test frame. It is deliberately the
   same three-part header the board uses, one size down, so the two things
   on that wall read as parts of one instrument rather than two posters. */
export function fieldCaptionTexture() {
  const { c, x, w, h } = P.canvas(512, 85);
  x.fillStyle = '#0a0d12'; x.fillRect(0, 0, w, h);
  x.fillStyle = P.BLUE; x.fillRect(0, h - 3, w, 3);
  const parts = [
    { t: 'FIELD TEST', weight: 700, color: P.INK },
    { t: '//', weight: 400, color: P.BLUE },
    { t: 'gait', weight: 400, color: P.INK2 },
  ];
  let px = 20;
  for (const p of parts) {
    P.line(x, p.t, { font: P.fonts.mono, size: 34, weight: p.weight, color: p.color, x: px, y: 58, track: 2 });
    x.font = `${p.weight} 34px ${P.fonts.mono}`;
    px += [...p.t].reduce((a, ch) => a + x.measureText(ch).width + 2, -2) + 16;
  }
  return P.toTexture(c);
}

/* the exit sign over the back door */
export function exitSignTexture() {
  const { c, x, w, h } = P.canvas(512, 160);
  x.fillStyle = '#0b0e13'; x.fillRect(0, 0, w, h);
  P.line(x, 'STILL BUILDING', { font: P.fonts.display, size: 52, color: '#cfe0ff', x: w / 2, y: 74, align: 'center', track: 4 });
  P.line(x, PERSON.email, { font: P.fonts.mono, size: 20, color: P.BLUE_LIT, x: w / 2, y: 116, align: 'center', track: 1 });
  return P.toTexture(c);
}

/* the spec card that lives in the engine bay */
export function specTexture() {
  const { c, x, w, h } = P.canvas(640, 480);
  x.fillStyle = '#0d1015'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#2b323d'; x.lineWidth = 3; x.strokeRect(10, 10, w - 20, h - 20);
  P.line(x, CAR.name.toUpperCase(), { font: P.fonts.display, size: 44, color: P.INK, x: 34, y: 84, track: 4 });
  P.line(x, `${CAR.model} / ${CAR.paint}`, { font: P.fonts.mono, size: 17, color: P.BLUE_LIT, x: 34, y: 116, track: 2, upper: true });
  let y = 176;
  for (const s of CAR.specs) {
    P.line(x, s.k, { font: P.fonts.mono, size: 15, color: P.INK3, x: 34, y, track: 2.5, upper: true });
    P.line(x, s.v, { font: P.fonts.sans, size: 22, weight: 600, color: P.INK, x: w - 34, y, align: 'right' });
    x.fillStyle = '#20262f'; x.fillRect(34, y + 16, w - 68, 1);
    y += 52;
  }
  return P.toTexture(c);
}

export { EDUCATION, EXPERIENCE, PROJECTS };

/* ---- the holo bench ----------------------------------------------- */
/* The workbench panes. Everything below paints on nothing: the material
   is additive, so black is invisible and the whole language has to be
   made of light. The reference for this corner is a workshop desk with
   an arc of translucent panes dense with tiny instrument UI, and density
   is the trick, so the panes are deliberately packed. What keeps packed
   from being noise is that every string on them is real: the numbers are
   the dyno's, the tags are the project's, the dates are the resume's. */

const HW = 1024, HH = 640;      // the browser pane
/* The browser's right third is permanently under the two wings, so no
   content is allowed past this. The old CRT reserved the same strip for
   a tag rail; the rail is gone but the reservation still has to stand,
   or the body copy runs straight under the diagnostics sheet. */
const CLEAR = HW - 300;
const SW = 640, SH = 460;       // the capture wing
const DW = 640, DH = 620;       // diagnostics, which carries the stack as well
const BW = 512, BH = 340;       // the index strip

/* Largest size that still fits, so a long project title shrinks instead
   of running off the pane. Nothing here is ever ellipsised: a truncated
   title reads as a bug, a smaller one reads as a decision. */
function fit(x, text, font, max, cap, floor = 12, weight = 400) {
  for (let s = cap; s > floor; s -= 1) {
    x.font = `${weight} ${s}px ${font}`;
    if (x.measureText(text).width <= max) return s;
  }
  return floor;
}

/* 'Mar 2026 to present' is the record; a pane this size wants the start
   of it. Dropping the tail is a compression, not a claim. */
function since(d) { return String(d || '').split(' to ')[0]; }

/* Crossfade, holographic. Same uniform names as screenMaterial so the
   bench's existing crossfade wiring drives it untouched; what changes is
   that it resolves to light on transparency instead of a lit rectangle.
   toneMapped stays off so the panes hold their exposure no matter how
   the room's grading is retuned around them. */
export function holoScreenMaterial(texA, texB, { alpha = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tA: { value: texA }, tB: { value: texB },
      uProgress: { value: 0 }, uTime: { value: 0 }, uOn: { value: 1 },
      uAlpha: { value: alpha },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tA; uniform sampler2D tB;
      uniform float uProgress; uniform float uTime; uniform float uOn; uniform float uAlpha;
      varying vec2 vUv;
      void main(){
        vec4 a = texture2D(tA, vUv);
        vec4 b = texture2D(tB, vUv);
        vec4 c = mix(a, b, smoothstep(0.0, 1.0, uProgress));
        // a pane being redrawn rather than printed: lines crawl, a soft
        // band passes down it, and the whole thing breathes a little
        float scan = 0.90 + 0.10 * sin(vUv.y * 520.0 - uTime * 3.0);
        float band = 0.15 * smoothstep(0.90, 1.0, sin(vUv.y * 2.4 - uTime * 0.45));
        float breathe = 0.955 + 0.045 * sin(uTime * 1.9 + vUv.x * 0.6);
        // no hard cut at the border: a projection has no edge to it
        float ex = smoothstep(0.0, 0.010, vUv.x) * smoothstep(1.0, 0.990, vUv.x);
        float ey = smoothstep(0.0, 0.010, vUv.y) * smoothstep(1.0, 0.990, vUv.y);
        gl_FragColor = vec4(c.rgb * (scan + band), c.a * uOn * uAlpha * breathe * ex * ey);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/* ---- browser pane: idle, index, project --------------------------- */

/* Standby. Not an empty pane with a button in the middle of it: this is
   the bench's resting face and you look at it more than any other state,
   so it carries the same list the index does, held back a stop, with the
   invitation as the one bright thing on it. Dim-with-a-focal-point is
   the hierarchy doing the work that a big centred CLICK was doing by
   shouting, and it keeps the standby pane in the same instrument
   language as the three beside it. */
export function holoIdle(t = 0) {
  const { c, x } = P.canvas(HW, HH);
  P.holoFrame(x, HW, HH);
  P.holoHead(x, CLEAR + 26, 'workbench', 'standby', `${PROJECTS.length} builds`);

  const top = 92, foot = 96, rowH = (HH - top - foot) / PROJECTS.length;
  PROJECTS.forEach((p, i) => {
    const y = top + i * rowH;
    x.fillStyle = P.HOLO_DIM; x.globalAlpha = 0.55;
    x.fillRect(26, y + 6, 2, 22);
    x.globalAlpha = 1;
    const size = fit(x, p.title, P.fonts.sans, CLEAR - 150, 24, 15, 600);
    P.line(x, p.title, { font: P.fonts.sans, size, weight: 600, color: P.HOLO_MID, x: 44, y: y + 26 });
    P.line(x, p.kicker, { font: P.fonts.sans, size: 14, color: P.HOLO_DIM, x: 44, y: y + 47 });
    P.line(x, since(p.date), { font: P.fonts.mono, size: 13, color: P.HOLO_DIM, x: CLEAR, y: y + 26, align: 'right', track: 2, upper: true });
    if (i < PROJECTS.length - 1) P.holoRule(x, 26, y + rowH - 8, CLEAR - 26, 0.18);
  });

  /* The invitation, and a dial beside it. The dial is painted once at
     whatever t it is built with, so it is a reading rather than a
     sweep: what makes this pane look awake is the shimmer in the
     material, not anything moving in the canvas. */
  P.holoRule(x, 26, HH - foot + 14, CLEAR - 26, 0.45);
  const by = HH - 52;
  P.holoChip(x, 'click to open the bench', { px: 26, y: by - 22, h: 36, size: 16, pad: 16, color: P.HOLO_HI, stroke: P.HOLO });

  const cx = CLEAR - 48, cy = by - 4, r = 24;
  x.strokeStyle = P.HOLO_DIM; x.lineWidth = 4; x.globalAlpha = 0.5;
  x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 2.22); x.stroke();
  x.globalAlpha = 1;
  const sweep = 0.5 + 0.5 * Math.sin(t * 1.3);
  x.strokeStyle = P.HOLO; x.lineWidth = 4;
  x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 0.78 + sweep * Math.PI * 1.44); x.stroke();
  return P.toTexture(c);
}

/* The index. Six rows, separated by hairlines rather than boxes: at this
   density a container round every row would be the loudest thing on the
   pane and the least useful. */
export function holoIndex() {
  const { c, x } = P.canvas(HW, HH);
  P.holoFrame(x, HW, HH);
  P.holoHead(x, CLEAR + 26, 'workbench', 'index', `${PROJECTS.length} builds`);

  const top = 96, rowH = (HH - top - 34) / PROJECTS.length;
  PROJECTS.forEach((p, i) => {
    const y = top + i * rowH;
    x.fillStyle = P.HOLO; x.globalAlpha = 0.75;
    x.fillRect(26, y + 8, 3, 26);
    x.globalAlpha = 1;
    const size = fit(x, p.title, P.fonts.sans, CLEAR - 140, 27, 17, 600);
    P.line(x, p.title, { font: P.fonts.sans, size, weight: 600, color: P.HOLO_HI, x: 44, y: y + 30 });
    P.line(x, p.kicker, { font: P.fonts.sans, size: 16, color: P.HOLO_MID, x: 44, y: y + 54 });
    P.line(x, since(p.date), { font: P.fonts.mono, size: 14, color: P.HOLO_DIM, x: CLEAR, y: y + 30, align: 'right', track: 2, upper: true });
    if (i < PROJECTS.length - 1) P.holoRule(x, 26, y + rowH - 10, CLEAR - 26);
  });
  return P.toTexture(c);
}

export function holoProject(p) {
  const { c, x } = P.canvas(HW, HH);
  P.holoFrame(x, HW, HH);
  P.holoHead(x, CLEAR + 26, p.tag || 'build', null, p.date);

  const body = CLEAR - 58;
  const tSize = fit(x, p.title.toUpperCase(), P.fonts.display, CLEAR - 28, 50, 26);
  P.line(x, p.title, { font: P.fonts.display, size: tSize, color: P.HOLO_HI, x: 28, y: 130, upper: true });
  P.line(x, p.kicker, { font: P.fonts.sans, size: 21, color: P.HOLO, x: 30, y: 166 });

  let y = P.wrap(x, p.body, { size: 18, color: P.HOLO_MID, x: 30, y: 212, max: body, leading: 1.55 });
  for (const b of p.bullets.slice(0, 2)) {
    x.fillStyle = P.HOLO; x.globalAlpha = 0.7;
    x.fillRect(30, y + 6, 10, 2);
    x.globalAlpha = 1;
    y = P.wrap(x, b, { size: 15, color: P.HOLO_MID, x: 50, y: y + 12, max: body - 24, leading: 1.5 }) + 8;
  }

  P.holoRule(x, 28, HH - 76, CLEAR - 28);
  // both controls cluster bottom-left: the far corner is under the capture
  // wing, and a control you cannot read is worse than one you have to find
  const cw = p.href
    ? P.holoChip(x, p.hrefLabel || 'Open', { px: 28, y: HH - 62, h: 34, size: 15, color: P.HOLO_HI, stroke: P.HOLO })
    : -22;
  P.line(x, 'back to index', { font: P.fonts.mono, size: 14, color: P.HOLO_DIM, x: 28 + cw + 22, y: HH - 39, track: 2, upper: true });
  return P.toTexture(c);
}

/* ---- wing pane: the capture ---------------------------------------- */

/* The selected build's photograph, projected. It is tinted into the same
   hue family as everything else rather than pasted in full colour: a
   photograph in its own palette would be the only object in the corner
   not made of the same light, and it would win every time. */
export function holoCapture(p, img) {
  const { c, x } = P.canvas(SW, SH);
  P.holoFrame(x, SW, SH);
  // with nothing picked the pane holds the car, which is what the pane
  // beside it is reading out and what the turntable above it is turning:
  // the whole corner has one idle subject and this is it
  const ry = P.holoHead(x, SW, 'capture', p ? null : CAR.name,
    p ? since(p.date) : CAR.model);

  const fx = 28, fy = ry + 22, fw = SW - 56, fh = 250;

  if (img) {
    /* Cover-fit, then map the luminance onto the pane's blue.
       The dimming has to happen AFTER the tint, not on the way in. A
       blend mode filled with an opaque colour composites to alpha 1
       across the whole rect, so drawing the photograph at 0.24 and then
       running 'color' over it threw the 0.24 away and handed back a
       fully opaque tile: the pane came out an lit rectangle that beat
       everything else in the corner however far the input alpha was
       wound down. So the image goes on solid, gets tinted, and is then
       knocked back with destination-out, which touches alpha only. */
    const s = Math.max(fw / img.width, fh / img.height);
    const dw = img.width * s, dh = img.height * s;
    x.save();
    x.beginPath(); x.rect(fx, fy, fw, fh); x.clip();
    x.drawImage(img, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);
    x.globalCompositeOperation = 'saturation';
    x.fillStyle = 'hsl(0,0%,50%)'; x.fillRect(fx, fy, fw, fh);
    x.globalCompositeOperation = 'color';
    x.fillStyle = '#5aa0ff'; x.fillRect(fx, fy, fw, fh);
    x.globalCompositeOperation = 'source-over';
    // the same line crawl as the rest of the corner, over the image
    x.fillStyle = 'rgba(168,204,255,0.14)';
    for (let yy = fy; yy < fy + fh; yy += 3) x.fillRect(fx, yy, fw, 1);
    x.globalCompositeOperation = 'destination-out';
    // down to a projection...
    x.fillStyle = 'rgba(0,0,0,0.68)'; x.fillRect(fx, fy, fw, fh);
    // ...and no hard border on it either: a projected frame dies at its edges
    const vg = x.createRadialGradient(
      fx + fw / 2, fy + fh / 2, fh * 0.22,
      fx + fw / 2, fy + fh / 2, fw * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.95)');
    x.fillStyle = vg; x.fillRect(fx, fy, fw, fh);
    x.restore();
  } else {
    // no photograph on file. Say so, and give the pane something true to
    // hold instead of a stand-in image that would be a small lie.
    x.save();
    x.globalAlpha = 0.22;
    x.strokeStyle = P.HOLO_DIM; x.lineWidth = 1.5;
    for (let d = -fh; d < fw; d += 22) {
      x.beginPath(); x.moveTo(fx + d, fy + fh); x.lineTo(fx + d + fh, fy); x.stroke();
    }
    x.restore();
    P.line(x, 'no capture on file', {
      font: P.fonts.mono, size: 15, color: P.HOLO_MID,
      x: fx + fw / 2, y: fy + fh / 2 + 5, align: 'center', track: 3, upper: true,
    });
  }

  // corner ticks on the image well, the same shape the pane itself uses
  x.strokeStyle = P.HOLO; x.lineWidth = 2; x.globalAlpha = 0.7;
  for (const [cx2, cy2, sx, sy] of [
    [fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1],
  ]) {
    x.beginPath();
    x.moveTo(cx2, cy2 + sy * 18); x.lineTo(cx2, cy2); x.lineTo(cx2 + sx * 18, cy2);
    x.stroke();
  }
  x.globalAlpha = 1;

  const cap = p ? (p.photoAlt || p.kicker) : `${CAR.name}. ${CAR.model}, ${CAR.paint}.`;
  P.wrap(x, cap, { size: 15, color: P.HOLO_MID, x: fx, y: fy + fh + 34, max: fw, leading: 1.45 });
  return P.toTexture(c);
}

/* Every distinct tool across the six builds. Lives here rather than in
   its own pane: a fifth sheet was one too many for the frame this
   station actually has to compose in. */
const STACK = [...new Set(PROJECTS.flatMap((p) => p.tags))];

/* ---- wing pane: diagnostics ---------------------------------------- */

/* The car's real numbers and the selected build's stack, packed the way
   the reference packs a pane. The dyno figure is the one thing on it
   sized to be read from across the room; everything else is the density
   that makes a readout look like a readout. */
export function holoDiag(p) {
  const { c, x } = P.canvas(DW, DH);
  P.holoFrame(x, DW, DH);
  let y = P.holoHead(x, DW, 'diagnostics', CAR.name, CAR.model) + 30;

  const rows = CAR.specs.filter((s) => s.k !== 'Result');
  for (const s of rows) {
    P.line(x, s.k, { font: P.fonts.mono, size: 13, color: P.HOLO_DIM, x: 28, y: y + 14, track: 2.5, upper: true });
    const vs = fit(x, s.v, P.fonts.sans, DW - 200, 17, 12, 600);
    P.line(x, s.v, { font: P.fonts.sans, size: vs, weight: 600, color: P.HOLO, x: DW - 28, y: y + 14, align: 'right' });
    P.holoRule(x, 28, y + 26, DW - 56, 0.22);
    y += 38;
  }

  // the dyno sheet, which is the one number a car person looks for
  const res = CAR.specs.find((s) => s.k === 'Result');
  if (res) {
    const n = res.v.replace(/\s*w?hp$/i, '');
    y += 14;
    P.line(x, 'dyno result', { font: P.fonts.mono, size: 13, color: P.HOLO_DIM, x: 28, y: y + 6, track: 3, upper: true });
    P.line(x, n, { font: P.fonts.mono, size: 42, weight: 700, color: P.HOLO_HI, x: 28, y: y + 54 });
    x.font = `700 42px ${P.fonts.mono}`;
    P.line(x, 'WHP', { font: P.fonts.mono, size: 17, color: P.HOLO, x: 32 + x.measureText(n).width, y: y + 54, track: 2 });
    P.line(x, CAR.paint, { font: P.fonts.mono, size: 13, color: P.HOLO_MID, x: DW - 28, y: y + 54, align: 'right', track: 2, upper: true });
    y += 76;
  }

  P.holoRule(x, 28, y, DW - 56, 0.4);
  y += 30;

  const lit = new Set(p ? p.tags : []);
  P.line(x, p ? 'active build' : 'bench idle', { font: P.fonts.mono, size: 13, color: P.HOLO_DIM, x: 28, y, track: 3, upper: true });
  P.line(x, p ? `${lit.size}/${STACK.length}` : `${STACK.length} tools`, {
    font: P.fonts.mono, size: 13, color: P.HOLO_DIM, x: DW - 28, y, align: 'right', track: 2, upper: true,
  });
  y += 26;
  const title = p ? p.title : 'Nothing selected';
  const ts = fit(x, title, P.fonts.sans, DW - 56, 20, 13, 600);
  P.line(x, title, { font: P.fonts.sans, size: ts, weight: 600, color: p ? P.HOLO_HI : P.HOLO_MID, x: 28, y });
  y += 26;

  /* Every distinct tool across the six builds, with the picked build's
     lit and the rest held back. This lived on a fifth pane of its own
     until that pane started fighting the browser for the same corner of
     the frame; folded in here it costs nothing and gives the dyno block
     something to sit above. */
  let px = 28;
  for (const t of STACK) {
    x.save();
    x.font = `400 12px ${P.fonts.mono}`;
    const tw = [...t.toUpperCase()].reduce((a, ch) => a + x.measureText(ch).width + 1.6, -1.6) + 16;
    x.restore();
    if (px + tw > DW - 28) { px = 28; y += 27; }
    if (y > DH - 26) break;
    const on = lit.has(t);
    P.holoChip(x, t, {
      px, y, h: 21, size: 12, pad: 8,
      color: on ? P.HOLO_HI : P.HOLO_MID,
      stroke: on ? P.HOLO : P.HOLO_DIM,
      alpha: on ? 1 : 0.40,
    });
    px += tw + 6;
  }
  return P.toTexture(c);
}


/* The signboard, proposed. The board currently carries the room's name and
   then two lines telling you how to drive it, and the HUD chip in the
   corner now says the same thing and fades once you have done it. Two
   places saying "click and drag" is one place too many, and the sign is
   the wrong one of the two to say it: it is the thing hanging over the car
   with his name on it, so it should say who this is, not how a mouse works.

   Not shipped. buildSign renders this only under ?sign=two, so the
   proposal can be photographed in the room and looked at before anybody
   changes the words over the door. Copy is the owner's call, not mine. */
export function signTextureTwoLine() {
  const { c, x, w, h } = P.canvas(1024, 256);
  x.fillStyle = '#12161c'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#39414d'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  P.line(x, "BRIAN'S GARAGE", { font: P.fonts.display, size: 74, color: P.INK, x: w / 2, y: 130, align: 'center', track: 7 });
  P.line(x, 'I like building things', { font: P.fonts.sans, size: 30, color: P.INK2, x: w / 2, y: 186, align: 'center', track: 2 });
  return P.toTexture(c);
}
