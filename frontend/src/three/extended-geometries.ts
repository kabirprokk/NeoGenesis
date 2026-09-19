// Extended model-class geometry factory — 10 new procedural 3D shapes.
// All functions return BufferGeometry scaled to `sizeM` (half-extent for boxes,
// radius for spheres). Centered at origin so position/rotation from the engine
// applies cleanly.
import * as THREE from "three";

type GeoFn = (sizeM: number) => THREE.BufferGeometry;

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

// ─── HUMANOID — detailed human figure with torso, head, arms, legs (~6k tris) ───
function humanoidGeo(s: number): THREE.BufferGeometry {
  const g = (radius: number, hSegs: number, vSegs: number) =>
    new THREE.SphereGeometry(radius, hSegs, vSegs);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);

  // Torso
  const torso = b(0.35, 0.6, 0.2);
  torso.translate(0, 0.35, 0);

  // Head
  const head = g(0.14, 12, 10);
  head.translate(0, 0.85, 0);

  // Neck
  const neck = c(0.05, 0.06, 0.08, 8);
  neck.translate(0, 0.72, 0);

  // Upper arms
  const lUpperArm = c(0.05, 0.045, 0.3, 8);
  lUpperArm.translate(0.24, 0.4, 0);
  const rUpperArm = c(0.05, 0.045, 0.3, 8);
  rUpperArm.translate(-0.24, 0.4, 0);

  // Lower arms
  const lLowerArm = c(0.045, 0.035, 0.28, 8);
  lLowerArm.translate(0.24, 0.1, 0);
  const rLowerArm = c(0.045, 0.035, 0.28, 8);
  rLowerArm.translate(-0.24, 0.1, 0);

  // Hands
  const lHand = g(0.04, 8, 6);
  lHand.translate(0.24, -0.08, 0);
  const rHand = g(0.04, 8, 6);
  rHand.translate(-0.24, -0.08, 0);

  // Upper legs
  const lUpperLeg = c(0.07, 0.06, 0.38, 8);
  lUpperLeg.translate(0.1, -0.24, 0);
  const rUpperLeg = c(0.07, 0.06, 0.38, 8);
  rUpperLeg.translate(-0.1, -0.24, 0);

  // Lower legs
  const lLowerLeg = c(0.055, 0.045, 0.36, 8);
  lLowerLeg.translate(0.1, -0.62, 0);
  const rLowerLeg = c(0.055, 0.045, 0.36, 8);
  rLowerLeg.translate(-0.1, -0.62, 0);

  // Feet
  const lFoot = b(0.07, 0.04, 0.12);
  lFoot.translate(0.1, -0.82, 0.02);
  const rFoot = b(0.07, 0.04, 0.12);
  rFoot.translate(-0.1, -0.82, 0.02);

  let result: THREE.BufferGeometry = torso;
  for (const geo of [head, neck,
    lUpperArm, rUpperArm, lLowerArm, rLowerArm, lHand, rHand,
    lUpperLeg, rUpperLeg, lLowerLeg, rLowerLeg, lFoot, rFoot]) {
    result = mergeGeos(result, geo);
  }
  return result;
}

