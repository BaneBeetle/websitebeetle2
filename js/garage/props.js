/* Everything in the room that is not the car.
   All of it is generated: boxes, cylinders, tori, tubes, plus canvas
   textures for anything that carries words or a photograph. Each prop
   maps to something real, and nothing is here purely as set dressing. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as P from './paint.js';
import * as S from './screens.js';
import { ROOM, X0, X1, Z_BACK, blobShadow, bakeAO } from './scene.js';
import { EXPERIENCE, EDUCATION, PAPER, BIKE } from './content.js';

const MDF = () => new THREE.MeshStandardMaterial({ color: 0x565049, roughness: 0.88, metalness: 0.02 });
const STEEL = () => new THREE.MeshStandardMaterial({ color: 0x3d444e, roughness: 0.48, metalness: 0.82 });
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.8, metalness: 0.25 });
const ALU = () => new THREE.MeshStandardMaterial({ color: 0x98a1ac, roughness: 0.32, metalness: 0.92 });

function photoPlane(url, w, h, fallback = 0x222933) {
  const mat = new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.9, metalness: 0.02 });
  new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    mat.map = t; mat.color.setHex(0xffffff); mat.needsUpdate = true;
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function framed(url, w, h, depth = 0.03) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, depth), DARK());
  g.add(frame);
  const img = photoPlane(url, w, h);
  img.position.z = depth / 2 + 0.002;
  g.add(img);
  return g;
}

/* ------------------------------------------------------------ signage */

export function buildSign(scene, touch) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 0.48, 0.05),
    new THREE.MeshStandardMaterial({ map: touch ? S.touchSignTexture() : S.signTexture(), roughness: 0.7, metalness: 0.2 })
  );
  g.add(board);
  for (const sx of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 5), STEEL());
    chain.position.set(sx * 0.78, 0.47, 0);
    g.add(chain);
  }
  g.position.set(0.42, 2.08, 3.40);
  /* on a phone the sign would fill the arrival frame, so it hangs deeper
     in the room where it reads once you are inside */
  if (touch) { g.position.set(0.05, 2.20, 1.15); g.scale.setScalar(0.85); }
  g.rotation.y = 0.02;
  scene.add(g);
  return g;
}

/* ---------------------------------------------------------- workbench */

