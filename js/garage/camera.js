/* Camera rig.
   Orbit is never actually free: every station carries a hand-tuned cage
   so there is no angle that shows a seam, and flights between stations
   are tweened with input locked, the way a cut in a film locks the
   viewer out of the edit. */

import * as THREE from 'three';
import { X0, X1, Z_BACK, Z_DOOR, DOOR_H, ROOM } from './scene.js';

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* Cages: azimuth 0 looks from the door end, +PI/2 from the right wall. */
export const POI = {
  /* Arrival is from the driveway, looking in through the open door. */
  home: {
    target: [-0.34, 0.78, -0.10], az: 0.40, pol: 1.42, dist: 6.40,
    cage: { az: [-0.30, 1.02], pol: [1.22, 1.54], dist: [5.00, 7.20] },
    label: 'The garage',
  },
  /* Inside, walking round the car: this is where the orbit opens up. */
  car: {
    target: [-0.30, 0.68, -0.15], az: 1.05, pol: 1.34, dist: 4.10,
    cage: { az: null, pol: [1.06, 1.48], dist: [3.20, 4.70] },
    label: 'Carbeetle',
  },
  bay: {
    target: [-0.30, 0.95, 1.28], az: 0.14, pol: 0.86, dist: 2.45,
    cage: { az: [-0.50, 0.78], pol: [0.58, 1.26], dist: [1.95, 3.00] },
    label: 'Engine bay',
  },
  bench: {
    target: [2.92, 1.28, -0.80], az: -1.30, pol: 1.52, dist: 1.62,
    cage: { az: [-1.90, -0.72], pol: [1.22, 1.72], dist: [1.30, 2.40] },
    label: 'Workbench',
  },
  wall: {
    target: [-3.42, 1.60, -0.60], az: 1.60, pol: 1.53, dist: 2.20,
    cage: { az: [1.06, 2.16], pol: [1.20, 1.80], dist: [1.70, 2.90] },
    label: 'Research wall',
  },
  dog: {
    target: [-2.26, 0.40, -4.30], az: 1.00, pol: 1.44, dist: 1.22,
    cage: { az: [0.14, 1.72], pol: [1.18, 1.60], dist: [0.98, 1.95] },
    label: 'Iron Bark',
  },
  bike: {
    target: [-0.55, 1.62, -4.92], az: 0.02, pol: 1.42, dist: 2.20,
    cage: { az: [-0.70, 0.74], pol: [1.12, 1.68], dist: [1.75, 2.95] },
    label: 'The bike',
  },
  exit: {
    target: [2.16, 1.34, -5.12], az: 0.16, pol: 1.50, dist: 2.55,
    cage: { az: [-0.46, 0.92], pol: [1.18, 1.70], dist: [2.05, 3.30] },
    label: 'Still building',
  },
};

export const STATION_ORDER = ['home', 'car', 'bay', 'bench', 'wall', 'dog', 'bike', 'exit'];

/* Keep the camera inside the building. Sliding along a wall is a better
   failure than punching through one. */
const M = 0.34;
function clampToRoom(v) {
  /* You can only be on the driveway if you are below the door header.
     Otherwise the camera ends up inside the wall above the opening,
     which renders as a black frame and reads as a broken site. */
  if (v.z > Z_DOOR - 0.24 && v.y < DOOR_H - 0.12) {
    // standing on the driveway: the walls no longer apply, but stay in
    // front of the opening so the view is never blocked by the jambs
    v.x = THREE.MathUtils.clamp(v.x, -3.2, 3.2);
    v.y = THREE.MathUtils.clamp(v.y, 0.55, 3.2);
    v.z = THREE.MathUtils.clamp(v.z, Z_DOOR - 0.24, Z_DOOR + 4.2);
    return v;
  }
  v.x = THREE.MathUtils.clamp(v.x, X0 + M, X1 - M);
  v.y = THREE.MathUtils.clamp(v.y, 0.28, ROOM.h - 0.26);
  v.z = THREE.MathUtils.clamp(v.z, Z_BACK + M, Z_DOOR - 0.24);
  return v;
}

export class Rig {
  constructor(camera, opts = {}) {
    this.cam = camera;
    /* Portrait viewports see a narrower slice of the world, so every
       station backs off until its subject fits. One experience, not a
       mobile subsite. */
    this.pull = opts.pull || 1;
    this.target = new THREE.Vector3(...POI.home.target);
    this.tTarget = this.target.clone();
    this.az = POI.home.az; this.pol = POI.home.pol; this.dist = POI.home.dist * this.pull;
    this.tAz = this.az; this.tPol = this.pol; this.tDist = this.dist;
    this.cage = this.cageOf('home');
    this.locked = false;
    this.flight = null;
    this.station = 'home';
    /* When the reading panel is open it covers the right third of a wide
       viewport, so the whole rig slides sideways to keep the subject in
       the part of the frame you can still see. */
    this.shift = 0;
    this._shift = 0;
    this._v = new THREE.Vector3();
    this._right = new THREE.Vector3();
  }

