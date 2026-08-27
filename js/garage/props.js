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
  /* A sheet of glass over the print. It changes nothing about the picture
     and adds one thing: a specular that slides across as you orbit. That
     slide is the entire difference between a photograph hanging on a wall
     and a photograph painted onto one, and it costs a plane. Kept at 6%
     and not a point more, because a photo you cannot read through the
     reflection is a worse photo. depthWrite off so it never z-fights the
     print a couple of millimetres behind it. */
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.05, h + 0.05),
    new THREE.MeshStandardMaterial({
      color: 0xdfe8f8, roughness: 0.07, metalness: 0,
      transparent: true, opacity: 0.06, depthWrite: false,
    }));
  glass.position.z = depth / 2 + 0.006;
  g.add(glass);
  return g;
}

/* ------------------------------------------------------------ signage */

export function buildSign(scene, touch, twoLine = false) {
  const g = new THREE.Group();
  /* twoLine is the unshipped proposal, reachable only via ?sign=two, so it
     can be photographed hanging in the room rather than argued about flat. */
  const signMap = twoLine ? S.signTextureTwoLine()
    : touch ? S.touchSignTexture() : S.signTexture();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 0.48, 0.05),
    new THREE.MeshStandardMaterial({ map: signMap, roughness: 0.7, metalness: 0.2 })
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

export function buildBench(scene, opts = {}) {
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
  const wrenchLen = P.seeded(0x77e9c401);
  for (let i = 0; i < 7; i++) {
    const l = 0.20 + wrenchLen() * 0.16;
    const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.03, l, 0.014), ALU());
    wrench.position.set(wallX - 0.06, 2.05 - l / 2, zc - 1.25 + i * 0.19);
    g.add(wrench);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 5, 10), ALU());
    ring.position.set(wallX - 0.06, 2.05 - l, zc - 1.25 + i * 0.19);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }

  /* the holo desk: the arc of panes where the monitor used to stand */
  const holo = buildHoloDesk(g, hotspots, opts);
  const { screenMat, idle, index } = holo;

  /* the emitter the arc is thrown from. Small, machined, and sitting
     where the monitor's foot used to: without it the panes hang off
     nothing and the desk reads as missing a thing rather than as having
     a better one. */
  const emit = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.022, 14), ALU());
  emit.position.set(wallX - 0.30, topY + 0.041, zc - 0.26);
  g.add(emit);
  const emitRing = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 5, 14), new THREE.MeshBasicMaterial({
    color: 0x7aa7ff, transparent: true, opacity: 0.85, toneMapped: false,
  }));
  emitRing.rotation.x = Math.PI / 2;
  emitRing.position.set(wallX - 0.30, topY + 0.053, zc - 0.26);
  g.add(emitRing);

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
  return { group: g, hotspots, screenMat, screen: holo.browser, idle, index, mon: holo.group, holo };
}

/* ------------------------------------------------------- the holo desk */
/* An arc of panes over the bench, in the grammar of a workshop desk lit
   only by its own instruments: translucent, additive, dense with small
   type, and dim enough that the corner still reads as a dark garage.
   Everything printed on them is real. The dyno figure is the dyno's, the
   tags are the project's, the dates are the resume's; the density is the
   effect, but invented density would just be noise with a font. */

/* The arc is struck around the eye, not around the desk. Every pane sits
   the same distance from where camera.js parks you at this station,
   which is what makes an arc read as an arc instead of as a row of
   screens seen at an angle. EYE is that parking spot, solved from
   POI.bench; PHI is the bearing from it to the middle of the bench. */
const HOLO_EYE = [1.36, 1.36, -0.38];
const HOLO_PHI = 1.849;
const GHOST_LEN = 0.55;

/* Where the turntable sits, measured rather than judged. The first cut put
   the ghost at dPhi 0.080, which read fine from the parked view and was
   wrong everywhere else: projected against the diagnostics sheet it
   crossed the pane at every one of 210 sampled cage poses, with up to 71%
   of the wireframe's own vertices on the readout and the nose through the
   DIAGNOSTICS header.
   Solved by sweeping the ghost's projected hull against each pane's
   projected quad over the whole cage. Two things the first attempt at
   this got wrong. The fix is sideways, not upward: lifting the ghost
   clear of the sheet's top needs about 0.27m and puts it out of frame,
   while swinging it round the arc into the empty band left of the sheet
   and above the browser costs nothing. And the turntable turns, so one
   frame proves nothing: a placement that was clear at the yaw it happened
   to be sampled at still grazed the browser pane a third of a revolution
   later. These numbers are the worst case over twelve turntable angles as
   well as over the cage, panel open and closed.
   At dPhi 0.360, r 1.760, y 1.820 the ghost never touches any of the
   three panes at any sampled pose or angle: 0.019 of NDC daylight to the
   diagnostics sheet at worst, 0.029 to the browser, 0.27 to the capture,
   and it keeps its full size. Its roof reaches 0.969 of the frame at the
   parked view, which is tight but stable: three.js holds vertical FOV
   across aspect ratios, so a wider or narrower window does not push it
   any closer to the top. The panes themselves do not move at all, so
   none of this is paid for out of the panel-open budget. */
const GHOST = { dPhi: 0.360, r: 1.760, y: 1.820, spin: 0.5 };
const GHOST_POOL_DROP = 0.085;      // the light pool sits under the turntable

/* Where the light comes from. A projection with no source is a decal, so
   every sheet in the arc gets one and you can see the throw leave it.
   The puck is the one the bench already builds at the old monitor's foot,
   and it takes the turntable, which hangs more or less over it. The three
   nubs are new and small, one per pane, set along the front lip of the
   bench top: forking all four throws out of the single puck drew a
   starburst, which is a lightshow, while a source under each sheet reads
   as an array of instruments. The lip is x 2.98 at the near edge and the
   top is y 0.92, which is where these numbers come from; the z values are
   each pane's own, pulled apart where two panes share a bearing so two
   nubs never sit on top of each other. All of them are well clear of the
   arm's end of the bench. */
const DESK_Y = 0.92;
const EMIT = [X1 - 0.30, DESK_Y + 0.041, -0.86];        // the existing puck
const NUBS = {
  browser: [X1 - 0.58, DESK_Y + 0.026, -1.14],
  diag:    [X1 - 0.58, DESK_Y + 0.026, -0.70],
  capture: [X1 - 0.58, DESK_Y + 0.026, -0.46],
};

/* A throw of light from a source to the thing it draws. The cone is a
   unit with its apex on the local origin opening down its own -Y, so
   aiming one is a single rotation of -Y onto the direction and a single
   scale onto the distance: no Euler order to get wrong, and the texture's
   own falloff always runs from the lens outward whichever way it points. */
