/* Carbeetle.
   The glTF ships as one welded shell with no separate panels and no
   animations, so the hood is carved out of the body at load time (see
   geo-split.js) and everything under it is fabricated here: strut towers,
   an S54-shaped plenum with six velocity stacks, the airbox, braided
   lines. Abstract forms, no fake badges, lit to read as machinery. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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

const PAINT = 0x17255e;          // Interlagos Blue
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

  /* ---- environment ------------------------------------------------- */
  /* The room's scene.environment is a dim gradient with no floor and no
     horizon, which is the right light for the props and the wrong light
     for paint: it hands every panel the same value, so the sill reads as
     bright as the roof and the car goes flat. The car gets its own, with
     the range a photograph has (see carEnvTexture). scene.environment is
     left alone — the room is not being relit, the car is just no longer
     reflecting a room-sized softbox. */
  const carEnv = P.carEnvTexture();
  const envUsers = ['Material', 'Material.001', 'Material.002', 'Material.005',
                    'Material.006', 'Material.007', 'Material.008',
                    'wheel_metal.002', 'brake_disc', 'brake_disc1',
                    'rubber.001', 'mirror', 'material'];
  car.traverse((o) => {
    if (o.isMesh && o.material && envUsers.includes(o.material.name)) o.material.envMap = carEnv;
  });

  /* ---- paint ------------------------------------------------------- */
  /* GLTFLoader built this one as a MeshPhysicalMaterial — the glTF carries
     KHR_materials_clearcoat — so the clearcoat below is real and always
     has been. `body` and the carved hood share this material by reference,
     so tuning it here reaches both and the two cannot drift apart.

     Interlagos is a dark colour. The old 0x27427f was mid-blue and had to
     be, because the flat environment was doing no work; against an env
     with real range the albedo can sit down where the real paint sits and
     let the reflection supply every value above it. Most of the apparent
     brightness is the env now, so envMapIntensity comes a long way down
     with it: at 1.55 the car was a mirror with a hint of blue. */
  const body = pick('Material');
  const bodyMat = body.material;
  bodyMat.color.setHex(PAINT);
  bodyMat.metalness = 0.80;
  bodyMat.roughness = 0.30;
  bodyMat.clearcoat = 1.0;
  bodyMat.clearcoatRoughness = 0.04;
  bodyMat.envMapIntensity = 0.58;

  for (const m of ['Material.008', 'Material.002', 'Material.006', 'Material.007']) {
    const mesh = pick(m);
    if (mesh) { mesh.material.envMapIntensity = 1.1; mesh.material.roughness = Math.min(1, (mesh.material.roughness ?? .5) + 0.12); }
  }
  /* Material.001 is the brightwork: the kidney surrounds and their slats,
     and the window trim. It used to sit in the loop above at white /
     metalness 1 / env 1.1, which was fine against the room's dim gradient
     and is not fine against the car's own env — a mirror handed a brighter
     world got brighter with it, and the kidneys filled in as two solid
     white slabs. On the real car they read dark: you see the shadow
     between the slats, and the chrome is a bright edge around and along
     them, not a fill. Taking the mirror down restores that, and the window
     trim stays a thin bright line either way. */
  for (const c of all('Material.001')) {
    const m = c.material;
    m.color.setHex(0xa8b0ba);
    m.metalness = 1.0; m.roughness = 0.36; m.envMapIntensity = 0.38;
  }
  const glass = pick('Material.005');
  if (glass) {
    glass.material.color.setHex(0x0a0d13);
    glass.material.metalness = 0.0;
    glass.material.roughness = 0.08;
    glass.material.envMapIntensity = 2.2;
  }

  /* ---- wheels, tyres, brakes --------------------------------------- */
  /* The CSL wheels in the reference are satin, not chrome, and what sells
     them is that the pockets between the spokes go dark. They could not:
     the rim was white at 0.92/0.34 against a bright env, and behind it sat
     a near-white brake disc and a red mirror of a disc hat, both still on
     their glTF defaults. So the whole corner was one bright mass. Take the
     rim off white, roughen it until the lip is the brightest part of it
     again, and put the hardware behind it back in shadow. */
  for (const w of all('wheel_metal.002')) {
    const m = w.material;
    m.color.setHex(0x8f959d);
    m.metalness = 0.88; m.roughness = 0.46; m.envMapIntensity = 0.66;
  }
  /* Rotor faces stay metal so they still catch a turned-steel sheen, but
     dark enough to sit behind the spokes rather than glow through them. */
  for (const d of all('brake_disc')) {
    const m = d.material;
    m.color.setHex(0x565c63);
    m.metalness = 0.90; m.roughness = 0.38; m.envMapIntensity = 0.26;
  }
  /* brake_disc1 shipped as pure red at metalness 1, which rendered as a
     red mirror behind every spoke and was the single most toy-like thing
     on the car. It is the hat and the caliper body: near-black and rough. */
  for (const d of all('brake_disc1')) {
    const m = d.material;
    m.color.setHex(0x111316);
    m.metalness = 0.15; m.roughness = 0.92; m.envMapIntensity = 0.26;
  }
  /* Tyres came through at roughness 0.77, which is wet rubber. Keep the
     normal map — it carries the sidewall lettering and the tread. */
  for (const t of all('rubber.001')) {
    const m = t.material;
    m.color.setHex(0x0a0b0d);
    m.metalness = 0.0; m.roughness = 0.95; m.envMapIntensity = 0.35;
  }

  /* ---- exhaust ------------------------------------------------------ */
  /* The quad tips ('material') shipped as near-white chrome and lit up
     like four bulbs under a dark bumper. Burnt titanium instead — and
     burnt titanium is not a colour, it is thin-film interference on the
     oxide layer heat leaves behind, which is exactly what iridescence
     models. So the hue comes from the film, not from a hand-picked blue.

     With no iridescenceThicknessMap three uses the TOP of the range for
     the whole surface, so iridescenceThicknessRange[1] alone picks the
     hue, and it cycles fast: 200nm came out green, 280 magenta, 360 teal.
     150 lands on the blue band and leaves the bronze rim at the edge —
     the heat gradient running out — which is the detail that makes it
     read as burnt rather than painted. */
  for (const e of all('material')) {
    const m = e.material;
    m.color.setHex(0x223a63);
    m.metalness = 0.95; m.roughness = 0.30; m.envMapIntensity = 0.55;
    m.iridescence = 1.0;
    m.iridescenceIOR = 1.8;
    m.iridescenceThicknessRange = [100, 150];
  }

  /* ---- angel eyes -------------------------------------------------- */
  /* The corona rings are the whole face of an E46 and the model ships
     without them. Nothing here is guessed: headlight_led breaks into
     connected rims, one pair per round lamp, and each ring is fitted to the
     annulus those rims describe. That annulus is an ellipse, not a circle —
     0.0726 across by 0.0671 tall on the outer lamps — and the earlier
     circular torus split the difference, which is why its upper arc stood
     proud of the housing and pierced the fender skin at some angles. rz is
     held under the surround's own ceiling (0.7496 outer, 0.7517 inner) so
     the top of the ring cannot escape the lamp. The model's nose is not
     centred on x=0, so the two sides carry their own measured offsets
     rather than a mirrored pair. */
  const angelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const angelHalos = [];
  const angel = new THREE.Group();
  angel.name = 'angel-eyes';
  const haloMap = P.haloTexture();
  for (const L of [
    // outer, swept back into the fender
    { at: [-0.6512, -2.1635, 0.6801], rx: 0.0700, rz: 0.0640, glow: 0.052 },
    { at: [0.6040, -2.1635, 0.6801], rx: 0.0700, rz: 0.0640, glow: 0.052 },
    // inner, further forward
    { at: [-0.4795, -2.2495, 0.6855], rx: 0.0630, rz: 0.0610, glow: 0.017 },
    { at: [0.4323, -2.2495, 0.6855], rx: 0.0630, rz: 0.0610, glow: 0.017 },
  ]) {
    /* A fat tube reads as a chalky donut: at 0.0058 the cross-section shaded
       light-to-dark across its own width and the 44 segments showed as a
       polygon. Thin it until the core is a line and let the corona carry the
       neon. The torus is round and the lamp is not, so the ellipse comes
       from scale. */
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0032 / L.rx, 14, 128), angelMat);
    ring.position.set(L.at[0], L.at[1] - 0.006, L.at[2]);
    ring.scale.set(L.rx, L.rz, L.rx);
    ring.rotation.x = Math.PI / 2;                   // torus axis down the nose
    angel.add(ring);
    /* There is no bloom pass on this scene, so the corona is the bloom. One
       sprite, at exactly twice the ring radius: the texture puts its bright
       line at half its own radius, so at 2x it lands on the ring and spills
       a full ring-radius either side. A second, wider sprite was tried for
       the far spill and had to go — at 3.6x it was a 25cm disc that washed
       the hood and the fender in white. It sits forward of the projector;
       at the ring's own depth the outer lamp's lens ball masked the middle
       of the sprite and left a hollow annulus. */
    const halo = new THREE.Mesh(
      // a circle, not a square: the corners of the old plane were what
      // punched through the surround, not the sprite itself
      new THREE.CircleGeometry(L.rx * 2.0, 48),
      new THREE.MeshBasicMaterial({ map: haloMap, transparent: true, opacity: 0.52,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    halo.position.set(L.at[0], L.at[1] - L.glow, L.at[2]);
    halo.scale.set(1, L.rz / L.rx, 1);
    halo.rotation.x = Math.PI / 2;
    halo.renderOrder = 4;
    halo.material.userData.base = 0.52;
    angel.add(halo);
    angelHalos.push(halo.material);
  }
  body.parent.add(angel);

  /* ---- the lens cover ---------------------------------------------- */
  /* The cover was being driven emissive along with the bulbs, which lit the
     whole front of the lamp like a slab of plastic. It is glass. But nearly
     clear at 0.15 it stopped being anything at all: the lamp read as a unit
     with its cover off, internals in open air. Glass earns its presence
     through reflection, and alpha cannot do that on its own — raising
     opacity only veils what is behind it, which is the frosting failure.
     So the pane is split in two: a thin dark body for depth, and an
     additive metal skin over it carrying the environment. Additive never
     veils, so the sheen composites over the halos instead of dimming them,
     and the strip lights sweep across the whole face as you walk round. */
  const hlGlass = pick('headlight_glass');
  if (hlGlass) {
    const g = hlGlass.material;
    g.color.setHex(0x0d141d);
    g.transparent = true; g.opacity = 0.17; g.depthWrite = false;
    g.roughness = 0.02; g.metalness = 0.0; g.envMapIntensity = 4.6;
    g.clearcoat = 1.0; g.clearcoatRoughness = 0.03;
    g.side = THREE.FrontSide;      // a double-sided pane tints twice
    if (g.emissive) g.emissive.setRGB(0, 0, 0);
    hlGlass.renderOrder = 12;

    const sheen = hlGlass.clone();
    sheen.name = 'headlight-sheen';
    const sm = g.clone();
    sm.color.setHex(0x5d6b7e);     // how much of the room the pane hands back
    sm.metalness = 1.0; sm.roughness = 0.075; sm.envMapIntensity = 1.35;
    sm.opacity = 1; sm.transparent = true; sm.blending = THREE.AdditiveBlending;
    sm.depthWrite = false; sm.clearcoat = 0;
    sheen.material = sm;
    sheen.renderOrder = 13;
    hlGlass.parent.add(sheen);
  }

  /* ---- turn signals ------------------------------------------------ */
  /* The corner section was the most obviously disassembled thing on the car:
     headlight_chrome's facets were left mirror-raw and read as crumpled
     foil, with the two bulb cones behind them standing out black against it,
     and blinker_glass — which ships its own ribbed normal map — was so close
     to clear at 0.25 that there was no lens over any of it. Give the lens
     back its body and the facets go quiet behind it. */
  const blinker = all('blinker_glass');
  for (const b of blinker) {
    const m = b.material;
    m.color.setHex(0xe0dcd6);      // frosted clear, a shade warm
    m.transparent = true; m.opacity = 0.60; m.depthWrite = false;
    m.roughness = 0.30; m.metalness = 0.0; m.envMapIntensity = 1.9;
    m.clearcoat = 1.0; m.clearcoatRoughness = 0.18;
    m.side = THREE.FrontSide;
    if (m.normalScale) m.normalScale.set(1.7, 1.7);   // let the ribs read
    b.renderOrder = 11;
  }
  /* headlight_chrome is only ever lamp internals — the two reflector bowls,
     the blinker facets and the side-marker facets — so softening it here
     costs no trim anywhere else on the car. Satin rather than mirror: it
     still catches a bright rim where it curves toward you, but it stops
     handing back a sharp picture of the ceiling strips. */
  for (const c of all('headlight_chrome')) {
    const m = c.material;
    m.color.setHex(0x646c7a);
    m.metalness = 0.88; m.roughness = 0.60; m.envMapIntensity = 0.68;
  }
  /* The two bulb cones behind each signal lens. They are their own six-vertex
     pieces of headlight_chrome, sitting on the face of the faceted dish and
     pointing at the viewer, and no lens treatment hides them — muted they
     stopped being black hardware and started being a brown lump. Nothing on
     the real car pokes out here, so they go. The predicate is narrow enough
     to leave the side-marker pieces (|x| 0.925) and the dish itself alone. */
  for (const c of all('headlight_chrome')) {
    dropParts(c.geometry, (n, size, mid) => !(
      n <= 6 && size.every((d) => d < 0.09) &&
      Math.abs(mid[0]) > 0.70 && Math.abs(mid[0]) < 0.83));
  }
  /* The amber bulb behind each signal lens, which is all you ever see of
     one in daylight. Warm, small, and always on — an unlit signal on a
     parked car still catches a little of the room.

     This was a bare additive disc and it read as a smudge hovering off the
     corner of the car. Two reasons, both fixed here. It was too big and
     too far outboard: r 0.038 centred at x -0.818 reaches -0.856, while
     the lens itself stops at -0.8418, so a third of the glow hung past the
     lens edge over bodywork and background with nothing to sit on. And a
     glow alone has no source — the reference car shows a discrete little
     bulb behind the ribs, with an edge and a lit side, not a soft blob.

     So: an actual bulb, with a tight corona around it rather than instead
     of it, and both placed against the lens surface rather than its
     bounding box. That distinction is the whole fix. blinker_glass is not
     a flat panel — it wraps about 0.09 rearward toward the outboard end,
     from y -2.2194 at the inboard edge to -2.1259 at the outboard one, so
     a fixed y that sits inside the box still comes out through the glass
     at the corner. These sit at the second bin in from the inboard edge,
     where the lens spans y -2.1914..-2.1543, and at y -2.150 they are
     behind all of it while staying forward of the dish that would mask
     them, the trap the coronas fell into. blinker_glass draws at
     renderOrder 11 and these at 6 and 7, so the ribs read over them the
     way they do on the real lamp.

     The two sides are not mirrored: this model's nose centreline is at
     x -0.0236, so the right bulb is -0.0472 minus the left, not its
     negation. */
  const blinkGlow = P.glowTexture('#ffd9a0', '255,196,120', '255,170,90');
  /* Muted on purpose: the signal is off. Bright enough to read as amber
     glass through the ribs, dim enough not to look like it is flashing. */
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x9c6530, emissive: 0xc9691f, emissiveIntensity: 0.30,
    roughness: 0.55, metalness: 0.0,
  });
  for (const at of [[-0.7450, -2.1500, 0.6760], [0.6980, -2.1500, 0.6760]]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 12, 10), bulbMat);
    bulb.position.set(at[0], at[1], at[2]);
    bulb.renderOrder = 6;
    angel.add(bulb);

    // co-located with the bulb, so the corona can never lead it out of the
    // housing the way a disc set in front of it did
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 24),
      new THREE.MeshBasicMaterial({ map: blinkGlow, transparent: true, opacity: 0.20,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    dot.position.set(at[0], at[1], at[2]);
    dot.rotation.x = Math.PI / 2;
    dot.renderOrder = 7;
    angel.add(dot);
  }

  /* ---- lamp interior ----------------------------------------------- */
  /* The projector ships with baseColorFactor [0,0,0,1], which rendered it as
     a flat black ball filling the middle of the outer lamp. The real one is
     a clear glass dome you look straight through to the reflector behind it,
     holding a hard specular and a bright rim. The same material is also the
     small stub in the inner lamp, which was reading as a dark speck for
     exactly the same reason and clears up with it. */
  for (const l of all('headlight_lens')) {
    const m = l.material;
    m.color.setHex(0xcddbec);
    m.transparent = true; m.opacity = 0.17; m.depthWrite = false;
    m.metalness = 0.0; m.roughness = 0.045; m.envMapIntensity = 3.4;
    m.clearcoat = 1.0; m.clearcoatRoughness = 0.03;
    m.side = THREE.FrontSide;
    l.renderOrder = 8;               // behind the cover, in front of the bowl
  }
  for (const h of all('headlight_plastic')) {
    const m = h.material;
    m.roughness = Math.max(0.45, m.roughness ?? 0.33);   // housing, not trim
    m.envMapIntensity = 0.55;
  }

  /* CARBEETLE plate. The car has a name, so it gets its name.
     The model hangs a full-width slab across the nose, 0.548 by 0.134, which
     is four times as long as it is tall and covers the whole bumper mouth.
     The real car runs a short tow-hook bracket plate tucked to one side, so
     the front plate is squeezed to a plate-shaped 2:1 and slid outboard.
     Material.029 carries the rear plate in the same geometry, so only the
     vertices ahead of the axle move; the nose sits at -y. */
  const plate = pick('Material.029');
  if (plate) {
    /* Both plates share one mesh and one material, so reshaping the front one
       alone means splitting them: the rear keeps the full-width recess it was
       modelled for, and stretching a short plate's texture across it left the
       name two ends wide. Each gets a mesh, and a texture cut to its own
       proportion. */
    const front = new THREE.Mesh(plate.geometry.clone(), new THREE.MeshStandardMaterial({
      map: plateTexture(2), roughness: 0.55, metalness: 0.1,
    }));
    front.name = 'front-plate';
    front.frustumCulled = false;
    keepPlate(front.geometry, 'front');
    shiftFrontPlate(front.geometry, { cx: -0.0243, scale: 0.489, dx: -0.352, dz: -0.048 });
    plate.parent.add(front);

    keepPlate(plate.geometry, 'rear');
    plate.material = new THREE.MeshStandardMaterial({
      map: plateTexture(4), roughness: 0.55, metalness: 0.1,
    });
  }

  /* Moving the plate off-centre exposed what it had been hiding: the bumper
     carries a raised mounting pad, a shallow box the exact size of the old
     plate, standing 27mm proud of the skin. No M3 bumper has one, and with
     the plate gone it read as a blue rectangle stuck to the nose.
     It is two pieces, and neither is bumper skin: a 54-vertex box, and the
     flat 14-vertex panel it stands on, which bridges the air intake behind
     it. Both go, and the intake becomes the single opening the real bumper
     has. Two gentler fixes were tried first and both left a mark. Collapsing
     the box onto the panel put the two coplanar, which z-fought into a
     speckled lip along the top of the intake; cutting only the box left the
     panel reading as a bright flat strip bridging the same place. Nothing
     shows through once they are gone — the intake was already open behind
     them. Runs before the hood carve so the cut survives the re-index. */
  dropParts(body.geometry, (n, size, mid) => !(
    n <= 60 && size[0] > 0.40 && size[0] < 0.70 && size[1] < 0.050 &&
    size[2] > 0.05 && size[2] < 0.15 &&
    mid[1] < -2.42 && Math.abs(mid[0]) < 0.10));

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

  /* The body shell is not the only mesh with hood-side geometry, and the
     slotted cowl vent is the piece that gives it away: the exporter welded
     that grille into the glass mesh, Material.005, so every earlier attempt
     at it split Material.008 and moved a 36-vertex trim strip while the
     vent stayed bolted to the car and hung over the open bay like a shelf.
     Both meshes already fall inside the cut planes above, so splitting them
     there sends each piece up with the panel it is set into. */
  for (const name of ['Material.005', 'Material.008']) {
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
     matte painted underside for the panel to show when it is up. */
  const underGeo = split.inside.clone();
  flipGeometry(underGeo);
  const under = new THREE.Mesh(underGeo, new THREE.MeshStandardMaterial({
    color: 0x1e232b, roughness: 0.86, metalness: 0.10,
  }));
  under.position.z = -0.012;
  under.frustumCulled = false;
  hinge.add(under);

  /* Sound deadening, and nothing else. The dyno number used to be taped
     here; it moved into the bay itself, where the work actually happened. */
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 0.86),
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.96, metalness: 0.02 })
  );
  pad.position.set(0, -1.80 - HOOD.yBack, 0.845 - HINGE_Z);
  pad.rotation.x = Math.PI + 0.20;
  hinge.add(pad);

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
      head: [pick('headlight_led')].filter(Boolean),
      angel: { ring: angelMat, halos: angelHalos },
      tail: [pick('taillight'), pick('taillight_glass')].filter(Boolean),
    },
    setHood(t) {                              // t: 0 shut, 1 fully open
      hinge.rotation.x = HOOD_OPEN * t;
      rod.visible = t > 0.55;
      bay.group.visible = t > 0.02;
    },
  };
}

