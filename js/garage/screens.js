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