function holoThrow(mat, from, to, spread) {
  const g = new THREE.ConeGeometry(1, 1, 14, 1, true);
  g.translate(0, -0.5, 0);
  const m = new THREE.Mesh(g, mat);
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  m.position.set(from[0], from[1], from[2]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  m.scale.set(spread, len, spread);
  return m;
}

/* dPhi swings a pane round the arc, r pushes it out from the eye, y is
   plain height. Three panes at three sizes with one clearly dominant: a
   row of equal rectangles would read as a menu, and this is meant to
   read as a desk in use. A fourth pane carrying the tool stack lived
   here for a while and spent the whole time fighting the browser for
   the same corner of the frame, so its content moved onto the
   diagnostics sheet instead. All three sit well clear of the arm's end
   of the bench, which keeps its stretch of MDF to itself.
   The band to compose in is not symmetric. The rig shifts its look-at
   0.20 to the right whenever a panel is open, to park the subject clear
   of it, and the panel then covers the right of the frame outright, so
   what is left runs about -0.24 to +0.39 of dPhi and the arc leans into
   it rather than sitting square. */
const PANES = [
  { id: 'browser', dPhi: 0.171, r: 1.744, y: 1.357, w: 0.802, h: 0.5012, order: 10, rz: 0 },
  { id: 'diag', dPhi: -0.119, r: 1.458, y: 1.574, w: 0.509, h: 0.4929, order: 11, rz: -0.018 },
  { id: 'capture', dPhi: -0.108, r: 1.337, y: 1.136, w: 0.400, h: 0.2875, order: 12, rz: 0.020 },
];

function holoPlace(node, dPhi, r, y) {
  const phi = HOLO_PHI + dPhi;
  node.position.set(HOLO_EYE[0] + r * Math.sin(phi), y, HOLO_EYE[2] + r * Math.cos(phi));
  node.rotation.y = phi + Math.PI;        // face back down its own radius
  return phi;
}

/* The Carbeetle, projected. The shell is already in memory for the real
   car, so the ghost clones that geometry rather than fetching the glTF a
   second time, and takes only its edges: a full wireframe of a car body
   is a grey mass at this size, while the contour lines are the thing
   that actually reads as a hologram. */
function buildGhost(geo) {
  const group = new THREE.Group();
  if (!geo) return { group, spin: null, mat: null };

  const edges = new THREE.EdgesGeometry(geo, 24);
  const mat = new THREE.LineBasicMaterial({
    color: 0x8ec2ff, transparent: true, opacity: 0.34,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const lines = new THREE.LineSegments(edges, mat);
  // a Group carries no draw of its own, so the order has to sit on the mesh
  lines.renderOrder = 14;

  edges.computeBoundingBox();
  const bb = edges.boundingBox;
  const c = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());
  lines.position.set(-c.x, -c.y, -c.z);

  /* the shell stands Z-up in its own frame, the same way the engine bay
     does, so the turntable carries a quarter turn to stand it up */
  const tilt = new THREE.Group();
  tilt.rotation.x = -Math.PI / 2;
  tilt.add(lines);
  const spin = new THREE.Group();
  spin.scale.setScalar(GHOST_LEN / (Math.max(size.x, size.y, size.z) || 1));
  spin.add(tilt);
  group.add(spin);
  return { group, spin, mat };
}

function buildHoloDesk(parent, hotspots, { ghost: ghostGeo = null, reduced = false } = {}) {
  const group = new THREE.Group();
  group.name = 'holo';
  parent.add(group);

  const glowTex = P.glowTexture('#bfd8ff', '130,170,240', '96,132,200');
  const bleedMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.10, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });

  const idle = S.holoIdle(0);
  const index = S.holoIndex();
  const WING = {
    capture: (p, im) => S.holoCapture(p, im),
    diag: (p) => S.holoDiag(p),
  };
  const panes = {};
  const list = [];

  for (const spec of PANES) {
    // the browser keeps the crossfade the bench already drives; the wings
    // get the same material so a project change reads as one gesture
    const first = spec.id === 'browser' ? idle : WING[spec.id](null, null);
    const second = spec.id === 'browser' ? index : first;
    const mat = S.holoScreenMaterial(first, second, { alpha: spec.id === 'browser' ? 1 : 0.96 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), mat);
    holoPlace(mesh, spec.dPhi, spec.r, spec.y);
    mesh.rotation.z = spec.rz;
    mesh.renderOrder = spec.order;
    mesh.name = `holo-${spec.id}`;
    group.add(mesh);

    // the pane's own bloom, sat just behind it so the pegboard catches it.
    // Held close to the pane's own size: any bigger and four soft
    // rectangles merge into one sheet of fog across the wall.
    const bleed = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * 1.28, spec.h * 1.42), bleedMat);
    holoPlace(bleed, spec.dPhi, spec.r + 0.05, spec.y);
    bleed.renderOrder = spec.order - 5;
    group.add(bleed);

    const pane = {
      id: spec.id, mesh, mat, baseY: spec.y, baseRz: spec.rz,
      phase: list.length * 1.9, rate: 0.55 + list.length * 0.11,
      own: spec.id !== 'browser',      // the browser's fade is main.js's
    };
    panes[spec.id] = pane;
    list.push(pane);
  }

  // the browser pane is the hotspot: same id as before, so handle() and
  // the rail button route exactly as they always did
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.78, 0.14),
    new THREE.MeshBasicMaterial({ visible: false }));
  panes.browser.mesh.add(hit);
  hotspots.push({ id: 'bench', mesh: hit, size: [1.18, 0.78] });

  /* the turntable, above and a little to the near side of the browser so
     it never sits on top of what you are reading */
  const ghost = buildGhost(ghostGeo);
  holoPlace(ghost.group, GHOST.dPhi, GHOST.r, GHOST.y);
  ghost.group.rotation.y += GHOST.spin;
  group.add(ghost.group);

  const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.20, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.copy(ghost.group.position).setY(GHOST.y - GHOST_POOL_DROP);
  pool.renderOrder = 10;
  group.add(pool);

  /* ---- the throws -------------------------------------------------- */

  /* The projection, sold. Each sheet gets a beam up from its own nub and
     the turntable gets one from the puck. The wings share a material so
     the array breathes on one number; the turntable's is a clone of it a
     stop up, driven off the same flicker.
     They sit at renderOrder 4, under the panes' own bloom at 5 and well
     under the panes at 10-12: a throw belongs behind what it draws. But
     the order is documentation, not protection. Additive light is
     commutative, so drawing a beam first does nothing to stop it adding
     onto a pane it crosses; only never arriving does, which is why the
     brightness is low and the texture is dead about two thirds of the
     way along. That is what actually keeps the type clean. */
  const BEAM_BASE = 0.17;
  const GHOST_BEAM_GAIN = 1.7;
  const beamMat = new THREE.MeshBasicMaterial({
    map: P.holoBeamTexture(), transparent: true, opacity: BEAM_BASE,
    depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false,
  });
  const beams = new THREE.Group();
  beams.name = 'holo-beams';
  group.add(beams);

  /* A nub is a pea of machined aluminium with a lit face, the same
     hardware grammar as the puck at a tenth the size. Without it the beam
     starts out of bare MDF. */
  for (const spec of PANES) {
    const at = NUBS[spec.id];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.012, 10), ALU());
    body.position.set(at[0], at[1], at[2]);
    group.add(body);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.010, 10), new THREE.MeshBasicMaterial({
      color: 0x9fc6ff, transparent: true, opacity: 0.9, toneMapped: false,
    }));
    lens.rotation.x = -Math.PI / 2;
    lens.position.set(at[0], at[1] + 0.007, at[2]);
    group.add(lens);

    /* Aimed at the sheet's own centre, and narrower than the sheet is
       wide: a cone as wide as the pane reads as a wash sitting on it
       rather than as the throw that put it there. */
    const t = panes[spec.id].mesh.position;
    const beam = holoThrow(beamMat, [at[0], at[1] + 0.012, at[2]],
                           [t.x, t.y, t.z], spec.w * 0.20);
    beam.renderOrder = 4;
    beams.add(beam);
  }

  /* And the turntable's own, off the puck the bench already has. It gets
     its own material a stop up because it is the longest throw in the set
     and the one carrying the thing that most obviously hangs off nothing:
     at the wings' brightness it read as a smudge rather than as a source.
     Its line does pass behind the browser pane about three fifths of the
     way along, which is exactly why the texture is dead by two thirds:
     what crosses the sheet is already nothing. */
  const gp = ghost.group.position;
  const gBeamMat = beamMat.clone();
  gBeamMat.opacity = BEAM_BASE * GHOST_BEAM_GAIN;
  const gBeam = holoThrow(gBeamMat, [EMIT[0], EMIT[1] + 0.014, EMIT[2]],
                          [gp.x, gp.y, gp.z], 0.085);
  gBeam.renderOrder = 4;
  beams.add(gBeam);

  /* what the arc spills onto the bench top. A pane that lights nothing
     is a decal; this is the difference between the two. */
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.75), new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.17, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(X1 - 0.31, 0.954, -0.66);
  spill.renderOrder = 9;
  group.add(spill);

  /* ---- content ---------------------------------------------------- */

  function fade(pane, tex) {
    const u = pane.mat.uniforms;
    u.tA.value = u.uProgress.value > 0.5 ? u.tB.value : u.tA.value;
    u.tB.value = tex;
    u.uProgress.value = reduced ? 1 : 0;
  }

  /* Photographs arrive late and out of order if you click quickly, so the
     wing paints its empty state at once and the image is only allowed to
     land if it is still the one being asked for. */
  const cache = new Map();
  let token = 0;

  function photo(url) {
    if (!url) return Promise.resolve(null);
    if (!cache.has(url)) {
      cache.set(url, new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = url;
      }));
    }
    return cache.get(url);
  }

  function sync(p) {
    const mine = ++token;
    fade(panes.capture, S.holoCapture(p, null));
    fade(panes.diag, S.holoDiag(p));
    const url = p ? p.photo : 'img/photo/carbeetle-800.jpg';
    if (url) {
      photo(url).then((im) => {
        if (im && mine === token) fade(panes.capture, S.holoCapture(p, im));
      });
    }
  }
  /* The wings are built wearing their own p=null faces, so the only
     thing still outstanding at boot is the photograph. */
  photo('img/photo/carbeetle-800.jpg').then((im) => {
    if (im && token === 0) fade(panes.capture, S.holoCapture(null, im));
  });

  /* ---- motion ------------------------------------------------------ */

  function step(t, dt, animate) {
    // a crossfade is state, not decoration: it finishes at any tier
    for (const pane of list) {
      const u = pane.mat.uniforms;
      if (pane.own && u.uProgress.value < 1) {
        u.uProgress.value = Math.min(1, u.uProgress.value + dt * 3.4);
      }
      u.uTime.value = animate ? t : 0;
    }
    if (!animate) {
      // dropping a tier mid-session must not leave a pane parked at
      // whatever drift it happened to be carrying that frame, nor the
      // throws parked mid-flicker
      for (const pane of list) {
        pane.mesh.position.y = pane.baseY;
        pane.mesh.rotation.z = pane.baseRz;
      }
      beamMat.opacity = BEAM_BASE;
      gBeamMat.opacity = BEAM_BASE * GHOST_BEAM_GAIN;
      /* step() stops animating for two different reasons and they do not
         want the same answer. Under reduced motion the throws stay lit
         and hold still, the way the panes beside them do: they are
         scenery, and the ask is only that nothing moves. A dropped tier
         is the other reason, and that one is about cost, so there they
         come off entirely - four additive cones is overdraw a machine
         already missing frames should not be paying for. */
      beams.visible = reduced;
      return;
    }
    beams.visible = true;
    for (const pane of list) {
      pane.mesh.position.y = pane.baseY + Math.sin(t * pane.rate + pane.phase) * 0.005;
      pane.mesh.rotation.z = pane.baseRz + Math.sin(t * pane.rate * 0.7 + pane.phase) * 0.004;
    }
    if (ghost.spin) ghost.spin.rotation.y = t * 0.34;
    pool.material.opacity = 0.20 + 0.03 * Math.sin(t * 1.4);
    /* The throws flicker on the rate the panes already breathe at, which
       is 1.9 in the pane shader, so the array reads as one instrument
       rather than as a beam effect bolted beside a screen effect. The
       second rate is not a multiple of the first, so it never settles
       into a loop you can count. */
    const flick = 0.86 + 0.10 * Math.sin(t * 1.9) + 0.05 * Math.sin(t * 0.77);
    beamMat.opacity = BEAM_BASE * flick;
    gBeamMat.opacity = BEAM_BASE * GHOST_BEAM_GAIN * flick;
  }

  return { group, browser: panes.browser.mesh, screenMat: panes.browser.mat, idle, index, ghost, sync, step };
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

  /* a strip of experience index cards running along the bottom.
     The tilt used to be Math.random() per card, which is the right look
     and the wrong mechanism: the wall was rearranged on every load, so no
     two screenshots of one build ever matched. Fixed seed, same wall, and
     the spread is held to about 1.5 degrees — enough that they read as
     pinned up by hand, little enough that they do not read as falling off.
     A hair of vertical scatter too, for the same reason. */
  const tilt = P.seeded(0xca4d5711);
  let z = zc - 1.42;
  for (const e of EXPERIENCE) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({
      map: S.noteTexture(e.short || e.org, [e.role, e.when], '#3b6fd4'), roughness: 0.95,
    }));
    face(card, 0.80 + (tilt() - 0.5) * 0.02, z, 0, (tilt() - 0.5) * 0.052);
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
  /* A print in a frame, not a lightbox. These were Basic, which means they
     ignored the room entirely and rendered at full brightness: in a corner
     this dark that made a white photograph the brightest object at the
     station, brighter than the robot it is a photograph OF. Standard puts
     it back under the clip lamp above it, where a framed print belongs, and
     lets Iron Bark be the thing you look at first.
     The board next to it stays Basic on purpose. That one really is a
     screen, it is dark-field UI rather than a white print, and it has its
     own glow light behind it. */
  const printMat = (map) => new THREE.MeshStandardMaterial({
    map, roughness: 0.82, metalness: 0.02,
  });
  const filmFace = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), printMat(walkTex));
  filmFace.position.set(0, 0.05, 0.021);
  film.add(filmFace);
  const filmCap = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.075),
    printMat(S.fieldCaptionTexture()));
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

