/* Seven synthesized cues. No audio files ship with this site: everything
   below is filtered noise and a couple of oscillators, which is also why
   it can stay silent until the visitor asks for it.
   Volumes are deliberately low. Cues 0.15 to 0.6, room tone 0.05. */

export class Shop {
  constructor() {
    this.ctx = null; this.on = false; this.master = null; this.room = null;
  }

  enable() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      this.on = true;
      if (this.master) this.master.gain.value = 1;
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Safari and Chrome both hand back a suspended context when the
    // gesture is not trusted; resuming here costs nothing when it is.
    if (this.ctx.state !== 'running') this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.on = true;
    this.roomTone();
  }

  disable() {
    this.on = false;
    if (this.master) this.master.gain.value = 0;
  }

  toggle() { this.on ? this.disable() : this.enable(); return this.on; }

  noise(dur = 0.4) {
    const n = Math.max(1, (this.ctx.sampleRate * dur) | 0);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /* low rumble under the whole room, the level of a fridge two rooms away */
  roomTone() {
    const src = this.noise(4);
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    this.room = g;
  }

  env(node, peak, attack, decay) {
    const t = this.ctx.currentTime;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /* camera flights */
  whoosh(vol = 0.36) {
    if (!this.on) return;
    const src = this.noise(0.9);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    const t = this.ctx.currentTime;
    bp.frequency.setValueAtTime(220, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.34);
    bp.frequency.exponentialRampToValueAtTime(180, t + 0.85);
    const g = this.ctx.createGain();
    src.connect(bp).connect(g).connect(this.master);
    this.env(g, vol, 0.10, 0.72);
    src.start();
  }

  /* hood latch, door thunk, anything that lands */
  clunk(vol = 0.5) {
    if (!this.on) return;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    const g = this.ctx.createGain();
    o.connect(g).connect(this.master);
    this.env(g, vol, 0.004, 0.20);
    o.start(); o.stop(t + 0.3);

    const src = this.noise(0.14);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const ng = this.ctx.createGain();
    src.connect(lp).connect(ng).connect(this.master);
    this.env(ng, vol * 0.6, 0.003, 0.12);
    src.start();
  }

  /* indicator-stalk click on every button */
  click(vol = 0.3) {
    if (!this.on) return;
    const src = this.noise(0.05);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = this.ctx.createGain();
    src.connect(hp).connect(g).connect(this.master);
    this.env(g, vol, 0.002, 0.045);
    src.start();
  }

  /* key-fob chirp on arrival */
  chirp(vol = 0.18) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    for (const [f, d] of [[1760, 0], [2340, 0.09]]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      o.connect(g).connect(this.master);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(vol, t + d + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.07);
      o.start(t + d); o.stop(t + d + 0.1);
    }
  }

  /* the roller door: a long motor grind under a rumble */
  door(dur = 2.4, vol = 0.34) {
    if (!this.on) return;
    const src = this.noise(dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 2.2;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    /* The envelope must fit inside dur: the reduced-motion door runs at
       0.4s, where the fixed 0.25s attack / 0.5s release put the hold point
       before currentTime and setValueAtTime throws on a negative t. */
    const attack = Math.min(0.25, dur * 0.4);
    const hold = Math.max(t + attack, t + dur - 0.5);
    src.connect(lp).connect(g).connect(this.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start();

    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 58;
    const og = this.ctx.createGain();
    const of_ = this.ctx.createBiquadFilter();
    of_.type = 'lowpass'; of_.frequency.value = 220;
    o.connect(of_).connect(og).connect(this.master);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vol * 0.5, t + Math.min(0.3, dur * 0.5));
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.1);
  }

  /* the toy: a rev blip, the one sound with no information in it */
  rev(vol = 0.30) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.30);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.85);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + 0.30);
    lp.frequency.exponentialRampToValueAtTime(600, t + 0.85);
    const g = this.ctx.createGain();
    o.connect(lp).connect(g).connect(this.master);
    this.env(g, vol, 0.05, 0.80);
    o.start(t); o.stop(t + 1.0);
  }

  /* the horn: two tones, a real car horn is a chord */
  horn(vol = 0.26) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    for (const f of [400, 500]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g = this.ctx.createGain();
      o.connect(lp).connect(g).connect(this.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.setValueAtTime(vol, t + 0.24);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.start(t); o.stop(t + 0.4);
    }
  }
}