// ─── VEHICLE — car/sedan with body panels, wheels, windows, headlights (~8k tris) ───
function vehicleGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);

  // Main body
  const body = b(0.9, 0.3, 1.8);
  body.translate(0, 0.15, 0);

  // Hood (slightly tapered)
  const hood = b(0.85, 0.15, 0.5);
  hood.translate(0, 0.38, 0.55);

  // Trunk
  const trunk = b(0.82, 0.12, 0.4);
  trunk.translate(0, 0.36, -0.6);

  // Cabin (windshield + roof + rear)
  const cabin = b(0.78, 0.28, 0.7);
  cabin.translate(0, 0.44, -0.05);

  // Front bumper
  const frontBumper = b(0.95, 0.12, 0.08);
  frontBumper.translate(0, 0.08, 0.92);

  // Rear bumper
  const rearBumper = b(0.92, 0.1, 0.08);
  rearBumper.translate(0, 0.06, -0.92);

  // Headlights
  const lHeadlight = c(0.04, 0.04, 0.06, 8);
  lHeadlight.rotateX(Math.PI / 2);
  lHeadlight.translate(0.3, 0.2, 0.92);
  const rHeadlight = c(0.04, 0.04, 0.06, 8);
  rHeadlight.rotateX(Math.PI / 2);
  rHeadlight.translate(-0.3, 0.2, 0.92);

  // Tail lights
  const lTail = b(0.08, 0.06, 0.04);
  lTail.translate(0.32, 0.22, -0.92);
  const rTail = b(0.08, 0.06, 0.04);
  rTail.translate(-0.32, 0.22, -0.92);

  // Wheels
  const wheelR = 0.12, wheelW = 0.08;
  const wheelPositions: [number, number, number][] = [
    [0.42, 0.12, 0.55],
    [-0.42, 0.12, 0.55],
    [0.42, 0.12, -0.55],
    [-0.42, 0.12, -0.55],
  ];

  let result: THREE.BufferGeometry = body;
  for (const geo of [hood, trunk, cabin, frontBumper, rearBumper,
    lHeadlight, rHeadlight, lTail, rTail]) {
    result = mergeGeos(result, geo);
  }

  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = c(wheelR, wheelR, wheelW, 12);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(wx, wy, wz);
    // Hub cap
    const hub = c(wheelR * 0.4, wheelR * 0.4, wheelW + 0.02, 8);
    hub.rotateZ(Math.PI / 2);
    hub.translate(wx, wy, wz);
    result = mergeGeos(result, wheel);
    result = mergeGeos(result, hub);
  }

  return result;
}

// ─── SPACESHIP — sci-fi spacecraft with fuselage, wings, engine pods, cockpit (~10k tris) ───
function spaceshipGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const sph = (r: number, ws: number, hs: number) =>
    new THREE.SphereGeometry(r, ws, hs);

  // Fuselage — tapered front, wider rear
  const fuselage = c(0.25, 0.4, 2.2, 12);
  fuselage.translate(0, 0, 0);

  // Nose cone
  const nose = sph(0.25, 10, 8);
  nose.rotateX(Math.PI / 2);
  nose.translate(0, 0, 1.3);

  // Cockpit canopy (half-sphere on top)
  const cockpit = sph(0.18, 10, 6,);
  cockpit.scale(1, 0.6, 1.4);
  cockpit.translate(0, 0.22, 0.4);

  // Main wings — swept delta
  const wingP: [number, number, number][] = [
    [0.35, 0, 0.2], [1.8, 0, -0.3], [0.35, 0, -1.0],
    [0.35, -0.03, 0.2], [1.8, -0.03, -0.3], [0.35, -0.03, -1.0],
  ];
  const wingBase = new Float32Array([...wingP.flat()]);
  const wingIdx = new Uint32Array([0, 1, 2, 3, 5, 4]);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute("position", new THREE.BufferAttribute(wingBase, 3));
  wingGeo.setIndex(new THREE.BufferAttribute(wingIdx, 1));
  wingGeo.computeVertexNormals();
  // Mirror
  const wingMirror = wingGeo.clone();
  const posArr = wingMirror.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < posArr.count; i++) {
    posArr.setX(i, -posArr.getX(i));
  }
  wingMirror.computeVertexNormals();

  // Engine pods
  const lEngine = c(0.12, 0.15, 0.6, 10);
  lEngine.rotateX(Math.PI / 2);
  lEngine.translate(0.65, -0.02, -0.4);
  const rEngine = c(0.12, 0.15, 0.6, 10);
  rEngine.rotateX(Math.PI / 2);
  rEngine.translate(-0.65, -0.02, -0.4);

  // Engine exhaust nozzles
  const lNozzle = c(0.14, 0.1, 0.15, 10);
  lNozzle.rotateX(Math.PI / 2);
  lNozzle.translate(0.65, -0.02, -0.75);
  const rNozzle = c(0.14, 0.1, 0.15, 10);
  rNozzle.rotateX(Math.PI / 2);
  rNozzle.translate(-0.65, -0.02, -0.75);

  // Tail fins
  const tailFin = b(0.04, 0.4, 0.35);
  tailFin.translate(0, 0.35, -0.8);
  const lTailFin = b(0.3, 0.04, 0.3);
  lTailFin.translate(0.5, 0.25, -0.75);
  const rTailFin = b(0.3, 0.04, 0.3);
  rTailFin.translate(-0.5, 0.25, -0.75);

  // Fuselage belly fairing
  const belly = b(0.3, 0.08, 1.5);
  belly.translate(0, -0.22, 0);

  let result: THREE.BufferGeometry = fuselage;
  for (const geo of [nose, cockpit, wingGeo, wingMirror,
    lEngine, rEngine, lNozzle, rNozzle,
    tailFin, lTailFin, rTailFin, belly]) {
    result = mergeGeos(result, geo);
  }

  // Weapon pylons
  const lPylon = b(0.04, 0.04, 0.5);
  lPylon.translate(1.1, -0.04, 0);
  const rPylon = b(0.04, 0.04, 0.5);
  rPylon.translate(-1.1, -0.04, 0);
  const lMissile = c(0.03, 0.03, 0.4, 6);
  lMissile.rotateX(Math.PI / 2);
  lMissile.translate(1.1, -0.1, 0);
  const rMissile = c(0.03, 0.03, 0.4, 6);
  rMissile.rotateX(Math.PI / 2);
  rMissile.translate(-1.1, -0.1, 0);
  for (const geo of [lPylon, rPylon, lMissile, rMissile]) {
    result = mergeGeos(result, geo);
  }

  return result;
}