/* ------------------------------------------------- ambient machines */
/* Two small robots that keep the shop moving. Both are built from the
   same parts bin as Iron Bark so they read as one product line, and both
   run entirely off the shared clock: position, pose and gait are pure
   functions of t, so stepping time backwards reproduces a frame exactly.
   Neither carries a hotspot. They are life, not navigation. */

const PUP_SHELL = () => new THREE.MeshStandardMaterial({ color: 0x2f3742, roughness: 0.38, metalness: 0.55 });
const PUP_JOINT = () => new THREE.MeshStandardMaterial({ color: 0x13171c, roughness: 0.66, metalness: 0.42 });
const PUP_TRIM = () => new THREE.MeshStandardMaterial({ color: 0x3b6fd4, roughness: 0.28, metalness: 0.5 });

/* Both wanderers walk a closed Catmull-Rom ring on the same clock, so
   the timeline maths lives here once. A route is a list of stops, each
   with a dwell in seconds; the ring is sampled to arc length and every
   leg gets a cosine speed ramp off a standing start and back down into
   the next stop, running flat out in between. Easing position instead
   would leave a machine arriving at a pass-through waypoint at twice
   cruise and then snapping back to it, which on the pup is the exact
   mismatch that reads as a moonwalk once the legs are driven off
   distance. Ramping speed keeps it continuous, so there is no join.

   sample(t) is a pure function of t. Nothing accumulates, so stepping
   the clock backwards reproduces a frame exactly. */
