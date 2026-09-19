// Model-class geometry factory — every class gets a distinctive 3D shape.
// All functions return BufferGeometry scaled to `sizeM` (half-extent for boxes,
// radius for spheres). The geometry is centered at origin so position/rotation
// from the engine applies cleanly.
import * as THREE from "three";
import { disposeExtendedGeometries } from "./extended-geometries.js";

type GeoFn = (sizeM: number) => THREE.BufferGeometry;

const V3 = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

function build(
  positions: [number, number, number][],
  indices: [number, number, number][],
  scale: number,
): THREE.BufferGeometry {
  const verts = new Float32Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    verts[i * 3] = positions[i][0] * scale;
    verts[i * 3 + 1] = positions[i][1] * scale;
    verts[i * 3 + 2] = positions[i][2] * scale;
  }
  const idx = new Uint32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    idx[i * 3] = indices[i][0];
    idx[i * 3 + 1] = indices[i][1];
    idx[i * 3 + 2] = indices[i][2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

// ─── AEROSPACE — sleek fighter-jet fuselage with swept wings ───
function aerospaceGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  const n = 16;
  // Fuselage: tapered cylinder (nose → tail)
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const z = (t - 0.5) * 4;
    const r = t < 0.15 ? t / 0.15 * 0.35 : t > 0.85 ? (1 - t) / 0.15 * 0.35 : 0.35;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      p.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j, b = a + 8, c = a + 1, d = b + 1;
      ix.push([a, b, c], [c, b, d]);
    }
  }
  // Wings: flat triangular swept-back surfaces
  const wBase = p.length;
  const wingShape: [number, number, number][] = [
    [0.35, 0, 0.3], [2.2, 0, -0.4], [0.35, 0, -0.8],
    [0.35, -0.04, 0.3], [2.2, -0.04, -0.4], [0.35, -0.04, -0.8],
  ];
  for (const v of wingShape) p.push(v);
  // top wing
  ix.push([wBase, wBase + 1, wBase + 2]);
  // bottom wing
  ix.push([wBase + 3, wBase + 5, wBase + 4]);
  // mirror left wing
  for (const v of wingShape) p.push([-v[0], v[1], v[2]]);
  ix.push([wBase + 6, wBase + 8, wBase + 7]);
  ix.push([wBase + 9, wBase + 11, wBase + 10]);
  // tail fin
  const tBase = p.length;
  p.push([0, 0, -1.8], [0, 0.6, -2.0], [0, 0, -2.2]);
  ix.push([tBase, tBase + 1, tBase + 2]);
  return build(p, ix, s);
}

// ─── MARITIME — boat hull with V-shaped bottom ───
function maritimeGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  const n = 12;
  // Hull: V-bottom cross-section, extruded along z
  for (let i = 0; i <= n; i++) {
    const z = (i / n - 0.5) * 3.5;
    const widthFactor = 1 - Math.pow(2 * Math.abs(i / n - 0.5), 1.5) * 0.4;
    // starboard side
    p.push([0.5 * widthFactor, -0.3 * widthFactor, z]);
    p.push([0.6 * widthFactor, 0.1, z]);
    p.push([0.55 * widthFactor, 0.35, z]);
    // port side (mirror)
    p.push([-0.5 * widthFactor, -0.3 * widthFactor, z]);
    p.push([-0.6 * widthFactor, 0.1, z]);
    p.push([-0.55 * widthFactor, 0.35, z]);
    // keel
    p.push([0, -0.5 * widthFactor, z]);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 7, b = (i + 1) * 7;
    // starboard hull panels
    ix.push([a, b, a + 1], [a + 1, b, b + 1]);
    ix.push([a + 1, b + 1, a + 2], [a + 2, b + 1, b + 2]);
    // port hull panels
    ix.push([a + 3, a + 4, b + 3], [a + 4, b + 4, b + 3]);
    ix.push([a + 4, a + 5, b + 4], [a + 5, b + 5, b + 4]);
    // bottom keel
    ix.push([a, a + 6, b], [a + 6, b + 6, b]);
    ix.push([a + 3, b + 3, a + 6], [a + 6, b + 3, b + 6]);
  }
  return build(p, ix, s);
}

// ─── CRATE — wooden crate with cross-brace detail ───
function crateGeo(s: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(s * 2, s * 2, s * 2);
  return geo; // edges added in renderer
}