export function buildBench(scene) {
  const g = new THREE.Group();
  g.name = 'bench';
  const wallX = X1;
  const zc = -0.60, len = 3.7, depth = 0.62, topY = 0.92;
  const hotspots = [];

  const top = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.06, len), MDF());
  top.position.set(wallX - depth / 2, topY, zc);
  g.add(top);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, len), STEEL());
  lip.position.set(wallX - depth, topY - 0.05, zc);
  g.add(lip);

  // frame
  for (const dz of [-len / 2 + 0.14, len / 2 - 0.14]) {
    for (const dx of [0.09, depth - 0.09]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, topY - 0.03, 0.055), STEEL());
      leg.position.set(wallX - dx, (topY - 0.03) / 2, zc + dz);
      g.add(leg);
    }
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(depth - 0.12, 0.04, len - 0.3), MDF());
  shelf.position.set(wallX - depth / 2, 0.26, zc);
  g.add(shelf);

  // drawers under one end
  const drawers = new THREE.Mesh(new THREE.BoxGeometry(depth - 0.06, topY - 0.08, 0.9), new THREE.MeshStandardMaterial({
    color: 0x2d3742, roughness: 0.55, metalness: 0.5,
  }));
  drawers.position.set(wallX - depth / 2, (topY - 0.08) / 2, zc + 1.1);
  g.add(drawers);
  for (let i = 0; i < 3; i++) {
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.5), ALU());
    pull.position.set(wallX - depth - 0.005, 0.18 + i * 0.26, zc + 1.1);
    g.add(pull);
  }

  /* pegboard above the bench, with tools that are actually hung */
  const pegTex = pegboardTexture();
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.15), new THREE.MeshStandardMaterial({
    map: pegTex, roughness: 0.9,
  }));
  peg.position.set(wallX - 0.02, 1.72, zc);
  peg.rotation.y = -Math.PI / 2;
  g.add(peg);
  for (let i = 0; i < 7; i++) {
    const l = 0.20 + Math.random() * 0.16;
    const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.03, l, 0.014), ALU());
    wrench.position.set(wallX - 0.06, 2.05 - l / 2, zc - 1.25 + i * 0.19);
    g.add(wrench);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 5, 10), ALU());
    ring.position.set(wallX - 0.06, 2.05 - l, zc - 1.25 + i * 0.19);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }

  /* the monitor: the project index lives here */
  const mon = new THREE.Group();
  mon.position.set(wallX - 0.36, topY + 0.42, zc - 0.32);
  mon.rotation.y = -Math.PI / 2 + 0.34;
  g.add(mon);

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.64, 0.035), new THREE.MeshStandardMaterial({
    color: 0x14181e, roughness: 0.5, metalness: 0.4,
  }));
  mon.add(bezel);
  const idle = S.screenIdle(0);
  const index = S.screenIndex();
  const screenMat = S.screenMaterial(idle, index);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.00, 0.585), screenMat);
  screen.position.z = 0.019;
  screen.name = 'monitor-screen';
  mon.add(screen);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), STEEL());
  stand.position.set(0, -0.52, -0.02);
  mon.add(stand);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.02, 0.20), STEEL());
  foot.position.set(0, -0.73, 0.02);
  mon.add(foot);
  const monHit = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.86, 0.30), new THREE.MeshBasicMaterial({ visible: false }));
  monHit.position.z = 0.14;
  mon.add(monHit);
  hotspots.push({ id: 'bench', mesh: monHit, size: [1.30, 0.86] });

  /* Raspberry Pi on a breadboard: the Carbeetle classifier and the arm
     controller both run on one of these */
  const pi = new THREE.Group();
  pi.position.set(wallX - 0.28, topY + 0.035, zc + 0.42);
  g.add(pi);
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.008, 0.19), new THREE.MeshStandardMaterial({
    color: 0x1d5e3a, roughness: 0.6, metalness: 0.2,
  }));
  pi.add(pcb);
  for (const [dx, dz, w, h, d, col] of [
    [0.04, -0.05, 0.05, 0.014, 0.05, 0x2b3038],
    [-0.045, 0.03, 0.03, 0.018, 0.055, 0x8b939d],
    [0.03, 0.07, 0.045, 0.012, 0.03, 0x2b3038],
  ]) {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.4 }));
    chip.position.set(dx, 0.008 + h / 2, dz);
    pi.add(chip);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), new THREE.MeshBasicMaterial({ color: 0x8fffb0 }));
  led.position.set(-0.05, 0.016, -0.08);
  pi.add(led);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.012, 0.16), new THREE.MeshStandardMaterial({
    color: 0xd8d5cc, roughness: 0.8,
  }));
  board.position.set(wallX - 0.44, topY + 0.036, zc + 0.62);
  g.add(board);
  const jumpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wallX - 0.30, topY + 0.04, zc + 0.48),
    new THREE.Vector3(wallX - 0.36, topY + 0.10, zc + 0.55),
    new THREE.Vector3(wallX - 0.43, topY + 0.045, zc + 0.60),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(jumpCurve, 14, 0.004, 5, false),
    new THREE.MeshStandardMaterial({ color: 0xd04a4a, roughness: 0.7 })));

  /* a webcam on a small tripod aimed off the bench: the classifier's eye */
  const camBody = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), DARK());
  camBody.rotation.z = Math.PI / 2;
  camBody.position.set(wallX - 0.52, topY + 0.13, zc - 1.15);
  g.add(camBody);
  const camLens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), new THREE.MeshStandardMaterial({
    color: 0x0c1016, roughness: 0.1, metalness: 0.8,
  }));
  camLens.position.set(wallX - 0.552, topY + 0.13, zc - 1.15);
  camLens.rotation.y = -Math.PI / 2;
  g.add(camLens);
  const camPole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.10, 6), STEEL());
  camPole.position.set(wallX - 0.52, topY + 0.055, zc - 1.15);
  g.add(camPole);

  /* soldering iron, mug, and a coil of solder: a bench in use */
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.10, 14), new THREE.MeshStandardMaterial({
    color: 0x21262e, roughness: 0.35, metalness: 0.05,
  }));
  mug.position.set(wallX - 0.20, topY + 0.08, zc - 0.95);
  g.add(mug);
  const iron = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.006, 0.22, 8), new THREE.MeshStandardMaterial({
    color: 0x2e3540, roughness: 0.5, metalness: 0.5,
  }));
  iron.rotation.z = Math.PI / 2; iron.rotation.y = 0.5;
  iron.position.set(wallX - 0.30, topY + 0.045, zc + 1.0);
  g.add(iron);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 16), ALU());
  coil.rotation.x = Math.PI / 2;
  coil.position.set(wallX - 0.44, topY + 0.05, zc + 0.98);
  g.add(coil);

  /* a photo of the real car, propped against the pegboard */
  const shot = framed('img/photo/carbeetle-800.jpg', 0.36, 0.24);
  shot.position.set(wallX - 0.10, topY + 0.16, zc + 1.28);
  shot.rotation.y = -Math.PI / 2 + 0.18;
  shot.rotation.x = -0.10;
  g.add(shot);

  for (const m of [top, shelf, drawers]) bakeAO(m, { reach: 0.7, strength: 0.5 });

  const sh = blobShadow(1.1, len + 0.6, 0.5);
  sh.position.set(wallX - 0.34, 0.008, zc);
  g.add(sh);

  scene.add(g);
  return { group: g, hotspots, screenMat, screen, idle, index, mon };
}

