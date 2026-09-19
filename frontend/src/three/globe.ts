// Sky: atmosphere shell + sun/moon lights + REAL star + planet field.
// No planet mesh — the game is a plane lab; the sky is a time-of-day lab
// condition showing the real Earth sky (real sun/moon math + J2000 bright
// stars + JPL naked-eye planets). The plane is NOT a planet.
//
// Lighting honesty: the sun follows Beer–Lambert extinction + blackbody color
// (engine physics), the moon follows phase×altitude illuminance with a
// documented scotopic boost (true moonlight is ~10⁻⁶ of noon sun — invisible
// without eye-like exposure compensation), and bounce light is a hemisphere
// whose ground color is sun × ground albedo. Directional sun/moon ARE the
// correct finite-c representation at lab scale: the whole 4 km plane sees
// parallel rays, and light crosses it in 13 µs ≪ one frame, so flashes render
// immediately (the verdicts quote the microseconds instead of faking travel).
import * as THREE from "three";
import { ATMOS_FRAG, ATMOS_VERT } from "./atmosphere.js";
import { DEFAULT_ERA } from "../../../shared/src/era.js";
import { equatorialToHorizontal, moonState, planetStates, sunPosition } from "../../../shared/src/astro.js";
import { BRIGHT_STARS, bvToRGB } from "./brightStars.js";
import { kelvinToRGBapprox, moonIlluminanceLux, solarIlluminanceLux, sunColorTempK } from "../../../engine/src/physics.js";

export interface SkyState {
  sunDir: THREE.Vector3; nightFactor: number; dayFactor: number;
  sunAlt: number; moonPhase: number; moonIllum: number;
  sunLux: number; sunTempK: number; moonLux: number;
  /** three.js directional intensity for the sun (noon ≈ 2.9, same look as before). */
  sunI: number; moonI: number;
}

export function buildGlobe(scene: THREE.Scene) {
  const R = 6371; // scene units scaled (1 unit = 1 km, camera near-field trick)

  const atmosMat = new THREE.ShaderMaterial({
    vertexShader: ATMOS_VERT, fragmentShader: ATMOS_FRAG,
    side: THREE.BackSide, transparent: false, depthWrite: false,
    uniforms: {
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      rayleigh: { value: new THREE.Vector3(...DEFAULT_ERA.atmosphere.rayleigh) },
      mieStrength: { value: DEFAULT_ERA.atmosphere.mieStrength },
      mieG: { value: DEFAULT_ERA.atmosphere.mieG },
      dayZenith: { value: new THREE.Color(0x2a5a9e) },
      sunsetTint: { value: new THREE.Color(0xd96b32) },
      nightZenith: { value: new THREE.Color(0x02040a) },
      nightFactor: { value: 0 },
    },
  });
  const atmos = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 96, 64), atmosMat);
  scene.add(atmos);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  // Real-time shadows in a ±80 m box around the player (repositioned every frame).
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  scene.add(sun); scene.add(sun.target);
  const moon = new THREE.DirectionalLight(0x8fa3c7, 0.0);
  scene.add(moon); scene.add(moon.target);
  scene.add(new THREE.AmbientLight(0x223344, 0.35));

  // REAL stars: J2000 bright-star places (brightStars.ts) on a shell INSIDE
  // the camera far-plane, fog off. Positions recomputed per frame from
  // RA/Dec + LST (equatorialToHorizontal) so looking up shows the true sky
  // for the player's lat/lon/date. Brightness encodes V magnitude.
  const starGeo = new THREE.BufferGeometry();
  const N = BRIGHT_STARS.length, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const starR = R * 1.18;
  for (let i = 0; i < N; i++) {
    const s = BRIGHT_STARS[i];
    const [r, g, b2] = bvToRGB(s.bv);
    const bright = Math.max(0.25, Math.min(1.4, 1.55 - 0.28 * s.vmag));
    col[i*3] = Math.min(1, r * bright); col[i*3+1] = Math.min(1, g * bright); col[i*3+2] = Math.min(1, b2 * bright);
    pos[i*3+1] = -starR * 2; // parked below until first updateSky places them
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.6, vertexColors: true, transparent: true, opacity: 0, sizeAttenuation: false, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);
  // REAL naked-eye planets (JPL elements via planetStates): 7 points, true
  // colors, sized by magnitude. Updated per frame in updateSky.
  const planetGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(7 * 3), pCol = new Float32Array(7 * 3);
  planetGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  planetGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const planetMat = new THREE.PointsMaterial({ size: 5.5, vertexColors: true, transparent: true, opacity: 0, sizeAttenuation: false, depthWrite: false, fog: false });
  const planets = new THREE.Points(planetGeo, planetMat);
  planets.frustumCulled = false;
  scene.add(planets);

  // Moon billboard — inside the far-plane with fog off (the old code scaled
  // the direction vector twice, parking the moon at ~10¹⁵ units: invisible).
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 0.02, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xdde4ee, fog: false }));
  moonMesh.frustumCulled = false;
  scene.add(moonMesh);

  return { atmosMat, starMat, planetMat, starGeo, planetGeo, sun, moon, moonMesh, R };
}

