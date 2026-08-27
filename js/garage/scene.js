/* The room. A one-car garage: floor, four walls, ceiling, roller door,
   two strip lights. Lighting is deliberately cheap (a hemisphere plus two
   directionals, no shadow maps by default) because the shading that sells
   the room is painted into the floor and wall textures, and the shading
   that sells the car is the gradient environment map it reflects. */

import * as THREE from 'three';
import * as P from './paint.js';

export const ROOM = { w: 7.2, d: 9.4, h: 3.05 };
export const X0 = -ROOM.w / 2, X1 = ROOM.w / 2;
export const Z_DOOR = 4.1, Z_BACK = -5.3;
export const DOOR_H = 2.35;

/* Floor stencils are the navigation. UVs run 0..1 across the floor plane:
   u maps to x (left to right), v maps to z (back to front). */
const STENCILS = [
  { text: 'engine bay',  u: 0.50, v: 0.215, size: 44, rot: 0 },
  { text: 'projects',    u: 0.855, v: 0.560, size: 46, rot: -90 },
  { text: 'research',    u: 0.145, v: 0.530, size: 46, rot: 90 },
  { text: 'still building', u: 0.62, v: 0.925, size: 36, rot: 180 },
];

export function buildRoom(scene, opts = {}) {
  const { floorMaps = null, aniso = 8, lowDetail = false } = opts;
  const room = new THREE.Group();
  room.name = 'room';
  scene.add(room);

  const floorTex = P.floorTexture(STENCILS, floorMaps && floorMaps.color, lowDetail);
  floorTex.anisotropy = aniso;
  const wallTex = P.wallTexture();
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;

  /* ---- floor ------------------------------------------------------ */
  /* The painted canvas carries what the floor SAYS - stencils, pools,
     parking box - and the two tiling maps carry how it BEHAVES. Splitting
     it that way is what lets the slab have a real grazing response without
     the wayfinding being tiled four times along with the grain.
     normalScale is held low on purpose: at 1 this concrete is a quarry,
     and the room only needs the floor to stop being paper. */
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, roughness: 0.44, metalness: 0.06, color: 0xffffff,
  });
  if (floorMaps) {
    floorMat.normalMap = floorMaps.normal;
    floorMat.normalScale.set(0.45, 0.45);
    floorMat.roughnessMap = floorMaps.rough;
    /* roughnessMap multiplies this, and the map averages near 0.55, so the
       flat 0.44 would land the slab around 0.24 and turn it into polished
       showroom epoxy. Lifted so the product stays near where the tuned
       matte value was, with the map now supplying the variation. */
    floorMat.roughness = 0.86;
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (Z_DOOR + Z_BACK) / 2);
  floor.name = 'floor';
  room.add(floor);

  /* ---- walls ------------------------------------------------------ */
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.94, metalness: 0 });
  const mkWall = (w, h, pos, rotY) => {
    const t = wallTex.clone();
    t.repeat.set(w / 2.6, h / 2.6);
    t.needsUpdate = true;
    const m = wallMat.clone(); m.map = t;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.copy(pos); mesh.rotation.y = rotY;
    room.add(mesh); return mesh;
  };
  const midZ = (Z_DOOR + Z_BACK) / 2;
  mkWall(ROOM.d, ROOM.h, new THREE.Vector3(X0, ROOM.h / 2, midZ), Math.PI / 2);   // left
  mkWall(ROOM.d, ROOM.h, new THREE.Vector3(X1, ROOM.h / 2, midZ), -Math.PI / 2);  // right
  mkWall(ROOM.w, ROOM.h, new THREE.Vector3(0, ROOM.h / 2, Z_BACK), 0);            // back

  /* ceiling: unlit dark plate, it only ever appears as a reflection */
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshBasicMaterial({ color: 0x0a0d12 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM.h, midZ);
  room.add(ceil);

  /* ---- roller door ------------------------------------------------ */
  /* The door is the loader. Progress raises it, and the same object
     closes again at the exit station. */
  const doorH = DOOR_H, doorW = 4.9;
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, Z_DOOR - 0.06);
  room.add(doorGroup);

  const doorTex = P.doorTexture();
  doorTex.wrapS = doorTex.wrapT = THREE.RepeatWrapping;
  doorTex.repeat.set(2.2, 1);
  const doorPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide })
  );
  doorPanel.position.set(0, doorH / 2, 0);
  doorGroup.add(doorPanel);

  /* header wall above the door plus jambs, so the opening reads as an
     opening rather than a floating rectangle */
  const jambMat = new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.9 });
  const header = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h - doorH, 0.80), jambMat);
  header.position.set(0, doorH + (ROOM.h - doorH) / 2, Z_DOOR);
  room.add(header);
  for (const sx of [-1, 1]) {
    const jw = (ROOM.w - doorW) / 2;
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(jw, doorH, 0.80), jambMat);
    jamb.position.set(sx * (doorW / 2 + jw / 2), doorH / 2, Z_DOOR);
    room.add(jamb);
  }
  /* Outside: a short driveway apron and the building's own front face.
     The arrival shot stands here, so it cannot be a void. */
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w + 7, 9),
    new THREE.MeshStandardMaterial({ map: apronTexture(lowDetail), roughness: 0.72, metalness: 0.05 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.004, Z_DOOR + 4.4);
  room.add(apron);

  const facade = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.w + 0.5, ROOM.h + 0.35, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x151a21, roughness: 0.94 })
  );
  facade.position.set(0, (ROOM.h + 0.35) / 2, Z_DOOR + 0.55);
  facade.visible = false;   // kept out of the way; the header and jambs read as the wall
  room.add(facade);

  /* returns on both sides so the building has a silhouette from outside */
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, ROOM.h),
      new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.95, side: THREE.DoubleSide })
    );
    side.position.set(sx * ROOM.w / 2, ROOM.h / 2, Z_DOOR + 0.6);
    side.rotation.y = sx * Math.PI / 2;
    room.add(side);
  }

  /* one lamp over the door, so the apron is not pitch black */
  const porch = new THREE.PointLight(0xbccbe4, 1.5, 7.5, 2.2);
  porch.position.set(0, ROOM.h - 0.25, Z_DOOR + 0.9);
  room.add(porch);
  const porchBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x232932, roughness: 0.6, metalness: 0.4 })
  );
  porchBody.position.set(0, ROOM.h - 0.18, Z_DOOR + 0.9);
  room.add(porchBody);
  const porchLens = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.10),
    new THREE.MeshBasicMaterial({ color: 0xdfe9ff })
  );
  porchLens.rotation.x = Math.PI / 2;
  porchLens.position.set(0, ROOM.h - 0.252, Z_DOOR + 0.9);
  room.add(porchLens);

  /* ---- strip lights ----------------------------------------------- */
  const glow = P.glowTexture();
  const strips = [];
  for (const sz of [1.9, -0.7, -3.5]) {
    const g = new THREE.Group();
    g.position.set(0, ROOM.h - 0.11, sz);
    room.add(g);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.09, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x252b34, roughness: 0.6, metalness: 0.4 })
    );
    g.add(housing);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff });
    const tube = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.02, 0.13), tubeMat);
    tube.position.y = -0.055;
    g.add(tube);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.0),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.20, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.1;
    g.add(halo);
    strips.push({ group: g, tube: tubeMat, halo });
  }

  return { room, floor, floorMat, doorGroup, doorPanel, doorH, strips, porch };
}