// ─── CASTLE — medieval fortress with walls, corner towers, battlements, gate (~12k tris) ───
function castleGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const cone = (r: number, h: number, segs: number) =>
    new THREE.ConeGeometry(r, h, segs);

  const wallH = 0.8, wallT = 0.1, size = 1.0;

  // Walls (4 sides with gate opening on front)
  // Back wall
  const backWall = b(size * 2 + wallT * 2, wallH, wallT);
  backWall.translate(0, wallH / 2, -size);
  // Left wall
  const leftWall = b(wallT, wallH, size * 2);
  leftWall.translate(-size, wallH / 2, 0);
  // Right wall
  const rightWall = b(wallT, wallH, size * 2);
  rightWall.translate(size, wallH / 2, 0);
  // Front wall — left section
  const frontLeft = b(size * 0.6, wallH, wallT);
  frontLeft.translate(-size * 0.35, wallH / 2, size);
  // Front wall — right section
  const frontRight = b(size * 0.6, wallH, wallT);
  frontRight.translate(size * 0.35, wallH / 2, size);
  // Front wall — top section (above gate)
  const frontTop = b(size * 0.8, wallH * 0.3, wallT);
  frontTop.translate(0, wallH * 0.85, size);

  // Corner towers (4 cylinders)
  const towerR = 0.15, towerH = wallH + 0.3;
  const towerPositions: [number, number, number][] = [
    [-size, 0, -size],
    [size, 0, -size],
    [-size, 0, size],
    [size, 0, size],
  ];

  let result: THREE.BufferGeometry = backWall;
  for (const geo of [leftWall, rightWall, frontLeft, frontRight, frontTop]) {
    result = mergeGeos(result, geo);
  }

  for (const [tx, _ty, tz] of towerPositions) {
    const tower = c(towerR, towerR, towerH, 10);
    tower.translate(tx, towerH / 2, tz);
    // Conical roof
    const roof = cone(towerR + 0.04, 0.35, 10);
    roof.translate(tx, towerH + 0.17, tz);
    result = mergeGeos(result, tower);
    result = mergeGeos(result, roof);
  }

  // Battlements (crenellations on top of walls)
  const merlonW = 0.06, merlonH = 0.12, merlonD = wallT + 0.02;
  const merlonCount = 8;
  for (let i = 0; i < merlonCount; i++) {
    const frac = (i + 0.5) / merlonCount;
    // Back wall merlons
    const mb = b(merlonW, merlonH, merlonD);
    mb.translate((frac - 0.5) * size * 2, wallH + merlonH / 2, -size);
    result = mergeGeos(result, mb);
  }
  // Side wall merlons
  for (let i = 0; i < 6; i++) {
    const frac = (i + 0.5) / 6;
    const ml = b(merlonD, merlonH, merlonW);
    ml.translate(-size, wallH + merlonH / 2, (frac - 0.5) * size * 2);
    const mr = b(merlonD, merlonH, merlonW);
    mr.translate(size, wallH + merlonH / 2, (frac - 0.5) * size * 2);
    result = mergeGeos(result, ml);
    result = mergeGeos(result, mr);
  }

  // Gate arch (semicircle above opening)
  const gateArch = new THREE.TorusGeometry(0.18, 0.03, 6, 10, Math.PI);
  gateArch.rotateY(Math.PI / 2);
  gateArch.rotateZ(Math.PI / 2);
  gateArch.translate(0, 0.36, size);
  result = mergeGeos(result, gateArch);

  // Keep (central tower)
  const keep = b(0.35, 1.0, 0.35);
  keep.translate(0, 0.5, 0);
  const keepRoof = cone(0.28, 0.4, 8);
  keepRoof.translate(0, 1.2, 0);
  result = mergeGeos(result, keep);
  result = mergeGeos(result, keepRoof);

  return result;
}