function pegboardTexture() {
  const { c, x, w, h } = P.canvas(1024, 384);
  x.fillStyle = '#2c333d'; x.fillRect(0, 0, w, h);
  for (let iy = 0; iy < 24; iy++) {
    for (let ix = 0; ix < 64; ix++) {
      x.fillStyle = 'rgba(0,0,0,0.55)';
      x.beginPath(); x.arc(10 + ix * 16, 10 + iy * 16, 3.2, 0, 6.284); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.05)';
      x.beginPath(); x.arc(10 + ix * 16, 8.4 + iy * 16, 3.2, 3.4, 6.0); x.fill();
    }
  }
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.07)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return P.toTexture(c);
}

/* --------------------------------------------------------- study wall */

export function buildWall(scene) {
  const g = new THREE.Group();
  g.name = 'wall';
  const wx = X0 + 0.03, zc = -0.6;
  const hotspots = [];

  // a plywood backing board, so the wall reads as a working wall
  const backer = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.95, 3.8), new THREE.MeshStandardMaterial({
    color: 0x453f36, roughness: 0.93,
  }));
  backer.position.set(wx, 1.62, zc);
  bakeAO(backer, { reach: 1.1, strength: 0.42 });
  g.add(backer);

  const face = (mesh, y, z, ry = 0, rz = 0) => {
    mesh.position.set(wx + 0.026, y, z);
    mesh.rotation.y = Math.PI / 2;
    mesh.rotation.z = rz;
    g.add(mesh);
    return mesh;
  };

  /* the publication, the biggest thing on the wall */
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.83), new THREE.MeshStandardMaterial({
    map: S.paperTexture(), roughness: 0.95,
  }));
  face(paper, 1.86, zc - 1.05, 0, 0.015);
  paper.name = 'paper';
  hotspots.push({ id: 'paper', mesh: paper, size: [0.70, 0.90] });

  /* the AERA photo, pinned beside it */
  const aera = framed(PAPER.photo, 0.66, 0.44);
  aera.position.set(wx + 0.04, 2.02, zc + 0.05);
  aera.rotation.y = Math.PI / 2;
  aera.rotation.z = -0.02;
  g.add(aera);

  /* lecture photo and the classroom work */
  const lect = framed('img/photo/brian-lectern-600.jpg', 0.5, 0.36);
  lect.position.set(wx + 0.04, 1.46, zc + 0.12);
  lect.rotation.y = Math.PI / 2;
  lect.rotation.z = 0.03;
  g.add(lect);

  const ec4 = framed('img/photo/ec4all-600.jpg', 0.42, 0.30);
  ec4.position.set(wx + 0.04, 1.44, zc + 0.72);
  ec4.rotation.y = Math.PI / 2;
  ec4.rotation.z = -0.04;
  g.add(ec4);

  /* two school cards */
  const cols = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.33), new THREE.MeshStandardMaterial({
    map: S.noteTexture('Columbia', [EDUCATION[0].degree, EDUCATION[0].when, EDUCATION[0].note]), roughness: 0.95,
  }));
  face(cols, 2.06, zc + 1.06, 0, 0.02);
  const uci = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.31), new THREE.MeshStandardMaterial({
    map: S.noteTexture('UC Irvine', [EDUCATION[1].degree, EDUCATION[1].when, EDUCATION[1].where]), roughness: 0.95,
  }));
  face(uci, 1.68, zc + 1.42, 0, -0.03);

  /* the thermal plot, taped up like a working printout */
  const plot = framed('img/photo/thermal-plot-600.jpg', 0.46, 0.31);
  plot.position.set(wx + 0.04, 1.30, zc - 0.62);
  plot.rotation.y = Math.PI / 2;
  plot.rotation.z = 0.02;
  g.add(plot);

  /* a strip of experience index cards running along the bottom */
  let z = zc - 1.42;
  for (const e of EXPERIENCE) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({
      map: S.noteTexture(e.short || e.org, [e.role, e.when], '#3b6fd4'), roughness: 0.95,
    }));
    face(card, 0.80, z, 0, (Math.random() - 0.5) * 0.05);
    z += 0.68;
  }

  /* a strip light clipped over the board */
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, 1.7), new THREE.MeshStandardMaterial({
    color: 0x2a313b, roughness: 0.6, metalness: 0.4,
  }));
  clip.position.set(wx + 0.16, 2.52, zc);
  g.add(clip);
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 1.62), new THREE.MeshBasicMaterial({ color: 0xdfe9ff }));
  tube.position.set(wx + 0.16, 2.47, zc);
  g.add(tube);
  const wash = new THREE.PointLight(0xcfe0ff, 1.5, 3.4, 2);
  wash.position.set(wx + 0.55, 2.2, zc);
  g.add(wash);

  hotspots.push({ id: 'wall', mesh: backer, size: null });

  scene.add(g);
  return { group: g, hotspots };
}