/* Delete whole connected pieces of a mesh without touching the rest of it.
   Only the index buffer is rewritten; the orphaned vertices cost nothing and
   rebuilding the attributes for four cones would cost more than they save. */
function dropParts(geo, keep) {
  const idx = geo.index, pos = geo.attributes.position;
  const par = new Int32Array(pos.count);
  for (let i = 0; i < par.length; i++) par[i] = i;
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < idx.count; t += 3) {
    const a = find(idx.getX(t));
    for (let k = 1; k < 3; k++) { const b = find(idx.getX(t + k)); if (a !== b) par[b] = a; }
  }
  const box = new Map();                      // root -> running bounds
  for (let t = 0; t < idx.count; t += 3) {
    const r = find(idx.getX(t));
    let b = box.get(r);
    if (!b) box.set(r, b = { n: new Set(), lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] });
    for (let k = 0; k < 3; k++) {
      const v = idx.getX(t + k);
      b.n.add(v);
      const p = [pos.getX(v), pos.getY(v), pos.getZ(v)];
      for (let d = 0; d < 3; d++) { if (p[d] < b.lo[d]) b.lo[d] = p[d]; if (p[d] > b.hi[d]) b.hi[d] = p[d]; }
    }
  }
  const cut = new Set();
  for (const [r, b] of box) {
    const size = [0, 1, 2].map((d) => b.hi[d] - b.lo[d]);
    const mid = [0, 1, 2].map((d) => (b.hi[d] + b.lo[d]) / 2);
    if (!keep(b.n.size, size, mid)) cut.add(r);
  }
  if (!cut.size) return 0;
  const out = [];
  for (let t = 0; t < idx.count; t += 3) {
    if (cut.has(find(idx.getX(t)))) continue;
    out.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  }
  geo.setIndex(out);
  return cut.size;
}