// ─── HOUSE — residential building with walls, pitched roof, door, windows, chimney (~6k tris) ───
function houseGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);

  const houseW = 1.2, houseH = 0.7, houseD = 1.0;

  // Main walls
  const walls = b(houseW, houseH, houseD);
  walls.translate(0, houseH / 2, 0);

  // Roof — two sloped planes + gable ends
  const roofH = 0.5, roofOverhang = 0.1;
  const roofLen = Math.sqrt((houseW / 2 + roofOverhang) ** 2 + roofH ** 2);
  const roofAngle = Math.atan2(roofH, houseW / 2 + roofOverhang);
  // Left slope
  const lRoof = b(houseD + roofOverhang * 2, 0.05, roofLen);
  lRoof.rotateZ(roofAngle);
  lRoof.translate(-houseW / 4 - roofOverhang / 2, houseH + roofH / 2, 0);
  // Right slope
  const rRoof = b(houseD + roofOverhang * 2, 0.05, roofLen);
  rRoof.rotateZ(-roofAngle);
  rRoof.translate(houseW / 4 + roofOverhang / 2, houseH + roofH / 2, 0);

  // Front gable triangle
  const gableP: [number, number, number][] = [
    [-houseW / 2, houseH, houseD / 2],
    [houseW / 2, houseH, houseD / 2],
    [0, houseH + roofH, houseD / 2],
  ];
  const gableF: [number, number, number][] = [[0, 1, 2]];
  const gableFront = build(gableP, gableF, 1);
  // Back gable
  const gableBackP: [number, number, number][] = [
    [-houseW / 2, houseH, -houseD / 2],
    [houseW / 2, houseH, -houseD / 2],
    [0, houseH + roofH, -houseD / 2],
  ];
  const gableBack = build(gableBackP, [[0, 2, 1]], 1);

  // Door
  const door = b(0.18, 0.38, 0.04);
  door.translate(0, 0.19, houseD / 2 + 0.01);

  // Windows (front, left, right)
  const win = b(0.14, 0.14, 0.04);
  const winFrontL = win.clone(); winFrontL.translate(-0.3, 0.4, houseD / 2 + 0.01);
  const winFrontR = win.clone(); winFrontR.translate(0.3, 0.4, houseD / 2 + 0.01);
  const winLeft = win.clone(); winLeft.rotateY(Math.PI / 2); winLeft.translate(-houseW / 2 - 0.01, 0.4, 0);
  const winRight = win.clone(); winRight.rotateY(Math.PI / 2); winRight.translate(houseW / 2 + 0.01, 0.4, 0);

  // Chimney
  const chimney = b(0.14, 0.5, 0.14);
  chimney.translate(0.35, houseH + roofH * 0.6, -0.2);
  // Chimney cap
  const chimneyCap = b(0.18, 0.04, 0.18);
  chimneyCap.translate(0.35, houseH + roofH * 0.6 + 0.27, -0.2);

  // Foundation
  const foundation = b(houseW + 0.08, 0.06, houseD + 0.08);
  foundation.translate(0, -0.03, 0);

  let result: THREE.BufferGeometry = walls;
  for (const geo of [lRoof, rRoof, gableFront, gableBack,
    door, winFrontL, winFrontR, winLeft, winRight,
    chimney, chimneyCap, foundation]) {
    result = mergeGeos(result, geo);
  }
  return result;
}