/* ------------------------------------------------------------ the dog */

/* Iron Bark, parked on its dock. Sit pose, one behavior: the head turns
   to whatever the pointer is over. No walk cycle, no pathfinding. */
export function buildDog(scene) {
  const g = new THREE.Group();
  g.name = 'dog';
  g.position.set(-2.30, 0, -4.40);
  g.rotation.y = 0.62;
  scene.add(g);

  const shell = new THREE.MeshStandardMaterial({ color: 0x2f3742, roughness: 0.38, metalness: 0.55 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x13171c, roughness: 0.66, metalness: 0.42 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x3b6fd4, roughness: 0.28, metalness: 0.5 });

  /* Everything above the dock hangs off `rig`, so the whole animal can
     lean, bob and bounce without dragging the dock with it. */
  const rig = new THREE.Group();
  g.add(rig);

  /* rounded boxes throughout: the same shapes, just not sharp */
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);

  /* ---- dock ------------------------------------------------------- */
  const dock = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.05, 0.60, 2, 0.014), new THREE.MeshStandardMaterial({
    color: 0x1d222a, roughness: 0.6, metalness: 0.4,
  }));
  dock.position.y = 0.025;
  g.add(dock);
  const dockLed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.014, 0.014), new THREE.MeshBasicMaterial({ color: 0x9dc0ff }));
  dockLed.position.set(0, 0.054, 0.27);
  g.add(dockLed);
  const dockGlow = new THREE.PointLight(0x8fb4ff, 1.6, 2.6, 2.2);
  dockGlow.position.set(0, 0.62, 0.34);
  g.add(dockGlow);
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.3),
    new THREE.MeshBasicMaterial({ map: P.glowTexture('#8fb4ff'), transparent: true, opacity: 0.16,
                                  depthWrite: false, blending: THREE.AdditiveBlending })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  g.add(pool);

  /* A shop lamp on a drop rod, tilted to aim at the dock. It hangs off the
     ceiling rather than clipping to thin air, and the three parts share one
     pivot so the rod, the shade and the lens are one object: before, each
     was rotated on its own axis by its own angle, so the rod ran through
     the shade at a seam and the lens sat off to one side of the mouth.
     The shade is double sided too. Open-ended and front-faced, the near
     wall was culled and you looked straight through it into the inside of
     the far wall, which read as a folded shard rather than a reflector. */
  const lamp = new THREE.Group();
  lamp.position.set(0, 0, -0.34);
  g.add(lamp);
  const CEIL_Y = ROOM.h, PIVOT_Y = 1.46;   // low enough to sit inside the station framing
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.022, 12), STEEL());
  canopy.position.y = CEIL_Y - 0.011;
  lamp.add(canopy);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, CEIL_Y - 0.022 - PIVOT_Y, 6), STEEL());
  rod.position.y = (CEIL_Y - 0.022 + PIVOT_Y) / 2;
  lamp.add(rod);
  const yoke = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), STEEL());
  yoke.position.y = PIVOT_Y;
  lamp.add(yoke);

  const lampHead = new THREE.Group();
  lampHead.position.y = PIVOT_Y;
  lampHead.rotation.x = -0.26;   // aimed down the rod at the dock
  lamp.add(lampHead);
  const shadeMat = STEEL();
  shadeMat.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.17, 20, 1, true), shadeMat);
  shade.position.y = -0.085;
  lampHead.add(shade);
  const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.112, 20), new THREE.MeshBasicMaterial({ color: 0xe8f0ff }));
  lampLens.position.y = -0.166;
  lampLens.rotation.x = Math.PI / 2;   // a circle faces +Z, so this turns it down
  lampHead.add(lampLens);
  const clip = new THREE.PointLight(0xdbe6ff, 2.2, 2.9, 2.0);
  clip.position.set(0.05, 1.25, -0.05);
  g.add(clip);

  /* ---- body: shorter and rounder than a real quadruped ------------ */
  const body = rbox(0.27, 0.20, 0.46, 0.055, shell);
  body.position.set(0, 0.42, 0.00);
  rig.add(body);
  const spine = rbox(0.17, 0.055, 0.40, 0.022, joint);
  spine.position.set(0, 0.525, 0.00);
  rig.add(spine);
  const vent = rbox(0.20, 0.012, 0.10, 0.005, trim);
  vent.position.set(0, 0.528, -0.11);
  rig.add(vent);

  /* ---- legs: stubby, which is most of the cuteness ---------------- */
  const legs = [], shins = [];
  const legPair = (z, hipY) => {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.135, hipY, z);
      rig.add(leg);
      const hip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), joint);
      leg.add(hip);
      const upper = rbox(0.058, 0.15, 0.070, 0.024, shell);
      upper.position.set(0, -0.085, 0.006);
      leg.add(upper);
      /* Everything below the knee hangs off its own group so a paw can fold
         under him. Swinging the whole leg from the hip is a pendulum; a dog
         asking you to play bends here. Rest pose is unchanged. */
      const shin = new THREE.Group();
      shin.position.set(0, -0.163, 0.006);
      leg.add(shin);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), joint);
      shin.add(knee);
      const lower = rbox(0.046, 0.13, 0.052, 0.020, shell);
      lower.position.set(0, -0.072, -0.004);
      shin.add(lower);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.040, 12, 10), joint);
      foot.position.set(0, -0.139, 0.002);
      foot.scale.set(1, 0.72, 1.15);
      shin.add(foot);
      legs.push(leg); shins.push(shin);
    }
  };
  legPair(0.175, 0.40);    // front
  legPair(-0.165, 0.395);  // rear
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), shell);
    shoulder.position.set(sx * 0.132, 0.425, 0.175);
    shoulder.scale.set(0.9, 1, 1.15);
    rig.add(shoulder);
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), shell);
    haunch.position.set(sx * 0.132, 0.415, -0.170);
    haunch.scale.set(0.9, 1, 1.2);
    rig.add(haunch);
  }

  /* ---- head: bigger than scale wants, which is the trick ---------- */
  const head = new THREE.Group();
  head.position.set(0, 0.545, 0.245);
  rig.add(head);
  const skull = rbox(0.195, 0.155, 0.195, 0.058, shell);
  head.add(skull);
  const muzzle = rbox(0.115, 0.075, 0.085, 0.030, joint);
  muzzle.position.set(0, -0.045, 0.115);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.020, 10, 8), joint);
  nose.position.set(0, -0.038, 0.162);
  nose.scale.set(1.25, 0.8, 0.7);
  head.add(nose);

  /* big rounded eyes on a dark face plate */
  const face = rbox(0.155, 0.078, 0.018, 0.026, new THREE.MeshStandardMaterial({
    color: 0x0c0f14, roughness: 0.16, metalness: 0.55,
  }));
  face.position.set(0, 0.022, 0.094);
  head.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8fc0ff });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.030, 18), eyeMat);
    e.position.set(sx * 0.042, 0.022, 0.104);
    head.add(e);
    eyes.push(e);
  }

  /* ears, which perk when the cursor comes near */
  const ears = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.068, 0.072, -0.020);
    head.add(ear);
    const shellEar = rbox(0.042, 0.085, 0.028, 0.013, shell);
    shellEar.position.y = 0.042;
    ear.add(shellEar);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.036), new THREE.MeshStandardMaterial({
      color: 0x25446f, roughness: 0.5, metalness: 0.3,
    }));
    inner.position.set(0, 0.042, 0.0155);
    ear.add(inner);
    ear.rotation.x = 0.30;
    ear.rotation.z = sx * 0.12;
    ears.push(ear);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.062, 6), joint);
  antenna.position.set(0.050, 0.110, -0.058);
  antenna.rotation.z = -0.16;
  head.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 8), trim);
  antennaTip.position.set(0.045, 0.142, -0.058);
  head.add(antennaTip);

  /* ---- tail: two segments that wag ------------------------------- */
  const tail = new THREE.Group();
  tail.position.set(0, 0.475, -0.225);
  rig.add(tail);
  const tail1 = rbox(0.040, 0.040, 0.115, 0.017, shell);
  tail1.position.set(0, 0.020, -0.058);
  tail.add(tail1);
  const tail2 = new THREE.Group();
  tail2.position.set(0, 0.038, -0.112);
  tail.add(tail2);
  const tail2m = rbox(0.032, 0.032, 0.095, 0.014, shell);
  tail2m.position.set(0, 0.014, -0.048);
  tail2.add(tail2m);
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), trim);
  tailTip.position.set(0, 0.026, -0.095);
  tail2.add(tailTip);
  tail.rotation.x = -0.45;

  const sh = blobShadow(0.8, 0.7, 0.55);
  sh.position.y = 0.004;
  g.add(sh);

  const dogHit = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.86, 0.88), new THREE.MeshBasicMaterial({ visible: false }));
  dogHit.position.set(0, 0.42, 0.02);
  g.add(dogHit);

  /* The behavior board on the wall behind the dock. It reads out the
     state machine the real robot runs, and the active state blinks. */
  const boardCv = S.behaviorCanvas();
  S.drawBehavior(boardCv, 0, true);
  const boardTex = P.toTexture(boardCv.c, { aniso: 8 });
  const board = new THREE.Group();
  board.position.set(0.128, 1.10, -0.953);
  board.rotation.y = -0.62;   // undo the dock's yaw so it faces the room
  g.add(board);
  const boardFrame = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.42, 0.035, 2, 0.012), new THREE.MeshStandardMaterial({
    color: 0x2a3039, roughness: 0.62, metalness: 0.35,
  }));
  board.add(boardFrame);
  const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(0.90, 0.35), new THREE.MeshBasicMaterial({ map: boardTex }));
  boardFace.position.z = 0.019;
  board.add(boardFace);
  const boardGlow = new THREE.PointLight(0x7aa7ff, 0.7, 1.5, 2.2);
  boardGlow.position.set(0.20, 1.02, -0.70);
  g.add(boardGlow);

  /* ---- field test frame ------------------------------------------- */
  /* A clip of the real Iron Bark walking a tiled floor, hung to the
     camera's left of the board. An animated GIF uploads only its first
     frame as a texture, so the clip ships as a sprite sheet and is
     stepped by the render loop instead. */
  const walk = { cols: 9, rows: 5, count: 45, cell: 256 };
  const sheetW = walk.cols * walk.cell, sheetH = walk.rows * walk.cell;
  const walkTex = new THREE.TextureLoader().load('img/ironbark-walk.jpg');
  walkTex.colorSpace = THREE.SRGBColorSpace;
  walkTex.generateMipmaps = false;
  walkTex.minFilter = walkTex.magFilter = THREE.LinearFilter;
  walkTex.wrapS = walkTex.wrapT = THREE.ClampToEdgeWrapping;
  // inset a texel each side so linear sampling never drags in the next cell
  walkTex.repeat.set((walk.cell - 2) / sheetW, (walk.cell - 2) / sheetH);
  const showWalkFrame = (n) => {
    const k = ((n % walk.count) + walk.count) % walk.count;
    const col = k % walk.cols, row = Math.floor(k / walk.cols);
    walkTex.offset.set((col * walk.cell + 1) / sheetW,
      1 - (row * walk.cell + walk.cell - 1) / sheetH);
  };
  showWalkFrame(0);

  /* The dock is yawed, but this hangs on a room wall, so it is placed in
     world space and lifted back into the group's frame. */
  const intoGroup = (wx, wy, wz) => {
    const dx = wx - g.position.x, dz = wz - g.position.z;
    const c = Math.cos(-g.rotation.y), s = Math.sin(-g.rotation.y);
    return new THREE.Vector3(dx * c + dz * s, wy, -dx * s + dz * c);
  };

  /* On the side wall rather than the back one: the back wall runs out at
     the corner a hand's width past the board, and the side wall is both
     empty this deep into the room and square-on enough to hang a picture
     the size it deserves. Turned a few degrees off the wall, toward the
     station, so the clip is not read edge-on. */
  const FILM_TURN = 0.175;
  const film = new THREE.Group();
  film.position.copy(intoGroup(X0 + 0.09, 1.15, -4.75));
  film.rotation.y = (Math.PI / 2 - FILM_TURN) - g.rotation.y;
  g.add(film);
  const filmFrame = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.64, 0.038, 2, 0.014), new THREE.MeshStandardMaterial({
    color: 0x2a3039, roughness: 0.62, metalness: 0.35,
  }));
  film.add(filmFrame);
  const filmFace = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ map: walkTex }));
  filmFace.position.set(0, 0.05, 0.021);
  film.add(filmFace);
  const filmCap = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.075), new THREE.MeshBasicMaterial({ map: S.fieldCaptionTexture() }));
  filmCap.position.set(0, -0.2425, 0.021);
  film.add(filmCap);

  return {
    group: g, rig, head, eyeMat, dockLed, ears, tail, tail2, legs, shins, antennaTip,
    board: { canvas: boardCv, texture: boardTex, group: board },
    film: { group: film, show: showWalkFrame, count: walk.count, fps: 10 },
    hotspots: [{ id: 'dog', mesh: dogHit, size: [0.9, 0.9] }],
  };
}