function ringPath(points, speed, ramp = 0.55) {
  const curve = new THREE.CatmullRomCurve3(points.map((w) => new THREE.Vector3(...w.at)),
                                           true, 'catmullrom', 0.5);
  /* Finer than the default 200, so the arc length table the walk is
     driven from and the one getPointAt looks up are the same table. */
  curve.arcLengthDivisions = 600;
  const len = curve.getLength();
  const lens = curve.getLengths(600);
  const stopS = points.map((w, i) => {
    const f = (i / points.length) * 600, lo = Math.floor(f);
    return lens[lo] + (lens[Math.min(600, lo + 1)] - lens[lo]) * (f - lo);
  });

  const beats = [];
  let at = 0;
  for (let i = 0; i < points.length; i++) {
    const w = points[i], nx = points[(i + 1) % points.length];
    if (w.dwell > 0) {
      beats.push({ t0: at, t1: at + w.dwell, hold: 1, s0: stopS[i], wp: i });
      at += w.dwell;
    }
    const s0 = stopS[i];
    const s1 = i === points.length - 1 ? len : stopS[i + 1];
    const ti = w.dwell > 0 ? ramp : 0;          // leaving a stop
    const to = nx.dwell > 0 ? ramp : 0;         // arriving at one
    const dur = (s1 - s0) / speed + (ti + to) / 2;
    beats.push({ t0: at, t1: at + dur, hold: 0, s0, s1, wp: i, ti, to, tc: dur - ti - to });
    at += dur;
  }
  const period = at;

  const sample = (t) => {
    const u = ((t % period) + period) % period;
    let b = beats[beats.length - 1];
    for (let i = 0; i < beats.length; i++) {
      if (u >= beats[i].t0 && u < beats[i].t1) { b = beats[i]; break; }
    }
    if (b.hold) {
      return { s: b.s0, speed: 0, hold: (u - b.t0) / (b.t1 - b.t0), stop: points[b.wp] };
    }
    const V = speed;
    let tau = u - b.t0, s = b.s0, sp = V;
    if (tau < b.ti) {
      s += (V / 2) * (tau - (b.ti / Math.PI) * Math.sin((Math.PI * tau) / b.ti));
      sp = (V / 2) * (1 - Math.cos((Math.PI * tau) / b.ti));
    } else if (tau < b.ti + b.tc) {
      s += (V * b.ti) / 2 + V * (tau - b.ti);
    } else {
      const sg = tau - b.ti - b.tc;
      s += (V * b.ti) / 2 + V * b.tc
         + (V / 2) * (sg + (b.to / Math.PI) * Math.sin((Math.PI * sg) / b.to));
      sp = (V / 2) * (1 + Math.cos((Math.PI * sg) / b.to));
    }
    return { s, speed: sp, hold: 0, stop: points[b.wp] };
  };

  return { curve, len, period, sample };
}

/* The pup patrols this ring, walked as a closed Catmull-Rom so the
   corners round themselves off instead of needing any turn logic.
   Which side of the car it runs down is not an arbitrary choice. The car
   sits in the middle of the floor and both wide stations look at it from
   the door end, so the whole left hand lane is behind it: a pup patrolling
   there is out of sight for four fifths of a lap. This ring keeps the near
   lane and the apron in front of the car, where it is in clear view, and
   lets the far lane be the stretch where it goes behind the car and comes
   back out. Waypoint 6 parks it beside Iron Bark's dock for a hello,
   clear of the dock itself and off the line the dog station looks down. */
const PUP_ROUTE = [
  { at: [0.70, 2.95], dwell: 2.6, look: 1 },    // the apron, in front of the nose
  { at: [1.95, 1.85], dwell: 0, look: 0 },
  { at: [2.10, 0.10], dwell: 3.0, look: 1 },    // near lane, between car and bench
  { at: [2.05, -1.90], dwell: 0, look: 0 },
  { at: [1.45, -3.35], dwell: 0, look: 0 },
  { at: [-0.30, -4.35], dwell: 0, look: 0 },    // along the back wall
  { at: [-1.36, -4.24], dwell: 4.2, look: 0, greet: 1 },
  { at: [-2.25, -3.05], dwell: 0, look: 0 },
  { at: [-2.35, -1.00], dwell: 2.2, look: 1 },  // far lane, behind the car
  { at: [-2.05, 1.40], dwell: 0, look: 0 },
  { at: [-1.75, 2.70], dwell: 0, look: 0 },     // round the nose and back to the apron
];
const PUP_SPEED = 0.52;      // metres per second at cruise
const PUP_SCALE = 0.42;      // against Iron Bark, who is the full size dog

