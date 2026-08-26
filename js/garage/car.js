/* Carbeetle.
   The glTF ships as one welded shell with no separate panels and no
   animations, so the hood is carved out of the body at load time (see
   geo-split.js) and everything under it is fabricated here: strut towers,
   an S54-shaped plenum with six velocity stacks, the airbox, braided
   lines. Abstract forms, no fake badges, lit to read as machinery. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { splitByPlanes } from './geo-split.js';
import * as P from './paint.js';
import { blobShadow } from './scene.js';

/* Local model space is Z-up with the nose at -Y; the glTF root carries
   the Z-up to Y-up matrix, so these planes are expressed in that local
   frame and the hood group inherits the same transform. */
/* The cut planes hug the hood skin closely. An earlier version sat 0.13
   below it, which scooped the fender tops and the headlight surrounds
   into the hood: they flew away when it opened and left holes you could
   see the bay through. Keep the floor plane within ~0.05 of the skin. */
const HOOD = { yBack: -1.20, yFront: -2.215, xHalf: 0.735, zAtBack: 0.930, slope: 0.220 };
export const HOOD_OPEN = -0.80;

const PAINT = 0x27427f;          // Interlagos Blue
const CARBON = 0x1b1e24;

export async function loadCar(scene, onProgress) {
  const gltf = await new Promise((res, rej) => {
    new GLTFLoader().load('models/bmw_m3_e46/scene.gltf', res,
      (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); }, rej);
  });

  const car = gltf.scene;
  car.name = 'carbeetle';

  const byMat = new Map();
  car.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const n = o.material && o.material.name;
    if (n) (byMat.get(n) || byMat.set(n, []).get(n)).push(o);
  });

  const pick = (name) => {
    let hit = null;
    car.traverse((o) => { if (o.isMesh && o.material && o.material.name === name && !hit) hit = o; });
    return hit;
  };
  const all = (name) => {
    const out = [];
    car.traverse((o) => { if (o.isMesh && o.material && o.material.name === name) out.push(o); });
    return out;
  };

  /* ---- paint ------------------------------------------------------ */
  const body = pick('Material');
  const bodyMat = body.material;
  bodyMat.color.setHex(PAINT);
  bodyMat.metalness = 0.82;
  bodyMat.roughness = 0.28;
  bodyMat.clearcoat = 1.0;
  bodyMat.clearcoatRoughness = 0.045;
  bodyMat.envMapIntensity = 1.55;

  for (const m of ['Material.001', 'Material.008', 'Material.002', 'Material.006', 'Material.007']) {
    const mesh = pick(m);
    if (mesh) { mesh.material.envMapIntensity = 1.1; mesh.material.roughness = Math.min(1, (mesh.material.roughness ?? .5) + 0.12); }
  }
  const glass = pick('Material.005');
  if (glass) {
    glass.material.color.setHex(0x0a0d13);
    glass.material.metalness = 0.0;
    glass.material.roughness = 0.08;
    glass.material.envMapIntensity = 2.2;
  }
  for (const w of all('wheel_metal.002')) {
    w.material.metalness = 0.92; w.material.roughness = 0.34; w.material.envMapIntensity = 1.4;
  }

  /* CARBEETLE plate. The car has a name, so it gets its name. */
  const plate = pick('Material.029');
  if (plate) {
    const t = plateTexture();
    plate.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1 });
  }

  /* ---- carve the hood --------------------------------------------- */
  const floorN = new THREE.Vector3(0, -HOOD.slope, 1).normalize();
  const planes = [
    { n: new THREE.Vector3(0, -1, 0), d: HOOD.yBack },
    { n: new THREE.Vector3(0, 1, 0), d: -HOOD.yFront },
    { n: new THREE.Vector3(-1, 0, 0), d: HOOD.xHalf },
    { n: new THREE.Vector3(1, 0, 0), d: HOOD.xHalf },
    { n: floorN, d: -(floorN.y * HOOD.yBack + floorN.z * HOOD.zAtBack) },
  ];
  const split = splitByPlanes(body.geometry, planes);
  body.geometry.dispose();
  body.geometry = split.outside;

  const HINGE_Z = 1.00;
  const hinge = new THREE.Object3D();
  hinge.name = 'hood-hinge';
  hinge.position.set(0, HOOD.yBack, HINGE_Z);
  body.parent.add(hinge);

  split.inside.translate(0, -HOOD.yBack, -HINGE_Z);
  const hood = new THREE.Mesh(split.inside, bodyMat);
  hood.name = 'hood';
  hood.frustumCulled = false;
  hinge.add(hood);

  /* The body shell is not the only mesh with hood-side geometry: the
     cowl vent belongs to Material.008, which also carries the bumpers
     and the sills. Split it on the same planes so the vent travels with
     the panel it is set into instead of staying behind on the car. */
  for (const name of ['Material.008']) {
    const extra = pick(name);
    if (!extra) continue;
    const cut = splitByPlanes(extra.geometry, planes);
    if (!cut.inside.attributes.position.count) { cut.inside.dispose(); cut.outside.dispose(); continue; }
    extra.geometry.dispose();
    extra.geometry = cut.outside;
    cut.inside.translate(0, -HOOD.yBack, -HINGE_Z);
    const piece = new THREE.Mesh(cut.inside, extra.material);
    piece.name = 'hood-' + name;
    piece.frustumCulled = false;
    hinge.add(piece);
  }

  /* Underside skin: the shell is one-sided, so an open hood would show
     nothing from behind. A flipped copy set slightly inboard gives it a
     matte painted underside, which is also where the dyno sheet lives. */
  const underGeo = split.inside.clone();
  flipGeometry(underGeo);
  const under = new THREE.Mesh(underGeo, new THREE.MeshStandardMaterial({
    color: 0x1e232b, roughness: 0.86, metalness: 0.10,
  }));
  under.position.z = -0.012;
  under.frustumCulled = false;
  hinge.add(under);

  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 0.86),
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.96, metalness: 0.02 })
  );
  pad.position.set(0, -1.80 - HOOD.yBack, 0.845 - HINGE_Z);
  pad.rotation.x = Math.PI + 0.20;
  hinge.add(pad);

  const dyno = dynoSheet();
  dyno.position.set(0.25, -1.70 - HOOD.yBack, 0.892 - HINGE_Z);
  dyno.rotation.set(Math.PI + 0.11, 0, 0.045);
  hinge.add(dyno);

  /* Two gas struts, the way the real car holds its hood up. A hood that
     floats on nothing reads as a bug. */
  const rod = new THREE.Group();
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x6b7480, metalness: 0.88, roughness: 0.36 });
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.80, 8), strutMat);
    strut.position.set(sx * 0.60, -1.52, 0.68);
    strut.rotation.set(0.62, 0, sx * 0.10);
    rod.add(strut);
  }
  rod.visible = false;
  body.parent.add(rod);

  /* ---- engine bay -------------------------------------------------- */
  const bay = buildBay();
  body.parent.add(bay.group);

  /* ---- stance ----------------------------------------------------- */
  const wrapper = new THREE.Group();
  wrapper.name = 'car';
  wrapper.add(car);
  scene.add(wrapper);

  const box = new THREE.Box3().setFromObject(car);
  wrapper.position.y = -box.min.y + 0.002;   // wheels on the floor, not through it
  wrapper.position.x = -0.28;
  wrapper.position.z = -0.40;
  wrapper.rotation.y = 0.055;                // parked by a human, not a robot

  const shadow = blobShadow(3.0, 5.4, 0.66);
  shadow.position.set(wrapper.position.x, 0.006, wrapper.position.z);
  scene.add(shadow);

  return {
    root: wrapper, car, body, bodyMat, hinge, hood, rod, bay, shadow,
    lights: {
      head: [pick('headlight_led'), pick('headlight_glass')].filter(Boolean),
      tail: [pick('taillight'), pick('taillight_glass')].filter(Boolean),
    },
    setHood(t) {                              // t: 0 shut, 1 fully open
      hinge.rotation.x = HOOD_OPEN * t;
      rod.visible = t > 0.55;
      bay.group.visible = t > 0.02;
    },
  };
}

