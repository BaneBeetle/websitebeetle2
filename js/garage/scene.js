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

/* Floor stencils are the navigation. UVs run 0..1 across the floor plane:
   u maps to x (left to right), v maps to z (back to front). */
const STENCILS = [
  { text: 'engine bay',  u: 0.50, v: 0.215, size: 44, rot: 0 },
  { text: 'projects',    u: 0.855, v: 0.560, size: 46, rot: -90 },
  { text: 'research',    u: 0.145, v: 0.530, size: 46, rot: 90 },
  { text: 'still building', u: 0.62, v: 0.925, size: 36, rot: 180 },
];

export function buildRoom(scene, quality) {
  const room = new THREE.Group();
  room.name = 'room';
  scene.add(room);

  const floorTex = P.floorTexture(STENCILS);
  const wallTex = P.wallTexture();
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;

  /* ---- floor ------------------------------------------------------ */
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, roughness: 0.44, metalness: 0.06, color: 0xffffff,
  });
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
  const doorH = 2.35, doorW = 4.9;
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
    new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.72, metalness: 0.05 })
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
  for (const sz of [1.6, -2.4]) {
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
function apronTexture() {
  const { c, x, w, h } = P.canvas(1024, 1024);
  x.fillStyle = '#0e1116'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 4200; i++) {
    x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${0.010 + Math.random() * 0.020})`;
    x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 14, 0, 6.284); x.fill();
  }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, h * 0.42); x.lineTo(w, h * 0.44); x.stroke();
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(150,175,220,0.22)');
  g.addColorStop(0.35, 'rgba(120,145,190,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return P.toTexture(c);
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xa9bede, 0x1a1712, 0.85);
  scene.add(hemi);

  // key: stands in for the two ceiling tubes
  const key = new THREE.DirectionalLight(0xdfe8f8, 2.05);
  key.position.set(1.4, 4.4, 1.6);
  scene.add(key);

  // fill from the far corner, cool, keeps the car's shadow side readable
  const fill = new THREE.DirectionalLight(0x7d9ad6, 0.75);
  fill.position.set(-3.4, 2.2, -3.0);
  scene.add(fill);

  // rim from the door opening, so the car separates from the back wall
  const rim = new THREE.DirectionalLight(0x9fb6e6, 0.55);
  rim.position.set(-0.4, 1.3, 6.0);
  scene.add(rim);

  return { hemi, key, fill, rim };
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