// ─── SPHERE-PROBE — sphere with antenna nub ───
function sphereProbeGeo(s: number): THREE.BufferGeometry {
  const base = new THREE.SphereGeometry(s * 0.85, 24, 18);
  const antenna = new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.5, 8);
  antenna.translate(0, s * 1.1, 0);
  const merged = mergeGeos(base, antenna);
  return merged;
}

// ─── BEAM — I-beam structural steel ───
function beamGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  const hw = 0.5, hh = 0.8, flange = 0.2, web = 0.08;
  // Cross-section: top flange + web + bottom flange, extruded along z
  const zLen = 2;
  const sections: [number, number, number][] = [
    // top flange
    [-hw, hh, -zLen], [hw, hh, -zLen], [hw, hh + flange, -zLen], [-hw, hh + flange, -zLen],
    [-hw, hh, zLen], [hw, hh, zLen], [hw, hh + flange, zLen], [-hw, hh + flange, zLen],
    // bottom flange
    [-hw, -hh - flange, -zLen], [hw, -hh - flange, -zLen], [hw, -hh, -zLen], [-hw, -hh, -zLen],
    [-hw, -hh - flange, zLen], [hw, -hh - flange, zLen], [hw, -hh, zLen], [-hw, -hh, zLen],
    // web left
    [-web, -hh, -zLen], [-web, hh, -zLen], [-web, hh, zLen], [-web, -hh, zLen],
    // web right
    [web, -hh, -zLen], [web, hh, -zLen], [web, hh, zLen], [web, -hh, zLen],
  ];
  for (const v of sections) p.push(v);
  // Top flange faces
  ix.push([0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [0, 4, 7], [0, 7, 3], [1, 6, 5], [1, 2, 6]);
  // Bottom flange faces
  ix.push([8, 12, 13], [8, 13, 9], [10, 14, 15], [10, 15, 11], [8, 11, 15], [8, 15, 12], [9, 13, 14], [9, 14, 10]);
  // Web faces
  ix.push([16, 20, 21], [16, 21, 17], [17, 21, 22], [17, 22, 18], [18, 22, 23], [18, 23, 19], [19, 23, 20], [19, 20, 16]);
  return build(p, ix, s);
}

// ─── PLATE-ARMOR — curved shield plate ───
function plateArmorGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  const rows = 8, cols = 10;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols - 0.5;
      const v = r / rows - 0.5;
      const curve = Math.cos(v * Math.PI * 0.8) * 0.15;
      p.push([u * 2, v * 1.6, curve]);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      ix.push([a, a + cols + 1, a + 1], [a + 1, a + cols + 1, a + cols + 2]);
    }
  }
  return build(p, ix, s);
}

// ─── TOOL — wrench/spanner shape ───
function toolGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  // Handle: long thin box
  const handle: [number, number, number][] = [
    [-0.1, -0.06, -1.5], [0.1, -0.06, -1.5], [0.1, 0.06, -1.5], [-0.1, 0.06, -1.5],
    [-0.1, -0.06, 0.3], [0.1, -0.06, 0.3], [0.1, 0.06, 0.3], [-0.1, 0.06, 0.3],
  ];
  for (const v of handle) p.push(v);
  ix.push([0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]);
  // Head: C-shaped jaw
  const headBase = p.length;
  const headPts: [number, number, number][] = [
    [-0.3, -0.08, 0.3], [0.3, -0.08, 0.3], [0.35, -0.08, 0.5], [0.35, -0.08, 1.2],
    [0.15, -0.08, 1.3], [0.15, -0.08, 0.6], [-0.15, -0.08, 0.6], [-0.15, -0.08, 1.3],
    [-0.35, -0.08, 1.2], [-0.35, -0.08, 0.5],
    // top face
    [-0.3, 0.08, 0.3], [0.3, 0.08, 0.3], [0.35, 0.08, 0.5], [0.35, 0.08, 1.2],
    [0.15, 0.08, 1.3], [0.15, 0.08, 0.6], [-0.15, 0.08, 0.6], [-0.15, 0.08, 1.3],
    [-0.35, 0.08, 1.2], [-0.35, 0.08, 0.5],
  ];
  for (const v of headPts) p.push(v);
  // bottom face
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10;
    ix.push([headBase + i, headBase + j, headBase + 10 + i]);
    ix.push([headBase + 10 + i, headBase + j, headBase + 10 + j]);
  }
  return build(p, ix, s);
}

// ─── CONTAINER — barrel/drum with ribs ───
function containerGeo(s: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 1.6, 16);
  return geo;
}