export function buildPup(scene) {
  const g = new THREE.Group();
  g.name = 'pup';
  scene.add(g);

  /* The animal is built at Iron Bark's own dimensions and then shrunk,
     which is the cheapest way to guarantee the silhouettes match. */
  const craft = new THREE.Group();
  craft.scale.setScalar(PUP_SCALE);
  /* Iron Bark's feet hang where they do because he stands on a dock.
     Borrowing his skeleton wholesale therefore leaves the pup hovering
     about 30 mm over bare concrete, so the whole animal is dropped by
     exactly the gap between his lowest foot and his own origin. Derived
     rather than dialled in, so it survives anyone editing the leg. */
  const FOOT_GAP = (0.40 - 0.163 - 0.139) - 0.040 * 0.72;
  craft.position.y = -FOOT_GAP * PUP_SCALE;
  g.add(craft);
  const rig = new THREE.Group();
  craft.add(rig);

  const shell = PUP_SHELL(), joint = PUP_JOINT(), trim = PUP_TRIM();
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, r), mat);

  const body = rbox(0.27, 0.20, 0.46, 0.055, shell);
  body.position.set(0, 0.42, 0);
  rig.add(body);
  /* The spine plate is not decoration. Dropping it as a simplification
     left daylight between the back of the skull and the top of the body
     on every side on view, because it is the piece that bridges them. */
  const spine = rbox(0.17, 0.055, 0.40, 0.022, joint);
  spine.position.set(0, 0.525, 0.02);
  rig.add(spine);
  const vent = rbox(0.20, 0.012, 0.10, 0.005, trim);
  vent.position.set(0, 0.528, -0.11);
  rig.add(vent);

  /* Four pendulum legs with a knee, because the knee is what lets a foot
     lift clear on the swing instead of scuffing through the floor. */
  const legs = [], shins = [];
  const legGeo = new RoundedBoxGeometry(0.058, 0.15, 0.070, 1, 0.024);
  const lowGeo = new RoundedBoxGeometry(0.046, 0.13, 0.052, 1, 0.020);
  const footGeo = new THREE.SphereGeometry(0.040, 8, 6);
  const legPair = (z, hipY) => {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.135, hipY, z);
      rig.add(leg);
      const upper = new THREE.Mesh(legGeo, shell);
      upper.position.set(0, -0.085, 0.006);
      leg.add(upper);
      const shin = new THREE.Group();
      shin.position.set(0, -0.163, 0.006);
      leg.add(shin);
      const lower = new THREE.Mesh(lowGeo, shell);
      lower.position.set(0, -0.072, -0.004);
      shin.add(lower);
      const foot = new THREE.Mesh(footGeo, joint);
      foot.position.set(0, -0.139, 0.002);
      foot.scale.set(1, 0.72, 1.15);
      shin.add(foot);
      legs.push(leg); shins.push(shin);
    }
  };
  legPair(0.175, 0.40);
  legPair(-0.165, 0.395);
  const shoulderGeo = new THREE.SphereGeometry(0.058, 8, 6);
  const haunchGeo = new THREE.SphereGeometry(0.066, 8, 6);
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeo, shell);
    shoulder.position.set(sx * 0.132, 0.425, 0.175);
    shoulder.scale.set(0.9, 1, 1.15);
    rig.add(shoulder);
    const haunch = new THREE.Mesh(haunchGeo, shell);
    haunch.position.set(sx * 0.132, 0.415, -0.170);
    haunch.scale.set(0.9, 1, 1.2);
    rig.add(haunch);
  }

  /* Head, oversized on purpose, same as his. No antenna and no separate
     nose: at this size those parts are one pixel and only cost draws. */
  const head = new THREE.Group();
  head.position.set(0, 0.545, 0.245);
  rig.add(head);
  const skull = rbox(0.195, 0.155, 0.195, 0.058, shell);
  head.add(skull);
  const muzzle = rbox(0.115, 0.075, 0.085, 0.030, joint);
  muzzle.position.set(0, -0.045, 0.115);
  head.add(muzzle);
  const face = rbox(0.155, 0.078, 0.018, 0.026, new THREE.MeshStandardMaterial({
    color: 0x0c0f14, roughness: 0.16, metalness: 0.55,
  }));
  face.position.set(0, 0.022, 0.094);
  head.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8fc0ff });
  const eyeGeo = new THREE.CircleGeometry(0.030, 10);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(sx * 0.042, 0.022, 0.104);
    head.add(e);
  }
  const ears = [];
  const earGeo = new RoundedBoxGeometry(0.042, 0.085, 0.028, 1, 0.013);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.068, 0.072, -0.020);
    head.add(ear);
    const shellEar = new THREE.Mesh(earGeo, shell);
    shellEar.position.y = 0.042;
    ear.add(shellEar);
    ear.rotation.x = 0.30;
    ear.rotation.z = sx * 0.12;
    ears.push(ear);
  }

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
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 5), trim);
  tailTip.position.set(0, 0.026, -0.095);
  tail2.add(tailTip);
  tail.rotation.x = -0.45;

  const sh = blobShadow(0.46, 0.40, 0.58);
  sh.position.y = 0.004;
  g.add(sh);

  /* Parked where the ring starts, facing the way it goes. This is the
     pose he keeps when the visitor has asked for reduced motion or the
     machine is too slow to animate him, so it has to be a pose worth
     standing in rather than the origin. */
  g.position.set(PUP_ROUTE[0].at[0], 0, PUP_ROUTE[0].at[1]);
  g.rotation.y = Math.atan2(PUP_ROUTE[1].at[0] - PUP_ROUTE[0].at[0],
                            PUP_ROUTE[1].at[1] - PUP_ROUTE[0].at[1]);

  /* ---- the route, precomputed once -------------------------------- */
  /* the route is written flat for readability, so lift it to 3D here and
     keep every other flag on the stop for sample() to hand back */
  const ring = ringPath(PUP_ROUTE.map((w) => ({ ...w, at: [w.at[0], 0, w.at[1]] })), PUP_SPEED);

  /* One stride is trimmed to divide the ring a whole number of times, so
     the gait phase comes back to where it started after a lap and the
     feet never pop at the seam. */
  const STRIDE = ring.len / Math.max(1, Math.round(ring.len / 0.30));

  /* How far the leg swings is not a taste decision. A leg of this length
     pivoting at the hip carries its foot backwards at exactly walking
     pace only for one amplitude, and any other value is a foot sliding
     on the floor. Solve for it instead of picking it. */
  const LEG = (0.40 - 0.098) * PUP_SCALE;      // hip height above the foot, in metres
  const SWING = STRIDE / (LEG * Math.PI * 2);

  const sample = (t) => {
    const r = ring.sample(t);
    return { s: r.s, speed: r.speed, hold: r.hold,
             look: r.stop.look || 0, greet: r.stop.greet || 0 };
  };

  return {
    group: g, craft, rig, head, ears, tail, tail2, legs, shins, eyeMat, shadow: sh,
    curve: ring.curve, sample, period: ring.period, len: ring.len,
    stride: STRIDE, speed: PUP_SPEED, swing: SWING, leg: LEG,
  };
}

/* ------------------------------------------------------- the arm */
/* A small desk arm clamped to the far end of the bench, where there is
   real estate to spare and nothing behind it to hide. It moves one
   machined part back and forth between two spots and looks at it on the
   way, which is the whole job. Brian built one of these; the site has
   never had anywhere to show it. */

/* The far end of the bench, past the monitor and clear of the coolant
   jug and the webcam. Nothing else is using this stretch of MDF, and
   from the bench station it sits well to the left of the screen. */
