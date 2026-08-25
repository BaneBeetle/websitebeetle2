/* Exact convex-region split of an indexed BufferGeometry.
   The E46 model ships as one welded body shell with no hood, so the hood
   has to be carved out at load time. A centroid-in-box test leaves a
   sawtooth edge; clipping every straddling triangle against the boundary
   planes gives a straight cut that reads as a panel shut line, and the
   two halves share the exact same edge vertices so no gap can appear. */

import * as THREE from 'three';

const EPS = 1e-6;

/* Vertex = flat array [px,py,pz, nx,ny,nz, u,v]. Keeping attributes in one
   stride makes interpolation at the cut a single loop. */
const STRIDE = 8;

function lerpVert(a, b, t, out) {
  for (let i = 0; i < STRIDE; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

function signedDist(plane, v) {
  return plane.n.x * v[0] + plane.n.y * v[1] + plane.n.z * v[2] + plane.d;
}

/* Sutherland-Hodgman on one triangle. Pushes fan-triangulated fragments
   into `keep` (inside half-space) and `drop` (outside). */
function clipTriangle(tri, plane, keep, drop) {
  const dist = [signedDist(plane, tri[0]), signedDist(plane, tri[1]), signedDist(plane, tri[2])];
  let nIn = 0;
  for (let i = 0; i < 3; i++) if (dist[i] >= 0) nIn++;

  if (nIn === 3) { keep.push(tri); return; }
  if (nIn === 0) { drop.push(tri); return; }

  const inside = [], outside = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const vi = tri[i], vj = tri[j], di = dist[i], dj = dist[j];
    if (di >= 0) inside.push(vi); else outside.push(vi);
    if ((di >= 0) !== (dj >= 0)) {
      const t = di / (di - dj);
      // one shared vertex object per crossing keeps both halves watertight
      const cut = lerpVert(vi, vj, t, new Float32Array(STRIDE));
      inside.push(cut); outside.push(cut);
    }
  }
  fan(inside, keep);
  fan(outside, drop);
}

function fan(poly, out) {
  for (let i = 1; i + 1 < poly.length; i++) {
    // skip slivers produced by a cut that grazes a corner
    if (area2(poly[0], poly[i], poly[i + 1]) < EPS) continue;
    out.push([poly[0], poly[i], poly[i + 1]]);
  }
}

function area2(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz);
}

function readTriangles(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  const tris = [];
  for (let t = 0; t < n; t += 3) {
    const tri = [];
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getX(t + k) : t + k;
      const v = new Float32Array(STRIDE);
      v[0] = pos.getX(i); v[1] = pos.getY(i); v[2] = pos.getZ(i);
      if (nor) { v[3] = nor.getX(i); v[4] = nor.getY(i); v[5] = nor.getZ(i); }
      if (uv) { v[6] = uv.getX(i); v[7] = uv.getY(i); }
      tri.push(v);
    }
    tris.push(tri);
  }
  return tris;
}

function buildGeometry(tris, hasNormal, hasUv) {
  const n = tris.length * 3;
  const pos = new Float32Array(n * 3);
  const nor = hasNormal ? new Float32Array(n * 3) : null;
  const uv = hasUv ? new Float32Array(n * 2) : null;
  let p = 0;
  for (const tri of tris) {
    for (const v of tri) {
      pos[p * 3] = v[0]; pos[p * 3 + 1] = v[1]; pos[p * 3 + 2] = v[2];
      if (nor) { nor[p * 3] = v[3]; nor[p * 3 + 1] = v[4]; nor[p * 3 + 2] = v[5]; }
      if (uv) { uv[p * 2] = v[6]; uv[p * 2 + 1] = v[7]; }
      p++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const index = new Uint32Array(n);
  for (let i = 0; i < n; i++) index[i] = i;
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Split `geo` by a convex region (intersection of half-spaces).
 * planes: [{ n: Vector3, d: number }], inside where n.p + d >= 0.
 * Returns { inside, outside } as fresh geometries.
 */
export function splitByPlanes(geo, planes) {
  const hasNormal = !!geo.attributes.normal;
  const hasUv = !!geo.attributes.uv;
  let remaining = readTriangles(geo);
  const outside = [];
  for (const plane of planes) {
    const keep = [];
    for (const tri of remaining) clipTriangle(tri, plane, keep, outside);
    remaining = keep;
    if (!remaining.length) break;
  }
  return {
    inside: buildGeometry(remaining, hasNormal, hasUv),
    outside: buildGeometry(outside, hasNormal, hasUv),
  };
}