// ─── INGOT — trapezoidal metal ingot ───
function ingotGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [
    // bottom (wider)
    [-0.7, -0.3, -1], [0.7, -0.3, -1], [0.7, -0.3, 1], [-0.7, -0.3, 1],
    // top (narrower)
    [-0.5, 0.3, -0.8], [0.5, 0.3, -0.8], [0.5, 0.3, 0.8], [-0.5, 0.3, 0.8],
  ];
  const ix: [number, number, number][] = [
    [0, 2, 1], [0, 3, 2], // bottom
    [4, 5, 6], [4, 6, 7], // top
    [0, 1, 5], [0, 5, 4], // front
    [2, 3, 7], [2, 7, 6], // back
    [0, 4, 7], [0, 7, 3], // left
    [1, 2, 6], [1, 6, 5], // right
  ];
  return build(p, ix, s);
}

// ─── SHELL — hollow sphere with an opening ───
function shellGeo(s: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(s, 28, 20, 0, Math.PI * 1.7, 0, Math.PI);
}

// ─── HABITAT-MODULE — cylindrical space station module ───
function habitatModuleGeo(s: number): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 2.5, 16);
  // end caps are hemispheres
  const cap1 = new THREE.SphereGeometry(s * 0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap1.rotateX(Math.PI / 2);
  cap1.translate(0, s * 1.25, 0);
  const cap2 = new THREE.SphereGeometry(s * 0.45, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  cap2.rotateX(Math.PI / 2);
  cap2.translate(0, -s * 1.25, 0);
  return mergeGeos(mergeGeos(body, cap1), cap2);
}

// ─── BALLAST — sphere with weight ridge bands ───
function ballastGeo(s: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(s, 20, 14);
}

// ─── WEDGE-RAMP — triangular ramp ───
function wedgeRampGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [
    [-1, 0, -0.6], [1, 0, -0.6], [1, 0, 0.6], [-1, 0, 0.6], // base
    [-1, 0.8, -0.6], [1, 0.8, -0.6], // top back
  ];
  const ix: [number, number, number][] = [
    [0, 2, 1], [0, 3, 2], // base
    [0, 1, 5], [0, 5, 4], // front slope
    [2, 3, 4], [2, 4, 5], // back slope
    [0, 4, 3], // left
    [1, 2, 5], // right
  ];
  return build(p, ix, s);
}

// ─── DOME — hemisphere ───
function domeGeo(s: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
}

// ─── ARCH — freestanding archway ───
function archGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  const segments = 12;
  const innerR = 0.6, outerR = 0.8, depth = 0.3;
  // Front arch face
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI * (i / segments);
    const cos = Math.cos(a), sin = Math.sin(a);
    p.push([cos * innerR, sin * innerR + 0.8, -depth]);
    p.push([cos * outerR, sin * outerR + 0.8, -depth]);
  }
  // Back arch face
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI * (i / segments);
    const cos = Math.cos(a), sin = Math.sin(a);
    p.push([cos * innerR, sin * innerR + 0.8, depth]);
    p.push([cos * outerR, sin * outerR + 0.8, depth]);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 2, c = a + 1, d = a + 3;
    // front face
    ix.push([a, b, c], [c, b, d]);
    // back face
    ix.push([a + segments * 2 + 2, c + segments * 2 + 2, b + segments * 2 + 2]);
    ix.push([c + segments * 2 + 2, d + segments * 2 + 2, b + segments * 2 + 2]);
  }
  return build(p, ix, s);
}

// ─── TRUSS — lattice truss element ───
function trussGeo(s: number): THREE.BufferGeometry {
  const bar = 0.04;
  const nodes: [number, number, number][] = [
    [-0.8, -0.4, -0.3], [0.8, -0.4, -0.3], [0.8, 0.4, -0.3], [-0.8, 0.4, -0.3],
    [-0.8, -0.4, 0.3], [0.8, -0.4, 0.3], [0.8, 0.4, 0.3], [-0.8, 0.4, 0.3],
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0], // front
    [4, 5], [5, 6], [6, 7], [7, 4], // back
    [0, 4], [1, 5], [2, 6], [3, 7], // struts
    [0, 6], [1, 7], // diagonals
  ];
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  for (const [a, b] of edges) {
    const base = p.length;
    const [ax, ay, az] = nodes[a];
    const [bx, by, bz] = nodes[b];
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const nx = -dy / len * bar, ny = dx / len * bar;
    p.push([ax + nx, ay + ny, az], [ax - nx, ay - ny, az],
           [bx + nx, by + ny, bz], [bx - nx, by - ny, bz]);
    ix.push([base, base + 2, base + 1], [base + 1, base + 2, base + 3]);
  }
  return build(p, ix, s);
}