/* Asphalt with a seam and a wet-looking spill of light from the door. */
function apronTexture(lowDetail = false) {
  /* Same bargain as the floor, and an easier one: the driveway is only
     ever seen from inside looking out through a door, at a glancing angle,
     for the length of the arrival. */
  const S = lowDetail ? 512 : 1024;
  const k = S / 1024;
  const { c, x, w, h } = P.canvas(S, S);
  x.fillStyle = '#0e1116'; x.fillRect(0, 0, w, h);
  const rnd = P.seeded(0xa5b8a17e);
  const grains = Math.round(4200 * k * k);
  for (let i = 0; i < grains; i++) {
    x.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${0.010 + rnd() * 0.020})`;
    x.beginPath(); x.arc(rnd() * w, rnd() * h, (1 + rnd() * 14) * k, 0, 6.284); x.fill();
  }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = Math.max(2, 5 * k);
  x.beginPath(); x.moveTo(0, h * 0.42); x.lineTo(w, h * 0.44); x.stroke();
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(150,175,220,0.22)');
  g.addColorStop(0.35, 'rgba(120,145,190,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return P.toTexture(c);
}

/* Every rig light carries its own daylight value and its own night
   multiplier, because main.js eases toward these numbers on every frame.
   A value typed here and a different one typed in the loop does not read
   as a disagreement: the loop wins, and the light quietly slides back to
   whatever the loop believes within about a second. One source, so
   retuning a light here is the whole edit and adding one cannot be
   forgotten at night. */
function rigLight(light, base, night) {
  light.intensity = base;
  light.userData.base = base;
  light.userData.night = night;
  return light;
}

export function buildLights(scene) {
  /* The room used to sit at 0.85 of hemisphere, which lit every surface
     from every direction and is why nothing in the frame was darker than
     anything else. Halved: the falloff into the corners is now the thing
     that makes the middle of the room read as lit. */
  const hemi = rigLight(new THREE.HemisphereLight(0xa9bede, 0x1a1712), 0.42, 0.30);
  scene.add(hemi);

  // key: stands in for the two ceiling tubes
  const key = rigLight(new THREE.DirectionalLight(0xdfe8f8), 2.35, 0.16);
  key.position.set(1.4, 4.4, 1.6);
  scene.add(key);

  // fill from the far corner, cool, keeps the car's shadow side readable
  const fill = rigLight(new THREE.DirectionalLight(0x7d9ad6), 0.52, 0.55);
  fill.position.set(-3.4, 2.2, -3.0);
  scene.add(fill);

  /* rim from the door opening, so the car separates from the back wall.
     Raised and swung off-axis: at the old near-horizontal (-0.4, 1.3, 6.0)
     it hit the nose flat and never found an edge. From up here it grazes
     the roof rail and the shoulder crease instead, which is the line the
     reference photographs of the car are built on. Held at 0.62: enough
     to draw the edge, little enough that the room does not move; pushing
     it to 0.8 lit the bench top too. main.js eases this at night with the
     rest of the rig, since the door opening is not bright after dark.

     Now at 0.78. The old ceiling on this was the bench top catching it,
     and the bench is no longer lit by the room: it has its own tungsten,
     which is warm, so a little more cool spill along the roof rail reads
     as a different light rather than as the same wash getting brighter. */
  const rim = rigLight(new THREE.DirectionalLight(0x9fb6e6), 0.78, 0.35);
  rim.position.set(-1.6, 3.2, 4.6);
  scene.add(rim);

  /* The only warm light in the building, and the only one that does not go
     down after dark. A clip lamp over the bench: tungsten, tight, aimed at
     the top rather than at the pegboard, so it pools on the work surface
     and dies before it reaches the holograms hanging above it. Those panes
     are additive and unlit, so this cannot wash them out; what it does is
     put a warm floor under them, which is what stops a blue pane over a
     blue bench from reading as one flat blue object. */
  const warm = rigLight(new THREE.SpotLight(0xffb36b), 8.0, 1.18);
  warm.distance = 3.4; warm.angle = 0.62; warm.penumbra = 0.85; warm.decay = 2;
  warm.position.set(2.72, 2.34, -0.60);
  warm.target.position.set(3.30, 0.92, -0.60);
  scene.add(warm);
  scene.add(warm.target);

  /* The one shadow caster, and it is an experiment that did not win: see
     the SHADOWS note in main.js for what was measured. It stays wired so
     ?shadow=1 can re-run it, and stays invisible otherwise, which costs a
     scene-graph node and no shadow map at all.

     It sits on the key's axis rather than somewhere of its own, because
     two lights disagreeing about where the sun is reads as a mistake even
     when neither one is wrong. These are the second tuning, the one that
     was supposed to save it: narrowed from 0.85 to 0.62 and taken from 3.2
     up to 6.5, on the theory that a shadow can only be as dark as the
     light it subtracts is bright. It made the contact no better and the
     room slightly brighter still, which is what settled the question. */
  const cast = rigLight(new THREE.SpotLight(0xd9e4f8), 6.5, 0.16);
  cast.distance = 9; cast.angle = 0.62; cast.penumbra = 0.5; cast.decay = 1.2;
  cast.position.set(1.05, 2.88, 1.25);
  cast.target.position.set(-0.28, 0, -0.55);
  cast.castShadow = true;
  cast.shadow.mapSize.set(2048, 2048);
  cast.shadow.bias = -0.0005;
  cast.shadow.normalBias = 0.02;   // the glTF has thin panels; bias alone acnes them
  cast.shadow.camera.near = 0.6;
  cast.shadow.camera.far = 9;
  /* Off until the tier gate in main.js says otherwise. A shadow map is the
     one thing here that a weak machine cannot afford, so the top tier owns
     it, and every lower tier keeps the blobs it always had. */
  cast.visible = false;
  scene.add(cast);
  scene.add(cast.target);

  /* `rig` is what the loop eases. Anything pushed here is night-wired for
     free; anything left out of it is a light that never turns off. */
  return { hemi, key, fill, rim, warm, cast,
           rig: [hemi, key, fill, rim, warm, cast] };
}

/* Blob shadow: one textured plane, no shadow map. Cheaper than a
   1024 shadow pass and it never shimmers when the camera moves. */
export function blobShadow(w, d, opacity = 0.62) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: P.blobTexture(), transparent: true, opacity,
      depthWrite: false, color: 0x000000,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  return m;
}

/* Vertex AO for procedural boxes: darken verts near the floor and near
   whichever wall the prop is bolted to. Costs one pass over the buffer
   and gets the grounded look that flat MeshStandard boxes never have. */
export function bakeAO(mesh, { floorY = 0, reach = 0.55, strength = 0.55 } = {}) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const dFloor = Math.max(0, v.y - floorY);
    let occ = 1 - Math.min(1, dFloor / reach);
    const dWall = Math.min(Math.abs(v.x - X0), Math.abs(v.x - X1), Math.abs(v.z - Z_BACK));
    occ = Math.max(occ, 1 - Math.min(1, dWall / (reach * 0.8)));
    const k = 1 - occ * strength;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => (m.vertexColors = true));
  else mesh.material.vertexColors = true;
  return mesh;
}
