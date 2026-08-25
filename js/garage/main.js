/* Brian's Garage: boot, state machine, input, and the wiring between the
   room and the DOM. One mode string gates every handler, exactly like a
   well-behaved kiosk: if the mode does not match, the click does nothing. */

import * as THREE from 'three';
import { buildRoom, buildLights, blobShadow } from './scene.js';
import { envTexture } from './paint.js';
import { loadCar } from './car.js';
import * as Props from './props.js';
import * as S from './screens.js';
import { Rig, POI, STATION_ORDER } from './camera.js';
import { Shop } from './audio.js';
import { CAR, PROJECTS, BAY_PROJECTS, PAPER, EXPERIENCE, EDUCATION, BIKE, DOG, PERSON, CREDITS } from './content.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const portrait = innerHeight > innerWidth;

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.environment = envTexture();

  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 60);
  const rig = new Rig(camera);

  const room = buildRoom(scene);
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

  const bench = Props.buildBench(scene);
  const wall = Props.buildWall(scene);
  const dog = Props.buildDog(scene);
  const bike = Props.buildBike(scene);
  const exit = Props.buildExit(scene);
  const dressing = Props.buildDressing(scene);
  Props.buildSign(scene, coarse);
  setProgress(0.92);

  /* ---------------------------------------------------------- picking */
  /* Invisible hitboxes larger than the thing they stand for, so a hotspot
     is easy to hit from any legal camera angle. */
  const targets = [];
  const addHit = (id, geo, pos, rot) => {
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
      targets.push(h.mesh);
    }
  }

  /* ------------------------------------------------------------ audio */
  const shop = new Shop();

  /* ------------------------------------------------------------- mode */
  let mode = 'boot';
  let buttonsLocked = false;
  let hoodT = 0, hoodTarget = 0;
  let lampsOn = false, lampT = 0;
  let nightMode = false;
  let headTargetX = 0, headTargetY = 0;

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
    if (name !== 'bay') hoodTarget = 0;
  }

  function arrive(name, opts) {
    mode = name;
    shop.chirp();
    openPanel(name, opts.detail);
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
      <p>Nothing here is a nav bar. The floor is painted with where things are, and anything that looks like it opens, opens. Start with the hood.</p>
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
      <p class="kicker">School, research, and four years of teaching.</p>
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
      bench: `${PROJECTS.length} builds`,
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
  }
  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    shop.click();
    if (act === 'close') return closePanel();
    if (act === 'go') return goto(b.dataset.to);
    if (act === 'hood') return openHood();
    if (act === 'bench-index') { openPanel('bench'); benchScreen(bench.index); return; }
    if (act === 'project') {
      const p = PROJECTS.find((x) => x.id === b.dataset.id);
      if (!p) return;
      openPanel('bench', { project: p });
      benchScreen(S.screenProject(p));
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
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 320);
      u.uProgress.value = k;
      if (k < 1) screenTimer = setTimeout(step, 16);
    };
    step();
  }

  /* --------------------------------------------------------- the hood */
  function openHood() {
    if (hoodTarget > 0.5) { hoodTarget = 0; shop.clunk(0.42); goto('car'); return; }
    hoodTarget = 1;
    shop.clunk();
    goto('bay');
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
    headTargetX = ndc.x; headTargetY = ndc.y;
    if (!down) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) dragging = true;
    if (dragging) rig.orbit(dx, dy);
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
    switch (id) {
      case 'horn': shop.horn(); flashPlate(); return;
      case 'lamp': lampsOn = !lampsOn; shop.click(0.22); return;
      case 'rev': shop.rev(); return;
      case 'lights': toggleNight(); return;
      case 'hood': shop.click(); return openHood();
      case 'car': shop.click(); return goto('car');
      case 'paper': shop.click(); return goto('wall', { detail: null }), openPanel('paper');
      case 'spec-engine': shop.click(); return openPanel('bay', { spec: 'engine' });
      case 'spec-intake': shop.click(); return openPanel('bay', { spec: 'intake' });
      case 'spec-tune': shop.click(); return openPanel('bay', { spec: 'tune' });
      case 'bench':
        shop.click();
        if (mode === 'bench') { benchScreen(bench.index); openPanel('bench'); return; }
        return goto('bench');
      default:
        shop.click();
        return goto(id);
    }
  }

  let plateFlash = 0;
  function flashPlate() { plateFlash = 1; }

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
  $('.tool-read').addEventListener('click', () => {
    document.body.classList.toggle('reading');
    const on = document.body.classList.contains('reading');
    $('.tool-read').setAttribute('aria-pressed', String(on));
    if (on) { document.body.classList.remove('gl-on'); closePanel(); }
    else document.body.classList.add('gl-on');
  });
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
  let tier = 3, frames = 0, windowStart = performance.now();
  function checkPerf(now) {
    frames++;
    if (now - windowStart < 4000) return;
    const fps = (frames * 1000) / (now - windowStart);
    frames = 0; windowStart = now;
    if (fps < 40 && tier === 3) {
      tier = 2; mirror.visible = false;
      room.floorMat.transparent = false; room.floorMat.opacity = 1;
    } else if (fps < 30 && tier === 2) {
      tier = 1;
    } else if (fps < 20 && tier === 1) {
      tier = 0;
      renderer.setPixelRatio(1);
      car.bay.bulb.intensity = 0.9;
      // the strip tubes stay emissive, so the room still reads as lit
    }
  }

  /* --------------------------------------------------------- the loop */
  let last = performance.now();
  const clock = { t: 0 };

  function frame(now, forcedDt) {
    const dt = forcedDt != null ? forcedDt : Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.t += dt;

    hoodT += (hoodTarget - hoodT) * (1 - Math.pow(0.002, dt));
    car.setHood(hoodT);
    hoodHit.position.y = 0.92 + hoodT * 0.34;

    lampT += ((lampsOn ? 1 : 0) - lampT) * (1 - Math.pow(0.004, dt));
    for (const m of car.lights.head) {
      if (m.material) m.material.emissive = m.material.emissive || new THREE.Color();
      if (m.material && m.material.emissive) {
        m.material.emissive.setRGB(lampT * 0.85, lampT * 0.9, lampT);
        m.material.emissiveIntensity = 1;
      }
    }

    // night mode: the acceptable version of "the room changes"
    const nk = 1 - Math.pow(0.004, dt);
    const want = nightMode ? 0.16 : 1;
    lights.key.intensity += (2.05 * want - lights.key.intensity) * nk;
    lights.hemi.intensity += (0.85 * (nightMode ? 0.3 : 1) - lights.hemi.intensity) * nk;
    lights.fill.intensity += (0.75 * (nightMode ? 0.55 : 1) - lights.fill.intensity) * nk;
    for (const s of room.strips) {
      const c = nightMode ? 0.09 : 1;
      s.tube.color.setRGB(0.874 * c + 0.02, 0.914 * c + 0.02, 1 * c + 0.02);
      s.halo.material.opacity = 0.20 * (nightMode ? 0.15 : 1);
    }

    if (tier >= 2) dressing.blades.rotation.z -= dt * 7.4;
    if (tier >= 2 && mode !== 'bench') {
      // the bench screen breathes while nobody is reading it
      bench.screenMat.uniforms.uTime.value = clock.t;
    }
    if (plateFlash > 0) {
      plateFlash = Math.max(0, plateFlash - dt * 1.6);
      dressing.motorLed.material.color.setRGB(1, 0.75 - plateFlash * 0.4, 0.35);
    } else {
      dressing.motorLed.material.color.setRGB(0.56, 1, 0.69);
    }

    // Iron Bark: one behavior, the head turns to the pointer
    const yaw = THREE.MathUtils.clamp(headTargetX * 0.7, -0.55, 0.55);
    const pitchTgt = THREE.MathUtils.clamp(-headTargetY * 0.35, -0.28, 0.30);
    dog.head.rotation.y += (yaw - dog.head.rotation.y) * (1 - Math.pow(0.02, dt));
    dog.head.rotation.x += (pitchTgt - dog.head.rotation.x) * (1 - Math.pow(0.02, dt));
    const blink = Math.sin(clock.t * 0.9) > 0.985 ? 0.15 : 1;
    dog.eyeMat.color.setRGB(0.56 * blink, 0.75 * blink, 1 * blink);

    rig.update(dt, now);
    renderer.render(scene, camera);
    checkPerf(now);
  }

  /* ------------------------------------------------------ the ceremony */
  setProgress(1);
  startBtn.hidden = false;
  startBtn.focus({ preventScroll: true });
  bootNote.textContent = 'The door opener is one of the projects. It seemed rude not to use it.';

  let running = false;
  function begin() {
    if (running) return;
    running = true;
    shop.enable();
    sndBtn.setAttribute('aria-pressed', 'true');
    sndBtn.textContent = 'Sound on';
    document.body.classList.add('gl-on');
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

    if (reduced) {
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
    /* Read the drawing buffer straight back. Headless compositors on this
       machine hand out stale frames; this cannot. */
    grab(type) {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL(type || 'image/png', 0.93);
    },
    ready: true,
  };

  if (document.hidden) {
    // paint one frame so a frozen pane is not a black rectangle
    rig.jumpTo('home');
    frame(performance.now(), 1 / 60);
  }
}