function flipGeometry(geo) {
  const idx = geo.index;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1), b = idx.getX(i + 2);
    idx.setX(i + 1, b); idx.setX(i + 2, a);
  }
  idx.needsUpdate = true;
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  n.needsUpdate = true;
}

/* ------------------------------------------------------------------ bay */
/* Everything below is fabricated. It is shaped after an S54 bay (six
   individual throttle bodies under a plenum, strut towers at the
   corners, a big airbox on the intake side) without copying any part. */
function buildBay() {
  const g = new THREE.Group();
  g.name = 'engine-bay';
  const hotspots = [];

  /* Local frame: +Z is up, -Y is the nose, +X is the driver's side of a
     left-hand-drive car, which is the side the airbox lives on. Layout
     follows the real bay: black canister and tanks on the passenger
     side, ribbed cam cover down the middle, throttle bodies and the
     carbon plenum beside it, the Karbonius box and its snorkel on the
     driver's side. Almost all of it is black; the metal is an accent. */
  const FLOOR_Z = 0.28, TOP_Z = 0.76;
  const Y_BULK = -1.21, Y_NOSE = -2.13, X_SIDE = 0.655;

  const carbonMap = P.carbonTexture(30, 22);
  const carbon = new THREE.MeshStandardMaterial({
    map: carbonMap, roughness: 0.22, metalness: 0.35, envMapIntensity: 1.7,
  });
  const carbonDull = new THREE.MeshStandardMaterial({
    map: carbonMap, roughness: 0.42, metalness: 0.25, envMapIntensity: 1.1,
  });
  const engineBlack = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.58, metalness: 0.35 });
  const plasticBlack = new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.74, metalness: 0.12 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.94, metalness: 0.02 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.48, metalness: 0.8 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x8d96a2, roughness: 0.38, metalness: 0.9 });
  const liner = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.95, metalness: 0.1, side: THREE.FrontSide });
  const translucent = new THREE.MeshStandardMaterial({
    color: 0xb9bfc6, roughness: 0.35, metalness: 0.02, transparent: true, opacity: 0.55,
  });

  const box = (w, d, hgt, pos, mat, rot) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, hgt), mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    g.add(m); return m;
  };
  const drum = (r, hgt, pos, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 18), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(pos[0], pos[1], pos[2]);
    g.add(m); return m;
  };
  const plane = (w, hgt, pos, rot, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), mat || liner);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    g.add(m); return m;
  };

  /* ---- liner: closes the cavity, inward-facing only ---------------- */
  const bayLen = Y_BULK - Y_NOSE;
  const midY = (Y_BULK + Y_NOSE) / 2, midZ = (TOP_Z + FLOOR_Z) / 2;
  plane(X_SIDE * 2, bayLen, [0, midY, FLOOR_Z], [0, 0, 0]);
  plane(X_SIDE * 2, TOP_Z - FLOOR_Z, [0, Y_BULK, midZ], [Math.PI / 2, 0, 0]);
  plane(X_SIDE * 2, TOP_Z - FLOOR_Z, [0, Y_NOSE, midZ], [-Math.PI / 2, 0, 0]);
  for (const sx of [-1, 1]) {
    plane(TOP_Z - FLOOR_Z, bayLen, [sx * X_SIDE, midY, midZ], [0, -sx * Math.PI / 2, 0]);
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(0.07, bayLen), liner);
    lip.position.set(sx * (X_SIDE - 0.035), midY, TOP_Z);
    g.add(lip);
  }

  /* ---- strut towers and the brace across them --------------------- */
  for (const sx of [-1, 1]) {
    const tower = drum(0.145, TOP_Z - FLOOR_Z - 0.16, [sx * 0.50, -1.37, FLOOR_Z + (TOP_Z - FLOOR_Z - 0.16) / 2], plasticBlack);
    tower.name = 'tower';
    const cap = drum(0.088, 0.05, [sx * 0.50, -1.37, TOP_Z - 0.19], steel);
    cap.name = 'cap';
    for (let n = 0; n < 3; n++) {
      const a = n * 2.094 + 0.4;
      drum(0.017, 0.030, [sx * 0.50 + Math.cos(a) * 0.105, -1.37 + Math.sin(a) * 0.105, TOP_Z - 0.185], steel);
    }
  }
  // a slim flat bar, not a scaffold pole
  box(1.06, 0.042, 0.020, [0, -1.37, TOP_Z - 0.145], plasticBlack);
  for (const sx of [-1, 1]) box(0.075, 0.075, 0.024, [sx * 0.50, -1.37, TOP_Z - 0.147], plasticBlack);

  /* ---- cam cover down the middle ---------------------------------- */
  const block = box(0.56, 0.84, 0.24, [-0.02, -1.72, FLOOR_Z + 0.12], plasticBlack);
  block.name = 'block';
  const cam = box(0.28, 0.80, 0.115, [-0.14, -1.72, FLOOR_Z + 0.295], engineBlack);
  cam.name = 'cam-cover';
  for (let i = 0; i < 15; i++) {
    box(0.245, 0.024, 0.016, [-0.14, -1.36 - i * 0.052, FLOOR_Z + 0.354], engineBlack);
  }
  // the M colours, as a painted accent rather than a badge
  [0x3f7fbe, 0x1b3268, 0x9c2b33].forEach((hex, i) => {
    box(0.022, 0.052, 0.003, [-0.196 + i * 0.024, -2.075, FLOOR_Z + 0.3555],
      new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.05 }));
  });
  // coil packs sitting in a row along the cover
  for (let i = 0; i < 6; i++) {
    box(0.055, 0.055, 0.045, [0.015, -1.42 - i * 0.126, FLOOR_Z + 0.33], plasticBlack);
  }

  /* ---- throttle bodies and the carbon plenum ----------------------- */
  const casting = new THREE.MeshStandardMaterial({ color: 0x4a5158, roughness: 0.55, metalness: 0.7 });
  for (let i = 0; i < 6; i++) {
    const y = -1.44 - i * 0.126;
    drum(0.036, 0.085, [0.16, y, FLOOR_Z + 0.235], casting);
    drum(0.020, 0.045, [0.16, y, FLOOR_Z + 0.295], plasticBlack);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.72, 8), casting);
  rail.position.set(0.205, -1.72, FLOOR_Z + 0.285);
  g.add(rail);

  const plenum = new THREE.Mesh(new THREE.CapsuleGeometry(0.108, 0.70, 5, 18), carbon);
  plenum.position.set(0.285, -1.72, FLOOR_Z + 0.275);
  plenum.name = 'plenum';
  g.add(plenum);
  hotspots.push({ id: 'spec-engine', at: new THREE.Vector3(0.10, -1.72, FLOOR_Z + 0.38), r: 0.30 });

  /* ---- Karbonius airbox and its snorkel ---------------------------- */
  const airbox = box(0.30, 0.42, 0.34, [0.515, -1.44, FLOOR_Z + 0.18], carbon);
  airbox.name = 'airbox';
  box(0.318, 0.438, 0.022, [0.515, -1.44, FLOOR_Z + 0.362], carbonDull);
  // the snorkel: out of the box, forward and inboard, mouth facing the nose
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.515, -1.65, FLOOR_Z + 0.20),
    new THREE.Vector3(0.512, -1.80, FLOOR_Z + 0.185),
    new THREE.Vector3(0.495, -1.94, FLOOR_Z + 0.155),
    new THREE.Vector3(0.470, -2.05, FLOOR_Z + 0.125),
  ]);
  const snorkel = new THREE.Mesh(new THREE.TubeGeometry(path, 30, 0.088, 18, false), carbon);
  snorkel.name = 'snorkel';
  g.add(snorkel);
  // flared mouth
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.090, 0.060, 20, 1, true), carbonDull);
  mouth.rotation.x = Math.PI / 2 - 0.24;
  mouth.position.set(0.464, -2.083, FLOOR_Z + 0.113);
  g.add(mouth);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(0.088, 20), rubber);
  throat.rotation.x = -0.24;
  throat.position.set(0.464, -2.095, FLOOR_Z + 0.116);
  g.add(throat);
  // clamp band where the snorkel meets the box, and the marker on it
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.094, 0.050, 20), plasticBlack);
  band.rotation.x = Math.PI / 2 - 0.09;
  band.position.set(0.513, -1.735, FLOOR_Z + 0.193);
  g.add(band);
  hotspots.push({ id: 'spec-intake', at: new THREE.Vector3(0.51, -1.60, FLOOR_Z + 0.36), r: 0.30 });

  /* ---- passenger side: filter drum, tanks, ECU box ---------------- */
  const canister = drum(0.155, 0.24, [-0.46, -1.50, FLOOR_Z + 0.15], plasticBlack);
  canister.name = 'canister';
  drum(0.115, 0.05, [-0.46, -1.50, FLOOR_Z + 0.29], plasticBlack);
  drum(0.098, 0.19, [-0.47, -1.84, FLOOR_Z + 0.12], plasticBlack);
  // coolant expansion tank, forward on the passenger side
  box(0.17, 0.19, 0.17, [-0.46, -2.00, FLOOR_Z + 0.10], translucent);
  drum(0.036, 0.035, [-0.46, -2.00, FLOOR_Z + 0.20], new THREE.MeshStandardMaterial({
    color: 0x2c3038, roughness: 0.6,
  }));
  // brake reservoir at the bulkhead
  box(0.13, 0.10, 0.13, [-0.24, -1.29, FLOOR_Z + 0.12], translucent);

  const ecu = box(0.20, 0.26, 0.085, [-0.50, -1.26, FLOOR_Z + 0.06], plasticBlack);
  ecu.name = 'ecu';
  const ecuFace = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.225), new THREE.MeshBasicMaterial({
    map: ecuLabel(), transparent: true,
  }));
  ecuFace.position.set(-0.50, -1.26, FLOOR_Z + 0.104);
  g.add(ecuFace);
  hotspots.push({ id: 'spec-tune', at: new THREE.Vector3(-0.50, -1.26, FLOOR_Z + 0.14), r: 0.24 });

  /* ---- cowl, slam panel, hoses ------------------------------------ */
  box(1.24, 0.05, 0.030, [0, -1.245, TOP_Z - 0.075], alu);      // cowl brace
  box(1.28, 0.055, 0.055, [0, -1.215, TOP_Z - 0.135], rubber);  // bulkhead seal
  box(1.20, 0.10, 0.05, [0, -2.10, FLOOR_Z + 0.32], plasticBlack); // slam panel

  const rad = box(1.22, 0.05, 0.26, [0, -2.115, FLOOR_Z + 0.13], plasticBlack);
  rad.name = 'radiator';
  for (let i = 0; i < 13; i++) {
    box(0.05, 0.06, 0.25, [-0.55 + i * 0.092, -2.115, FLOOR_Z + 0.13], rubber);
  }

  const tube = (pts, r, mat) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 22, r, 8, false), mat));
  };
  tube([[-0.34, -1.30, FLOOR_Z + 0.20], [-0.30, -1.55, FLOOR_Z + 0.24], [-0.20, -1.80, FLOOR_Z + 0.22]], 0.017, rubber);
  tube([[0.30, -1.32, FLOOR_Z + 0.24], [0.20, -1.30, FLOOR_Z + 0.22], [-0.05, -1.28, FLOOR_Z + 0.22]], 0.014, rubber);
  tube([[-0.52, -1.96, FLOOR_Z + 0.06], [-0.20, -2.02, FLOOR_Z + 0.05], [0.24, -2.06, FLOOR_Z + 0.05]], 0.022, rubber);
  tube([[0.44, -1.34, FLOOR_Z + 0.26], [0.30, -1.30, FLOOR_Z + 0.26], [0.10, -1.30, FLOOR_Z + 0.24]], 0.012,
    new THREE.MeshStandardMaterial({ color: 0x6f7885, roughness: 0.45, metalness: 0.85 }));

  /* ---- the work light clipped to the brace ------------------------ */
  const bulb = new THREE.PointLight(0xdbe6ff, 1.30, 1.45, 2.4);
  bulb.position.set(0.02, -1.74, TOP_Z - 0.06);
  g.add(bulb);
  const fill = new THREE.PointLight(0x93a8c8, 0.55, 1.9, 2.0);
  fill.position.set(0.05, -1.98, TOP_Z + 0.12);
  g.add(fill);
  const lampBody = drum(0.036, 0.09, [-0.30, -1.36, TOP_Z - 0.10], steel);
  lampBody.name = 'lamp';
  const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.034, 14), new THREE.MeshBasicMaterial({ color: 0xeef4ff }));
  lampLens.rotation.x = Math.PI;
  lampLens.position.set(-0.30, -1.36, TOP_Z - 0.147);
  g.add(lampLens);

  g.visible = false;
  return { group: g, hotspots, bulb };
}