// ─── CAPSULE — pill shape (cylinder + hemispheres) ───
function capsuleGeo(s: number): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.3, 16);
  const cap1 = new THREE.SphereGeometry(s * 0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap1.rotateX(Math.PI / 2);
  cap1.translate(0, s * 0.65, 0);
  const cap2 = new THREE.SphereGeometry(s * 0.35, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  cap2.rotateX(Math.PI / 2);
  cap2.translate(0, -s * 0.65, 0);
  return mergeGeos(mergeGeos(body, cap1), cap2);
}

// ─── TURBINE — disc with radial blades ───
function turbineGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  const blades = 8;
  const hubR = 0.15, bladeR = 0.9, thickness = 0.06;
  // Hub
  p.push([0, thickness, 0], [0, -thickness, 0]);
  // Blade tips and roots
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    const twist = 0.3;
    // root
    p.push([cos * hubR, thickness, sin * hubR]);
    p.push([cos * hubR, -thickness, sin * hubR]);
    // tip (twisted)
    p.push([cos * bladeR, thickness + twist, sin * bladeR]);
    p.push([cos * bladeR, -thickness - twist, sin * bladeR]);
    // blade face
    const base = 2 + i * 4;
    ix.push([0, base, base + 2], [0, base + 2, 0]); // won't work well, use simpler
  }
  // Simplified: use a flat disc with notches
  const disc = new THREE.CylinderGeometry(s * 0.9, s * 0.9, s * 0.08, blades * 2);
  return disc;
}

// ─── TANK-VESSEL — horizontal pressure vessel with domed ends ───
function tankVesselGeo(s: number): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 1.8, 16);
  body.rotateZ(Math.PI / 2);
  const cap1 = new THREE.SphereGeometry(s * 0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap1.rotateZ(-Math.PI / 2);
  cap1.translate(s * 0.9, 0, 0);
  const cap2 = new THREE.SphereGeometry(s * 0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap2.rotateZ(Math.PI / 2);
  cap2.translate(-s * 0.9, 0, 0);
  return mergeGeos(mergeGeos(body, cap1), cap2);
}

// ─── PIPE-RUN — pipe section with flanges ───
function pipeRunGeo(s: number): THREE.BufferGeometry {
  const pipe = new THREE.CylinderGeometry(s * 0.25, s * 0.25, s * 2.5, 12);
  pipe.rotateX(Math.PI / 2);
  const flange1 = new THREE.CylinderGeometry(s * 0.38, s * 0.38, s * 0.08, 16);
  flange1.rotateX(Math.PI / 2);
  flange1.translate(0, 0, s * 1.2);
  const flange2 = new THREE.CylinderGeometry(s * 0.38, s * 0.38, s * 0.08, 16);
  flange2.rotateX(Math.PI / 2);
  flange2.translate(0, 0, -s * 1.2);
  return mergeGeos(mergeGeos(pipe, flange1), flange2);
}

// ─── DRAGON — low-poly dragon figure ───
function dragonGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  // Body: elongated diamond
  const body: [number, number, number][] = [
    [0, 0.3, -1.2],   // 0 tail tip
    [-0.3, 0, -0.6],  // 1 left mid
    [0, 0.5, -0.6],   // 2 top mid
    [0.3, 0, -0.6],   // 3 right mid
    [0, -0.15, -0.6], // 4 bottom mid
    [-0.4, 0, 0.2],   // 5 left front
    [0, 0.55, 0.2],   // 6 top front
    [0.4, 0, 0.2],    // 7 right front
    [0, -0.2, 0.2],   // 8 bottom front
    [-0.25, 0.1, 0.9],// 9 left head
    [0, 0.5, 0.9],    // 10 top head
    [0.25, 0.1, 0.9], // 11 right head
    [0, 0, 1.2],      // 12 snout
    [0, 0.35, 1.1],   // 13 forehead
  ];
  for (const v of body) p.push(v);
  // Tail segments
  ix.push([0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1]);
  // Mid body
  ix.push([1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 8], [3, 8, 4], [4, 8, 5], [4, 5, 1]);
  // Front body to head
  ix.push([5, 9, 10], [5, 10, 6], [6, 10, 11], [6, 11, 7], [7, 11, 8], [8, 9, 5]);
  // Snout
  ix.push([9, 12, 13], [9, 13, 10], [10, 13, 11], [11, 12, 9]);
  // Wings: two triangular sails
  const wingBase = p.length;
  p.push([-0.4, 0.4, 0], [-1.2, 0.9, -0.2], [-0.3, 0.3, -0.4]);
  p.push([0.4, 0.4, 0], [1.2, 0.9, -0.2], [0.3, 0.3, -0.4]);
  ix.push([wingBase, wingBase + 1, wingBase + 2]);
  ix.push([wingBase + 3, wingBase + 5, wingBase + 4]);
  // Legs: 4 small triangular feet
  const legBase = p.length;
  const legPts: [number, number, number][] = [
    [-0.25, -0.15, -0.3], [-0.35, -0.4, -0.2], [-0.15, -0.4, -0.4],
    [0.25, -0.15, -0.3], [0.35, -0.4, -0.2], [0.15, -0.4, -0.4],
    [-0.25, -0.15, 0.3], [-0.35, -0.4, 0.4], [-0.15, -0.4, 0.2],
    [0.25, -0.15, 0.3], [0.35, -0.4, 0.4], [0.15, -0.4, 0.2],
  ];
  for (const v of legPts) p.push(v);
  for (let i = 0; i < 4; i++) {
    const b = legBase + i * 3;
    ix.push([b, b + 1, b + 2]);
  }
  // Tail spikes
  const spikeBase = p.length;
  p.push([0, 0.45, -0.9], [0, 0.55, -0.7]);
  p.push([0, 0.45, -1.0], [0, 0.6, -0.8]);
  ix.push([spikeBase, spikeBase + 1, 2]);
  ix.push([spikeBase + 2, spikeBase + 3, 2]);
  return build(p, ix, s);
}

