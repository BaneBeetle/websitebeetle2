/* Brian's Garage: boot, state machine, input, and the wiring between the
   room and the DOM. One mode string gates every handler, exactly like a
   well-behaved kiosk: if the mode does not match, the click does nothing. */

import * as THREE from 'three';
import { buildRoom, buildLights } from './scene.js';
import { envTexture, loadFloorMaps } from './paint.js';
import { loadCar } from './car.js';
import * as Props from './props.js';
import * as S from './screens.js';
import { Rig, POI, STATION_ORDER } from './camera.js';
import { Shop } from './audio.js';
import { CAR, PROJECTS, BAY_PROJECTS, PAPER, EXPERIENCE, EDUCATION, BIKE, DOG, PERSON, CREDITS } from './content.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const portrait = innerHeight > innerWidth;

const QUERY = new URLSearchParams(location.search);

/* Where the perf ladder starts. checkPerf still owns every demotion from
   here; this only picks the first rung, because handing a phone tier 3
   means it renders one expensive second before the first window closes and
   drops it anyway, and that second is the first one anybody sees.
   ?q=high|med|low pins a tier instead, which is what makes a screenshot
   reproducible: a pinned tier is never demoted. */
const TIER_BY_NAME = { high: 3, med: 2, low: 1 };
const FORCED_TIER = TIER_BY_NAME[QUERY.get('q')];
const TIER_PINNED = FORCED_TIER != null;

function startingTier() {
  if (TIER_PINNED) return FORCED_TIER;
  const cores = navigator.hardwareConcurrency || 4;
  /* deviceMemory is Chromium-only, reports GB, and is capped at 8. Safari
     does not implement it, so the 4 default is what an iPhone gets, which
     is deliberately not low enough to drop it to the bottom rung on a
     missing API alone. */
  const mem = navigator.deviceMemory || 4;

  // genuinely weak, whatever it is plugged into: plain path, no composer
  if (cores <= 4 || mem <= 2) return 1;
  /* A phone with real silicon can run the composer, but only at the 1.5
     pixel-ratio cap tier 2 applies; a thin one should not try. Screen
     density is not consulted here on purpose, because the tier's own DPR
     cap already decides how many pixels get drawn, and a dense screen on
     a fast chip was the one case the old rule got wrong. */
  if (coarse) return (cores >= 6 && mem >= 4) ? 2 : 1;
  return cores <= 6 ? 2 : 3;
}

/* The shadow experiment, run and lost. A single shadow-casting SpotLight
   over the car was measured against the painted blob it had to beat, at
   two tunings (wide and soft, then tight and bright), from identical
   poses. It lost both times, and the numbers say why: turning it on made
   the frame BRIGHTER and left FEWER dark pixels than the blob did.

   That is not a bias problem and there was no acne to fight. It is that
   this room is lit by a hemisphere, three directionals and a painted
   environment, so one spot is maybe a quarter of what reaches the floor
   beside the car; subtracting a quarter of a quarter is a whisper, while
   the blob is a tuned 66% contact sitting exactly where the sills are.
   The floor also already carries painted pools and a painted vignette, so
   the real shadow lands on a surface that is graded before it arrives.

   Left in and defaulted off rather than deleted, because the experiment is
   worth being able to re-run: ?shadow=1 puts it back, top tier only. */
const SHADOWS = QUERY.get('shadow') === '1';

/* ?post=0 drops the composer at any tier, and ?post=null keeps the chain
   but empties it of effects. That second one is the measurement that
   matters: this room has fourteen materials carrying toneMapped:false, and
   three stops applying the flag at all once a RenderPass is in front, so
   Render -> Output on its own is not guaranteed to equal renderer.render.
   Whatever that costs wants to be known before a bloom is laid on top of
   it and told to explain the difference. */
const POST_MODE = QUERY.get('post');   // null | '0' | 'null'

/* ?pose=hero lands straight on the home station instead of walking in
   through the door. The arrival is the better first impression and stays
   the default; this exists because a screenshot of a two-second flight is
   a screenshot of whichever frame the capture happened to land on. */
const POSE = QUERY.get('pose');

const $ = (s) => document.querySelector(s);
const boot = $('.boot');
const bar = $('.boot-bar');
const pct = $('.boot-pct');
const startBtn = $('.boot-start');
const bootNote = $('.boot-note');
const panel = $('.panel');
const panelBody = $('.panel-body');
const rail = $('.rail');
const hint = $('.hint');

/* ------------------------------------------------------------- boot */

let progress = 0;
function setProgress(v) {
  progress = Math.max(progress, Math.min(1, v));
  boot.style.setProperty('--load', String(progress));
  boot.style.setProperty('--door', String(progress * 0.58));
  if (pct) pct.textContent = String(Math.round(progress * 100)).padStart(2, '0');
}

if (document.documentElement.classList.contains('has-gl')) {
  start().catch((err) => {
    // if the room cannot be built, fall back to the page rather than a
    // black screen: the content is all there already
    console.warn('garage: falling back to the document layer', err);
    boot.hidden = true;
    document.body.classList.remove('gl-on');
    document.documentElement.classList.remove('has-gl');
  });
} else {
  boot.hidden = true;
}