/* ----------------------------------------------------------- the bike */

export function buildBike(scene) {
  const g = new THREE.Group();
  g.name = 'bike';
  g.position.set(-0.55, 1.86, Z_BACK + 0.34);
  g.scale.setScalar(0.9);
  scene.add(g);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x384049, roughness: 0.35, metalness: 0.7 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.94 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x8d96a2, roughness: 0.3, metalness: 0.9 });

  const wheel = (x) => {
    const w = new THREE.Group();
    w.position.x = x;
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 26), tyre);
    w.add(t);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.014, 6, 24), rim);
    w.add(r);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 8), rim);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.60, 4), rim);
      s.rotation.z = (i / 8) * Math.PI;
      w.add(s);
    }
    g.add(w);
    return w;
  };
  const front = wheel(0.60), rear = wheel(-0.60);

  const bar = (a, b, r = 0.019) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 7), frameMat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(m); return m;
  };
  bar([-0.60, 0, 0], [-0.10, 0.26, 0]);      // chainstay to seat cluster
  bar([-0.10, 0.26, 0], [0.26, 0.30, 0]);    // top tube
  bar([0.26, 0.30, 0], [0.60, 0, 0], 0.021); // down to the fork crown
  bar([-0.10, 0.26, 0], [-0.05, -0.10, 0]);  // seat tube
  bar([-0.05, -0.10, 0], [-0.60, 0, 0]);     // chainstay
  bar([-0.05, -0.10, 0], [0.60, 0, 0], 0.017);
  bar([0.26, 0.30, 0], [0.22, 0.46, 0], 0.016);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.58, 7), frameMat);
  bars.rotation.x = Math.PI / 2;
  bars.position.set(0.22, 0.47, 0);
  g.add(bars);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.10), new THREE.MeshStandardMaterial({
    color: 0x16191e, roughness: 0.6,
  }));
  saddle.position.set(-0.13, 0.36, 0);
  saddle.rotation.z = -0.12;
  g.add(saddle);
  const crank = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.010, 5, 18), rim);
  crank.position.set(-0.05, -0.10, 0.045);
  g.add(crank);
  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.15, 0.014), frameMat);
  crankArm.position.set(-0.05, -0.03, 0.06);
  g.add(crankArm);

  /* the hooks it hangs from */
  for (const hx of [-0.60, 0.60]) {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 5, 12, Math.PI * 1.4), new THREE.MeshStandardMaterial({
      color: 0x2f363f, roughness: 0.5, metalness: 0.7,
    }));
    hook.position.set(hx, 0.40, -0.09);
    hook.rotation.set(Math.PI / 2, 0, 0);
    g.add(hook);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.22), STEEL());
    arm.position.set(hx, 0.44, -0.20);
    g.add(arm);
  }

  /* a picture light over the mount, so the back wall is not a void */
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.10), STEEL());
  lightBar.position.set(0, 0.62, -0.16);
  g.add(lightBar);
  const lightTube = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.018, 0.05), new THREE.MeshBasicMaterial({ color: 0xdfe9ff }));
  lightTube.position.set(0, 0.585, -0.13);
  g.add(lightTube);
  const wash = new THREE.PointLight(0xcbd9f2, 2.0, 3.4, 2.1);
  wash.position.set(0, 0.30, 0.34);
  g.add(wash);

  /* the real photo, pinned under it */
  const shot = framed(BIKE.photo, 0.32, 0.47);
  shot.position.set(0.62, -0.62, -0.26);
  shot.rotation.z = 0.03;
  g.add(shot);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 0.1, 0);
  g.add(hit);

  return { group: g, front, rear, hotspots: [{ id: 'bike', mesh: hit, size: null }] };
}