// ─── UFO — flying saucer with dome ───
function ufoGeo(s: number): THREE.BufferGeometry {
  const disc = new THREE.CylinderGeometry(s * 0.9, s * 0.9, s * 0.15, 24);
  const ring = new THREE.TorusGeometry(s * 0.85, s * 0.06, 8, 24);
  ring.rotateX(Math.PI / 2);
  const dome = new THREE.SphereGeometry(s * 0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, s * 0.08, 0);
  // underside light
  const light = new THREE.CylinderGeometry(s * 0.15, s * 0.15, s * 0.05, 8);
  light.translate(0, -s * 0.1, 0);
  return mergeGeos(mergeGeos(mergeGeos(disc, ring), dome), light);
}

// ─── KRAKEN — octopus-like creature ───
function krakenGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  // Head: bulbous dome
  const headSegs = 10, headRings = 6;
  for (let r = 0; r <= headRings; r++) {
    const phi = (r / headRings) * Math.PI * 0.6;
    const rr = Math.sin(phi) * 0.5;
    const yy = Math.cos(phi) * 0.5;
    for (let j = 0; j < headSegs; j++) {
      const theta = (j / headSegs) * Math.PI * 2;
      p.push([Math.cos(theta) * rr, yy + 0.3, Math.sin(theta) * rr]);
    }
  }
  for (let r = 0; r < headRings; r++) {
    for (let j = 0; j < headSegs; j++) {
      const a = r * headSegs + j, b = a + headSegs;
      ix.push([a, b, (a + 1) % headSegs + b], [(a + 1) % headSegs + b, (a + 1) % headSegs + r * headSegs, a]);
    }
  }
  // Tentacles: 8 curling arms
  const tentacles = 8;
  for (let t = 0; t < tentacles; t++) {
    const base = p.length;
    const angle = (t / tentacles) * Math.PI * 2;
    const segments = 6;
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const curl = frac * 2.5;
      const r = 0.12 * (1 - frac * 0.6);
      const x = Math.cos(angle + curl) * (0.3 + frac * 0.8);
      const z = Math.sin(angle + curl) * (0.3 + frac * 0.8);
      const y = -frac * 0.5;
      p.push([x + Math.cos(angle) * 0.15, y, z + Math.sin(angle) * 0.15]);
      p.push([x + Math.cos(angle) * 0.15 + r, y + r * 0.5, z + Math.sin(angle) * 0.15]);
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      ix.push([a, c, b], [b, c, d]);
    }
  }
  // Eyes: two small spheres (as flat quads)
  const eyeBase = p.length;
  p.push([-0.15, 0.5, 0.4], [-0.1, 0.55, 0.42], [-0.2, 0.55, 0.42]);
  p.push([0.15, 0.5, 0.4], [0.1, 0.55, 0.42], [0.2, 0.55, 0.42]);
  ix.push([eyeBase, eyeBase + 1, eyeBase + 2]);
  ix.push([eyeBase + 3, eyeBase + 5, eyeBase + 4]);
  return build(p, ix, s);
}