export function updateSky(handles: ReturnType<typeof buildGlobe>, dateUtc: Date, lat: number, lon: number, cloud01 = 0): SkyState {
  const s = sunPosition(dateUtc, lat, lon);
  const m = moonState(dateUtc, lat, lon);
  const altR = (s.altitudeDeg * Math.PI) / 180, azR = (s.azimuthDeg * Math.PI) / 180;
  const sunDir = new THREE.Vector3(
    Math.cos(altR) * Math.sin(azR), Math.sin(altR), -Math.cos(altR) * Math.cos(azR)).normalize();
  handles.sun.position.copy(sunDir.clone().multiplyScalar(handles.R * 5));
  const nightFactor = THREE.MathUtils.clamp(-s.altitudeDeg / 12, 0, 1);
  // Real sun: Beer–Lambert lux through Kasten–Young airmass, dimmed by cloud
  // (overcast cuts ~85%), mapped so a clear noon matches the old tuned look.
  const cloudDim = 1 - Math.min(1, Math.max(0, cloud01)) * 0.85;
  const sunLux = solarIlluminanceLux(s.altitudeDeg) * cloudDim;
  const sunTempK = sunColorTempK(Math.max(0, s.altitudeDeg));
  const [sr, sg, sb] = kelvinToRGBapprox(sunTempK);
  const sunI = (sunLux / 110000) * 3;
  handles.sun.intensity = sunI;
  handles.sun.color.setRGB(sr, sg, sb);
  handles.sun.castShadow = s.altitudeDeg > 0.5;
  // Real moonlight, exposure-compensated: true full-moon zenith is 0.25 lux
  // (10⁻⁶ of noon) — rendered ×1.2 as scotopic boost so nights stay readable.
  // Said out loud in WORLD.md; the ratio to phase/altitude stays physical.
  const moonLux = moonIlluminanceLux(m.illumination, m.altitudeDeg);
  const moonI = (moonLux / 0.25) * 0.3 * nightFactor;
  handles.moon.intensity = moonI;
  const maltR = (m.altitudeDeg * Math.PI) / 180, mazR = (m.azimuthDeg * Math.PI) / 180;
  const moonDir = new THREE.Vector3(Math.cos(maltR) * Math.sin(mazR), Math.sin(maltR), -Math.cos(maltR) * Math.cos(mazR));
  handles.moon.position.copy(moonDir.clone().multiplyScalar(handles.R * 5));
  handles.moonMesh.position.copy(moonDir.clone().multiplyScalar(handles.R * 1.12));
  const sc = 1 - m.illumination * 0.5;
  (handles.moonMesh.material as THREE.MeshBasicMaterial).color.setRGB(0.85 * sc + 0.15, 0.88 * sc + 0.12, 0.95 * sc + 0.05);
  (handles.moonMesh.material as THREE.MeshBasicMaterial).transparent = true;
  (handles.moonMesh.material as THREE.MeshBasicMaterial).opacity = nightFactor > 0 ? 1 : 0;
  handles.moonMesh.visible = m.altitudeDeg > -2;
  handles.starMat.opacity = nightFactor * 0.95;
  // True star places for this instant / location.
  {
    const p = handles.starGeo.getAttribute("position") as THREE.BufferAttribute;
    const arr = p.array as Float32Array, Rr = handles.R * 1.18;
    for (let i = 0; i < BRIGHT_STARS.length; i++) {
      const s = BRIGHT_STARS[i];
      const hz = equatorialToHorizontal(s.raH, s.decD, dateUtc, lat, lon);
      const altR = (hz.altitudeDeg * Math.PI) / 180, azR = (hz.azimuthDeg * Math.PI) / 180;
      // Below-horizon stars park under the ground plane (occluded, depth-tested).
      const d = hz.altitudeDeg > -1 ? Rr : -Rr * 2;
      arr[i*3] = Math.cos(altR) * Math.sin(azR) * d;
      arr[i*3+1] = Math.sin(altR) * d;
      arr[i*3+2] = -Math.cos(altR) * Math.cos(azR) * d;
    }
    p.needsUpdate = true;
  }
  // True naked-eye planet places. Brightness → color gain; faint outer
  // planets render small (mag-limited honesty: they exist, binoculars help).
  {
    const states = planetStates(dateUtc, lat, lon);
    const p = handles.planetGeo.getAttribute("position") as THREE.BufferAttribute;
    const c = handles.planetGeo.getAttribute("color") as THREE.BufferAttribute;
    const arr = p.array as Float32Array, carr = c.array as Float32Array, Rr = handles.R * 1.15;
    const COLORS: Record<string, [number, number, number]> = {
      Mercury: [0.75, 0.68, 0.6], Venus: [0.98, 0.94, 0.8], Mars: [1.0, 0.45, 0.25],
      Jupiter: [0.95, 0.85, 0.7], Saturn: [0.9, 0.8, 0.6], Uranus: [0.6, 0.9, 0.9], Neptune: [0.4, 0.55, 1.0],
    };
    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      const altR = (st.altitudeDeg * Math.PI) / 180, azR = (st.azimuthDeg * Math.PI) / 180;
      const d = st.altitudeDeg > -1 ? Rr : -Rr * 2;
      arr[i*3] = Math.cos(altR) * Math.sin(azR) * d;
      arr[i*3+1] = Math.sin(altR) * d;
      arr[i*3+2] = -Math.cos(altR) * Math.cos(azR) * d;
      const gain = Math.max(0.25, Math.min(1.3, 1.5 - 0.22 * st.magV));
      const cc = COLORS[st.name] ?? [1, 1, 1];
      carr[i*3] = Math.min(1, cc[0] * gain); carr[i*3+1] = Math.min(1, cc[1] * gain); carr[i*3+2] = Math.min(1, cc[2] * gain);
    }
    p.needsUpdate = true; c.needsUpdate = true;
    const anyUp = states.some((s) => s.altitudeDeg > 0);
    handles.planetMat.opacity = anyUp ? Math.max(nightFactor * 0.95, 0.25) : 0;
  }
  handles.atmosMat.uniforms.sunDir.value.copy(sunDir);
  handles.atmosMat.uniforms.nightFactor.value = nightFactor;
  const dayFactor = THREE.MathUtils.clamp(sunLux / 60000, 0, 1);
  return { sunDir, nightFactor, dayFactor, sunAlt: s.altitudeDeg, moonPhase: m.phase, moonIllum: m.illumination, sunLux, sunTempK, moonLux, sunI, moonI };
}
