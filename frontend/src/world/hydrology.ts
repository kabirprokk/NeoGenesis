// RiverSystem + LakeSystem + OceanSystem — water meshes derived from geology output.
// Rivers follow carved drainage paths (never straight lines); lakes fill real basins;
// ocean foam hugs the actual shoreline contour from the height grid.
import * as THREE from "three";
import type { WorldTerrainSystem, RiverTrace, LakeBasin } from "./geology.js";

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(70,120,150,0.78)"; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "rgba(220,240,250,0.5)"; g.lineWidth = 2;
  for (let i = -64; i < 128; i += 10) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 64); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
let sharedStripe: THREE.CanvasTexture | null = null;
// Extras are rebuilt on a timer — dispose everything except the shared stripe map.
export function disposeExtras(gr: THREE.Group): void {
  gr.traverse((o) => {
    const m = o as unknown as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    if ((m.userData as { ownMap?: boolean }).ownMap) mat.map?.dispose();
    mat.dispose();
  });
  gr.clear();
}
export function riverMaterial(): THREE.MeshStandardMaterial {
  if (!sharedStripe) sharedStripe = stripeTexture();
  return new THREE.MeshStandardMaterial({
    map: sharedStripe, transparent: true, opacity: 0.9,
    roughness: 0.12, metalness: 0.05, depthWrite: false,
  });
}

export class RiverSystem {
  // Ribbon strip following the traced path; y sampled from banks minus freeboard.
  static buildRibbon(r: RiverTrace, sys: WorldTerrainSystem): THREE.Group {
    const group = new THREE.Group();
    const mat = riverMaterial();
    (mat.map as THREE.Texture).repeat.set(1, Math.max(1, r.pts.length / 8));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let k = 0; k < r.pts.length; k++) {
      const p = r.pts[k];
      const q = r.pts[Math.min(r.pts.length - 1, k + 1)];
      const dx = q.x - p.x, dz = q.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const w = r.widths[k] / 2;
      const y = sys.rel(p.x, p.z) + 0.55; // water sits inside the carved channel
      pos.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
      uv.push(0, k * 0.4, 1, k * 0.4);
      if (k > 0) { const b = k * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    }
    if (pos.length >= 12) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      group.add(mesh);
      group.userData.mat = mat;
    }
    return group;
  }
}

export class LakeSystem {
  static buildDisc(l: LakeBasin, sys: WorldTerrainSystem): THREE.Mesh {
    const y = sys.rel(l.x, l.z) + 0.9;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(l.r, 28), riverMaterial());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(l.x, y, l.z);
    mesh.renderOrder = 2;
    return mesh;
  }
}

export class OceanSystem {
  // Foam alpha canvas painted from the true shoreline contour (|h − sea| band + noise breakup).
  static buildFoam(sys: WorldTerrainSystem): THREE.Mesh {
    const S = 128;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const g = c.getContext("2d")!;
    const img = g.createImageData(S, S);
    const sea = sys.waterYRel();
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = sys.cx + (i / (S - 1) - 0.5) * sys.extent, z = sys.cz + (j / (S - 1) - 0.5) * sys.extent;
      const d = Math.abs(sys.rel(x, z) - sea);
      const breakup = 0.5 + 0.5 * Math.sin(x * 0.8 + z * 1.7) * Math.sin(x * 0.23 - z * 0.61);
      const a = d < 1.6 ? (1 - d / 1.6) * (0.35 + 0.65 * breakup) : 0;
      const o = (j * S + i) * 4;
      img.data[o] = 235; img.data[o + 1] = 242; img.data[o + 2] = 245;
      img.data[o + 3] = Math.round(Math.min(1, a) * 200);
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sys.extent, sys.extent),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(sys.cx, sea + 0.07, sys.cz); // spawn-anchored frame, like everything else
    mesh.renderOrder = 3;
    mesh.userData.ownMap = true; // per-build canvas → safe to dispose
    return mesh;
  }
}