/* ------------------------------------------------------------ decals */

function plateTexture() {
  const { c, x, w, h } = P.canvas(1024, 256);
  x.fillStyle = '#e8e9e4'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#1a1c20'; x.lineWidth = 10;
  x.strokeRect(14, 14, w - 28, h - 28);
  P.line(x, 'CARBEETLE', {
    font: P.fonts.display, size: 132, color: '#16181d',
    x: w / 2, y: h / 2 + 46, align: 'center', track: 6,
  });
  // grime, so it does not look freshly printed
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 12, 1 + Math.random() * 4);
  }
  return P.toTexture(c);
}

function ecuLabel() {
  const { c, x, w, h } = P.canvas(256, 320);
  x.clearRect(0, 0, w, h);
  x.fillStyle = 'rgba(18,21,26,0.95)'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#39414d'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
  P.line(x, 'ALPHA-N', { font: P.fonts.mono, size: 30, weight: 700, color: P.BLUE_LIT, x: w / 2, y: 118, align: 'center', track: 3 });
  P.line(x, 'EVOLVE', { font: P.fonts.mono, size: 19, color: P.INK3, x: w / 2, y: 156, align: 'center', track: 5 });
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i < 3 ? '#3b6fd4' : '#242a33';
    x.fillRect(48 + i * 34, 210, 20, 8);
  }
  return P.toTexture(c);
}