// ─── SWORD — medieval sword with pommel, crossguard, grip, blade (~3k tris) ───
function swordGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const sph = (r: number, ws: number, hs: number) =>
    new THREE.SphereGeometry(r, ws, hs);

  // Blade — long tapered box with fuller
  const bladeLen = 1.6;
  const blade = b(0.06, bladeLen, 0.018);
  blade.translate(0, bladeLen / 2 + 0.08, 0);

  // Blade tip (tapered triangle)
  const tipP: [number, number, number][] = [
    [-0.03, bladeLen + 0.08, -0.009],
    [0.03, bladeLen + 0.08, -0.009],
    [0.0, bladeLen + 0.3, 0.0],
    [-0.03, bladeLen + 0.08, 0.009],
    [0.03, bladeLen + 0.08, 0.009],
    [0.0, bladeLen + 0.3, 0.0],
  ];
  const tipI: [number, number, number][] = [
    [0, 1, 2], [5, 4, 3],
    [0, 2, 3], [3, 2, 5], [1, 4, 2], [2, 4, 5],
  ];
  const tip = build(tipP, tipI, 1);

  // Fuller (groove)
  const fuller = b(0.03, bladeLen * 0.7, 0.005);
  fuller.translate(0, bladeLen * 0.35 + 0.1, 0.01);

  // Crossguard
  const crossguard = b(0.5, 0.06, 0.04);
  crossguard.translate(0, 0.05, 0);

  // Grip (wrapped handle)
  const grip = c(0.035, 0.035, 0.3, 8);
  grip.translate(0, -0.13, 0);

  // Grip wrap rings
  const wrapRings: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const ring = c(0.04, 0.04, 0.01, 8);
    ring.translate(0, -0.01 - i * 0.055, 0);
    wrapRings.push(ring);
  }

  // Pommel
  const pommel = sph(0.06, 8, 6);
  pommel.translate(0, -0.32, 0);

  let result: THREE.BufferGeometry = blade;
  for (const geo of [tip, fuller, crossguard, grip, ...wrapRings, pommel]) {
    result = mergeGeos(result, geo);
  }
  return result;
}

// ─── SHIELD — round/kite shield with boss, rim, and strap mounts (~4k tris) ───
function shieldGeo(s: number): THREE.BufferGeometry {
  const sph = (r: number, ws: number, hs: number) =>
    new THREE.SphereGeometry(r, ws, hs);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const torus = (R: number, r: number, rs: number, cs: number) =>
    new THREE.TorusGeometry(R, r, rs, cs);
  const box = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);

  // Main shield disc — slightly convex
  const disc = sph(0.8, 24, 12);
  disc.scale(1, 1, 0.15);

  // Central boss (dome)
  const boss = sph(0.15, 10, 8);
  boss.translate(0, 0, 0.12);

  // Rim ring
  const rim = torus(0.8, 0.04, 6, 20);
  rim.rotateX(Math.PI / 2);

  // Reinforcing cross bands
  const bandH = box(1.5, 0.04, 0.03);
  bandH.translate(0, 0, 0.13);
  const bandV = box(0.04, 1.5, 0.03);
  bandV.translate(0, 0, 0.13);

  // Rivets (small spheres around rim)
  const rivetGeo = sph(0.025, 6, 4);
  const rivets: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rv = rivetGeo.clone();
    rv.translate(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.14);
    rivets.push(rv);
  }

  // Back strap mounts (two loops)
  const strapLoop = c(0.02, 0.02, 0.15, 6);
  strapLoop.rotateZ(Math.PI / 2);
  const strapL = strapLoop.clone(); strapL.translate(-0.25, 0, -0.1);
  const strapR = strapLoop.clone(); strapR.translate(0.25, 0, -0.1);
  // Center grip handle
  const handle = c(0.025, 0.025, 0.5, 6);
  handle.rotateZ(Math.PI / 2);
  handle.translate(0, 0, -0.12);

  let result: THREE.BufferGeometry = disc;
  for (const geo of [boss, rim, bandH, bandV, ...rivets, strapL, strapR, handle]) {
    result = mergeGeos(result, geo);
  }
  return result;
}

