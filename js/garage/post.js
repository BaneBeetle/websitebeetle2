/* The post chain, and the one rule it has to obey.

   Fourteen materials in this room carry `toneMapped: false` — the angel eye
   rings and their coronas, the bench holograms, the drone's scan cone, the
   glow pools. Every one of them was tuned against the plain render path,
   where that flag means "ACES does not touch me".

   A composer changes the deal. three switches in-shader tone mapping off
   whenever it renders into a render target, so once a RenderPass is in
   front, the flag stops meaning anything at all: the scene lands in the
   HDR buffer linear, and whatever the final pass does happens to every
   pixel equally. That is why this file exists as a switchable thing and
   why `nullTest` is in it — the chain is measured against the plain path
   before a single effect is added, rather than assumed to match.

   Order: Render -> Bloom -> Vignette -> Output. Output is last because it
   is the pass that tone maps and converts to sRGB; anything after it would
   be grading a display-referred image. */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

/* Threshold is the whole audit in one number, and the first number tried
   was wrong in an instructive way. At 0.9/0.6 the room bloomed everything
   that was merely pale: the ceiling tubes went to a blown bar, the chrome
   grille and the BMW roundel threw a lens flare off a specular highlight,
   the white number plate and a white breadboard on the bench lit up like
   lamps, and the frame lost two thirds of its dark pixels. None of those
   are light sources.

   The mistake was reading "threshold" as a brightness dial rather than as
   the line between lit and luminous. Nothing in this room that already has
   a painted halo needs a second one: the ceiling strips carry an additive
   halo sprite, and so do the angel eyes. Bloom here is only allowed to
   touch what genuinely exceeds display white in the HDR buffer.

   At 1.10 the tubes sit under it (0xdfe9ff is about 0.82 linear) and keep
   their own painted halo, while the angel eye cores clear it, because a
   ring at full white with two additive coronas stacked on it lands past
   1.0 and nothing else in the room does. Strength halved to match: the
   eyes get a kiss, not a flare. */
export const BLOOM = { threshold: 1.10, strength: 0.32, radius: 0.50 };

export function buildPost(renderer, scene, camera, opts = {}) {
  const { bloom = true, vignette = true } = opts;
  const size = renderer.getSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();

  /* HalfFloat so the bloom has real headroom to threshold against: in an
     8-bit target everything bright is already clipped to 1.0 and the
     threshold has nothing left to separate.
     `samples` is not optional here. The canvas was created with
     antialias:true, which stops doing anything the moment the scene is
     drawn into a target instead of the backbuffer, and this room is all
     long straight edges — bench lip, door slats, roof rail. */
  const target = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(size.x * dpr)), Math.max(1, Math.floor(size.y * dpr)), {
      type: THREE.HalfFloatType,
      samples: 4,
    });

  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(size.x, size.y);

  composer.addPass(new RenderPass(scene, camera));

  let bloomPass = null;
  if (bloom) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    composer.addPass(bloomPass);
  }

  let vignettePass = null;
  if (vignette) {
    /* Subtle. The floor canvas already paints a vignette into the slab, so
       this is only here to carry the darkening up the walls, where nothing
       was painting it. The shader mixes toward vec3(1.0 - darkness), so
       darkness is 1.0 and not a hair more or less: below 1 the target is a
       positive grey and the corners get LIGHTER, which is the opposite of
       a vignette. offset squares into the mix factor, so 0.78 is about a
       28% pull to black in the corners and nothing at all in the middle. */
    vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = 0.78;
    vignettePass.uniforms.darkness.value = 1.0;
    composer.addPass(vignettePass);
  }

  // last, always: tone map + sRGB, reading renderer.toneMapping/exposure
  composer.addPass(new OutputPass());

  return {
    composer, bloomPass, vignettePass,
    setSize(w, h) {
      /* Logical pixels only. EffectComposer.setSize multiplies by its own
         pixel ratio and forwards the EFFECTIVE size to every pass, so
         calling bloomPass.setSize(w, h) after it would hand the bloom
         logical pixels and quietly halve its buffers on any 2x display. */
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    render() { composer.render(); },
    dispose() { composer.dispose(); target.dispose(); },
  };
}

/* A composer with nothing in it but Render -> Output. If this does not
   match the plain renderer.render path, the difference is exactly what
   moving tone mapping out of the material shaders and into a final pass
   costs, with no effect on top to confuse the measurement. Used by the
   harness; costs nothing when unused. */
export function buildNullPost(renderer, scene, camera) {
  return buildPost(renderer, scene, camera, { bloom: false, vignette: false });
}
