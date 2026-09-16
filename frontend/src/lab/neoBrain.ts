// NeoBrain — a tiny bio-inspired neural substrate for Neo's voice.
//
// Honest framing: this is NOT a human brain and NOT built from HCP / H01 /
// Allen / BICCN / Algonauts data (a millimeter of cortex is 1.4 PB — no
// browser can ingest that, and neuroscience has no complete reverse-engineered
// brain to copy). What it borrows is three validated principles:
//
//  1. Cell-type diversity (Allen-inspired): leaky integrate-and-fire neurons
//     with distinct thresholds, time constants and refractory periods for
//     regular-spiking excitatory, fast-spiking inhibitory, bursting and
//     low-threshold cells. Parameters are textbook LIF ranges, hand-set and
//     documented — not copied recordings.
//  2. Small-world wiring (HCP-inspired topology principle): ring lattice with
//     a fraction of rewired long-range links — high clustering, short paths.
//     Dale's law holds: excitatory rows stay ≥ 0, inhibitory rows stay ≤ 0.
//  3. Hebbian plasticity (electrophysiology-inspired dynamics): cells that
//     fire together wire together, with passive decay (forgetting) and row
//     normalization (homeostasis) so weights cannot blow up.
//
// The brain does not store sentences. It holds a running activation state:
// what Neo just "felt" biases wording novelty (temperature of the sampler)
// and phrasing choice (opener/connector bias). Learning is online — every
// conversation turn physically rewires weights, persisted in localStorage.
export interface BrainStats {
  cells: number; types: number; energy: number; winner: number; novelty: number;
}

interface CellType { name: string; frac: number; tau: number; thresh: number; refrac: number; inhibitory: boolean; burst: boolean }