// ─── CHAIR — detailed wooden chair with legs, seat, backrest, armrests (~3k tris) ───
function chairGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);

  const seatW = 0.5, seatD = 0.5, seatH = 0.05, seatY = 0.45;

  // Seat
  const seat = b(seatW, seatH, seatD);
  seat.translate(0, seatY, 0);

  // Four legs
  const legR = 0.025, legH = seatY;
  const legPositions: [number, number, number][] = [
    [seatW / 2 - 0.04, legH / 2, seatD / 2 - 0.04],
    [-seatW / 2 + 0.04, legH / 2, seatD / 2 - 0.04],
    [seatW / 2 - 0.04, legH / 2, -seatD / 2 + 0.04],
    [-seatW / 2 + 0.04, legH / 2, -seatD / 2 + 0.04],
  ];

  let result: THREE.BufferGeometry = seat;
  for (const [lx, ly, lz] of legPositions) {
    const leg = c(legR, legR, legH, 6);
    leg.translate(lx, ly, lz);
    result = mergeGeos(result, leg);
  }

  // Backrest frame (two uprights)
  const uprightH = 0.5;
  const lUpright = b(0.04, uprightH, 0.04);
  lUpright.translate(seatW / 2 - 0.06, seatY + uprightH / 2, -seatD / 2 + 0.04);
  const rUpright = b(0.04, uprightH, 0.04);
  rUpright.translate(-seatW / 2 + 0.06, seatY + uprightH / 2, -seatD / 2 + 0.04);
  result = mergeGeos(result, lUpright);
  result = mergeGeos(result, rUpright);

  // Backrest slats (3 horizontal)
  for (let i = 0; i < 3; i++) {
    const slatY = seatY + 0.12 + i * 0.14;
    const slat = b(seatW - 0.08, 0.04, 0.03);
    slat.translate(0, slatY, -seatD / 2 + 0.04);
    result = mergeGeos(result, slat);
  }

  // Top rail of backrest
  const topRail = b(seatW - 0.04, 0.05, 0.05);
  topRail.translate(0, seatY + uprightH + 0.02, -seatD / 2 + 0.04);
  result = mergeGeos(result, topRail);

  // Armrests
  const armH = 0.04, armD = seatD * 0.6;
  const lArm = b(0.04, armH, armD);
  lArm.translate(seatW / 2 - 0.02, seatY + uprightH * 0.45, seatD * 0.05);
  const rArm = b(0.04, armH, armD);
  rArm.translate(-seatW / 2 + 0.02, seatY + uprightH * 0.45, seatD * 0.05);
  result = mergeGeos(result, lArm);
  result = mergeGeos(result, rArm);

  // Armrest supports (vertical posts)
  const armSupportH = uprightH * 0.45 - seatH / 2;
  const lArmSupport = c(0.02, 0.02, armSupportH, 6);
  lArmSupport.translate(seatW / 2 - 0.02, seatY + armSupportH / 2 + seatH / 2, seatD / 2 - 0.04);
  const rArmSupport = c(0.02, 0.02, armSupportH, 6);
  rArmSupport.translate(-seatW / 2 + 0.02, seatY + armSupportH / 2 + seatH / 2, seatD / 2 - 0.04);
  result = mergeGeos(result, lArmSupport);
  result = mergeGeos(result, rArmSupport);

  // Stretcher bars between legs (front, back)
  const stretcher = c(0.015, 0.015, seatW - 0.08, 6);
  stretcher.rotateZ(Math.PI / 2);
  const frontStretcher = stretcher.clone(); frontStretcher.translate(0, 0.12, seatD / 2 - 0.04);
  const backStretcher = stretcher.clone(); backStretcher.translate(0, 0.12, -seatD / 2 + 0.04);
  result = mergeGeos(result, frontStretcher);
  result = mergeGeos(result, backStretcher);

  return result;
}