  cageOf(name) {
    const c = POI[name].cage;
    if (this.pull === 1) return c;
    return { az: c.az, pol: c.pol, dist: [c.dist[0] * this.pull, c.dist[1] * this.pull], rotate: c.rotate };
  }

  orbit(dx, dy) {
    if (this.locked || this.cage.rotate === false) return;
    this.tAz -= dx * 0.0042;
    this.tPol = THREE.MathUtils.clamp(this.tPol - dy * 0.0038, this.cage.pol[0], this.cage.pol[1]);
    if (this.cage.az) this.tAz = THREE.MathUtils.clamp(this.tAz, this.cage.az[0], this.cage.az[1]);
  }

  zoom(dz) {
    if (this.locked) return;
    this.tDist = THREE.MathUtils.clamp(this.tDist + dz * 0.0016, this.cage.dist[0], this.cage.dist[1]);
  }

  /* Fly to a station. Constraints are released for the flight and
     re-clamped on arrival, so a move between two tight cages is legal. */
  flyTo(name, ms = 1500, onArrive) {
    const p = POI[name];
    if (!p) return;
    this.station = name;
    this.locked = true;
    const from = { az: this.tAz, pol: this.tPol, dist: this.tDist, t: this.tTarget.clone() };
    // take the short way round the circle
    let dAz = p.az - from.az;
    while (dAz > Math.PI) dAz -= Math.PI * 2;
    while (dAz < -Math.PI) dAz += Math.PI * 2;
    this.flight = {
      from, dAz, to: p, ms, t0: null, onArrive,
      apply: (k) => {
        const e = easeInOut(k);
        this.tAz = from.az + dAz * e;
        this.tPol = from.pol + (p.pol - from.pol) * e;
        this.tDist = from.dist + (p.dist * this.pull - from.dist) * e;
        this.tTarget.lerpVectors(from.t, this._v.set(...p.target), e);
      },
    };
  }

  jumpTo(name) {
    const p = POI[name];
    if (!p) return;
    // a jump cancels any flight still in the air, or the flight would
    // keep writing its own target back over this one every frame
    this.flight = null;
    this.locked = false;
    this.station = name;
    this.cage = this.cageOf(name);
    this.tAz = this.az = p.az;
    this.tPol = this.pol = p.pol;
    this.tDist = this.dist = p.dist * this.pull;
    this.tTarget.set(...p.target);
    this.target.copy(this.tTarget);
    this.apply(1);
  }

  update(dt, now) {
    if (this.flight) {
      const f = this.flight;
      if (f.t0 == null) f.t0 = now;
      const k = Math.min(1, (now - f.t0) / f.ms);
      f.apply(k);
      if (k >= 1) {
        this.cage = this.cageOf(this.station);
        this.locked = false;
        const cb = f.onArrive;
        this.flight = null;
        if (cb) cb();
      }
      this.apply(1);            // flights are already eased, do not damp twice
      return;
    }
    this.apply(1 - Math.pow(0.0016, dt));
  }

  apply(k) {
    this.az += (this.tAz - this.az) * k;
    this.pol += (this.tPol - this.pol) * k;
    this.dist += (this.tDist - this.dist) * k;
    this.target.lerp(this.tTarget, k);
    const sp = Math.sin(this.pol), cp = Math.cos(this.pol);
    this._v.set(
      this.target.x + this.dist * sp * Math.sin(this.az),
      this.target.y + this.dist * cp,
      this.target.z + this.dist * sp * Math.cos(this.az)
    );
    clampToRoom(this._v);
    this.cam.position.copy(this._v);

    /* Aim to the right of the subject so the subject lands on the left,
       clear of the panel. Only the look-at point moves: translating the
       eye as well would keep the framing and just show a different wall. */
    this._shift += (this.shift - this._shift) * Math.min(1, k * 1.4);
    if (Math.abs(this._shift) > 0.0015) {
      this._right.set(Math.cos(this.az), 0, -Math.sin(this.az))
        .multiplyScalar(this._shift * this.dist)
        .add(this.target);
      this.cam.lookAt(this._right);
    } else {
      this.cam.lookAt(this.target);
    }
  }
}