/* ------------------------------------------------------------ the exit */

export function buildExit(scene) {
  const g = new THREE.Group();
  g.name = 'exit';
  const z = Z_BACK + 0.05, x = 2.52;
  scene.add(g);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.14, 0.09), new THREE.MeshStandardMaterial({
    color: 0x232932, roughness: 0.7, metalness: 0.3,
  }));
  frame.position.set(x, 1.07, z);
  g.add(frame);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.0, 0.05), new THREE.MeshStandardMaterial({
    color: 0x2c333d, roughness: 0.55, metalness: 0.45,
  }));
  leaf.position.set(x, 1.0, z + 0.06);
  g.add(leaf);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.20, 8), ALU());
  handle.rotation.x = Math.PI / 2;
  handle.position.set(x + 0.32, 1.02, z + 0.10);
  g.add(handle);

  /* the sign over the door */
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.30), new THREE.MeshBasicMaterial({
    map: S.exitSignTexture(),
  }));
  sign.position.set(x, 2.32, z + 0.07);
  g.add(sign);
  const signGlow = new THREE.PointLight(0xa8c4ff, 2.4, 4.2, 2.1);
  signGlow.position.set(x, 2.16, z + 0.55);
  g.add(signGlow);
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.0),
    new THREE.MeshBasicMaterial({ map: P.glowTexture('#9dbcf0'), transparent: true, opacity: 0.13,
                                  depthWrite: false, blending: THREE.AdditiveBlending })
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(x, 0.014, z + 0.9);
  g.add(spill);

  /* the light switch: the one control that changes the room */
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.20, 0.02), new THREE.MeshStandardMaterial({
    color: 0x333a44, roughness: 0.6,
  }));
  plate.position.set(x - 0.72, 1.22, z + 0.06);
  g.add(plate);
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.022), new THREE.MeshStandardMaterial({
    color: 0xc4ccd6, roughness: 0.5,
  }));
  rocker.position.set(x - 0.72, 1.22, z + 0.075);
  g.add(rocker);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, 1.15, z + 0.15);
  g.add(hit);
  const switchHit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
  switchHit.position.set(x - 0.72, 1.22, z + 0.12);
  g.add(switchHit);

  return {
    group: g, rocker,
    hotspots: [{ id: 'exit', mesh: hit, size: null }, { id: 'lights', mesh: switchHit, size: null }],
  };
}