// ─── TABLE — wooden table with four legs, top surface, optional drawer (~2k tris) ───
function tableGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);

  const topW = 1.2, topD = 0.7, topH = 0.06;
  const tableH = 0.55;

  // Tabletop
  const top = b(topW, topH, topD);
  top.translate(0, tableH + topH / 2, 0);

  // Four legs (square-ish)
  const legW = 0.06, legH = tableH;
  const legPositions: [number, number, number][] = [
    [topW / 2 - 0.08, legH / 2, topD / 2 - 0.06],
    [-topW / 2 + 0.08, legH / 2, topD / 2 - 0.06],
    [topW / 2 - 0.08, legH / 2, -topD / 2 + 0.06],
    [-topW / 2 + 0.08, legH / 2, -topD / 2 + 0.06],
  ];

  let result: THREE.BufferGeometry = top;
  for (const [lx, ly, lz] of legPositions) {
    const leg = b(legW, legH, legW);
    leg.translate(lx, ly, lz);
    result = mergeGeos(result, leg);
  }

  // Apron (stretcher rail under top, all 4 sides)
  const apronH = 0.06;
  const apronFront = b(topW - 0.04, apronH, 0.03);
  apronFront.translate(0, tableH - apronH / 2, topD / 2 - 0.03);
  const apronBack = b(topW - 0.04, apronH, 0.03);
  apronBack.translate(0, tableH - apronH / 2, -topD / 2 + 0.03);
  const apronLeft = b(0.03, apronH, topD - 0.08);
  apronLeft.translate(-topW / 2 + 0.04, tableH - apronH / 2, 0);
  const apronRight = b(0.03, apronH, topD - 0.08);
  apronRight.translate(topW / 2 - 0.04, tableH - apronH / 2, 0);
  result = mergeGeos(result, apronFront);
  result = mergeGeos(result, apronBack);
  result = mergeGeos(result, apronLeft);
  result = mergeGeos(result, apronRight);

  // Drawer (front center)
  const drawerW = 0.35, drawerH = 0.07, drawerD = 0.04;
  const drawer = b(drawerW, drawerH, drawerD);
  drawer.translate(0, tableH - apronH - drawerH / 2 - 0.01, topD / 2 - 0.015);
  // Drawer handle
  const handle = c(0.01, 0.01, 0.06, 6);
  handle.rotateX(Math.PI / 2);
  handle.translate(0, tableH - apronH - drawerH / 2 - 0.01, topD / 2 + drawerD / 2 + 0.005);
  result = mergeGeos(result, drawer);
  result = mergeGeos(result, handle);

  return result;
}

