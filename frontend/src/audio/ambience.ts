// Environmental audio: wind/water/insects/calls/rain. Silence exists — no music loop.
//
// Location-aware: forest → insects at night, water proximity → surf/river wash,
// altitude + storm → wind body. All gains ease toward targets; absence stays audible.
export class Ambience {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;
  private insectGain: GainNode | null = null;
  started = false;
  private noiseBuf: AudioBuffer | null = null;
  start() {
    if (this.started) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = 2 * this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const loop = () => {
        const s = this.ctx!.createBufferSource();
        s.buffer = buf; s.loop = true; s.start();
        return s;
      };
      // Wind: lowpassed noise.
      const wf = this.ctx.createBiquadFilter();
      wf.type = "lowpass"; wf.frequency.value = 400;
      this.windFilter = wf;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.05;
      loop().connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master);
      // Water: bandpassed wash (surf + river + rain share this body).
      const bf = this.ctx.createBiquadFilter();
      bf.type = "bandpass"; bf.frequency.value = 1400; bf.Q.value = 0.6;
      this.waterGain = this.ctx.createGain(); this.waterGain.gain.value = 0;
      loop().connect(bf); bf.connect(this.waterGain); this.waterGain.connect(this.master);
      // Insects: highpassed shimmer, night forests only.
      const hf = this.ctx.createBiquadFilter();
      hf.type = "highpass"; hf.frequency.value = 5200;
      this.insectGain = this.ctx.createGain(); this.insectGain.gain.value = 0;
      loop().connect(hf); hf.connect(this.insectGain); this.insectGain.connect(this.master);
      this.started = true;
    } catch { /* audio unavailable — silence is fine */ }
  }
  setWind(strength01: number) {
    if (this.windGain && this.ctx) this.windGain.gain.setTargetAtTime(0.02 + strength01 * 0.2, this.ctx.currentTime, 0.5);
  }
  // altitude01 raises whistle, forest01 softens it into leaf rustle.
  setAir(altitude01: number, forest01: number) {
    if (!this.ctx || !this.windFilter) return;
    this.windFilter.frequency.setTargetAtTime(300 + altitude01 * 700 - forest01 * 120, this.ctx.currentTime, 1);
  }
  setWater(proximity01: number, rain01 = 0) {
    if (!this.ctx || !this.waterGain) return;
    this.waterGain.gain.setTargetAtTime(Math.min(0.3, proximity01 * 0.22 + rain01 * 0.1), this.ctx.currentTime, 0.8);
  }
  setInsects(night01: number, forest01: number) {
    if (!this.ctx || !this.insectGain) return;
    this.insectGain.gain.setTargetAtTime(night01 * forest01 * 0.05, this.ctx.currentTime, 2);
  }
  // Footstep: short filtered noise burst, pitch varies per step.
  footstep(run01: number, wet01: number) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.7 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = wet01 > 0.5 ? 900 : 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1 + run01 * 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 1.5, 0.18);
  }
  // Distant call: simple decaying sine sweep (placeholder for sampled calls).
  distantCall(distanceM: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    const vol = Math.min(0.2, 30 / Math.max(30, distanceM));
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1.6);
  }
}
export const ambience = new Ambience();