const ARM_BASE = [3.42, 0.95, -2.09];    // bolted to the bench top
const ARM_A = [3.22, 0.952, -2.20];      // where the part rests
const ARM_B = [3.22, 0.952, -1.98];      // where it gets put down

export function buildArm(scene) {
  const g = new THREE.Group();
  g.name = 'arm';
  g.position.set(...ARM_BASE);
  scene.add(g);

  const shell = PUP_SHELL(), joint = PUP_JOINT(), trim = PUP_TRIM();
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, r), mat);

  const plate = rbox(0.13, 0.014, 0.13, 0.006, joint);
  plate.position.y = 0.007;
  g.add(plate);
  /* One inset riser instead of four separate bolt heads. At the size this
     reads on screen the bolts were four draw calls buying about two
     pixels each, which is the wrong trade for a prop in the background. */
  const riser = rbox(0.088, 0.010, 0.088, 0.004, shell);
  riser.position.y = 0.017;
  g.add(riser);

  /* yaw column, then shoulder, elbow, wrist: three hinges and a twist */
  const yaw = new THREE.Group();
  yaw.position.y = 0.014;
  g.add(yaw);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.055, 10), shell);
  column.position.y = 0.028;
  yaw.add(column);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.007, 5, 10), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.056;
  yaw.add(collar);

  const shoulder = new THREE.Group();
  shoulder.position.y = 0.062;
  yaw.add(shoulder);
  const shoulderHub = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), joint);
  shoulder.add(shoulderHub);
  const upper = rbox(0.036, 0.155, 0.040, 0.013, shell);
  upper.position.y = 0.082;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = 0.162;
  shoulder.add(elbow);
  const elbowHub = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 6), joint);
  elbow.add(elbowHub);
  const fore = rbox(0.030, 0.140, 0.034, 0.011, shell);
  fore.position.y = 0.074;
  elbow.add(fore);

  const wrist = new THREE.Group();
  wrist.position.y = 0.146;
  elbow.add(wrist);
  const wristHub = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), joint);
  wrist.add(wristHub);
  /* the twist that turns the part over so the camera can see the far face */
  const roll = new THREE.Group();
  wrist.add(roll);
  const palm = rbox(0.066, 0.022, 0.034, 0.008, joint);
  palm.position.y = 0.020;
  roll.add(palm);

  const fingers = [];
  const fingerGeo = new RoundedBoxGeometry(0.010, 0.038, 0.028, 1, 0.004);
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(fingerGeo, ALU());
    f.position.set(sx * 0.023, 0.048, 0);
    roll.add(f);
    fingers.push(f);
  }
  /* the tip the part hangs from while it is held */
  const grip = new THREE.Object3D();
  grip.position.y = 0.062;
  roll.add(grip);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: 0x8fffb0 }));
  led.position.set(0, 0.050, 0.034);
  yaw.add(led);

  /* The part itself. It lives in the arm's own frame so that handing it
     between the bench and the gripper is a coordinate change, not a
     reparent, and it can never be left orphaned mid loop. */
  /* Machined steel rather than the same aluminium as the fingers, or the
     part disappears into the hand holding it at any real viewing size. */
  const part = rbox(0.036, 0.020, 0.036, 0.005, new THREE.MeshStandardMaterial({
    color: 0x5a6068, roughness: 0.36, metalness: 0.84,
  }));
  g.add(part);
  const spotA = new THREE.Vector3(ARM_A[0] - ARM_BASE[0], ARM_A[1] - ARM_BASE[1] + 0.010, ARM_A[2] - ARM_BASE[2]);
  const spotB = new THREE.Vector3(ARM_B[0] - ARM_BASE[0], ARM_B[1] - ARM_BASE[1] + 0.010, ARM_B[2] - ARM_BASE[2]);
  part.position.copy(spotA);

  /* Angles are not eyeballed: the two link solution for this arm puts
     the wrist exactly over a given spot on the bench, and the gripper is
     then turned to hang straight down from it. AT sits on the part, OVER
     clears it by 60 mm, LIFT holds it up in the middle where both spots
     can see it. Bearings are the compass angles from the base to each
     spot, so the column turns to face the work rather than guessing. */
  const B_A = -2.0736, B_B = -1.0680, B_MID = -1.5708;
  const OVER = { sh: 0.6644, el: 1.4029, wr: 1.0743 };
  const DOWN = { sh: 0.8894, el: 1.4746, wr: 0.7776 };
  const UP = { sh: 0.0962, el: 1.6207, wr: 1.4247 };
  const IDLE = { sh: 0.0277, el: 1.6249, wr: 1.4889 };
  const at = (bearing, k, grip, rl = 0) => ({ yaw: bearing, sh: k.sh, el: k.el, wr: k.wr, rl, grip });

  const REST = at(B_MID, IDLE, 0.6);
  const OVER_A = at(B_A, OVER, 1), DOWN_A = at(B_A, DOWN, 1), SHUT_A = at(B_A, DOWN, 0);
  const UP_A = at(B_A, UP, 0), UP_A_OPEN = at(B_A, UP, 1);
  const OVER_B = at(B_B, OVER, 0), DOWN_B = at(B_B, DOWN, 0), OPEN_B = at(B_B, DOWN, 1);
  const UP_B = at(B_B, UP, 1), UP_B_HELD = at(B_B, UP, 0);
  const CARRY = at(B_MID, UP, 0);
  /* The look. The gripper stays pointing down so the part hangs below
     the fingers in clear air, and the wrist turns it through most of a
     revolution: a part held out flat towards the room would be hidden
     behind the hand holding it from half the angles in the garage. */
  const LOOK = at(B_MID, UP, 0, 2.6);

  /* held: 1 while the part is in the hand, so the frame loop knows
     whether to read its position off the gripper or off the bench.
     spot names which end it belongs to when it is not held. */
  const steps = [
    { dur: 2.4, a: REST, b: REST, held: 0, spot: 'a', rest: 1 },
    { dur: 1.5, a: REST, b: OVER_A, held: 0, spot: 'a' },
    { dur: 0.9, a: OVER_A, b: DOWN_A, held: 0, spot: 'a' },
    { dur: 0.6, a: DOWN_A, b: SHUT_A, held: 0, spot: 'a' },   // fingers close on it
    { dur: 1.1, a: SHUT_A, b: UP_A, held: 1 },
    { dur: 0.9, a: UP_A, b: CARRY, held: 1 },
    { dur: 1.6, a: CARRY, b: LOOK, held: 1 },                 // turn it over
    { dur: 1.2, a: LOOK, b: CARRY, held: 1 },
    { dur: 0.9, a: CARRY, b: UP_B_HELD, held: 1 },
    { dur: 0.9, a: UP_B_HELD, b: DOWN_B, held: 1 },
    { dur: 0.6, a: DOWN_B, b: OPEN_B, held: 1 },              // fingers let go
    { dur: 1.0, a: OPEN_B, b: UP_B, held: 0, spot: 'b' },
    { dur: 1.4, a: UP_B, b: REST, held: 0, spot: 'b' },
    { dur: 2.8, a: REST, b: REST, held: 0, spot: 'b', rest: 1 },
    { dur: 1.5, a: REST, b: OVER_B, held: 0, spot: 'b' },
    { dur: 0.9, a: OVER_B, b: OPEN_B, held: 0, spot: 'b' },
    { dur: 0.6, a: OPEN_B, b: DOWN_B, held: 0, spot: 'b' },   // and pick it back up
    { dur: 1.1, a: DOWN_B, b: UP_B_HELD, held: 1 },
    { dur: 0.9, a: UP_B_HELD, b: CARRY, held: 1 },
    { dur: 1.3, a: CARRY, b: UP_A, held: 1 },
    { dur: 0.9, a: UP_A, b: DOWN_A, held: 1 },
    { dur: 0.6, a: DOWN_A, b: SHUT_A, held: 1 },
    { dur: 0.0, a: SHUT_A, b: DOWN_A, held: 0, spot: 'a' },
    { dur: 1.0, a: DOWN_A, b: UP_A_OPEN, held: 0, spot: 'a' },
    { dur: 1.4, a: UP_A_OPEN, b: REST, held: 0, spot: 'a' },
  ];
  let acc = 0;
  for (const s of steps) { s.t0 = acc; acc += s.dur; s.t1 = acc; }

  const sh2 = blobShadow(0.34, 0.34, 0.34);
  sh2.position.set(0, 0.010, 0);
  g.add(sh2);

  /* Parked in the rest pose for the same reason the pup is. */
  yaw.rotation.y = REST.yaw;
  shoulder.rotation.x = REST.sh;
  elbow.rotation.x = REST.el;
  wrist.rotation.x = REST.wr;
  fingers[0].position.x = -(0.023 + REST.grip * 0.011);
  fingers[1].position.x = 0.023 + REST.grip * 0.011;

  return { group: g, yaw, shoulder, elbow, wrist, roll, fingers, grip, led, part,
           spotA, spotB, steps, period: acc };
}