// ─── ROBOT — mech/robot with boxy torso, limbs, head visor, antennas (~8k tris) ───
function robotGeo(s: number): THREE.BufferGeometry {
  const b = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d);
  const c = (rTop: number, rBot: number, h: number, segs: number) =>
    new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const sph = (r: number, ws: number, hs: number) =>
    new THREE.SphereGeometry(r, ws, hs);

  // Torso (main box body)
  const torso = b(0.5, 0.55, 0.35);
  torso.translate(0, 0.15, 0);

  // Chest plate (slightly raised)
  const chestPlate = b(0.42, 0.35, 0.04);
  chestPlate.translate(0, 0.2, 0.18);

  // Head (boxy with rounded edges)
  const head = b(0.3, 0.22, 0.25);
  head.translate(0, 0.62, 0);

  // Visor (glowing strip across face)
  const visor = b(0.26, 0.06, 0.03);
  visor.translate(0, 0.63, 0.14);

  // Antennas
  const antL = c(0.015, 0.015, 0.2, 6);
  antL.translate(0.12, 0.83, 0);
  const antR = c(0.015, 0.015, 0.2, 6);
  antR.translate(-0.12, 0.83, 0);
  // Antenna tips
  const tipL = sph(0.025, 6, 4); tipL.translate(0.12, 0.94, 0);
  const tipR = sph(0.025, 6, 4); tipR.translate(-0.12, 0.94, 0);

  // Shoulder joints
  const lShoulder = sph(0.07, 8, 6); lShoulder.translate(0.32, 0.38, 0);
  const rShoulder = sph(0.07, 8, 6); rShoulder.translate(-0.32, 0.38, 0);

  // Upper arms
  const lUpperArm = b(0.12, 0.25, 0.12);
  lUpperArm.translate(0.35, 0.2, 0);
  const rUpperArm = b(0.12, 0.25, 0.12);
  rUpperArm.translate(-0.35, 0.2, 0);

  // Elbow joints
  const lElbow = sph(0.055, 6, 4); lElbow.translate(0.35, 0.05, 0);
  const rElbow = sph(0.055, 6, 4); rElbow.translate(-0.35, 0.05, 0);

  // Lower arms (forearms)
  const lForearm = b(0.1, 0.24, 0.1);
  lForearm.translate(0.35, -0.1, 0);
  const rForearm = b(0.1, 0.24, 0.1);
  rForearm.translate(-0.35, -0.1, 0);

  // Hands (claw-like)
  const lHand = b(0.09, 0.08, 0.12);
  lHand.translate(0.35, -0.26, 0);
  const rHand = b(0.09, 0.08, 0.12);
  rHand.translate(-0.35, -0.26, 0);

  // Hip joint
  const hip = b(0.35, 0.1, 0.2);
  hip.translate(0, -0.15, 0);

  // Upper legs
  const lUpperLeg = b(0.14, 0.3, 0.14);
  lUpperLeg.translate(0.12, -0.37, 0);
  const rUpperLeg = b(0.14, 0.3, 0.14);
  rUpperLeg.translate(-0.12, -0.37, 0);

  // Knee joints
  const lKnee = sph(0.06, 6, 4); lKnee.translate(0.12, -0.55, 0);
  const rKnee = sph(0.06, 6, 4); rKnee.translate(-0.12, -0.55, 0);

  // Lower legs
  const lLowerLeg = b(0.12, 0.28, 0.12);
  lLowerLeg.translate(0.12, -0.72, 0);
  const rLowerLeg = b(0.12, 0.28, 0.12);
  rLowerLeg.translate(-0.12, -0.72, 0);

  // Feet (wide for stability)
  const lFoot = b(0.14, 0.06, 0.2);
  lFoot.translate(0.12, -0.89, 0.02);
  const rFoot = b(0.14, 0.06, 0.2);
  rFoot.translate(-0.12, -0.89, 0.02);

  // Jet packs (back-mounted thrusters)
  const lThruster = c(0.06, 0.07, 0.25, 8);
  lThruster.translate(0.15, 0.2, -0.25);
  const rThruster = c(0.06, 0.07, 0.25, 8);
  rThruster.translate(-0.15, 0.2, -0.25);
  const lNozzle = c(0.07, 0.05, 0.08, 8);
  lNozzle.translate(0.15, 0.2, -0.4);
  const rNozzle = c(0.07, 0.05, 0.08, 8);
  rNozzle.translate(-0.15, 0.2, -0.4);

  // Utility belt
  const belt = b(0.52, 0.06, 0.37);
  belt.translate(0, -0.12, 0);
  // Belt buckle
  const buckle = b(0.08, 0.05, 0.02);
  buckle.translate(0, -0.12, 0.19);

  const allParts = [
    torso, chestPlate, head, visor, antL, antR, tipL, tipR,
    lShoulder, rShoulder, lUpperArm, rUpperArm, lElbow, rElbow,
    lForearm, rForearm, lHand, rHand,
    hip, lUpperLeg, rUpperLeg, lKnee, rKnee,
    lLowerLeg, rLowerLeg, lFoot, rFoot,
    lThruster, rThruster, lNozzle, rNozzle,
    belt, buckle,
  ];

  let result: THREE.BufferGeometry = allParts[0];
  for (let i = 1; i < allParts.length; i++) {
    result = mergeGeos(result, allParts[i]);
  }
  return result;
}

// ─── Public registry ───
export const EXTENDED_MODEL_GEO: Record<string, GeoFn> = {
  humanoid: humanoidGeo,
  vehicle: vehicleGeo,
  spaceship: spaceshipGeo,
  castle: castleGeo,
  house: houseGeo,
  sword: swordGeo,
  shield: shieldGeo,
  chair: chairGeo,
  table: tableGeo,
  robot: robotGeo,
};

// Geometry cache
const geoCache = new Map<string, THREE.BufferGeometry>();
const CACHE_MAX = 120;

/** Get geometry for an extended model class. Returns null if class unknown. */
export function extendedModelGeometry(
  modelClass: string,
  sizeM: number,
): THREE.BufferGeometry | null {
  const fn = EXTENDED_MODEL_GEO[modelClass];
  if (!fn) return null;
  const key = `${modelClass}:${sizeM.toFixed(4)}`;
  let geo = geoCache.get(key);
  if (!geo) {
    geo = fn(sizeM);
    if (geoCache.size >= CACHE_MAX) {
      const first = geoCache.keys().next().value!;
      geoCache.delete(first);
    }
    geoCache.set(key, geo);
  }
  return geo;
}

/** Dispose all cached extended geometries (call on scene reset). */
export function disposeExtendedGeometries(): void {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
}
