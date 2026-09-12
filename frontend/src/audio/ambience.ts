// Environmental audio: wind/insects/calls/rain/waves/fire. Silence exists — no music loop.
export class Ambience {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private windGain: GainNode | null = null;
  started = false;
  start() {
    if (this.started) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Wind: filtered noise
      const len = 2 * this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 400;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.05;
      src.connect(filt); filt.connect(this.windGain); this.windGain.connect(this.master);
      src.start();
      this.started = true;
    } catch { /* audio unavailable — silence is fine */ }
  }
  setWind(strength01: number) {
    if (this.windGain && this.ctx) this.windGain.gain.setTargetAtTime(0.02 + strength01 * 0.2, this.ctx.currentTime, 0.5);
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