/* -------------------------------------------------------- the drone */
/* A survey quadcopter, the third and smallest of the shop's machines.
   It owns the air the way the pup owns the floor and the arm owns the
   bench, which is what keeps three moving things from reading as a
   circus: they never share a band, and their laps are deliberately
   coprime so they do not fall into a repeating pattern together.

   It flies at about two metres, under the strip lights at 2.94 and well
   over the car at 1.46. The ring deliberately does not cross the apron
   in front of the windscreen, because that is the corridor the engine
   bay station looks down and a drone parked in it would sit on top of
   the thing you went there to read. */
const DRONE_ROUTE = [
  { at: [2.12, 1.95, 1.10], dwell: 0 },     // over the near lane, by the door end
  { at: [2.08, 2.10, -1.70], dwell: 1.8 },  // holds to look down the bench
  { at: [0.90, 2.16, -3.65], dwell: 0 },
  { at: [-1.25, 2.18, -3.80], dwell: 2.4 }, // holds over Iron Bark's corner
  { at: [-2.50, 1.95, -2.10], dwell: 0 },
  { at: [-2.42, 2.05, 0.40], dwell: 1.6 },  // holds over the research wall lane
  { at: [0.20, 2.22, 0.70], dwell: 0 },     // back across, high over the roof
];
const DRONE_SPEED = 0.78;    // metres per second: quicker than the pup, still unhurried

export function buildDrone(scene) {
  const g = new THREE.Group();
  g.name = 'drone';
  scene.add(g);

  /* The airframe hangs off `tilt` so the whole machine can bank and
     pitch into its turns without the shadow on the floor tipping with
     it. The shadow is not a child of the drone at all, for the same
     reason: it belongs to the floor, not to the aircraft. */
  const tilt = new THREE.Group();
  g.add(tilt);

  const shell = PUP_SHELL(), joint = PUP_JOINT(), trim = PUP_TRIM();
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, r), mat);

  const body = rbox(0.105, 0.042, 0.135, 0.016, shell);
  tilt.add(body);
  const spine = rbox(0.055, 0.010, 0.10, 0.004, trim);
  spine.position.y = 0.025;
  tilt.add(spine);

  /* The camera ball underneath, which is the only reason a shop drone
     exists: it is the same eye the bench webcam is.

     Ball and lens hang off a yoke of their own rather than off the
     airframe, so the eye can turn without the aircraft turning. A gimbal
     that cannot move is a decal, and the one moment this machine exists
     for is the moment it looks at something: a beam that swung while the
     hardware went on staring at the floor was the tell. The yoke sits
     exactly where the ball sat and starts level, so at rest every part
     of this is still where it always was. */
  const yoke = new THREE.Group();
  yoke.position.set(0, -0.026, 0.030);
  tilt.add(yoke);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 6), joint);
  yoke.add(ball);
  /* Dark glass that picks up the accent only while the sensor has hold
     of something. Both ends of that mix are named here rather than in the
     frame, so the one green in this room stays owned by the file that
     owns the palette. Half way to the accent and no further: this is a
     lens catching its own return, not a lamp. */
  const lensDark = new THREE.Color(0x0b0e13);
  const lensLit = new THREE.Color(P.SCAN_LIT).lerp(lensDark, 0.52);
  const lensMat = new THREE.MeshBasicMaterial({ color: lensDark });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.009, 8), lensMat);
  lens.position.set(0, -0.004, 0.019);
  lens.rotation.x = -0.7;
  yoke.add(lens);

  /* Four arms and four discs. A disc rather than modelled blades: at
     this size a spinning two blade rotor strobes into a flicker, and a
     translucent disc is what the eye reads as "turning too fast to
     see" anyway, for one mesh instead of three. */
  /* Two booms crossed through the hull rather than four stubs, and no
     separate rotor hubs: the hub sits under its own disc and is about a
     pixel from any angle anyone will see this from, so it was six draw
     calls buying nothing. */
  const boomGeo = new RoundedBoxGeometry(0.016, 0.008, 0.232, 1, 0.004);
  for (const ry of [Math.PI / 4, -Math.PI / 4]) {
    const boom = new THREE.Mesh(boomGeo, joint);
    boom.position.y = 0.004;
    boom.rotation.y = ry;
    tilt.add(boom);
  }
  const discGeo = new THREE.CircleGeometry(0.048, 14);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x9fb4d8, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide,
  });
  const rotors = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(sx * 0.082, 0.021, sz * 0.082);
    disc.rotation.x = -Math.PI / 2;
    tilt.add(disc);
    rotors.push(disc);
  }

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: 0x8fc0ff }));
  led.position.set(0, 0.014, -0.062);
  tilt.add(led);

  /* Its shadow lives on the concrete and only follows it in plan, which
     is the cheapest honest cue that the thing is genuinely off the
     ground rather than pasted at head height. */
  const sh = blobShadow(0.44, 0.44, 0.30);
  sh.position.y = 0.005;
  scene.add(sh);

  const ring = ringPath(DRONE_ROUTE, DRONE_SPEED);

  /* Parked on the first leg, level, for reduced motion and weak tiers. */
  const p0 = ring.curve.getPointAt(0);
  g.position.copy(p0);
  sh.position.set(p0.x, 0.005, p0.z);

  const scan = buildScan(scene);

  return { group: g, tilt, yoke, rotors, led, shadow: sh, discMat, scan,
           lensMat, lensDark, lensLit,
           curve: ring.curve, sample: ring.sample, len: ring.len,
           period: ring.period, speed: DRONE_SPEED, cruiseY: 2.03,
           route: DRONE_ROUTE };
}

