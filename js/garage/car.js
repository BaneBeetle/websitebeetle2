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
const HOOD = { yBack: -1.20, yFront: -2.30, xHalf: 0.780, zAtBack: 0.86, slope: 0.228 };
export const HOOD_OPEN = -0.86;

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

  const dyno = dynoSheet();
  dyno.position.set(0.30, -1.72 - HOOD.yBack, 0.905 - HINGE_Z);
  dyno.rotation.set(Math.PI + 0.16, 0, 0.05);
  hinge.add(dyno);

  /* prop rod, because a hood that floats reads as a bug */
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.74, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b939d, metalness: 0.9, roughness: 0.35 })
  );
  rod.position.set(-0.52, -1.52, 0.62);
  rod.rotation.set(0.30, 0, 0.16);
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

  /* Local frame: +Z is up, -Y is the nose, +X is the passenger side.
     PlaneGeometry faces +Z, so rotation.x = PI/2 faces the nose and
     rotation.y = PI/2 faces +X. Every placement below follows that. */
  const FLOOR_Z = 0.30, TOP_Z = 0.80;
  const Y_BULK = -1.17, Y_NOSE = -2.24, X_SIDE = 0.71;

  const steel = new THREE.MeshStandardMaterial({ color: 0x4c545f, metalness: 0.85, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2029, metalness: 0.3, roughness: 0.78 });
  const carbon = new THREE.MeshStandardMaterial({ color: CARBON, metalness: 0.45, roughness: 0.28, envMapIntensity: 1.4 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.95, roughness: 0.28 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x121519, roughness: 0.95 });
  const liner = new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.95, metalness: 0.15, side: THREE.FrontSide });

  const plane = (w, h, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), liner);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    g.add(m); return m;
  };

  /* liner: closes the cavity so the cut edge never shows through */
  const bayLen = Y_BULK - Y_NOSE;
  plane(X_SIDE * 2, bayLen, [0, (Y_BULK + Y_NOSE) / 2, FLOOR_Z], [0, 0, 0]);                    // floor
  plane(X_SIDE * 2, TOP_Z - FLOOR_Z, [0, Y_BULK, (TOP_Z + FLOOR_Z) / 2], [Math.PI / 2, 0, 0]);  // bulkhead
  plane(X_SIDE * 2, TOP_Z - FLOOR_Z, [0, Y_NOSE, (TOP_Z + FLOOR_Z) / 2], [-Math.PI / 2, 0, 0]); // nose panel
  /* inner fenders as arch shells, so the cavity has a wheel-well curve
     instead of two flat walls catching the work light */
  for (const sx of [-1, 1]) {
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.30, bayLen, 14, 1, true, sx > 0 ? Math.PI * 0.5 : Math.PI, Math.PI * 0.5),
      liner.clone()
    );
    arch.material.side = THREE.BackSide;
    arch.rotation.x = Math.PI / 2;
    arch.position.set(sx * (X_SIDE + 0.02), (Y_BULK + Y_NOSE) / 2, FLOOR_Z + 0.30);
    g.add(arch);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(bayLen, 0.30), liner);
    skirt.position.set(sx * (X_SIDE + 0.02), (Y_BULK + Y_NOSE) / 2, FLOOR_Z + 0.15);
    skirt.rotation.set(0, -sx * Math.PI / 2, 0);
    g.add(skirt);
  }

  /* strut towers at the bulkhead corners */
  for (const sx of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, TOP_Z - FLOOR_Z - 0.06, 12), steel);
    tower.rotation.x = Math.PI / 2;
    tower.position.set(sx * 0.60, -1.44, FLOOR_Z + (TOP_Z - FLOOR_Z - 0.06) / 2);
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.045, 12), alu);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(sx * 0.60, -1.44, TOP_Z - 0.025);
    g.add(cap);
    for (let n = 0; n < 3; n++) {
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 6), steel);
      nut.rotation.x = Math.PI / 2;
      nut.position.set(sx * 0.60 + Math.cos(n * 2.09) * 0.115, -1.44 + Math.sin(n * 2.09) * 0.115, TOP_Z - 0.012);
      g.add(nut);
    }
  }
  /* strut brace: one clean line across the mess */
  const brace = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.055, 0.035), alu);
  brace.position.set(0, -1.44, TOP_Z - 0.005);
  g.add(brace);

  /* block plus ribbed cam cover, running fore and aft */
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.00, 0.30), dark);
  block.position.set(-0.06, -1.82, FLOOR_Z + 0.15);
  g.add(block);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.94, 0.13), new THREE.MeshStandardMaterial({
    color: 0x333a44, metalness: 0.7, roughness: 0.40,
  }));
  cam.position.set(-0.19, -1.82, FLOOR_Z + 0.36);
  g.add(cam);
  for (let i = 0; i < 13; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.022, 0.018), alu);
    rib.position.set(-0.19, -1.43 - i * 0.066, FLOOR_Z + 0.428);
    g.add(rib);
  }

  /* plenum plus six velocity stacks: the S54 signature */
  const plenum = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.78, 4, 14), new THREE.MeshStandardMaterial({
    color: 0x39414c, metalness: 0.82, roughness: 0.32,
  }));
  plenum.position.set(0.26, -1.82, FLOOR_Z + 0.20);
  g.add(plenum);
  for (let i = 0; i < 6; i++) {
    const y = -1.50 - i * 0.128;
    const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.050, 0.26, 12), alu);
    runner.rotation.x = Math.PI / 2;
    runner.position.set(0.26, y, FLOOR_Z + 0.32);
    g.add(runner);
    const trumpet = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.013, 6, 16), alu);
    trumpet.position.set(0.26, y, FLOOR_Z + 0.448);
    g.add(trumpet);
  }
  hotspots.push({ id: 'spec-engine', at: new THREE.Vector3(0.26, -1.82, FLOOR_Z + 0.46), r: 0.30 });

  /* Karbonius CSL airbox, feeding the plenum from the nose side */
  const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.40, 0.30), carbon);
  airbox.position.set(0.32, -2.10, FLOOR_Z + 0.19);
  g.add(airbox);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.42, 0.028), new THREE.MeshStandardMaterial({
    color: 0x262b33, metalness: 0.55, roughness: 0.20, envMapIntensity: 1.8,
  }));
  lid.position.set(0.32, -2.10, FLOOR_Z + 0.35);
  g.add(lid);
  const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.30, 12), dark);
  snorkel.rotation.z = Math.PI / 2;
  snorkel.position.set(0.32, -1.92, FLOOR_Z + 0.22);
  snorkel.rotation.x = Math.PI / 2;
  snorkel.rotation.z = 0;
  g.add(snorkel);
  hotspots.push({ id: 'spec-intake', at: new THREE.Vector3(0.32, -2.10, FLOOR_Z + 0.38), r: 0.30 });

  /* ECU box bolted to the left tower: where the tune lives */
  const ecu = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.10), new THREE.MeshStandardMaterial({
    color: 0x232830, metalness: 0.55, roughness: 0.4,
  }));
  ecu.position.set(-0.54, -1.70, FLOOR_Z + 0.14);
  g.add(ecu);
  const ecuFace = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.29), new THREE.MeshBasicMaterial({
    map: ecuLabel(), transparent: true,
  }));
  ecuFace.position.set(-0.54, -1.70, FLOOR_Z + 0.192);
  g.add(ecuFace);
  hotspots.push({ id: 'spec-tune', at: new THREE.Vector3(-0.54, -1.70, FLOOR_Z + 0.20), r: 0.26 });

  /* braided lines and hoses */
  const tube = (pts, r, mat) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 26, r, 6, false), mat));
  };
  const braid = new THREE.MeshStandardMaterial({ color: 0x848d9b, metalness: 0.9, roughness: 0.44 });
  tube([[-0.60, -1.52, FLOOR_Z + 0.30], [-0.36, -1.62, FLOOR_Z + 0.26], [-0.02, -1.94, FLOOR_Z + 0.22], [0.22, -2.16, FLOOR_Z + 0.16]], 0.016, braid);
  tube([[0.60, -1.48, FLOOR_Z + 0.26], [0.52, -1.78, FLOOR_Z + 0.14], [0.24, -2.02, FLOOR_Z + 0.10], [-0.26, -2.20, FLOOR_Z + 0.10]], 0.021, rubber);
  tube([[-0.68, -2.04, FLOOR_Z + 0.08], [-0.20, -2.10, FLOOR_Z + 0.06], [0.30, -2.18, FLOOR_Z + 0.06]], 0.025, rubber);
  tube([[-0.62, -1.44, FLOOR_Z + 0.34], [-0.30, -1.40, FLOOR_Z + 0.30], [0.10, -1.42, FLOOR_Z + 0.28]], 0.013, braid);

  /* radiator core at the nose */
  const rad = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.05, 0.30), new THREE.MeshStandardMaterial({
    color: 0x2c333c, metalness: 0.7, roughness: 0.6,
  }));
  rad.position.set(0, -2.26, FLOOR_Z + 0.16);
  g.add(rad);
  for (let i = 0; i < 15; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.07, 0.29), dark);
    fin.position.set(-0.60 + i * 0.086, -2.26, FLOOR_Z + 0.16);
    g.add(fin);
  }

  /* a work light clipped to the brace: a garage truth that also solves
     the problem of lighting a cavity with no shadow maps */
  const bulb = new THREE.PointLight(0xdce7ff, 1.25, 1.15, 2.6);
  bulb.position.set(0.02, -1.80, TOP_Z - 0.02);
  g.add(bulb);
  const bulbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.10, 10), steel);
  bulbBody.rotation.x = Math.PI / 2;
  bulbBody.position.set(-0.34, -1.44, TOP_Z + 0.02);
  g.add(bulbBody);
  const bulbLens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshBasicMaterial({ color: 0xf0f5ff }));
  bulbLens.rotation.x = Math.PI;
  bulbLens.position.set(-0.34, -1.44, TOP_Z - 0.031);
  g.add(bulbLens);

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
    new THREE.PlaneGeometry(0.40, 0.30),
    new THREE.MeshStandardMaterial({ map: P.toTexture(c), roughness: 0.94, side: THREE.DoubleSide })
  );
  return m;
}