// ─── BUOY — navigational buoy ───
function buoyGeo(s: number): THREE.BufferGeometry {
  const p: [number, number, number][] = [];
  const ix: [number, number, number][] = [];
  // Body: tapered cylinder
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = (t - 0.5) * 2;
    const r = t < 0.2 ? 0.2 + t * 1.5 : t > 0.8 ? 0.2 + (1 - t) * 1.5 : 0.5;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      p.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j, b = a + 8, c = a + 1, d = b + 1;
      ix.push([a, b, c], [c, b, d]);
    }
  }
  // Top post
  const postBase = p.length;
  const topY = 1.0;
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * Math.PI * 2;
    p.push([Math.cos(a) * 0.06, topY, Math.sin(a) * 0.06]);
    p.push([Math.cos(a) * 0.06, topY + 0.5, Math.sin(a) * 0.06]);
  }
  for (let j = 0; j < 6; j++) {
    const a = postBase + j * 2, b = a + 1, c = a + 2, d = b + 2;
    ix.push([a, b, c], [c, b, d]);
  }
  return build(p, ix, s);
}

// ─── Merge helper: combines two BufferGeometries ───
function mergeGeos(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const pa = a.getAttribute("position");
  const pb = b.getAttribute("position");
  const ia = a.getIndex();
  const ib = b.getIndex();
  const va = new Float32Array(pa.array);
  const vb = new Float32Array(pb.array);
  const verts = new Float32Array(va.length + vb.length);
  verts.set(va);
  verts.set(vb, va.length);
  const numA = pa.count;
  const idxA = ia ? Array.from(ia.array) : Array.from({ length: numA }, (_, i) => i);
  const idxB = ib ? Array.from(ib.array) : Array.from({ length: pb.count }, (_, i) => i);
  const indices = new Uint32Array(idxA.length + idxB.length);
  indices.set(new Uint32Array(idxA));
  const offsetB = new Uint32Array(idxB.map((v: number) => v + numA));
  indices.set(offsetB, idxA.length);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

// ─── Public registry ───
const MODEL_GEO: Record<string, GeoFn> = {
  aerospace: aerospaceGeo,
  maritime: maritimeGeo,
  crate: crateGeo,
  "sphere-probe": sphereProbeGeo,
  beam: beamGeo,
  "plate-armor": plateArmorGeo,
  tool: toolGeo,
  container: containerGeo,
  ingot: ingotGeo,
  shell: shellGeo,
  "habitat-module": habitatModuleGeo,
  ballast: ballastGeo,
  "wedge-ramp": wedgeRampGeo,
  dome: domeGeo,
  arch: archGeo,
  truss: trussGeo,
  capsule: capsuleGeo,
  turbine: turbineGeo,
  "tank-vessel": tankVesselGeo,
  "pipe-run": pipeRunGeo,
  dragon: dragonGeo,
  ufo: ufoGeo,
  kraken: krakenGeo,
  buoy: buoyGeo,
};

// Geometry cache: same class + same size → reuse. Prevents regenerating
// identical BufferGeometry every frame for many bodies of the same kind.
const geoCache = new Map<string, THREE.BufferGeometry>();
const CACHE_MAX = 120;

/** Get geometry for a model class. Returns null if class unknown (use fallback). */
export function modelGeometry(modelClass: string, sizeM: number): THREE.BufferGeometry | null {
  const fn = MODEL_GEO[modelClass];
  if (!fn) return null;
  // Quantise size to 4 decimal places to hit cache for near-identical bodies
  const key = `${modelClass}:${sizeM.toFixed(4)}`;
  let geo = geoCache.get(key);
  if (!geo) {
    geo = fn(sizeM);
    if (geoCache.size >= CACHE_MAX) {
      // Evict oldest entry
      const first = geoCache.keys().next().value!;
      geoCache.delete(first);
    }
    geoCache.set(key, geo);
  }
  return geo;
}

/** Dispose all cached geometries (call on scene reset). */
export function disposeModelGeometries(): void {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
  disposeExtendedGeometries();
}