async function start() {
  const canvas = $('#stage');
  /* Decided before the renderer exists, because two things about the
     renderer itself depend on it. */
  const startTier = startingTier();

  /* Canvas MSAA is only worth paying for on the plain path. From tier 2 up
     the room is drawn into the composer's own multisampled target and the
     backbuffer is never antialiased by this flag at all, so on those tiers
     it buys nothing and costs a second multisampled surface at whatever
     device pixel ratio the display has. Below tier 2 it is the only thing
     keeping the door slats and the bench lip from crawling, so that is
     exactly where it stays on. */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: startTier < 2, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(startTier >= 3 ? Math.min(2, devicePixelRatio || 1)
    : startTier === 2 ? Math.min(1.5, devicePixelRatio || 1) : 1);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  /* Soft, because the one shadow in this room is a three-metre strip light
     and a hard edge under the sills would be a different building. Whether
     the map is switched on at all is the tier gate's call. */
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.environment = envTexture();

  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 60);
  /* Portrait phones see a narrow slice, so every station steps back. */
  const pullFor = () => (innerWidth / innerHeight < 0.85 ? 1.42 : innerWidth < 900 ? 1.15 : 1);
  // the panel is a right-hand rail above 760px and a bottom sheet below
  const wideViewport = () => innerWidth > 760;
  const rig = new Rig(camera, { pull: pullFor() });
  /* Portrait sees a narrow slice, so the wide stations aim at the one
     thing worth seeing instead of the whole wall. */
  if (rig.pull > 1.2) {
    POI.wall.target = [-3.34, 1.78, -1.40];
    POI.wall.dist = 1.95;
    POI.wall.cage.dist = [1.60, 2.60];
    POI.bench.dist = 1.85;
    POI.car.az = 0.60;
    POI.car.dist = 3.80;
    POI.car.cage.dist = [3.20, 4.60];
    POI.bay.pol = 0.95;
    POI.bay.dist = 1.95;
    POI.bay.cage.dist = [1.55, 2.30];
    rig.jumpTo('home');
  }

  let resizeTimer = null;
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    // the composer owns its own targets; left unresized they keep the old
    // buffer and the room renders into a corner of the canvas
    if (post) post.setSize(innerWidth, innerHeight);
    clearTimeout(resizeTimer);
    if (!wideViewport()) rig.shift = 0;
    resizeTimer = setTimeout(() => {
      const p = pullFor();
      if (p === rig.pull) return;
      rig.pull = p;
      rig.jumpTo(rig.station);
    }, 220);
  });
  addEventListener('orientationchange', () => {
    setTimeout(() => dispatchEvent(new Event('resize')), 120);
  });

  /* The concrete maps, before the room rather than after it, because the
     colour map is composited into the floor canvas and a floor built twice
     is a floor that flashes. 243 KB for the three, against 6 MB of car.

     Not downloaded at all on the bottom rung. A machine that is going to
     be handed the plain render path should not first be made to fetch a
     quarter of a megabyte of normal map for a slab it will barely shade,
     and this is the only decision that has to be made before the perf
     ladder exists, because by the time tier is read the room is built.

     A failure here is not fatal either: the slab falls back to the
     painted-only version it has always had, which is why this is a catch
     and not an await that can reject the boot. */
  /* The composer and the eleven vendored modules behind it are 55 KB that
     the bottom rung will never run: the ladder only ever demotes, so a
     machine that starts at tier 1 cannot later climb to a tier that wants
     them. Imported dynamically so that machine never fetches them at all,
     which is most of what "the low path stays light" has to mean when the
     alternative is downloading a bloom pass in order not to use it. */
  const Post = startTier >= 2 ? await import('./post.js') : null;

  const floorMaps = startTier <= 1 ? null : await loadFloorMaps(
    renderer.capabilities.getMaxAnisotropy()).catch((e) => {
    console.warn('garage: concrete maps unavailable, painted floor only', e);
    return null;
  });

  /* Texture detail follows the SCREEN, not just the tier. A good phone
     earns tier 2 and can run the composer, but it is still a tiled GPU
     behind a screen a few inches across, and a four-megapixel floor canvas
     costs it sixteen megabytes to hold and a visible pause to paint for
     detail it cannot resolve. Anisotropy is the same trade: nearly free on
     a desktop GPU, pure bandwidth on a tiler, and the floor is the one
     surface here seen at a grazing angle, so it keeps some of it. */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const lowDetail = startTier <= 1 || coarse;
  const room = buildRoom(scene, {
    floorMaps,
    aniso: lowDetail ? Math.min(4, maxAniso) : maxAniso,
    lowDetail,
  });
  const lights = buildLights(scene);
  setProgress(0.10);

  const car = await loadCar(scene, (p) => setProgress(0.10 + p * 0.55));
  setProgress(0.70);

  /* Cheap floor reflection: one extra draw of the car, mirrored under
     the slab, composited through a slightly transparent floor. A full
     Reflector would redraw the whole room; this doubles the one object
     that actually needs doubling. */
  const mirror = car.root.clone(true);
  mirror.scale.y = -1;
  mirror.position.y = -car.root.position.y;
  mirror.traverse((o) => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshBasicMaterial({
      color: o.material && o.material.color ? o.material.color.clone().multiplyScalar(0.30) : 0x141820,
      transparent: true, opacity: 0.34, depthWrite: false, side: THREE.BackSide,
    });
    o.renderOrder = -3;
  });
  scene.add(mirror);
  room.floorMat.transparent = true;
  room.floorMat.opacity = 0.90;
  room.floor.renderOrder = -2;

  /* the bench borrows the car's own shell for the hologram over it,
     rather than paying for the glTF twice */
  const bench = Props.buildBench(scene, { ghost: car.body.geometry, reduced });
  const wall = Props.buildWall(scene);
  const dog = Props.buildDog(scene);
  const bike = Props.buildBike(scene);
  const exit = Props.buildExit(scene);
  const dressing = Props.buildDressing(scene);
  Props.buildSign(scene, coarse, QUERY.get('sign') === 'two');

  /* ------------------------------------------------- ambient machines */
  /* A pup on patrol and an arm on the bench. Neither is clickable and
     neither is in `targets`, so a ray fired at a hotspot goes straight
     through both of them no matter where they have got to. */
  const pup = Props.buildPup(scene);
  const arm = Props.buildArm(scene);
  const drone = Props.buildDrone(scene);
  const pupPos = new THREE.Vector3();
  const pupAhead = new THREE.Vector3();
  const pupHeadW = new THREE.Vector3();
  const pupCamW = new THREE.Vector3();
  const gripW = new THREE.Vector3();
  let pupYaw = 0, pupLook = 0, pupWag = 0, pupGreet = 0, pupNear = 0;
  const dronePos = new THREE.Vector3();
  const droneAhead = new THREE.Vector3();
  let droneYaw = null, droneBank = 0, dronePitch = 0;

  /* What the drone's camera is allowed to recognise, and where.
     The car's box is measured off the loaded model rather than typed in,
     because the model is the only thing that knows how long an E46 is.
     Iron Bark's is fitted to the robot itself: its group's own bounds
     swallow the dock and the behaviour board on the wall above it, and
     bracketing three metres of wall would say the drone had recognised
     the furniture.

     The two triggers are both pure functions of the sampled flight, so
     the moment is a place on the ring rather than a time on a clock and
     __exp.step lands on the same frame twice. Iron Bark is recognised on
     the dwell that already holds over its corner, so the moment is the
     hold. The car is recognised on the pass across its roof, so the
     moment is a stretch of arc length. They sit seven metres apart on a
     seventeen metre lap, which is nine seconds of quiet either side:
     that is the cooldown, and it costs no timer to keep.

     0.91 is not decoration: it is what the detector actually prints over
     this car in the frame hanging on the bench wall. Iron Bark's 0.87 is
     the one invented number here, and it is deliberately not another
     0.91, because two identical scores would read as a placeholder. */
  const carBox = new THREE.Box3().setFromObject(car.root);
  const DRONE_SCANS = [
    { id: 'ironbark', label: 'IRON BARK 0.87', wp: 3,
      min: new THREE.Vector3(-2.64, 0.04, -4.83),
      max: new THREE.Vector3(-1.96, 0.74, -4.01) },
    { id: 'car', label: 'CARBEETLE 0.91', u0: 0.795, u1: 0.895,
      min: carBox.min.clone(), max: carBox.max.clone() },
  ];
  /* How far the beam gets before it hits what it is aiming at. A sensor
     that aimed at a centre and drew a beam all the way to it would draw
     a beam through the bodywork and out of the far door, so the length
     is where the ray enters the box, not the distance to the middle of
     it. The standard slab test, clamped at zero: the drone is always
     outside these two boxes and always above them, so the near hit is
     the top face or a flank and never behind the sensor. */
  const slab = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-6) return 0;          // parallel to this pair of faces
    const t0 = (lo - o) / d, t1 = (hi - o) / d;
    return Math.min(t0, t1);
  };
  const rayEntry = (o, d, min, max) => Math.max(0,
    slab(o.x, d.x, min.x, max.x),
    slab(o.y, d.y, min.y, max.y),
    slab(o.z, d.z, min.z, max.z));

  let droneLock = null, scanFloor = 0, scanAim = 0, aimTarget = null;
  const scanCam = new THREE.Vector3();
  const aimAt = new THREE.Vector3();
  const DOWN = new THREE.Vector3(0, -1, 0);      // the beam's own axis, unaimed
  const scanEuler = new THREE.Euler();
  const qGround = new THREE.Quaternion(), qBeam = new THREE.Quaternion();
  const qAim = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  const qTmp = new THREE.Quaternion(), qYoke = new THREE.Quaternion();
  setProgress(0.92);

  /* ---------------------------------------------------------- picking */
  /* Invisible hitboxes larger than the thing they stand for, so a hotspot
     is easy to hit from any legal camera angle. */
  const targets = [];
  const FAT = coarse ? 1.45 : 1;
  const addHit = (id, geo, pos, rot) => {
    if (FAT !== 1) geo.scale(FAT, FAT, FAT);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(pos);
    if (rot) m.rotation.copy(rot);
    m.userData.hit = id;
    scene.add(m); targets.push(m); return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cx = car.root.position.x, cz = car.root.position.z;

  addHit('car', new THREE.BoxGeometry(2.1, 1.0, 3.0), V(cx, 0.72, cz - 0.55));
  const hoodHit = addHit('hood', new THREE.BoxGeometry(1.7, 0.7, 1.35), V(cx + 0.02, 0.92, cz + 1.72));
  addHit('horn', new THREE.BoxGeometry(0.7, 0.5, 0.35), V(cx, 0.60, cz + 2.42));
  addHit('lamp', new THREE.BoxGeometry(0.55, 0.4, 0.35), V(cx - 0.72, 0.68, cz + 2.28));
  addHit('rev', new THREE.BoxGeometry(0.9, 0.45, 0.4), V(cx, 0.34, cz - 2.28));

  for (const h of car.bay.hotspots) {
    const w = h.at.clone();
    // bay hotspots are in the car's Z-up local frame
    const p = new THREE.Vector3(w.x, w.z, -w.y);
    p.add(car.root.position);
    addHit(h.id, new THREE.SphereGeometry(h.r, 8, 8), p);
  }

  for (const src of [bench, wall, dog, bike, exit]) {
    for (const h of src.hotspots) {
      h.mesh.userData.hit = h.id;
      if (FAT !== 1 && h.size) h.mesh.scale.set(FAT, FAT, 1);
      targets.push(h.mesh);
    }
  }

  /* ------------------------------------------------------ hover glow */
  /* What visibly answers when the pointer finds a hotspot. Most hitboxes
     are invisible boxes, so brightening the box does nothing: each station
     names the group its box stands in front of, and the whole group lifts
     by a hair. A few hotspots ARE the drawn thing — the paper pinned to
     the research wall — and those answer on their own.

     Only MeshStandardMaterial is touched, which is exactly what keeps this
     off the holograms, the LEDs, the eyes and the scan cone: those are
     Basic and Shader materials with no emissive channel, and most of them
     are already driven every frame by something that would fight a hover.

     The car is deliberately absent. Its materials are finished, graded
     work, and a hover tint is the one thing that would quietly regrade
     them; it gets the cursor, which is the half that actually says
     "clickable". */
  const HOVER_GROUPS = {
    bench: bench.group, wall: wall.group, dog: dog.group,
    bike: bike.group, exit: exit.group,
  };
  for (const src of [bench, wall, dog, bike, exit]) {
    for (const h of src.hotspots) {
      // material.visible === false is how the invisible hitboxes are made
      if (!HOVER_GROUPS[h.id] && h.mesh.material && h.mesh.material.visible !== false) {
        HOVER_GROUPS[h.id] = h.mesh;
      }
    }
  }
  const HOVER_TINT = new THREE.Color(0x16243a);
  function setHover(id, on) {
    const node = id && HOVER_GROUPS[id];
    if (!node) return;
    node.traverse((o) => {
      const m = o.material;
      if (!m || Array.isArray(m) || !m.isMeshStandardMaterial) return;
      // capture once: the base may already be a real emissive, and a hover
      // must add to it rather than replace it
      if (m.userData.emBase === undefined) m.userData.emBase = m.emissive.getHex();
      m.emissive.setHex(m.userData.emBase);
      if (on) m.emissive.add(HOVER_TINT);
    });
  }

  /* ------------------------------------------------------------ audio */
  const shop = new Shop();

  /* ------------------------------------------------------------- mode */
  let mode = 'boot';
  let buttonsLocked = false;
  let hoodT = 0, hoodTarget = 0;
  let lampsOn = false, lampT = 0;
  let nightMode = false;
  const pointerNdc = new THREE.Vector2(0, 0);
  const lookRay = new THREE.Raycaster();
  const lookPlane = new THREE.Plane();
  const lookAt = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const viewDir = new THREE.Vector3();
  const plateCam = new THREE.Vector3();
  const plateAim = new THREE.Object3D();
  plateAim.up.set(0, 0, 1);              // the bay's own up, which is Z
  /* Hover state. The bay owns the cursor whenever it is open and the
     pointer is on a plate, because 'zoom-in' says something more specific
     there than 'pointer' does; everywhere else the room says 'pointer'. */
  let bayHot = false, hoverId = null, hoverTick = 0;
  let boardT = 0, boardPhase = -1, boardFlash = -1;
  let filmT = 0, filmN = -1;
  let dogPerk = 0, dogHop = 0;

  const lockButtons = (ms) => {
    buttonsLocked = true;
    setTimeout(() => { buttonsLocked = false; }, ms);
  };

  function goto(name, opts = {}) {
    if (buttonsLocked && !opts.force) return;
    lockButtons(reduced ? 60 : 1500);
    setStation(name);
    if (reduced) {
      rig.jumpTo(name);
      arrive(name, opts);
    } else {
      shop.whoosh();
      rig.flyTo(name, 1500, () => arrive(name, opts));
    }
    /* Every road into the bay raises the hood: the rail button, the arrow
       keys, a panel link, the hood itself. Arriving at a shut hood was the
       one place the garage lied about what a station meant. The clunk only
       fires on a real shut-to-open transition, so coming through
       openHood() does not sound it twice. */
    if (name === 'bay') {
      if (hoodTarget < 0.5) shop.clunk();
      hoodTarget = 1;
    } else {
      hoodTarget = 0;
    }
  }

  function arrive(name, opts) {
    mode = name;
    shop.chirp();
    openPanel(opts.panel || name, opts.detail);
  }

  function setStation(name) {
    rail.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-current', String(b.dataset.station === name));
    });
    document.body.classList.toggle('deep', name !== 'home');
  }

  /* ------------------------------------------------------------- panel */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tagList = (t) => t && t.length ? `<ul class="tags">${t.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';

  function projectHTML(p) {
    return `
      <h2>${esc(p.title)}</h2>
      <p class="kicker">${esc(p.kicker)}</p>
      <p class="meta">${esc(p.date)} / ${esc(p.tag)}</p>
      ${p.photo ? `<img src="${p.photo}" alt="${esc(p.photoAlt || '')}" width="600" height="380" loading="lazy">` : ''}
      <p>${esc(p.body)}</p>
      ${p.bullets.length ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${tagList(p.tags)}
      <div class="btn-row">
        ${p.href ? `<a class="btn" href="${p.href}" target="_blank" rel="noopener">${esc(p.hrefLabel || 'Open')}</a>` : ''}
        <button class="btn btn-ghost" data-act="bench-index">All builds</button>
      </div>`;
  }

  const PANELS = {
    home: () => `
      <h2>Brian's Garage</h2>
      <p class="kicker">One car, one bench, and everything I have taken apart.</p>
      <p>Nothing here is a nav bar. The floor is stencilled with where things are, and anything that looks like it opens, opens. Start with the hood.</p>
      <div class="btn-row">
        <button class="btn" data-act="hood">Open the hood</button>
        <a class="btn btn-ghost" href="${PERSON.resume}" target="_blank" rel="noopener">Resume, PDF</a>
      </div>
      <ul class="panel-list">
        ${STATION_ORDER.filter((s) => s !== 'home').map((s) => `
          <li><button data-act="go" data-to="${s}"><b>${esc(POI[s].label)}</b><span>${esc(stationBlurb(s))}</span></button></li>`).join('')}
      </ul>`,

    car: () => `
      <h2>${esc(CAR.name)}</h2>
      <p class="kicker">${esc(CAR.model)}, ${esc(CAR.paint)}</p>
      <p>${esc(CAR.provenance)} It is also the reason a camera in this garage knows which car is mine.</p>
      <img src="img/photo/carbeetle-800.jpg" alt="The M3 badge on Brian's Interlagos Blue E46." width="800" height="533" loading="lazy">
      <dl class="spec">
        ${CAR.specs.map((s) => `<div><dt>${esc(s.k)}</dt><dd><b>${esc(s.v)}</b><small>${esc(s.note)}</small></dd></div>`).join('')}
      </dl>
      <div class="btn-row">
        <button class="btn" data-act="hood">Open the hood</button>
      </div>`,

    bay: () => `
      <h2>Engine bay</h2>
      <p class="kicker">The specs above, and the two things I built around this car.</p>
      <dl class="spec">
        ${CAR.specs.map((s) => `<div><dt>${esc(s.k)}</dt><dd><b>${esc(s.v)}</b></dd></div>`).join('')}
      </dl>
      ${BAY_PROJECTS.map((p) => `
        <h3 style="font-size:19px;font-weight:600;margin:0 0 4px">${esc(p.title)}</h3>
        <p class="meta">${esc(p.date)}</p>
        <p>${esc(p.body)}</p>
        ${tagList(p.tags)}
        <div class="btn-row"><a class="btn btn-ghost" href="${p.href}" target="_blank" rel="noopener">${esc(p.hrefLabel)}</a></div>
      `).join('')}`,

    bench: () => `
      <h2>Workbench</h2>
      <p class="kicker">Software, machine learning, and the things with wires coming out of them.</p>
      <ul class="panel-list">
        ${PROJECTS.map((p) => `
          <li><button data-act="project" data-id="${p.id}"><b>${esc(p.title)}</b><span>${esc(p.date)} / ${esc(p.tag)}</span></button></li>`).join('')}
      </ul>
      <div class="btn-row"><a class="btn btn-ghost" href="projects.html">Projects as a page</a></div>`,

    wall: () => `
      <h2>The wall</h2>
      <p class="kicker">School, research, and the teaching that came with it.</p>
      ${EDUCATION.map((e) => `
        <dl class="spec"><div><dt>${esc(e.when)}</dt><dd><b>${esc(e.school)}</b><small>${esc(e.degree)}${e.note ? '. ' + esc(e.note) : ''}</small></dd></div></dl>`).join('')}
      <ul class="panel-list">
        ${EXPERIENCE.map((e) => `
          <li><button data-act="link" data-href="${e.href}"><b>${esc(e.role)}</b><span>${esc(e.org)} / ${esc(e.when)}</span></button></li>`).join('')}
      </ul>
      <div class="btn-row">
        <a class="btn" href="publication.html">Read the AERA paper</a>
        <a class="btn btn-ghost" href="portfolio-1.html">Experience as a page</a>
      </div>`,

    paper: () => `
      <h2>AERA 2025</h2>
      <p class="kicker">${esc(PAPER.title)}</p>
      <p class="meta">${esc(PAPER.venue)} / ${esc(PAPER.date)}</p>
      <img src="${PAPER.photo}" alt="${esc(PAPER.photoAlt)}" width="800" height="533" loading="lazy">
      <p>${esc(PAPER.blurb)}</p>
      <p class="meta">${esc(PAPER.status)}</p>
      <div class="btn-row"><a class="btn" href="publication.html">Read the paper</a></div>`,

    dog: () => {
      const p = PROJECTS.find((x) => x.id === DOG.ref);
      return `<h2>${esc(DOG.title)}</h2>
        <p class="kicker">${esc(p.kicker)}</p>
        <p class="meta">${esc(p.date)}</p>
        <p>${esc(DOG.body)}</p>
        <p>${esc(p.body)}</p>
        <ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        ${tagList(p.tags)}`;
    },

    bike: () => `
      <h2>${esc(BIKE.title)}</h2>
      <p class="kicker">${esc(BIKE.body)}</p>
      <img src="${BIKE.photo}" alt="${esc(BIKE.photoAlt)}" width="454" height="682" loading="lazy">`,

    exit: () => `
      <h2>Still building</h2>
      <p class="kicker">Columbia through Dec 2026, and a robot dog that is not finished.</p>
      <div class="btn-row">
        <a class="btn" href="mailto:${PERSON.email}">Email me</a>
        <a class="btn btn-ghost" href="${PERSON.github}" target="_blank" rel="noopener">GitHub</a>
      </div>
      <dl class="spec">
        <div><dt>Email</dt><dd><a href="mailto:${PERSON.email}">${esc(PERSON.email)}</a></dd></div>
        <div><dt>School</dt><dd><a href="mailto:${PERSON.school}">${esc(PERSON.school)}</a></dd></div>
        <div><dt>GitHub</dt><dd><a href="${PERSON.github}" target="_blank" rel="noopener">${esc(PERSON.githubHandle)}</a></dd></div>
        <div><dt>LinkedIn</dt><dd><a href="${PERSON.linkedin}" target="_blank" rel="noopener">banebeetle</a></dd></div>
        <div><dt>Resume</dt><dd><a href="${PERSON.resume}" target="_blank" rel="noopener">PDF</a></dd></div>
      </dl>
      <p class="meta">Credits</p>
      <p style="font-size:13px">${esc(CREDITS.built)}</p>
      <p style="font-size:13px">This work is based on <a href="${CREDITS.modelLink}" target="_blank" rel="noopener">"BMW M3 E46"</a>
        by <a href="${CREDITS.authorLink}" target="_blank" rel="noopener">Lexyc16</a>
        licensed under <a href="${CREDITS.licenseLink}" target="_blank" rel="noopener">CC-BY-NC-4.0</a>.</p>`,
  };

  const SPEC_PANEL = (k) => {
    const s = CAR.specs.find((x) => x.k.toLowerCase() === k);
    return `<h2>${esc(s.v)}</h2><p class="kicker">${esc(s.k)}</p><p>${esc(s.note)}</p>
      <div class="btn-row"><button class="btn btn-ghost" data-act="go" data-to="bay">Whole bay</button></div>`;
  };

  function stationBlurb(s) {
    return {
      car: 'S54, Alpha-N, 317.27 hp',
      bay: 'Under the hood',
      bench: `Six on the bench`,
      wall: 'Columbia, UC Irvine, AERA 2025',
      dog: 'Robot dog on its dock',
      bike: 'Off the clock',
      exit: 'Contact and credits',
    }[s] || '';
  }

  function openPanel(name, detail) {
    let html;
    if (detail && detail.project) html = projectHTML(detail.project);
    else if (detail && detail.spec) html = SPEC_PANEL(detail.spec);
    else if (PANELS[name]) html = PANELS[name]();
    else return;
    panelBody.innerHTML = html;
    panel.classList.add('open');
    panel.scrollTop = 0;
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
    rig.shift = wideViewport() ? 0.20 : 0;
  }
  function closePanel() {
    if (panel.contains(document.activeElement)) {
      const cur = rail.querySelector('[aria-current="true"]');
      if (cur) cur.focus({ preventScroll: true });
    }
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    rig.shift = 0;
  }
  panel.inert = true;

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    shop.click();
    if (act === 'close') return closePanel();
    if (act === 'go') return goto(b.dataset.to);
    if (act === 'hood') return openHood();
    if (act === 'bench-index') { openPanel('bench'); benchShow(null); return; }
    if (act === 'project') {
      const p = PROJECTS.find((x) => x.id === b.dataset.id);
      if (!p) return;
      openPanel('bench', { project: p });
      benchShow(p);
      if (mode !== 'bench') goto('bench', { detail: { project: p } });
      return;
    }
    if (act === 'link') { window.open(b.dataset.href, '_blank', 'noopener'); return; }
  });

  let screenTimer = null;
  function benchScreen(tex) {
    const u = bench.screenMat.uniforms;
    u.tA.value = u.uProgress.value > 0.5 ? u.tB.value : u.tA.value;
    u.tB.value = tex;
    u.uProgress.value = 0;
    clearTimeout(screenTimer);
    /* Reduced motion gets the new pane outright. The wings already snap,
       so without this the browser would be the one thing in the corner
       still dissolving for anyone who asked the room to hold still. */
    if (reduced) { u.uProgress.value = 1; return; }
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 320);
      u.uProgress.value = k;
      if (k < 1) screenTimer = setTimeout(step, 16);
    };
    step();
  }

  /* One gesture, four panes: the browser crossfades to the build and the
     wings follow it, so picking a project changes the whole desk rather
     than one rectangle in the middle of it. Passing null means the index. */
  function benchShow(p) {
    benchScreen(p ? S.holoProject(p) : bench.index);
    bench.holo.sync(p);
  }

  /* --------------------------------------------------------- the hood */
  function openHood() {
    // still a toggle: shut it and step back, or let goto('bay') raise it
    if (hoodTarget > 0.5) { hoodTarget = 0; shop.clunk(0.42); goto('car'); return; }
    goto('bay');
  }

  /* ------------------------------------------------------------- hud */
  /* The hint is an instruction, and an instruction that has been followed
     is furniture. It goes a beat and a half after the first drag rather
     than on the first pixel of it, so it reads as confirmation instead of
     as something that fled when you touched it. */
  let hintGone = false, railTucked = false;
  function retireHint() {
    if (hintGone || !hint) return;
    hintGone = true;
    setTimeout(() => hint.classList.add('gone'), 1500);
  }
  /* The rail folds to its ticks once you have shown you can drive. Class
     only: the buttons keep their text, their order and their focusability,
     and CSS :focus-within opens it again for anyone arriving by keyboard. */
  function tuckRail() {
    if (railTucked || !rail) return;
    railTucked = true;
    rail.classList.add('tucked');
  }

  /* -------------------------------------------------------- pointer */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null, dragging = false, lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    lastX = e.clientX; lastY = e.clientY;
    dragging = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    pointerNdc.copy(ndc);
    /* Once the hint has been retired, its corner stays live: coming back
       to it brings it back. Cheap enough to do on every move — two
       comparisons against a box, no layout read. */
    if (hintGone) {
      hint.classList.toggle(
        'peek', e.clientX > innerWidth - 280 && e.clientY > innerHeight - 150);
    }
    if (!down) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) dragging = true;
    if (dragging) { rig.orbit(dx, dy); retireHint(); tuckRail(); }
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = dragging;
    down = null; dragging = false;
    // a click only counts if the pointer barely moved, so an orbit drag
    // that ends over a hotspot never fires it
    if (wasDrag) return;
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    pick();
  });
  canvas.addEventListener('pointercancel', () => { down = null; dragging = false; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); rig.zoom(e.deltaY); }, { passive: false });

  function pick() {
    if (buttonsLocked) return;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets, false);
    if (!hits.length) return;
    const id = hits[0].object.userData.hit;
    handle(id);
  }

  function handle(id) {
    // clicking a thing in the room counts as knowing how to drive too
    retireHint(); tuckRail();
    switch (id) {
      case 'horn': shop.horn(); flashPlate(); return;
      case 'lamp': lampsOn = !lampsOn; shop.click(0.22); return;
      case 'rev': shop.rev(); return;
      case 'lights': toggleNight(); return;
      case 'hood': shop.click(); return openHood();
      case 'car': shop.click(); return goto('car');
      case 'paper': shop.click(); return goto('wall', { panel: 'paper' });
      case 'spec-engine': shop.click(); return openPanel('bay', { spec: 'engine' });
      case 'spec-intake': shop.click(); return openPanel('bay', { spec: 'intake' });
      case 'spec-tune': shop.click(); return openPanel('bay', { spec: 'tune' });
      case 'bench':
        shop.click();
        if (mode === 'bench') { benchShow(null); openPanel('bench'); return; }
        return goto('bench');
      case 'dog':
        shop.click();
        dogHop = 1;
        return goto('dog');
      default:
        shop.click();
        return goto(id);
    }
  }

  let openerBlink = 0;
  function flashPlate() { openerBlink = 1.6; }

  function toggleNight() {
    nightMode = !nightMode;
    shop.click(0.4);
    shop.clunk(0.22);
    exit.rocker.position.y = 1.22 + (nightMode ? -0.02 : 0.02);
  }

  /* ------------------------------------------------------------- rail */
  rail.innerHTML = STATION_ORDER.map((s) =>
    `<button data-station="${s}" type="button">${POI[s].label}</button>`).join('');
  rail.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    shop.click();
    goto(b.dataset.station);
  });
  setStation('home');

  /* ------------------------------------------------------------ tools */
  const sndBtn = $('.tool-sound');
  sndBtn.addEventListener('click', () => {
    const on = shop.toggle();
    sndBtn.setAttribute('aria-pressed', String(on));
    sndBtn.textContent = on ? 'Sound on' : 'Sound off';
    if (on) shop.click();
  });
  const doc = $('#doc');
  function setReading(on, focusDoc) {
    document.body.classList.toggle('reading', on);
    $('.tool-read').setAttribute('aria-pressed', String(on));
    $('.tool-read').textContent = on ? 'Back to the garage' : 'Read as page';
    doc.inert = !on;
    if (on) {
      document.body.classList.remove('gl-on');
      closePanel();
      looping = false;
      if (focusDoc) { doc.setAttribute('tabindex', '-1'); doc.focus({ preventScroll: false }); }
    } else {
      document.body.classList.add('gl-on');
      boot.hidden = true;
      loop();
    }
  }
  $('.tool-read').addEventListener('click', () => { shop.click(); setReading(!document.body.classList.contains('reading'), true); });
  $('.hud-mark').addEventListener('click', (e) => { e.preventDefault(); setReading(true, true); });
  $('.skip').addEventListener('click', (e) => { e.preventDefault(); setReading(true, true); });
  $('.panel-close').addEventListener('click', () => { shop.click(); closePanel(); });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
    if (e.key === 'm' || e.key === 'M') sndBtn.click();
    if (e.key === 'h' || e.key === 'H') openHood();
    const i = STATION_ORDER.indexOf(rig.station);
    if (e.key === 'ArrowRight' && i >= 0) goto(STATION_ORDER[(i + 1) % STATION_ORDER.length]);
    if (e.key === 'ArrowLeft' && i >= 0) goto(STATION_ORDER[(i + STATION_ORDER.length - 1) % STATION_ORDER.length]);
  });
  addEventListener('visibilitychange', () => { if (document.hidden && shop.on) shop.disable(); });

  /* ------------------------------------------------------- perf ladder */
  /* Never show a weak machine an ugly version, only a simpler pretty one. */
  let tier = startTier, frames = 0, windowStart = performance.now();

  /* What a tier COSTS lives here; when we drop a tier still lives in
     checkPerf. One ladder: a second one that also decided which effects
     were on would disagree with this one the first time either changed.
     Written as "what is true at tier N" rather than as a list of things to
     switch off on the way down, so starting at tier 1 and falling to tier 1
     produce the same room. */
  let post = null;
  function applyTier() {
    // the mirrored car under the slab, and the slab going transparent to
    // show it: the most expensive thing in the room after the car itself
    mirror.visible = tier >= 3;
    room.floorMat.transparent = tier >= 3;
    room.floorMat.opacity = tier >= 3 ? 0.90 : 1;
    room.floorMat.needsUpdate = true;

    /* Real shadow at the top only, and the car's painted blob steps aside
       exactly when it lands: both at once reads as a double shadow, which
       is worse than either alone. Every other prop keeps its blob. */
    const wantShadow = tier >= 3 && SHADOWS;
    if (renderer.shadowMap.enabled !== wantShadow) {
      renderer.shadowMap.enabled = wantShadow;
      // switching the map on changes every program, so they all recompile
      scene.traverse((o) => {
        if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true;
      });
    }
    lights.cast.visible = wantShadow;
    car.shadow.visible = !wantShadow;

    renderer.setPixelRatio(
      tier >= 3 ? Math.min(2, devicePixelRatio || 1)
        : tier === 2 ? Math.min(1.5, devicePixelRatio || 1)
          : 1);

    /* The composer from tier 2 up. Below that the plain path has to still
       be a complete room, not a broken one: no composer means no bloom, so
       the angel eyes are carried by their own additive coronas, which is
       what they were built on before any of this existed. */
    const wantPost = tier >= 2 && POST_MODE !== '0' && Post;
    if (wantPost && !post) {
      post = POST_MODE === 'null'
        ? Post.buildPost(renderer, scene, camera, { bloom: false, vignette: false })
        : Post.buildPost(renderer, scene, camera);
    } else if (!wantPost && post) { post.dispose(); post = null; }
    if (post) post.setSize(innerWidth, innerHeight);

    // the strip tubes stay emissive, so the room still reads as lit
    if (tier === 0) car.bay.bulb.intensity = 0.9;
  }

  /* The one place anything is drawn. grab() calls this too: the moment a
     composer exists, a bare renderer.render is a different picture, and
     every screenshot-based check on this machine would be verifying a
     render path the site never uses. */
  function render() {
    if (post) post.render();
    else renderer.render(scene, camera);
  }

  function checkPerf(now) {
    frames++;
    if (now - windowStart < 4000) return;
    /* A window that ran long means rAF was not actually running for part
       of it — a hidden tab, the boot screen, a sleeping laptop. Judging
       it would punish the machine for time it never spent rendering, and
       the ladder never climbs back up, so one polluted window used to
       freeze every ambient machine for the rest of the session. */
    if (now - windowStart > 8000) { frames = 0; windowStart = now; return; }
    const fps = (frames * 1000) / (now - windowStart);
    frames = 0; windowStart = now;
    // a tier asked for by hand is a tier we keep, or ?q= could not hold a
    // screenshot still long enough to compare it with anything
    if (TIER_PINNED) return;
    const was = tier;
    if (fps < 40 && tier === 3) tier = 2;
    else if (fps < 30 && tier === 2) tier = 1;
    else if (fps < 20 && tier === 1) tier = 0;
    if (tier !== was) applyTier();
  }

  applyTier();

  /* --------------------------------------------------------- the loop */
  let last = performance.now();
  const clock = { t: 0 };

  function frame(now, forcedDt) {
    const dt = forcedDt != null ? forcedDt : Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.t += dt;

    hoodT = reduced ? hoodTarget : hoodT + (hoodTarget - hoodT) * (1 - Math.pow(0.002, dt));
    car.setHood(hoodT);
    hoodHit.position.y = 0.92 + hoodT * 0.34;

    lampT = reduced ? (lampsOn ? 1 : 0) : lampT + ((lampsOn ? 1 : 0) - lampT) * (1 - Math.pow(0.004, dt));
    for (const m of car.lights.head) {
      if (m.material && m.material.emissive) m.material.emissive.setRGB(lampT * 0.85, lampT * 0.9, lampT);
    }
    /* Angel eyes hold a low glow whether the lamps are on or not, the way
       sidelights do, and come all the way up with the switch. Without that
       floor the car has no face at all until you find the light pull. Both
       states are white: the blue weighting here was what made them read as
       ice rather than the neon in the photographs. */
    const ae = 0.46 + lampT * 0.54;
    car.lights.angel.ring.color.setRGB(ae, ae, ae);
    /* The corona is this car's only bloom, so it swings further than the
       core does — a ring that merely brightens looks painted on, one whose
       spill grows looks lit. It scales off the opacity it was built with
       rather than a literal, so retuning the sprite retunes both states. */
    for (const h of car.lights.angel.halos) {
      h.opacity = (h.userData.base ?? 0.4) * (0.34 + lampT * 0.66);
    }

    // night mode: the acceptable version of "the room changes"
    /* Every rig light eases toward its own pair of numbers, which live on
       the light itself in scene.js rather than being typed again here. The
       rim is the light through the door opening, so it goes down with the
       rest; left undimmed it became the brightest thing in the room after
       dark. The bench tungsten is the one that goes UP: after the ceiling
       is out it is the only light left, and the room should read as one
       warm island rather than as the same room with the gain pulled. */
    const nk = 1 - Math.pow(0.004, dt);
    for (const l of lights.rig) {
      const b = l.userData;
      l.intensity += (b.base * (nightMode ? b.night : 1) - l.intensity) * nk;
    }
    for (const s of room.strips) {
      const c = nightMode ? 0.09 : 1;
      s.tube.color.setRGB(0.874 * c + 0.02, 0.914 * c + 0.02, 1 * c + 0.02);
      s.halo.material.opacity = 0.20 * (nightMode ? 0.15 : 1);
    }

    /* The driveway loop on the airbox lid. Only while the bay is actually
       open, and held on its first frame under reduced motion. */
    bayHot = false;      // the bay only claims the cursor while it is open
    if (car.bay.group.visible) {
      car.bay.miniStep(reduced ? 0 : clock.t);

      /* The frames pick themselves up when the pointer finds them: they
         lift off the cam cover towards the eye, turn to face it and come
         up to full brightness. Held to 1.75x, and the travel scales with
         how far out the camera is, so it always clears the frames beside
         it without ever covering the bay. The lift is
         along the line to the camera, so a plate never swings out through
         the hood or the strut brace. */
      /* Only once the panel is properly up. Mid-swing the hood underside
         is still low over the bay, and a plate that has lifted 130mm
         towards the eye would go through it. */
      let hot = null;
      if (hoodT > 0.9) {
        ray.setFromCamera(pointerNdc, camera);
        const pick = ray.intersectObjects(car.bay.plateHits, false)[0];
        if (pick) hot = car.bay.plates[pick.object.userData.plateIndex];
      }
      car.bay.group.worldToLocal(camera.getWorldPosition(plateCam));
      const hk = reduced ? 1 : 1 - Math.pow(0.004, dt);
      for (const pl of car.bay.plates) {
        pl.hover += ((pl === hot ? 1 : 0) - pl.hover) * hk;
        if (pl.hover < 0.0008) {
          pl.group.position.copy(pl.rest);
          pl.group.quaternion.copy(pl.restQuat);
          pl.group.scale.setScalar(1);
          pl.face.material.color.setHex(0xbccfec);
          continue;
        }
        const k = pl.hover * pl.hover * (3 - 2 * pl.hover);       // smoothstep
        plateAim.position.copy(pl.rest);
        plateAim.lookAt(plateCam);
        /* Far enough towards the eye to clear the frames either side of it.
           At 0.055 the plate grew to 1.75x but only rose about 74mm, less
           than its own half-height once tilted, so it cut through its
           neighbours on the cam cover. Travelling towards the camera is not
           enough on its own either: from the low end of the cage that line
           is almost horizontal, so the plate stands up without rising and
           saws through them again. Hence the floor under the climb. */
        pl.group.position.copy(pl.rest).lerp(plateCam, k * 0.105);
        pl.group.position.z = Math.max(pl.group.position.z, pl.rest.z + k * 0.175);
        pl.group.quaternion.slerpQuaternions(pl.restQuat, plateAim.quaternion, k);
        pl.group.scale.setScalar(1 + k * 0.75);
        pl.face.material.color.setRGB(0.737 + k * 0.263, 0.812 + k * 0.188, 0.925 + k * 0.075);
      }
      bayHot = !!hot;
    }

    if (tier >= 2) dressing.blades.rotation.z -= dt * 7.4;
    /* The bench arc is always on, even when nobody is reading it. Below
       tier 2, or under reduced motion, the panes stay lit but hold
       perfectly still: no shimmer, no drift, no turntable. Crossfades
       still finish, because a half-changed pane is a bug, not a flourish. */
    bench.holo.step(clock.t, dt, tier >= 2 && !reduced);
    // sound the horn and the door opener notices, which is the whole point
    // of the Carbeetle project sitting on the ceiling above you
    if (openerBlink > 0) {
      openerBlink = Math.max(0, openerBlink - dt * 1.4);
      const on = Math.sin(openerBlink * 34) > 0;
      dressing.motorLed.material.color.setRGB(on ? 0.48 : 0.1, on ? 0.68 : 0.16, on ? 1 : 0.24);
    } else {
      dressing.motorLed.material.color.setRGB(0.56, 1, 0.69);
    }

    /* Iron Bark watches the cursor, and the rest of him follows the
       head: the body leans after it, the tail wags harder the closer the
       pointer gets, the ears come up, and clicking him makes him hop. */
    dog.head.getWorldPosition(headWorld);
    camera.getWorldDirection(viewDir);
    lookPlane.setFromNormalAndCoplanarPoint(viewDir.negate(), headWorld);
    lookRay.setFromCamera(pointerNdc, camera);

    /* Hover affordance, riding the ray Iron Bark's look-at just set from
       the pointer. A second raycast on pointermove would fire far more
       often than this and tell us the same thing: the pointer moves in
       bursts of a hundred events, the room only needs to know once a
       frame. Every third frame is still faster than anyone can notice a
       cursor change, and it keeps twenty box intersects off the other two.
       intersectPlane below does not mutate the ray, so this is free. */
    if (!(hoverTick = (hoverTick + 1) % 3) && !buttonsLocked) {
      const h = lookRay.intersectObjects(targets, false)[0];
      const id = h ? h.object.userData.hit : null;
      if (id !== hoverId) {
        setHover(hoverId, false);
        hoverId = id;
        setHover(hoverId, true);
      }
    }
    canvas.style.cursor = bayHot ? 'zoom-in' : (hoverId ? 'pointer' : '');
    let yaw = 0, pitchTgt = 0, near = 0;
    if (lookRay.ray.intersectPlane(lookPlane, lookAt)) {
      near = THREE.MathUtils.clamp(1 - lookAt.distanceTo(headWorld) / 1.1, 0, 1);
      dog.group.worldToLocal(lookAt);
      const hx = lookAt.x - dog.head.position.x;
      const hy = lookAt.y - dog.head.position.y;
      const hz = lookAt.z - dog.head.position.z;
      // clamped so he never cranes past what a neck could do
      yaw = THREE.MathUtils.clamp(Math.atan2(hx, Math.max(0.12, hz)), -0.72, 0.72);
      pitchTgt = THREE.MathUtils.clamp(-Math.atan2(hy, Math.hypot(hx, hz)), -0.34, 0.30);
    }
    const track = reduced ? 1 : 1 - Math.pow(0.02, dt);
    const slow = reduced ? 1 : 1 - Math.pow(0.08, dt);
    dog.head.rotation.y += (yaw - dog.head.rotation.y) * track;
    dog.head.rotation.x += (pitchTgt - dog.head.rotation.x) * track;
    dogPerk += (near - dogPerk) * slow;

    // the body swings after the head, but only about a third as far
    dog.rig.rotation.y += (yaw * 0.34 - dog.rig.rotation.y) * slow;
    dog.rig.rotation.z += (-yaw * 0.06 - dog.rig.rotation.z) * slow;
    // breathing, plus a hop that decays after a click
    dogHop = Math.max(0, dogHop - dt * 2.6);
    const breathe = Math.sin(clock.t * 1.7) * 0.006;
    dog.rig.position.y = breathe + Math.sin(dogHop * Math.PI) * 0.075;
    dog.rig.rotation.x = -dogPerk * 0.05 + Math.sin(clock.t * 1.7 + 1) * 0.004;

    // tail: faster and wider the closer the pointer gets
    const wag = clock.t * (3.4 + dogPerk * 9);
    dog.tail.rotation.y = Math.sin(wag) * (0.12 + dogPerk * 0.34);
    dog.tail.rotation.x = -0.45 - dogPerk * 0.28;
    dog.tail2.rotation.y = Math.sin(wag - 0.7) * (0.14 + dogPerk * 0.38);
    // ears up when he is paying attention
    for (const [i, ear] of dog.ears.entries()) {
      ear.rotation.x = 0.30 - dogPerk * 0.46;
      ear.rotation.z = (i ? 1 : -1) * (0.12 + dogPerk * 0.10);
    }
    /* Legs. Standing about he only shifts his weight, which you are meant
       to feel rather than see. Bring the pointer close and the front paws
       start lifting one after the other while the haunches settle: a play
       bow, the ask. A click tucks all four under him on the way up and
       reaches them back out to land. Rotating a leg always swings the foot
       up and away from the dock, so none of this can push him through it. */
    const hopK = reduced ? 0 : Math.sin(dogHop * Math.PI);
    const legK = reduced ? 1 : 1 - Math.pow(0.06, dt);
    for (const [i, leg] of dog.legs.entries()) {
      const front = i < 2;
      let fwd = 0, fold = 0;
      if (!reduced) {
        fwd = Math.sin(clock.t * 0.8 + i * 1.9) * 0.022;
        if (front) {
          const beat = Math.sin(clock.t * 3.1 + (i % 2 ? Math.PI : 0));
          const lift = Math.max(0, beat) * dogPerk;
          fwd += lift * 0.30; fold += lift * 0.34;
        } else {
          fwd -= dogPerk * 0.05; fold += dogPerk * 0.12;
        }
        fwd += hopK * (front ? 0.22 : -0.16);
        fold += hopK * 0.34;
      }
      leg.rotation.x += (-fwd - leg.rotation.x) * legK;
      dog.shins[i].rotation.x += (fold - dog.shins[i].rotation.x) * legK;
    }

    const blink = Math.sin(clock.t * 0.9) > 0.985 ? 0.15 : 1;
    const eyeUp = 1 + dogPerk * 0.45;
    dog.eyeMat.color.setRGB(
      Math.min(1, 0.56 * blink * eyeUp),
      Math.min(1, 0.75 * blink * eyeUp),
      Math.min(1, 1 * blink * eyeUp));

    /* the behavior board steps through the real state machine: a state a
       second, so the sequence reads as a machine ticking rather than a
       slideshow. The flash windows are scaled to the shorter step so the
       moment of arrival still lands instead of clipping. */
    if (tier >= 2) {
      const STEP = 1.0;
      boardT += dt;
      const phaseNow = Math.floor(boardT / STEP) % 4;
      const since = boardT - Math.floor(boardT / STEP) * STEP;
      const flashNow = since < 0.20 ? 1 : since < 0.36 ? 0.4 : 0;
      if (phaseNow !== boardPhase || flashNow !== boardFlash) {
        boardPhase = phaseNow; boardFlash = flashNow;
        S.drawBehavior(dog.board.canvas, boardPhase, boardFlash);
        dog.board.texture.needsUpdate = true;
      }
      const led = flashNow > 0.5 ? 1 : 0.55;
      dog.dockLed.material.color.setRGB(0.62 * led, 0.75 * led, 1 * led);
    }

    /* the field-test clip walks at the rate it was filmed. Under reduced
       motion it holds on the first frame, which is still a photograph of
       the robot rather than an empty frame. */
    if (tier >= 2 && !reduced) {
      filmT += dt;
      const n = Math.floor(filmT * dog.film.fps) % dog.film.count;
      if (n !== filmN) { filmN = n; dog.film.show(n); }
    }

    /* ---------------------------------------------- ambient machines */
    /* Held still on a weak machine and parked outright when the visitor
       has asked for less motion, in which case both sit in the pose they
       hold at t=0 rather than snapping to a second one. */
    if (tier >= 2 && !reduced) {
      const P = pup.sample(clock.t);
      const u = (P.s / pup.len) % 1;
      pup.curve.getPointAt(u, pupPos);
      pup.curve.getPointAt((P.s + 0.12) / pup.len % 1, pupAhead);
      pup.group.position.set(pupPos.x, 0, pupPos.z);

      /* He faces the way the ring is going. Reading the heading off a
         point a little further along rather than off the tangent means
         the turn is already rounded by the curve itself. */
      const want = Math.atan2(pupAhead.x - pupPos.x, pupAhead.z - pupPos.z);
      let d = want - pupYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      pupYaw += d * (1 - Math.pow(0.0009, dt));
      pup.group.rotation.y = pupYaw;

      /* Gait phase is distance travelled, not time, so the feet cannot
         outrun the floor however hard he is accelerating. */
      const gait = (P.s / pup.stride) * Math.PI * 2;
      const moving = Math.min(1, P.speed / pup.speed);
      const SWING = pup.swing * moving;
      for (let i = 0; i < pup.legs.length; i++) {
        const ph = gait + (i === 0 || i === 3 ? 0 : Math.PI);
        pup.legs[i].rotation.x = -Math.sin(ph) * SWING;
        // the knee only folds on the half of the cycle that swings
        // forward, which is what keeps the planted foot off the floor
        pup.shins[i].rotation.x = Math.max(0, Math.cos(ph)) * 0.34 * moving;
      }
      /* the body lifts by what the pendulum takes off the standing leg,
         so the planted foot holds its height instead of sinking */
      const bob = (0.302 * (1 - Math.cos(SWING))) * 0.5;
      /* Both idle terms only ever add height. A breath or a roll that can
         also subtract puts the standing foot a couple of millimetres into
         the concrete at the bottom of its cycle, and the roll is the
         larger of the two because it acts at the width of the stance. */
      pup.rig.position.y = bob * (1 - Math.cos(gait * 2)) * 0.5
        + (1 + Math.sin(clock.t * 1.9)) * 0.003;
      pup.rig.rotation.z = Math.sin(gait) * 0.022 * moving;

      /* Standing about, he looks around, and looks at you instead if you
         are close enough for it to land. */
      pup.head.getWorldPosition(pupHeadW);
      camera.getWorldPosition(pupCamW);
      /* eased rather than a threshold, or the ears would snap the moment
         the camera crossed a line on the floor */
      const nearNow = THREE.MathUtils.clamp(1 - (pupCamW.distanceTo(pupHeadW) - 1.6) / 1.8, 0, 1);
      pupNear += (nearNow - pupNear) * (1 - Math.pow(0.08, dt));
      let lookY = 0;
      if (P.hold > 0.12 && P.hold < 0.92) {
        if (pupNear > 0.5) {
          const bearing = Math.atan2(pupCamW.x - pupHeadW.x, pupCamW.z - pupHeadW.z);
          let rel = bearing - pupYaw;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          lookY = THREE.MathUtils.clamp(rel, -0.85, 0.85);
        } else if (P.look) {
          lookY = Math.sin(P.hold * Math.PI * 2) * 0.62;
        }
      }
      pupLook += (lookY - pupLook) * (1 - Math.pow(0.02, dt));
      pup.head.rotation.y = pupLook;
      pup.head.rotation.x = -Math.abs(pupLook) * 0.10 + Math.sin(clock.t * 1.9 + 1) * 0.010;

      /* The hello at the dock: tail up and going, and two small hops in
         the middle of the stop. Nothing that would put him on the dock. */
      /* The wag is integrated rather than read off clock.t directly. A
         rate that is multiplied by the clock jumps its whole phase the
         instant the rate changes, which after a few minutes of uptime is
         a tail that teleports. Accumulating it keeps it continuous. */
      pupGreet += (P.greet - pupGreet) * (1 - Math.pow(0.05, dt));
      pupWag += dt * (3.2 + pupGreet * 9);
      const wagK = 0.10 + pupGreet * 0.32 + moving * 0.10;
      pup.tail.rotation.y = Math.sin(pupWag) * wagK;
      pup.tail.rotation.x = -0.45 - pupGreet * 0.26;
      pup.tail2.rotation.y = Math.sin(pupWag - 0.7) * (wagK + 0.04);
      let hop = 0;
      if (P.greet && P.hold > 0.30 && P.hold < 0.66) {
        hop = Math.abs(Math.sin((P.hold - 0.30) / 0.36 * Math.PI * 2));
      }
      pup.rig.position.y += hop * 0.125;
      for (let i = 0; i < pup.ears.length; i++) {
        pup.ears[i].rotation.x = 0.30 - (pupGreet * 0.30 + pupNear * 0.18);
      }
      pup.shadow.scale.setScalar(1 - hop * 0.10);

      /* eyes: the same slow blink Iron Bark has, lifted a little at
         night so he does not simply vanish, but never lit like a lamp */
      const blink = Math.sin(clock.t * 0.9 + 2.1) > 0.985 ? 0.18 : 1;
      const eyeK = blink * (nightMode ? 1.22 : 1);
      pup.eyeMat.color.setRGB(
        Math.min(1, 0.56 * eyeK), Math.min(1, 0.75 * eyeK), Math.min(1, 1 * eyeK));

      /* ---- the arm ------------------------------------------------- */
      const at = clock.t % arm.period;
      let st = arm.steps[arm.steps.length - 1];
      for (let i = 0; i < arm.steps.length; i++) {
        if (at >= arm.steps[i].t0 && at < arm.steps[i].t1) { st = arm.steps[i]; break; }
      }
      const k = st.dur > 0 ? (at - st.t0) / st.dur : 1;
      const e = k * k * (3 - 2 * k);          // smoothstep, the same curve the bay plates use
      const mix = (a, b) => a + (b - a) * e;
      arm.yaw.rotation.y = mix(st.a.yaw, st.b.yaw);
      arm.shoulder.rotation.x = mix(st.a.sh, st.b.sh);
      arm.elbow.rotation.x = mix(st.a.el, st.b.el);
      arm.wrist.rotation.x = mix(st.a.wr, st.b.wr);
      arm.roll.rotation.y = mix(st.a.rl, st.b.rl);
      const open = mix(st.a.grip, st.b.grip);
      arm.fingers[0].position.x = -(0.023 + open * 0.011);
      arm.fingers[1].position.x = 0.023 + open * 0.011;

      /* The part rides the gripper by copying its transform outright,
         so there is no frame where the two disagree. The arm root only
         carries a translation, so the world orientation of the gripper
         is already the part's local one. */
      if (st.held) {
        arm.grip.getWorldPosition(gripW);
        arm.group.worldToLocal(gripW);
        arm.part.position.copy(gripW);
        arm.grip.getWorldQuaternion(arm.part.quaternion);
      } else {
        arm.part.position.copy(st.spot === 'b' ? arm.spotB : arm.spotA);
        arm.part.quaternion.identity();
      }
      /* the status light is green while it works and amber on the rests,
         which is the only thing on either machine that changes colour */
      const busy = st.rest ? 0 : 1;
      /* clamped per channel: letting the lift push green past 1 while red
         and blue still climb turns the dot white instead of brighter */
      const lm = nightMode ? 1.15 : 1;
      arm.led.material.color.setRGB(
        Math.min(1, (busy ? 0.56 : 1) * lm),
        Math.min(1, (busy ? 1 : 0.72) * lm),
        Math.min(1, (busy ? 0.69 : 0.32) * lm));

      /* ---- the drone ----------------------------------------------- */
      /* Offset a third of a lap so it is never in the same corner of the
         room as the pup on the first pass, and the two rings drift apart
         from there because their periods do not divide. */
      const D = drone.sample(clock.t + drone.period * 0.34);
      drone.curve.getPointAt((D.s / drone.len) % 1, dronePos);
      drone.curve.getPointAt((D.s + 0.10) / drone.len % 1, droneAhead);

      /* Station keeping. A quadcopter never holds a perfectly still
         point, and the two frequencies are deliberately not multiples so
         the wobble does not settle into an obvious loop. */
      const sway = Math.sin(clock.t * 1.13) * 0.018 + Math.sin(clock.t * 0.47 + 1.4) * 0.026;
      drone.group.position.set(dronePos.x, dronePos.y + sway, dronePos.z);

      const dWant = Math.atan2(droneAhead.x - dronePos.x, droneAhead.z - dronePos.z);
      if (droneYaw === null) droneYaw = dWant;      // no whip round on the first frame
      let dd = dWant - droneYaw;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      const dk = 1 - Math.pow(0.004, dt);
      const turned = dd * dk;                  // the yaw actually applied this frame
      droneYaw += turned;
      drone.group.rotation.y = droneYaw;

      /* It banks into the turn and noses down to accelerate, the way the
         real thing has to: a multirotor can only go where it leans. Both
         are read off how hard it is turning and how fast it is going,
         not animated by hand. Rate comes from the rotation applied, not
         from the error still outstanding: the error is about eleven
         times the per frame turn at this smoothing, so using it pinned
         the bank to its own limit through every corner. */
      const dMove = Math.min(1, D.speed / drone.speed);
      const yawRate = turned / Math.max(dt, 1e-4);
      const bankWant = THREE.MathUtils.clamp(-yawRate * 0.32, -0.40, 0.40);
      droneBank += (bankWant - droneBank) * Math.min(1, dt * 3.2);
      dronePitch += (dMove * 0.14 - dronePitch) * Math.min(1, dt * 2.4);
      drone.tilt.rotation.z = droneBank;
      drone.tilt.rotation.x = dronePitch + Math.sin(clock.t * 1.9) * 0.012;

      /* The shadow stays on the concrete and only tracks it in plan, and
         thins out the higher it climbs. */
      drone.shadow.position.set(dronePos.x, 0.005, dronePos.z);
      const alt = THREE.MathUtils.clamp(dronePos.y / drone.cruiseY, 0.4, 1.4);
      drone.shadow.scale.setScalar(0.86 + alt * 0.22);
      drone.shadow.material.opacity = 0.34 - alt * 0.10;
      /* discs fade up with throttle, so a hover reads slower than a dash */
      drone.discMat.opacity = 0.15 + dMove * 0.09;
      drone.led.material.color.setRGB(
        Math.min(1, 0.56 * (nightMode ? 1.2 : 1)),
        Math.min(1, 0.75 * (nightMode ? 1.2 : 1)),
        Math.min(1, 1 * (nightMode ? 1.2 : 1)));

      /* ---- the scan ------------------------------------------------- */
      /* A beam terminates on whatever it hits, so the first thing the
         sensor needs to know is its clearance: crossing the car, the
         floor is effectively a metre and a half closer. Eased rather
         than switched, or the beam would change length the instant the
         drone crossed the line of the bumper. This is also what keeps
         the scan off the car: the beam shortens to nothing much and the
         ground clutter fades out exactly when the drone is overhead, so
         the recognition frame has the moment to itself. */
      const scan = drone.scan;

      /* Whether the camera has hold of something, decided before the
         beam is placed rather than after it, because the answer is what
         the beam is for. Both triggers are pure functions of the sampled
         flight, so the moment is a place on the ring rather than a time
         on a clock and __exp.step lands on the same frame twice. */
      const iron = DRONE_SCANS[0], beetle = DRONE_SCANS[1];
      const du = (D.s / drone.len) % 1;
      let lock = null, lockK = 0;
      if (D.hold > 0 && D.stop === drone.route[iron.wp]) {
        lock = iron; lockK = D.hold;
      } else if (du >= beetle.u0 && du < beetle.u1) {
        lock = beetle; lockK = (du - beetle.u0) / (beetle.u1 - beetle.u0);
      }

      /* The swing itself is the one thing here allowed to remember the
         last frame, exactly as the bank and the floor already do: the
         trigger stays a place on the ring, the head just takes a few
         tenths of a second to get there and the same to come back. The
         target outlives the lock on purpose, so the release eases out
         still tracking rather than snapping to plumb the frame the
         brackets die. Smoothstepped on the way out because a bare
         accumulator eases out but leaves at full speed, and a gimbal
         that leaves at full speed reads as a cut. */
      if (lock) aimTarget = lock;
      scanAim += ((lock ? 1 : 0) - scanAim) * Math.min(1, dt * 6.0);
      const aimK = scanAim * scanAim * (3 - 2 * scanAim);

      const overCar = dronePos.x > carBox.min.x - 0.12 && dronePos.x < carBox.max.x + 0.12
                   && dronePos.z > carBox.min.z - 0.12 && dronePos.z < carBox.max.z + 0.12;
      scanFloor += ((overCar ? carBox.max.y : 0) - scanFloor) * Math.min(1, dt * 2.6);
      const clearance = Math.max(0.30, drone.group.position.y - scanFloor);
      /* how much of the beam is landing on open concrete: clear floor is the
         full two metres, and anything less than that is the car */
      const onFloor = THREE.MathUtils.clamp((clearance - 0.9) / 0.8, 0, 1);
      /* An aimed beam is landing on a target, so by the same measure none
         of it is on concrete. That one term is what carries the restraint
         through the whole recognition: it takes the footprint away, and it
         holds the beam to the brightness it already uses over something
         close rather than the brightness it uses over an open floor. Over
         the car the clearance had already taken this to nothing, so that
         moment is unchanged to the last bit; over Iron Bark's corner it
         had not, and a full floor scanning beam swung onto him at arm's
         length washed half the frame from inside his own cage. */
      const land = onFloor * (1 - aimK);

      /* The sensor is gimballed, so it lags the airframe rather than
         whipping with it: a third of the lean, which is enough to read
         as coupled and not enough to sling the footprint across the
         floor every time the drone rounds a corner. */
      const sTilt = droneBank * 0.34, sPitch = dronePitch * 0.34;
      scan.coneRig.position.set(drone.group.position.x,
                                drone.group.position.y - 0.030,
                                drone.group.position.z);
      qGround.setFromEuler(scanEuler.set(sPitch, 0, sTilt));
      qBeam.copy(qGround);

      /* Aiming. Recognising a car while the sensor goes on staring at the
         concrete is the fiction breaking at the one moment it matters, so
         through a lock the beam swings onto the middle of the same box the
         brackets frame and keeps swinging: the drone is still flying, and
         a beam that stays glued to a target while the platform moves past
         is the whole of what "looking" reads as. It stops where the box
         starts, and the spread angle is left alone, so a shorter throw is
         a narrower cone here for the same reason it is over the floor. */
      let reach = clearance;
      if (aimTarget && scanAim > 1e-4) {
        aimAt.set((aimTarget.min.x + aimTarget.max.x) / 2,
                  (aimTarget.min.y + aimTarget.max.y) / 2,
                  (aimTarget.min.z + aimTarget.max.z) / 2)
             .sub(scan.coneRig.position).normalize();
        qAim.setFromUnitVectors(DOWN, aimAt);
        qBeam.slerp(qAim, aimK);
        reach += (rayEntry(scan.coneRig.position, aimAt, aimTarget.min, aimTarget.max)
                  - clearance) * aimK;
      }
      scan.coneRig.quaternion.copy(qBeam);
      scan.cone.rotation.y = (clock.t * 0.5) % (Math.PI * 2);   // slow: the ribs read as live
      /* Scaled on all three axes, not just height. A beam has a fixed
         spread angle, so a shorter throw is a narrower cone, and the one
         that only stretched vertically went squat and wide over the car
         instead of tightening the way a real one does. */
      scan.cone.scale.set(reach * 0.5, reach, reach * 0.5);
      /* A beam has to survive as far as it claims to reach. Over concrete
         the tail is deliberately let go, because the footprint is what
         does the landing down there; on a target there is no footprint,
         and an emission that evaporates halfway is not terminating on
         anything. Sliding the sampled window up its own gradient keeps
         the brightest part exactly as bright and only declines to take
         the tail all the way to nothing, so what this is allowed to do
         to the paint is unchanged. */
      scan.coneMat.map.offset.y = 0.38 * aimK;
      scan.coneMat.map.repeat.y = 1 - 0.38 * aimK;

      /* The ball turns with the beam, because a sensor whose housing
         never moves is a sticker. What the yoke is handed is the swing
         itself, where the beam ended up against where it would have
         hung, carried back into the airframe's own frame, so it is
         exactly level whenever the beam is not aimed and cannot
         accumulate a lean of its own across a lap. */
      if (scanAim > 1e-4) {
        qTilt.copy(drone.group.quaternion).multiply(drone.tilt.quaternion);
        qTmp.copy(qGround).invert().premultiply(qBeam);   // the swing, in world
        drone.yoke.quaternion.copy(qYoke.copy(qTilt).invert().multiply(qTmp).multiply(qTilt));
      } else drone.yoke.quaternion.identity();
      drone.lensMat.color.copy(drone.lensDark).lerp(drone.lensLit, aimK);
      /* breathing, not blinking: the two rates are not multiples, so the
         beam never settles into an obvious loop */
      const breath = 0.86 + Math.sin(clock.t * 1.7) * 0.09 + Math.sin(clock.t * 0.63) * 0.05;
      scan.coneMat.opacity = (nightMode ? 0.30 : 0.22) * breath * (0.35 + land * 0.65);

      /* Where the tilted axis actually meets the floor, so the patch is
         somewhere the beam is pointing rather than dead under the hull. */
      scan.foot.position.set(dronePos.x + Math.tan(sTilt) * clearance,
                             0, dronePos.z - Math.tan(sPitch) * clearance);
      const spread = 0.42 + clearance * 0.30;
      scan.foot.scale.setScalar(spread);
      scan.gridMat.opacity = 0.16 * land;

      /* One ranging pulse every beat and a half, expanding and dying.
         Driven off the clock alone, so it is the same pulse on the same
         frame however the drone got there. The returns come back with
         it: the speckle rides the same envelope as the ring rather than
         sitting at a constant brightness, which is the difference
         between a floor that is being measured and a floor with a green
         pattern painted on it. */
      const beat = (clock.t / 1.6) % 1;
      const ping = Math.max(0, 1 - beat) * Math.min(1, beat * 7);
      scan.pulse.scale.setScalar(0.22 + beat * 0.95);
      scan.ringMat.opacity = 0.30 * land * ping;
      scan.cloudMat.opacity = 0.34 * land * (0.58 + 0.42 * ping);

      /* ---- recognition ---------------------------------------------- */
      scan.lock.visible = !!lock;
      if (lock) {
        /* The line walks the long axis of whatever it found, so the plane
           it rides is broadside to that walk and only as wide as the
           other side of the box. Sized off the target once, because a
           car and a robot dog are not going to change shape. */
        const sx = lock.max.x - lock.min.x, sz = lock.max.z - lock.min.z;
        const alongZ = sz >= sx;
        if (lock !== droneLock) {
          const first = !scan.labelMat.map;
          droneLock = lock;
          scan.fitBrackets(lock.min, lock.max);
          scan.labelMat.map = scan.labelFor(lock.label);
          // null to a texture is the one swap that needs a recompile
          if (first) scan.labelMat.needsUpdate = true;
          /* The label straddles whichever top corner the visitor is
             standing nearest, rather than a fixed one. Pinned to a fixed
             corner it hung off the far side of the car and got cropped
             to "TLE 0.91" from the engine bay; on the near corner it
             lands beside the thing it names from every wide station.
             Chosen once, when the lock latches, so it cannot pop from
             corner to corner while the moment is playing. */
          camera.getWorldPosition(scanCam);
          scan.label.position.set(
            Math.abs(scanCam.x - lock.min.x) < Math.abs(scanCam.x - lock.max.x)
              ? lock.min.x : lock.max.x,
            lock.max.y + 0.10,
            Math.abs(scanCam.z - lock.min.z) < Math.abs(scanCam.z - lock.max.z)
              ? lock.min.z : lock.max.z);
          scan.sweep.rotation.set(0, alongZ ? 0 : Math.PI / 2, 0);
          scan.sweep.scale.set((alongZ ? sx : sz) * 1.05,
                               (lock.max.y - lock.min.y) * 1.05, 1);
        }
        /* Latches quickly and lets go slowly, the way a detector does.
           Nothing in here reads a clock, so the whole moment replays. */
        const lift = Math.min(1, lockK / 0.10) * Math.min(1, (1 - lockK) / 0.26);
        scan.bracketMat.opacity = 0.85 * lift;
        scan.labelMat.opacity = 0.95 * lift;
        /* one pass through the middle of the hold, dead at both ends so
           the plane is never caught sitting still */
        const walk = THREE.MathUtils.clamp((lockK - 0.14) / 0.62, 0, 1);
        const lo = alongZ ? lock.min.z : lock.min.x;
        const hi = alongZ ? lock.max.z : lock.max.x;
        scan.sweep.position.set(
          (lock.min.x + lock.max.x) / 2, (lock.min.y + lock.max.y) / 2,
          (lock.min.z + lock.max.z) / 2);
        scan.sweep.position[alongZ ? 'z' : 'x'] = lo + (hi - lo) * walk;
        scan.sweepMat.opacity = 0.34 * lift * Math.sin(walk * Math.PI);
      } else droneLock = null;
    }
    pup.group.visible = tier >= 1;
    arm.group.visible = tier >= 1;
    drone.group.visible = tier >= 1;
    drone.shadow.visible = tier >= 1;
    /* The scan is gated exactly where its driver is, and unconditionally,
       so dropping a tier or asking for less motion cannot leave a beam
       lit on the last values it was handed. */
    drone.scan.root.visible = tier >= 2 && !reduced;
    /* The eye and its yoke are hardware, so they stay on screen when the
       scan is retired and have to be put back by hand: otherwise dropping
       a tier mid recognition parks the drone with its head cocked at
       something it can no longer see, lit green, for the rest of the
       session. */
    if (!drone.scan.root.visible && scanAim !== 0) {
      scanAim = 0;
      drone.yoke.quaternion.identity();
      drone.lensMat.color.copy(drone.lensDark);
    }

    rig.update(dt, now);
    render();
    checkPerf(now);
  }

  /* ------------------------------------------------------ the ceremony */
  setProgress(1);
  startBtn.hidden = false;
  startBtn.focus({ preventScroll: true });
  bootNote.textContent = 'One of the projects in this garage is the door opener.';

  let running = false;
  function begin() {
    if (running) return;
    running = true;
    shop.enable();
    sndBtn.setAttribute('aria-pressed', 'true');
    sndBtn.textContent = 'Sound on';
    document.body.classList.add('gl-on');
    doc.inert = true;
    boot.style.setProperty('--door', '1');
    shop.door(reduced ? 0.4 : 2.2);

    setTimeout(() => { boot.hidden = true; }, reduced ? 60 : 900);

    // the roller door in the room lifts with the loader door
    const t0 = performance.now();
    const lift = () => {
      const k = Math.min(1, (performance.now() - t0) / (reduced ? 1 : 2000));
      room.doorGroup.position.y = room.doorH * (k < 1 ? k * k * (3 - 2 * k) : 1);
      if (k < 1) requestAnimationFrame(lift);
      else shop.clunk(0.45);
    };
    lift();

    if (reduced || POSE === 'hero') {
      rig.jumpTo('home');
      mode = 'home';
    } else {
      // arrive from outside the door, the way you would walk in
      rig.tTarget.set(-0.28, 0.90, 1.6);
      rig.target.copy(rig.tTarget);
      rig.tAz = rig.az = 0.12; rig.tPol = rig.pol = 1.44; rig.tDist = rig.dist = 3.55;
      rig.apply(1);
      setTimeout(() => { goto('home', { force: true }); }, 700);
    }

    loop();
  }

  let looping = false;
  function loop() {
    if (looping) return;
    looping = true;
    const tick = (t) => {
      if (!looping) return;
      frame(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  startBtn.addEventListener('click', begin);

  /* The embedded preview pane freezes rAF because the document reports
     hidden. Real browsers animate; this hook lets a harness advance
     frames deterministically. */
  window.__exp = {
    step(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) frame(last + dt * 1000, dt);
    },
    begin, goto, openHood, handle, rig, scene, camera, renderer, car, shop, room,
    get mode() { return mode; },
    setNight(v) { nightMode = !!v; },
    setHood(v) { hoodT = hoodTarget = v; },
    setLamps(v) { lampsOn = !!v; lampT = v ? 1 : 0; },
    pause() { looping = false; },
    play() { loop(); },
    jump(name) { setStation(name); rig.jumpTo(name); mode = name; openPanel(name); },
    openDoor(k) { room.doorGroup.position.y = room.doorH * k; },
    panel: { open: openPanel, close: closePanel },
    ray,
    cursor(x, y) { pointerNdc.set(x, y); },
    get boardPhase() { return boardPhase; },
    get tier() { return tier; },
    get filmFrame() { return filmN; },
    get locked() { return buttonsLocked; },
    unlock() { buttonsLocked = false; },
    /* Read the drawing buffer straight back. Headless compositors on this
       machine hand out stale frames; this cannot. */
    grab(type) {
      render();
      return renderer.domElement.toDataURL(type || 'image/png', 0.93);
    },
    get post() { return post; },
    setTier(t) { tier = t; applyTier(); },
    ready: true,
  };

  if (document.hidden) {
    // paint one frame so a frozen pane is not a black rectangle
    rig.jumpTo('home');
    frame(performance.now(), 1 / 60);
  }
}
