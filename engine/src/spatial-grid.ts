// Spatial hash grid — broad-phase collision optimization.
// Divides the world into cells and only checks bodies in the same
// or adjacent cells. Reduces collision checks from O(n²) to O(n·k)
// where k is the average number of bodies per cell.

export interface GridCell {
  bodies: number[]; // indices into the world's bodies array
}

export interface SpatialGridConfig {
  /** Cell size in world units */
  cellSize: number;
  /** Number of grid divisions (auto-calculated from world bounds) */
  divisions: [number, number, number];
}

/** Spatial hash grid for broad-phase collision detection */
export class SpatialGrid {
  private cells: Map<string, GridCell> = new Map();
  private cellSize: number;
  private bodyCells: Map<number, Set<string>> = new Map(); // bodyIndex → set of cell keys
  private dirty: boolean = true;

  constructor(cellSize: number = 5.0) {
    this.cellSize = cellSize;
  }

  /** Clear all cells and rebuild */
  clear(): void {
    this.cells.clear();
    this.bodyCells.clear();
    this.dirty = false;
  }

  /** Get the cell key for a given position */
  private getCellKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cy},${cz}`;
  }

  /** Get all cell keys that overlap with an AABB */
  private getOverlappingCells(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number
  ): string[] {
    const keys: string[] = [];
    const minCX = Math.floor(minX / this.cellSize);
    const minCY = Math.floor(minY / this.cellSize);
    const minCZ = Math.floor(minZ / this.cellSize);
    const maxCX = Math.floor(maxX / this.cellSize);
    const maxCY = Math.floor(maxY / this.cellSize);
    const maxCZ = Math.floor(maxZ / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          keys.push(`${cx},${cy},${cz}`);
        }
      }
    }
    return keys;
  }

  /** Insert a body into the grid. Call after positions change. */
  insert(index: number, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
    const keys = this.getOverlappingCells(minX, minY, minZ, maxX, maxY, maxZ);
    const cellSet = new Set(keys);

    // Remove from old cells if tracked
    const oldCells = this.bodyCells.get(index);
    if (oldCells) {
      for (const key of oldCells) {
        const cell = this.cells.get(key);
        if (cell) {
          const idx = cell.bodies.indexOf(index);
          if (idx !== -1) cell.bodies.splice(idx, 1);
        }
      }
    }

    // Insert into new cells
    for (const key of cellSet) {
      if (!this.cells.has(key)) {
        this.cells.set(key, { bodies: [] });
      }
      this.cells.get(key)!.bodies.push(index);
    }

    this.bodyCells.set(index, cellSet);
    this.dirty = false;
  }

  /** Remove a body from the grid */
  remove(index: number): void {
    const oldCells = this.bodyCells.get(index);
    if (oldCells) {
      for (const key of oldCells) {
        const cell = this.cells.get(key);
        if (cell) {
          const idx = cell.bodies.indexOf(index);
          if (idx !== -1) cell.bodies.splice(idx, 1);
        }
      }
      this.bodyCells.delete(index);
    }
  }

  /** Get potential collision pairs using the spatial grid. */
  getPotentialPairs(): [number, number][] {
    const pairs: [number, number][] = [];
    const processed = new Set<string>();

    for (const [key, cell] of this.cells) {
      if (cell.bodies.length < 2) continue;
      // Check all pairs within this cell
      for (let i = 0; i < cell.bodies.length; i++) {
        for (let j = i + 1; j < cell.bodies.length; j++) {
          const a = cell.bodies[i];
          const b = cell.bodies[j];
          const pairKey = a < b ? `${a}-${b}` : `${b}-${a}`;
          if (!processed.has(pairKey)) {
            processed.add(pairKey);
            pairs.push([a, b]);
          }
        }
      }
    }
    return pairs;
  }

  /** Get bodies in a specific region */
  getBodiesInRegion(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): number[] {
    const keys = this.getOverlappingCells(minX, minY, minZ, maxX, maxY, maxZ);
    const bodySet = new Set<number>();
    for (const key of keys) {
      const cell = this.cells.get(key);
      if (cell) {
        for (const idx of cell.bodies) {
          bodySet.add(idx);
        }
      }
    }
    return [...bodySet];
  }

  /** Rebuild the entire grid from scratch */
  rebuild(bodyCount: number, getBounds: (index: number) => [number, number, number, number, number, number]): void {
    this.clear();
    for (let i = 0; i < bodyCount; i++) {
      const [minX, minY, minZ, maxX, maxY, maxZ] = getBounds(i);
      this.insert(i, minX, minY, minZ, maxX, maxY, maxZ);
    }
  }

  /** Get the total number of cells */
  get cellCount(): number {
    return this.cells.size;
  }

  /** Get the number of bodies in the grid */
  get bodyCount(): number {
    return this.bodyCells.size;
  }
}

/** Broad-phase collision detector that wraps the spatial grid */
export class BroadPhaseDetector {
  private grid: SpatialGrid;
  private config: { cellSize: number };
  private lastBounds: Float64Array | null = null;
  private bodyCount: number = 0;

  constructor(cellSize: number = 5.0) {
    this.grid = new SpatialGrid(cellSize);
    this.config = { cellSize };
  }

  /** Update the broad-phase grid with current body positions. */
  update(bodies: Array<{ pos: { x: number; y: number; z: number }; shape: string; radiusM: number; halfM?: { x: number; y: number; z: number } }>): void {
    this.bodyCount = bodies.length;
    this.grid.clear();

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const r = b.shape === "sphere" ? b.radiusM : Math.min(b.halfM!.x, b.halfM!.y, b.halfM!.z);
      const minX = b.pos.x - r, minY = b.pos.y - r, minZ = b.pos.z - r;
      const maxX = b.pos.x + r, maxY = b.pos.y + r, maxZ = b.pos.z + r;
      this.grid.insert(i, minX, minY, minZ, maxX, maxY, maxZ);
    }
  }

  /** Get potential collision pairs using broad-phase */
  getPairs(): [number, number][] {
    return this.grid.getPotentialPairs();
  }

  /** Get bodies that potentially collide with a given body */
  getPotentialCollisions(index: number, radius: number, posX: number, posY: number, posZ: number): number[] {
    const r = Math.max(radius, this.config.cellSize * 0.5);
    return this.grid.getBodiesInRegion(
      posX - r, posY - r, posZ - r,
      posX + r, posY + r, posZ + r
    );
  }

  /** Get the spatial grid for direct access */
  getGrid(): SpatialGrid {
    return this.grid;
  }

  /** Rebuild the broad-phase grid */
  rebuild(bodies: Array<{ pos: { x: number; y: number; z: number }; shape: string; radiusM: number; halfM?: { x: number; y: number; z: number } }>): void {
    this.grid.rebuild(bodies.length, (i) => {
      const b = bodies[i];
      const r = b.shape === "sphere" ? b.radiusM : Math.min(b.halfM!.x, b.halfM!.y, b.halfM!.z);
      return [b.pos.x - r, b.pos.y - r, b.pos.z - r, b.pos.x + r, b.pos.y + r, b.pos.z + r];
    });
  }
}

/** Simple sweep-and-prune for 1D broad phase along axes */
export class SweepAndPrune {
  private intervals: Array<{ index: number; min: number; max: number }> = [];

  update(bodies: Array<{ pos: { x: number; y: number; z: number }; shape: string; radiusM: number; halfM?: { x: number; y: number; z: number } }>): void {
    this.intervals.length = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const r = b.shape === "sphere" ? b.radiusM : Math.min(b.halfM!.x, b.halfM!.y, b.halfM!.z);
      this.intervals.push({
        index: i,
        min: b.pos.x - r,
        max: b.pos.x + r,
      });
    }
    // Sort by min x
    this.intervals.sort((a, b) => a.min - b.min);
  }

  /** Get overlapping pairs along X axis */
  getOverlappingPairs(): [number, number][] {
    const pairs: [number, number][] = [];
    for (let i = 0; i < this.intervals.length; i++) {
      for (let j = i + 1; j < this.intervals.length; j++) {
        const a = this.intervals[i];
        const b = this.intervals[j];
        if (b.min > a.max) break; // no more overlaps
        pairs.push([a.index, b.index]);
      }
    }
    return pairs;
  }
}