/* ------------------------------------------------ the drone's scan */
/* The camera ball is the reason the drone is here, so this is the part
   that shows it working. Three layers, which is the structure the survey
   photographs have: emission from the sensor, a measured patch where the
   beam lands, and a recognition frame when it finds something it knows.
   Everything is additive with depth writing off and tone mapping off, so
   none of it occludes the room and none of it moves when the exposure
   does. It all hangs off one root at the origin, which means local
   coordinates are world coordinates and one flag can retire the lot. */
function buildScan(scene) {
  const root = new THREE.Group();
  root.name = 'drone-scan';
  scene.add(root);

  const additive = (map, opacity) => new THREE.MeshBasicMaterial({
    map, transparent: true, opacity, depthWrite: false, toneMapped: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });

  /* The beam. Open ended and a unit metre tall so the frame can scale it
     to whatever clearance the drone actually has: over the car that is
     three quarters of a metre, over concrete it is the full two.

     It hangs off its own rig for one reason. The rig carries where the
     sensor is and which way it is tipped; the cone carries only its spin
     about its own axis. Putting both on one object means an Euler order
     decides whether the tilt rotates with the spin, and it should not:
     the beam would wobble in a circle instead of leaning into the turn. */
  const coneRig = new THREE.Group();
  root.add(coneRig);
  const coneMat = additive(P.scanConeTexture(), 0.5);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.54, 1, 20, 1, true), coneMat);
  cone.geometry.translate(0, -0.5, 0);      // apex at the origin, opening downward
  cone.renderOrder = 2;
  coneRig.add(cone);

  /* The footprint, all of it flat on the floor and carried by one group
     so the frame only has to place the group. */
  const foot = new THREE.Group();
  root.add(foot);

  const gridMat = additive(P.scanGridTexture(), 0.5);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.012;
  grid.renderOrder = 2;
  foot.add(grid);

  /* One ring, expanding and dying on a sawtooth. A pulse per beat rather
     than a stack of them: the room is dim and three rings at once reads
     as decoration rather than as a rangefinder. */
  const ringMat = additive(null, 0.5);
  ringMat.color.set(P.SCAN_LIT);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), ringMat);
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.014;
  pulse.renderOrder = 3;
  foot.add(pulse);

  /* The point cloud. Scattered once, off the index rather than off a
     random number, so the pattern is the same on every run and stepping
     the clock backwards reproduces it exactly. The square root on the
     radius is what spreads the returns evenly over the disc: without it
     they pile up in the middle, which reads as a splat rather than as a
     survey. */
  const N = 420;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = i * 2.399963;                       // golden angle: no clumps, no rings
    const r = Math.sqrt((i + 0.5) / N) * 1.12;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0.016 + ((i * 37) % 11) * 0.0015;   // a hair of thickness, not a plane
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cloudMat = new THREE.PointsMaterial({
    color: new THREE.Color(P.SCAN_LIT), size: 0.022, sizeAttenuation: true,
    transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  cloud.renderOrder = 3;
  foot.add(cloud);

  /* The recognition frame. Held in its own group so releasing the lock is
     one flag rather than four. */
  const lock = new THREE.Group();
  lock.visible = false;
  root.add(lock);

  /* Corner brackets rather than a cage. The project's own detector draws
     a rectangle; the honest three dimensional version of that rectangle
     is the eight corners of the box with a short arm run out along each
     axis, which frames the thing without drawing a box around it. */
  const bracketMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(P.SCAN_LIT), transparent: true, opacity: 0.9,
    depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
  });
  const CORNERS = 8, ARMS = 3;
  const bpos = new Float32Array(CORNERS * ARMS * 2 * 3);
  const bracketGeo = new THREE.BufferGeometry();
  bracketGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  const brackets = new THREE.LineSegments(bracketGeo, bracketMat);
  brackets.renderOrder = 4;
  lock.add(brackets);

  /* Rewritten only when the target changes, which is twice a lap. The arm
     is a fixed fraction of the shortest side, so a box the size of a
     robot dog and a box the size of a car get brackets that read as the
     same instrument rather than the same shape scaled. */
  const fitBrackets = (min, max) => {
    const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z;
    const arm = Math.min(sx, sy, sz) * 0.22;
    let n = 0;
    const seg = (x, y, z, dx, dy, dz) => {
      bpos[n++] = x; bpos[n++] = y; bpos[n++] = z;
      bpos[n++] = x + dx; bpos[n++] = y + dy; bpos[n++] = z + dz;
    };
    for (const ix of [0, 1]) for (const iy of [0, 1]) for (const iz of [0, 1]) {
      const x = ix ? max.x : min.x, y = iy ? max.y : min.y, z = iz ? max.z : min.z;
      seg(x, y, z, ix ? -arm : arm, 0, 0);
      seg(x, y, z, 0, iy ? -arm : arm, 0);
      seg(x, y, z, 0, 0, iz ? -arm : arm);
    }
    brackets.geometry.attributes.position.needsUpdate = true;
    brackets.geometry.computeBoundingSphere();
  };

  /* The label, baked once per target rather than repainted per frame.
     Sprites keep it facing the visitor from every station, which is what
     a readout has to do. */
  const labelMat = new THREE.SpriteMaterial({
    transparent: true, depthWrite: false, toneMapped: false, opacity: 0.95,
  });
  const label = new THREE.Sprite(labelMat);
  label.scale.set(0.86, 0.215, 1);
  /* Straddling the corner rather than hanging off one side of it: half
     the readout sits over the target and half beside it, so whichever
     way round the visitor is standing the text has somewhere to go. */
  label.center.set(0.5, 0.5);
  label.renderOrder = 5;
  lock.add(label);

  /* Painted once per name and kept. Two targets means two canvases for
     the life of the page rather than one per recognition. */
  const labels = new Map();
  const labelFor = (text) => {
    if (!labels.has(text)) labels.set(text, P.detectLabel(text));
    return labels.get(text);
  };

  /* One plane walked once through the target volume. Broadside to the
     stations that look at the car, which is the only orientation a scan
     line is actually visible from. */
  const sweepMat = additive(P.scanSweepTexture(), 0.5);
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sweepMat);
  sweep.renderOrder = 4;
  lock.add(sweep);

  return { root, coneRig, cone, coneMat, foot, grid, gridMat, pulse, ringMat,
           cloud, cloudMat, lock, brackets, bracketMat, fitBrackets,
           label, labelMat, labelFor, sweep, sweepMat };
}