const CELL_TYPES: CellType[] = [
  { name: "RS", frac: 0.7, tau: 12, thresh: 1.0, refrac: 2, inhibitory: false, burst: false },
  { name: "FS", frac: 0.15, tau: 6, thresh: 0.8, refrac: 1, inhibitory: true, burst: false },
  { name: "BURST", frac: 0.1, tau: 10, thresh: 0.7, refrac: 3, inhibitory: false, burst: true },
  { name: "LTS", frac: 0.05, tau: 16, thresh: 1.2, refrac: 2, inhibitory: false, burst: false },
];

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const fnv1a = (s: string, salt: number): number => {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

const tok = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((t) => t.length > 1 || t === "i" || t === "a").slice(0, 120);

export class NeoBrain {
  readonly n: number;
  W: Float32Array;
  private v: Float32Array;
  private ref: Int8Array;
  private thresh: Float32Array;
  private tau: Float32Array;
  private inhib: Uint8Array;
  private burst: Uint8Array;
  spikeAvg: Float32Array;
  lastEnergy = 0;
  lastWinner = 0;
  lastNovelty = 0.5;

  constructor(n = 64, seed = 20260620) {
    this.n = n;
    const rnd = mulberry32(seed);
    this.W = new Float32Array(n * n);
    this.v = new Float32Array(n);
    this.ref = new Int8Array(n);
    this.thresh = new Float32Array(n);
    this.tau = new Float32Array(n);
    this.inhib = new Uint8Array(n);
    this.burst = new Uint8Array(n);
    this.spikeAvg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let acc = 0; const r = rnd();
      let t = CELL_TYPES[0];
      for (const c of CELL_TYPES) { acc += c.frac; if (r <= acc) { t = c; break; } }
      this.thresh[i] = t.thresh;
      this.tau[i] = t.tau;
      this.inhib[i] = t.inhibitory ? 1 : 0;
      this.burst[i] = t.burst ? 1 : 0;
    }
    // Ring lattice (k=6) + 15% rewired long-range links → small-world.
    const K = 6, P = 0.15;
    const link = (i: number, j: number, w: number): void => {
      if (i === j) return;
      this.W[i * n + j] = this.inhib[i] === 1 ? -Math.abs(w) : Math.abs(w);
    };
    for (let i = 0; i < n; i++) {
      for (let d = 1; d <= K / 2; d++) {
        const w = 0.22 + rnd() * 0.1;
        if (rnd() < P) link(i, Math.floor(rnd() * n), 0.2 + rnd() * 0.12);
        else { link(i, (i + d) % n, w); link(i, (i - d + n) % n, w); }
      }
    }
    // Fast-spiking cells broadcast weak global inhibition.
    for (let i = 0; i < n; i++) {
      if (this.inhib[i] === 1) for (let j = 0; j < n; j += 4) link(i, j, 0.05 + rnd() * 0.04);
    }
  }

  cellTypeCounts(): number[] {
    const counts = [0, 0, 0, 0];
    const seen = new Map<string, number>();
    for (let i = 0; i < this.n; i++) {
      const key = `${this.thresh[i].toFixed(1)}|${this.tau[i]}|${this.inhib[i]}|${this.burst[i]}`;
      if (!seen.has(key)) seen.set(key, seen.size);
      counts[Math.min(3, seen.get(key) as number)]++;
    }
    return counts;
  }

  /** Sparse projection: each token drives a 3-cell assembly. */
  encode(token: string): number[] {
    return [fnv1a(token, 7) % this.n, fnv1a(token, 131) % this.n, fnv1a(token, 911) % this.n];
  }

  private step(driven: Set<number>, prevFired: Set<number>): number[] {
    const fired: number[] = [];
    for (let i = 0; i < this.n; i++) {
      if (this.ref[i] > 0) { this.ref[i]--; this.v[i] = 0; continue; }
      let rec = 0;
      const row = i * this.n;
      for (let j = 0; j < this.n; j++) {
        const w = this.W[row + j];
        if (w !== 0 && prevFired.has(j)) rec += w;
      }
      this.v[i] = this.v[i] * (1 - 1 / this.tau[i]) + (driven.has(i) ? 1.0 : 0) + rec;
      if (this.v[i] >= this.thresh[i]) {
        fired.push(i);
        this.v[i] = 0;
        this.ref[i] = this.refracOf(i);
        if (this.burst[i] === 1) {
          for (let j = 0; j < this.n; j++) {
            const w = this.W[i * this.n + j];
            if (w > 0) this.v[j] += w * 0.5;
          }
        }
      }
    }
    return fired;
  }

  private refracOf(i: number): number {
    return this.tau[i] <= 6 ? 1 : this.burst[i] === 1 ? 3 : 2;
  }

  /**
   * Feel text: run dynamics, optionally rewire (Hebbian). Returns live state.
   * plasticity=false is a read — used when generating, so imagining an answer
   * does not rewrite memory; learn() passes true.
   */
  feel(text: string, plasticity: boolean, eta = 0.03): { energy: number; winner: number; novelty: number } {
    this.v.fill(0);
    this.ref.fill(0);
    const tokens = tok(text);
    const driven = new Set<number>();
    for (const t of tokens) for (const c of this.encode(t)) driven.add(c);
    const counts = new Float32Array(this.n);
    const STEPS = 6;
    let total = 0;
    let prev = new Set<number>();
    for (let s = 0; s < STEPS; s++) {
      const fired = this.step(driven, prev);
      prev = new Set<number>(fired);
      total += fired.length;
      for (const f of fired) counts[f]++;
      if (plasticity && fired.length > 1) {
        for (let a = 0; a < fired.length; a++) {
          for (let b = 0; b < fired.length; b++) {
            if (a === b) continue;
            const i = fired[a], j = fired[b];
            const k = i * this.n + j;
            const dw = eta * (1 - Math.abs(this.W[k]));
            this.W[k] += this.inhib[i] === 1 ? -dw : dw;
          }
        }
      }
    }
    if (plasticity) this.homeostasis();
    let winner = 0;
    for (let i = 1; i < this.n; i++) if (counts[i] > counts[winner]) winner = i;
    const energy = total / (this.n * STEPS);
    // Novelty: distance from running-average activation (1 = brand new).
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < this.n; i++) { dot += counts[i] * this.spikeAvg[i]; na += counts[i] * counts[i]; nb += this.spikeAvg[i] * this.spikeAvg[i]; }
    const novelty = nb === 0 ? 1 : Math.max(0, Math.min(1, 1 - dot / (Math.sqrt(na * nb) + 1e-9)));
    for (let i = 0; i < this.n; i++) this.spikeAvg[i] = 0.9 * this.spikeAvg[i] + 0.1 * (counts[i] / STEPS);
    this.lastEnergy = energy; this.lastWinner = winner; this.lastNovelty = novelty;
    return { energy, winner, novelty };
  }

  /** Online learning: feel with rewiring, plus slow forgetting. */
  learn(text: string, eta = 0.03): { energy: number; winner: number; novelty: number } {
    for (let i = 0; i < this.W.length; i++) this.W[i] *= 1 - 1e-4;
    return this.feel(text, true, eta);
  }

  private homeostasis(): void {
    for (let i = 0; i < this.n; i++) {
      let s = 0;
      const row = i * this.n;
      for (let j = 0; j < this.n; j++) s += Math.abs(this.W[row + j]);
      if (s > 2.5) {
        const k = 2.5 / s;
        for (let j = 0; j < this.n; j++) this.W[row + j] *= k;
      }
      for (let j = 0; j < this.n; j++) {
        const idx = row + j;
        if (this.W[idx] > 1) this.W[idx] = 1;
        if (this.W[idx] < -1) this.W[idx] = -1;
        if (this.inhib[i] === 1 && this.W[idx] > 0) this.W[idx] = 0;
        if (this.inhib[i] === 0 && this.W[idx] < 0) this.W[idx] = 0;
      }
    }
  }

  stats(): BrainStats {
    return { cells: this.n, types: CELL_TYPES.length, energy: this.lastEnergy, winner: this.lastWinner, novelty: this.lastNovelty };
  }

  meanAbsWeight(): number {
    let s = 0, c = 0;
    for (let i = 0; i < this.W.length; i++) if (this.W[i] !== 0) { s += Math.abs(this.W[i]); c++; }
    return c ? s / c : 0;
  }

  /** Small-world check helpers (proof/test use). */
  clustering(): number {
    const adj: Set<number>[] = [];
    for (let i = 0; i < this.n; i++) {
      adj.push(new Set<number>());
      for (let j = 0; j < this.n; j++) if (i !== j && Math.abs(this.W[i * this.n + j]) > 0.08) adj[i].add(j);
    }
    let sum = 0, c = 0;
    for (let i = 0; i < this.n; i++) {
      const nb = [...adj[i]];
      if (nb.length < 2) continue;
      let links = 0;
      for (let a = 0; a < nb.length; a++) for (let b = a + 1; b < nb.length; b++) if (adj[nb[a]].has(nb[b])) links++;
      sum += (2 * links) / (nb.length * (nb.length - 1));
      c++;
    }
    return c ? sum / c : 0;
  }

  meanPath(): number {
    const adj: number[][] = [];
    for (let i = 0; i < this.n; i++) {
      adj.push([]);
      for (let j = 0; j < this.n; j++) if (i !== j && Math.abs(this.W[i * this.n + j]) > 0.08) adj[i].push(j);
    }
    let total = 0, pairs = 0;
    for (let s = 0; s < this.n; s += 4) {
      const dist = new Array<number>(this.n).fill(-1);
      dist[s] = 0;
      const q = [s];
      while (q.length) {
        const u = q.shift() as number;
        for (const w of adj[u]) if (dist[w] < 0) { dist[w] = dist[u] + 1; q.push(w); }
      }
      for (let i = 0; i < this.n; i++) if (dist[i] > 0) { total += dist[i]; pairs++; }
    }
    return pairs ? total / pairs : Infinity;
  }

  toJSON(): number[] {
    const out = new Array<number>(this.W.length);
    for (let i = 0; i < this.W.length; i++) out[i] = Math.round(this.W[i] * 1000) / 1000;
    return out;
  }

  loadWeights(w: number[]): void {
    if (w.length !== this.W.length) return;
    for (let i = 0; i < w.length; i++) this.W[i] = w[i];
    this.homeostasis();
  }
}