/* Drop every triangle belonging to the other plate. The nose sits at -y, so
   the sign of a triangle's first vertex is enough to tell the two apart. */
function keepPlate(geo, which) {
  const idx = geo.index, pos = geo.attributes.position;
  const want = which === 'front';
  const out = [];
  for (let t = 0; t < idx.count; t += 3) {
    if ((pos.getY(idx.getX(t)) < 0) !== want) continue;
    out.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  }
  geo.setIndex(out);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

/* Squeeze and slide the front number plate. Everything at negative y is the
   front; the rear plate is a separate mesh by the time this runs. */
function shiftFrontPlate(geo, { cx, scale, dx, dz }) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) continue;                 // rear plate, leave it be
    pos.setX(i, (pos.getX(i) - cx) * scale + cx + dx);
    pos.setZ(i, pos.getZ(i) + dz);
  }
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
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
     carbon airbox beside it with its snorkel off the nose end, and a
     black canister in the driver's-side corner. Almost all of it is black; the metal is an accent. */
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

  /* ---- the Carbeetle frames, mounted on the engine ------------------ */
  /* Three stills from the project the car is named after, fixed to the
     two flat lids you can actually see down into: two on the cam cover,
     one on the airbox. Lying in the surface rather than hovering over it
     is the whole point, so they are plates, not billboards. Unlit, and
     pulled towards the room's blue: three daylight frames at full
     strength turn the bay into a lightbox and the engine stops being the
     thing you are looking at. */
  const texLoader = new THREE.TextureLoader();
  /* A glowing border for each frame: a rounded rectangle stroked three times
     with its own bloom on an otherwise transparent panel. A soft blob behind
     the picture only ever read as a white sheet laid under it; an edge that
     lights up reads as a screen. Drawn at the frame's own aspect so the
     corners stay round and the stroke stays even on all four sides. */
  const frameGlow = (aspect) => {
    const { c, x, w, h } = P.canvas(320, Math.round(320 / aspect));
    x.clearRect(0, 0, w, h);
    const mx = w * 0.0625, my = h * 0.0625, r = Math.min(w, h) * 0.05;
    const edge = () => {
      x.beginPath();
      x.moveTo(mx + r, my);
      x.arcTo(w - mx, my, w - mx, h - my, r);
      x.arcTo(w - mx, h - my, mx, h - my, r);
      x.arcTo(mx, h - my, mx, my, r);
      x.arcTo(mx, my, w - mx, my, r);
      x.closePath();
    };
    x.strokeStyle = '#e2eeff';
    x.shadowColor = '#79abff';
    x.lineWidth = Math.min(w, h) * 0.034;
    for (const blur of [30, 15, 5]) { x.shadowBlur = blur; edge(); x.stroke(); }
    return P.toTexture(c);
  };
  const GLOW_OUT = 1 / (1 - 2 * 0.0625);   // lands the stroke on the picture's edge
  const plates = [];                       // for the pointer to pick up and lift

  const photoPlate = (src, aspect, w, pos) => {
    const h = w / aspect;
    const grp = new THREE.Group();
    grp.position.set(pos[0], pos[1], pos[2]);
    g.add(grp);
    // a thin dark mount, so the picture has a crisp edge against the casting
    const bezel = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.013, h + 0.013),
      new THREE.MeshBasicMaterial({ color: 0x0d1016 })
    );
    bezel.position.z = 0.0015;
    grp.add(bezel);
    const tex = texLoader.load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xbccfec })
    );
    face.position.z = 0.0028;
    grp.add(face);
    // the border last and in front, so it burns over the picture's own edge
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * GLOW_OUT, h * GLOW_OUT),
      new THREE.MeshBasicMaterial({ map: frameGlow(aspect), transparent: true,
                                    depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.position.z = 0.0042;
    grp.add(glow);
    /* Rest pose is kept here rather than read back later: once the pointer
       starts moving the group, its own transform is no longer the truth
       about where it belongs. */
    const plate = {
      group: grp, face, glow, hover: 0,
      rest: grp.position.clone(), restQuat: grp.quaternion.clone(),
    };
    /* An index, not the object: three.js deep-copies userData through
       JSON, and a back-reference to the plate closes a circle through its
       own group and kills the whole scene on the first Object3D.copy(). */
    face.userData.plateIndex = plates.length;
    plates.push(plate);
    return plate;
  };
  // the two on the cam cover, and the y band each one covers, so the ribs
  // underneath can step around them instead of embossing straight through
  const CAM_TOP = FLOOR_Z + 0.3525;   // ribs sit at 0.354, 16mm tall
  /* All three live here now. Narrowed to 215mm so the stack of glowing
     borders fits the 800mm lid end to end with room off the M stripes. */
  const COVER_PLATES = [
    { src: 'img/photo/carbeetle-detect-900.jpg', aspect: 900 / 667, w: 0.215, y: -1.908 },
    { src: 'img/photo/carbeetle-rig-800.jpg',    aspect: 800 / 551, w: 0.215, y: -1.733 },
    { src: 'img/photo/carbeetle-door-700.jpg',   aspect: 700 / 591, w: 0.215, y: -1.544 },
  ];
  const coverBands = COVER_PLATES.map((c) => [c.y - c.w / c.aspect / 2 - 0.020,
                                              c.y + c.w / c.aspect / 2 + 0.020]);

  /* ---- cam cover down the middle ---------------------------------- */
  /* Both stop short of the slam panel now. At 0.84 and 0.80 the block ran
     out through the nose liner into the car's own bodywork, and the cover
     buried its front end in the radiator. */
  const block = box(0.56, 0.745, 0.24, [-0.02, -1.6725, FLOOR_Z + 0.12], plasticBlack);
  block.name = 'block';
  const cam = box(0.28, 0.71, 0.115, [-0.14, -1.675, FLOOR_Z + 0.295], engineBlack);
  cam.name = 'cam-cover';
  for (let i = 0; i < 13; i++) {
    const y = -1.36 - i * 0.052;
    if (coverBands.some(([a, b]) => y > a && y < b)) continue;   // a plate sits here
    box(0.245, 0.024, 0.016, [-0.14, y, FLOOR_Z + 0.354], engineBlack);
  }
  for (const c of COVER_PLATES) photoPlate(c.src, c.aspect, c.w, [-0.14, c.y, CAM_TOP + 0.0085]);
  // the M colours, as a painted accent rather than a badge
  [0x3f7fbe, 0x1b3268, 0x9c2b33].forEach((hex, i) => {
    box(0.022, 0.052, 0.003, [-0.196 + i * 0.024, -1.998, FLOOR_Z + 0.3555],
      new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.05 }));
  });
  // coil packs sitting in a row along the cover
  for (let i = 0; i < 6; i++) {
    box(0.055, 0.055, 0.045, [0.015, -1.42 - i * 0.100, FLOOR_Z + 0.33], plasticBlack);
  }

  /* ---- throttle bodies and the carbon plenum ----------------------- */
  const casting = new THREE.MeshStandardMaterial({ color: 0x4a5158, roughness: 0.55, metalness: 0.7 });
  for (let i = 0; i < 6; i++) {
    const y = -1.46 - i * 0.100;
    drum(0.036, 0.085, [0.16, y, FLOOR_Z + 0.235], casting);
    drum(0.020, 0.045, [0.16, y, FLOOR_Z + 0.295], plasticBlack);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.58, 8), casting);
  rail.position.set(0.205, -1.70, FLOOR_Z + 0.285);
  g.add(rail);

  /* A carbon airbox is a box. It was a capsule here, which read as a
     length of pipe lying on the engine; squared off it looks like the
     part it is, and its lid becomes somewhere to put the third frame.
     Widened since, and pulled 100mm shorter: at 0.90 it ran straight
     through the nose liner. */
  /* Moved 55mm inboard as well. With the hood up, the camera cage only
     ever sees the bay's nose-outboard corner past the raised panel, so
     anything hung off the airbox out there is cut in half by the hood;
     sliding the box left opens visible floor for the snorkel to run in. */
  const AIR_X = 0.245, AIR_W = 0.285, AIR_H = 0.150;
  const AIR_TOP = FLOOR_Z + 0.383;                 // lid height is what is fixed
  const AIR_Z = AIR_TOP - AIR_H / 2;
  const plenum = new THREE.Mesh(new RoundedBoxGeometry(AIR_W, 0.64, AIR_H, 3, 0.020), carbon);
  plenum.position.set(AIR_X, -1.64, AIR_Z);
  plenum.name = 'plenum';
  g.add(plenum);
  hotspots.push({ id: 'spec-engine', at: new THREE.Vector3(0.10, -1.72, FLOOR_Z + 0.38), r: 0.30 });

  /* ---- the snorkel, off the nose end of the airbox ------------------ */
  /* On the real car the carbon tube leaves the end of the box and turns
     down and outboard for the nose. This used to hang off a second carbon
     box that the widened airbox then grew into, so the two interpenetrated
     and the tube read as a loose pipe lying alongside. It now starts
     inside the airbox itself, at the centre of its end face, and there is
     only one carbon assembly to read. */
  /* The reference car's snorkel is not a hose. It is a broad flattened
     carbon duct, about twice as wide as it is deep, that leaves the nose
     end of the airbox and drops almost straight down to the floor of the
     bay, flaring at the mouth. Extruding a rounded rectangle along the
     drop gives that section; a round tube read as a radiator hose. The
     run is boxed in by the nose liner, the radiator just inside it and
     the floor, so every control point is set back from all three. */
  const duct = new THREE.Shape();
  {
    const dw = 0.122, dd = 0.058, r = 0.022;       // half-width, half-depth
    duct.moveTo(-dw + r, -dd);
    duct.lineTo(dw - r, -dd);   duct.quadraticCurveTo(dw, -dd, dw, -dd + r);
    duct.lineTo(dw, dd - r);    duct.quadraticCurveTo(dw, dd, dw - r, dd);
    duct.lineTo(-dw + r, dd);   duct.quadraticCurveTo(-dw, dd, -dw, dd - r);
    duct.lineTo(-dw, -dd + r);  duct.quadraticCurveTo(-dw, -dd, -dw + r, -dd);
  }
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.245, -1.905, AIR_TOP - 0.053),   // up inside the airbox
    new THREE.Vector3(0.245, -1.970, AIR_TOP - 0.128),
    new THREE.Vector3(0.243, -2.015, AIR_TOP - 0.218),
    new THREE.Vector3(0.240, -2.025, AIR_TOP - 0.295),
  ]);
  const snorkelCarbon = carbon.clone();
  snorkelCarbon.envMapIntensity = 2.4;      // it only ever reads by its highlight
  const snorkel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(duct, { extrudePath: path, steps: 26, bevelEnabled: false }),
    snorkelCarbon);
  snorkel.name = 'snorkel';
  g.add(snorkel);
  // the mouth flares, the way the real one opens up at the bottom
  const mouth = new THREE.Mesh(new RoundedBoxGeometry(0.286, 0.130, 0.070, 2, 0.020), carbonDull);
  mouth.rotation.x = 0.16;
  mouth.position.set(0.238, -2.020, AIR_TOP - 0.328);
  g.add(mouth);
  const throat = new THREE.Mesh(new THREE.PlaneGeometry(0.246, 0.100), rubber);
  throat.rotation.x = Math.PI + 0.16;
  throat.position.set(0.238, -2.022, AIR_TOP - 0.362);
  g.add(throat);
  // collar where the duct leaves the underside of the airbox
  const band = new THREE.Mesh(new RoundedBoxGeometry(0.272, 0.142, 0.030, 2, 0.010), plasticBlack);
  band.rotation.x = 0.34;
  band.position.set(0.246, -1.950, AIR_TOP - 0.098);
  g.add(band);
  hotspots.push({ id: 'spec-intake', at: new THREE.Vector3(0.243, -1.99, AIR_TOP - 0.17), r: 0.26 });

  /* ---- the mini garage on the airbox lid ---------------------------- */
  /* The Carbeetle project running in miniature, on a loop: a blue car comes
     up the drive, the camera on the roof picks it out and draws a box round
     it, the door goes up, the car pulls in, the door comes down. Same
     sequence the real one runs on the driveway outside. Everything is built
     in the lid's own frame, local z = 0 being the carbon surface, and the
     whole thing is kept under 92mm tall so it never breaks the plane of the
     bay opening at TOP_Z. */
  const mini = new THREE.Group();
  mini.position.set(AIR_X, -1.64, AIR_TOP);
  g.add(mini);
  const mbox = (w, d, hgt, pos, mat, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, hgt), mat);
    m.position.set(pos[0], pos[1], pos[2]);
    (parent || mini).add(m); return m;
  };
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d4653, roughness: 0.72, metalness: 0.14 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x272f3a, roughness: 0.68, metalness: 0.2 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x6d7885, roughness: 0.44, metalness: 0.6 });

  /* The drive the car comes up. It has to be darker than instinct says:
     the intake-side fill sits directly over this lid, and anything even
     mid-grey here blows out into a lightbox that swallows the garage. */
  const tarmac = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.98, metalness: 0.02 });

  /* The route the car drives, which is longer than the road it drives on.
     The tarmac stops at the lid; below that the car simply climbs the
     snorkel's own carbon, which is what the duct is there for. The bottom
     of the route is buried inside the duct, and the duct is solid, so that
     is where the car waits: not hidden by a prop, hidden inside geometry,
     with no angle in the cage that catches it sitting there. */
  /* The grade is the whole trick here. The lid stands only 150mm over its
     own base and the duct plunges away underneath it, so a road drawn
     straight between the two is a cliff and the car rears up at 78 degrees.
     These points keep the stretch you can see at 27 to 49 degrees, a steep
     hill but a road, and only go near vertical once the descent is already
     inside the duct where nothing can be seen anyway. */
  /* Every point stays on top of the lid until it is past the front edge at
     y -0.32, and only then drops, so the climb runs over the carbon rather
     than through it. */
  const HILL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.363, -0.175),   // inside the duct
    new THREE.Vector3(0, -0.359, -0.135),
    new THREE.Vector3(0, -0.351, -0.092),
    new THREE.Vector3(0, -0.339, -0.048),
    new THREE.Vector3(0, -0.324, -0.014),   // clear of the box's front face
    new THREE.Vector3(0, -0.309, 0.0015),   // over the lid's rounded edge
    new THREE.Vector3(0, -0.250, 0.0015),
    new THREE.Vector3(0, -0.100, 0.0015),
    new THREE.Vector3(0, 0.082, 0.0015),    // the door
    new THREE.Vector3(0, 0.212, 0.0015),    // parked inside
  ]);
  /* Road section, kerbs and all, in one piece: two meshes here once met in
     a coplanar overlap that z-fought into a seam straight across the drive,
     and one extrusion cannot seam against itself. Extruded along its own
     axis and then rotated flat, NOT swept along a path: a dead straight
     path gives Frenet nothing to work from, and three.js picks an arbitrary
     first normal that stood the whole road up on its edge. */
  const ribbon = new THREE.Shape();
  {
    const rw = 0.052, kw = 0.058, rt = 0.0022, kt = 0.0046;
    ribbon.moveTo(-kw, -rt);  ribbon.lineTo(kw, -rt);
    ribbon.lineTo(kw, kt);    ribbon.lineTo(rw, kt);
    ribbon.lineTo(rw, rt);    ribbon.lineTo(-rw, rt);
    ribbon.lineTo(-rw, kt);   ribbon.lineTo(-kw, kt);
    ribbon.closePath();
  }
  const ROAD_BACK = 0.212, ROAD_FRONT = -0.302;    // stops on the lid's flat top
  const road = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ribbon, { depth: ROAD_BACK - ROAD_FRONT, bevelEnabled: false }),
    tarmac);
  road.rotation.x = Math.PI / 2;
  road.position.set(0, ROAD_BACK, 0.0015);
  road.name = 'mini-road';
  mini.add(road);

  const GH = 0.066;                       // wall height
  mbox(0.170, 0.008, GH, [0, 0.268, GH / 2], wallMat);              // back wall
  for (const sx of [-1, 1]) mbox(0.008, 0.150, GH, [sx * 0.081, 0.196, GH / 2], wallMat);
  mbox(0.170, 0.176, 0.007, [0, 0.185, GH + 0.0035], roofMat);      // roof, with an eave
  mbox(0.170, 0.010, 0.016, [0, 0.121, GH - 0.008], wallMat);       // header over the opening

  /* A roll-up door: the panel hangs from a group pinned at the header and
     shrinks upward, which reads as it curling away rather than sinking
     through its own roof the way a straight slide would. */
  const doorGrp = new THREE.Group();
  doorGrp.position.set(0, 0.121, GH - 0.016);
  mini.add(doorGrp);
  const doorPanel = mbox(0.146, 0.005, 0.048, [0, 0, -0.024], doorMat, doorGrp);
  for (let i = 0; i < 3; i++) mbox(0.146, 0.007, 0.002, [0, 0, -0.010 - i * 0.014], roofMat, doorGrp);

  /* The webcam, on the eave at the very front of the roof and pitched down
     the drive. Nothing in this loop happens until it has seen the car, so it
     belongs where it can watch the whole approach rather than tucked over
     the back wall where it was looking at its own roof. Centred over the
     door, the way you would actually mount one. */
  mbox(0.005, 0.005, 0.010, [0, 0.110, GH + 0.011], roofMat);        // mast
  const camHead = new THREE.Group();
  camHead.position.set(0, 0.105, GH + 0.0205);
  camHead.rotation.x = 0.30;                       // nose down, onto the drive
  mini.add(camHead);
  const camBody = mbox(0.019, 0.014, 0.011, [0, 0, 0], wallMat, camHead);
  camBody.name = 'mini-cam';
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x0a0d13 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0042, 12), lensMat);
  lens.rotation.set(Math.PI / 2, 0, 0);
  lens.position.set(0, -0.0075, 0);
  camHead.add(lens);
  const camLedMat = new THREE.MeshBasicMaterial({ color: 0x1d3a2a });
  const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 8, 6), camLedMat);
  camLed.position.set(0.0075, -0.0072, 0.0038);
  camHead.add(camLed);

  // the car: Interlagos, like the one it is parked inside
  const carMini = new THREE.Group();
  mini.add(carMini);
  const miniPaint = new THREE.MeshStandardMaterial({
    color: PAINT, metalness: 0.62, roughness: 0.34, envMapIntensity: 1.4,
  });
  mbox(0.030, 0.055, 0.013, [0, 0, 0.0095], miniPaint, carMini);
  mbox(0.024, 0.026, 0.010, [0, -0.004, 0.0205], miniPaint, carMini);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 5), headMat);
    hl.position.set(sx * 0.009, 0.0275, 0.011);
    carMini.add(hl);
  }

  /* The detection box, drawn the way the model draws it: a red rectangle
     snapped round the car for as long as the camera is holding it. */
  const detBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.040, 0.064, 0.030)),
    new THREE.LineBasicMaterial({ color: 0xff3b30 })
  );
  detBox.position.z = 0.015;
  detBox.visible = false;
  carMini.add(detBox);

  // the bulb inside, which is the whole tell that the door is open
  const insideLight = new THREE.PointLight(0xffd9a8, 0, 0.14, 2.0);
  insideLight.position.set(0, 0.205, 0.040);
  mini.add(insideLight);

  /* One turn of the loop. The car rides the curve rather than sliding along
     an axis, so it climbs the hill and pitches with it for free. Where the
     door sits on that curve is found by bisection: y runs monotonically
     from the bottom of the duct to the back wall, so the search is safe,
     and nothing has to be re-measured by hand if the road moves. */
  const U_DOOR = (() => {
    let lo = 0, hi = 1, u = 0.5;
    for (let i = 0; i < 26; i++) {
      u = (lo + hi) / 2;
      if (HILL.getPointAt(u).y < 0.082) lo = u; else hi = u;
    }
    return u;
  })();
  const span = (p, a, b) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const carPt = new THREE.Vector3(), carTan = new THREE.Vector3();
  const miniStep = (t) => {
    const p = (t % 10) / 10;
    // a beat waiting inside the duct, the climb, then the pull into the bay
    const drive = ease(span(p, 0.06, 0.36));
    const pullIn = ease(span(p, 0.46, 0.64));
    const u = Math.min(1, U_DOOR * drive + (1 - U_DOOR) * pullIn);
    HILL.getPointAt(u, carPt);
    HILL.getTangentAt(u, carTan);
    carMini.position.copy(carPt);
    // nose follows the grade, clamped so the hidden dive never rears it up
    carMini.rotation.x = THREE.MathUtils.clamp(Math.atan2(carTan.z, carTan.y), -0.95, 0.95);
    const open = ease(span(p, 0.34, 0.48)) - ease(span(p, 0.68, 0.82));
    doorGrp.scale.z = 1 - open * 0.94;
    insideLight.intensity = open * 0.30;
    const seen = p > 0.28 && p < 0.52;
    detBox.visible = seen;
    const blink = seen ? (Math.sin(t * 26) > 0 ? 1 : 0.35) : 0;
    camLedMat.color.setRGB(0.11 + blink * 0.85, 0.23 + blink * 0.30, 0.16 + blink * 0.20);
  };
  miniStep(0);

  /* The driver's-side corner behind it, which the old Karbonius box used
     to fill. A plain black canister, the way the real bay carries one. */
  /* Just the box. There was a canister here as well, sitting almost exactly
     on top of the strut tower, so each rear corner read as two drums stacked
     into one another. The tower is the one that belongs. */
  box(0.15, 0.13, 0.12, [0.535, -1.68, FLOOR_Z + 0.06], plasticBlack);

  /* ---- passenger side: filter drum, tanks, ECU box ---------------- */
  /* Same on this side: the big canister overlapped its own strut tower.
     One drum, moved forward clear of the tower and grown to carry the
     corner on its own. */
  const canister = drum(0.132, 0.25, [-0.468, -1.795, FLOOR_Z + 0.155], plasticBlack);
  canister.name = 'canister';
  drum(0.098, 0.05, [-0.468, -1.795, FLOOR_Z + 0.303], plasticBlack);
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

  // one weak source so the frames put a little light back onto the engine
  // without lifting the whole bay off its black
  const plateGlow = new THREE.PointLight(0x8fb4ff, 0.26, 0.72, 2.4);
  plateGlow.position.set(-0.05, -1.74, FLOOR_Z + 0.44);
  g.add(plateGlow);

  /* ---- the work light clipped to the brace ------------------------ */
  const bulb = new THREE.PointLight(0xdbe6ff, 1.30, 1.45, 2.4);
  bulb.position.set(0.02, -1.74, TOP_Z - 0.06);
  g.add(bulb);
  const fill = new THREE.PointLight(0x93a8c8, 0.55, 1.9, 2.0);
  fill.position.set(0.05, -1.98, TOP_Z + 0.12);
  g.add(fill);
  // the intake side falls outside the work light's throw and renders as flat
  // black, which hides the snorkel and the canister behind it entirely
  const sideFill = new THREE.PointLight(0xb6cbe8, 1.15, 1.45, 2.0);
  sideFill.position.set(0.47, -1.90, TOP_Z - 0.11);
  g.add(sideFill);
  const lampBody = drum(0.036, 0.09, [-0.30, -1.36, TOP_Z - 0.10], steel);
  lampBody.name = 'lamp';
  const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.034, 14), new THREE.MeshBasicMaterial({ color: 0xeef4ff }));
  lampLens.rotation.x = Math.PI;
  lampLens.position.set(-0.30, -1.36, TOP_Z - 0.147);
  g.add(lampLens);

  g.visible = false;
  return { group: g, hotspots, bulb, miniStep, plates,
           plateHits: plates.map((q) => q.face) };
}

/* ------------------------------------------------------------ decals */

/* Drawn to the proportion of the plate it is going on: 4:1 for the rear
   recess, 2:1 for the short bracket plate up front. Nine letters on the
   short one have to sit tight, so the tracking closes up with it. */
function plateTexture(aspect = 4) {
  const { c, x, w, h } = P.canvas(256 * aspect, 256);
  x.fillStyle = '#e8e9e4'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#1a1c20'; x.lineWidth = aspect > 3 ? 10 : 8;
  const inset = aspect > 3 ? 14 : 11;
  x.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  P.line(x, 'CARBEETLE', {
    font: P.fonts.display,
    size: aspect > 3 ? 132 : 74, color: '#16181d',
    x: w / 2, y: h / 2 + (aspect > 3 ? 46 : 26),
    align: 'center', track: aspect > 3 ? 6 : 1,
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