/* The dyno sheet taped to the underside of the hood: the one number the
   whole engine bay is arguing for. */
function dynoSheet() {
  const { c, x, w, h } = P.canvas(512, 384);
  x.fillStyle = '#e6e3da'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, 0, w, 54);
  P.line(x, 'HTE DYNO', { font: P.fonts.mono, size: 21, weight: 700, color: '#2c3038', x: 26, y: 36, track: 3 });
  P.line(x, 'PEAK', { font: P.fonts.mono, size: 15, color: '#6a6f78', x: 26, y: 106, track: 4 });
  P.line(x, '317.27', { font: P.fonts.display, size: 96, color: '#1a1d22', x: 24, y: 194 });
  P.line(x, 'HP', { font: P.fonts.display, size: 34, color: '#3b6fd4', x: 320, y: 194 });

  // a plausible power curve, drawn as a shape, labelled as a chart not a spec
  x.strokeStyle = '#3b6fd4'; x.lineWidth = 5; x.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const px = 26 + t * (w - 60);
    const py = 350 - Math.pow(Math.sin(t * 2.05), 1.35) * 120 - t * 8;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2;
  for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(26 + i * 92, 232); x.lineTo(26 + i * 92, 356); x.stroke(); }
  // tape corners
  x.fillStyle = 'rgba(216,208,186,0.75)';
  x.fillRect(-16, -10, 90, 34); x.fillRect(w - 74, -10, 90, 34);

  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.50, 0.375),
    new THREE.MeshStandardMaterial({ map: P.toTexture(c), roughness: 0.94, side: THREE.DoubleSide })
  );
  return m;
}
