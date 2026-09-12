// Fire model: fuel/oxygen/moisture/wind/temperature on a coarse cell grid (performant).
export interface FireCell { fuel01: number; moisture01: number; burning: boolean; heat01: number }
export class FireGrid {
  cells: FireCell[][]; n: number;
  constructor(n = 32) {
    this.n = n;
    this.cells = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ fuel01: 0.3 + Math.random() * 0.7, moisture01: 0.4, burning: false, heat01: 0 })));
  }
  ignite(cx: number, cy: number) { if (this.cells[cy]?.[cx]) this.cells[cy][cx].burning = true; }
  tick(wind: { x: number; y: number }, tempC: number, humidity01: number) {
    const n = this.n, next = this.cells.map((r) => r.map((c) => ({ ...c })));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = this.cells[y][x];
      if (!c.burning) continue;
      c.fuel01 -= 0.05;
      const spreadP = Math.max(0, 0.25 - humidity01 * 0.3 - c.moisture01 * 0.2 + (tempC - 20) * 0.005);
      const targets = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
        [x + Math.sign(wind.x), y + Math.sign(wind.y)]];
      for (const [tx, ty] of targets) {
        const t = this.cells[ty]?.[tx];
        if (t && !t.burning && t.fuel01 > 0.1 && Math.random() < spreadP + (tx === x + Math.sign(wind.x) ? 0.15 : 0))
          next[ty][tx].burning = true;
      }
      if (c.fuel01 <= 0) next[y][x].burning = false;
      next[y][x].fuel01 = c.fuel01; next[y][x].heat01 = 1;
    }
    this.cells = next;
  }
  burningCount(): number { return this.cells.flat().filter((c) => c.burning).length; }
}