/* --------------------------------------------------------- odds and ends */

/* Things that keep the room from being still, and reward orbiting to the
   back of the shop where there is no content to find. */
export function buildDressing(scene) {
  const g = new THREE.Group();
  scene.add(g);

  /* a shop fan on a stand, turning */
  const fan = new THREE.Group();
  fan.position.set(-2.95, 1.05, 1.55);
  fan.rotation.y = -0.8;
  g.add(fan);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.014, 6, 20), STEEL());
  fan.add(cage);
  const blades = new THREE.Group();
  fan.add(blades);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.008), new THREE.MeshStandardMaterial({
      color: 0x4d545e, roughness: 0.5, metalness: 0.6,
    }));
    b.position.set(Math.cos(i * 1.571) * 0.09, Math.sin(i * 1.571) * 0.09, 0);
    b.rotation.z = i * 1.571 + 0.5;
    blades.add(b);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 8), STEEL());
  pole.position.set(-2.95, 0.53, 1.55);
  g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.03, 14), STEEL());
  base.position.set(-2.95, 0.015, 1.55);
  g.add(base);

  /* a stack of tyres in the corner */
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 8, 20), new THREE.MeshStandardMaterial({
      color: 0x15181d, roughness: 0.95,
    }));
    t.rotation.x = Math.PI / 2;
    t.position.set(-3.05, 0.12 + i * 0.20, -2.3);
    t.rotation.z = i * 0.5;
    g.add(t);
  }

  /* a jack and a creeper under the bench end */
  const jack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.52), new THREE.MeshStandardMaterial({
    color: 0x9a2f2f, roughness: 0.55, metalness: 0.4,
  }));
  jack.position.set(2.62, 0.07, -3.0);
  jack.rotation.y = 0.3;
  g.add(jack);

  /* a coolant jug and a funnel: the small true details */
  const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 12), new THREE.MeshStandardMaterial({
    color: 0x2e5fa8, roughness: 0.4, metalness: 0.05,
  }));
  jug.position.set(3.2, 1.06, -2.4);
  g.add(jug);

  /* the roller door motor, mounted on the ceiling: the project itself */
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.46), new THREE.MeshStandardMaterial({
    color: 0x3a424c, roughness: 0.5, metalness: 0.6,
  }));
  motor.position.set(0, ROOM.h - 0.22, 2.45);
  g.add(motor);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 1.5), STEEL());
  rail.position.set(0, ROOM.h - 0.20, 3.25);
  g.add(rail);
  const motorLed = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), new THREE.MeshBasicMaterial({ color: 0x8fffb0 }));
  motorLed.position.set(0.14, ROOM.h - 0.22, 2.68);
  motorLed.rotation.y = 0.0;
  g.add(motorLed);

  return { group: g, blades, motorLed };
}
