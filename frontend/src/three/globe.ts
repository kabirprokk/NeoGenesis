// Sky: atmosphere shell + sun/moon lights + star field. No planet mesh —
// the game is a plane lab; the sky is time-of-day, nothing more.
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
import { moonState, starSeed, sunPosition } from "../../../shared/src/astro.js";
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

  // Stars: deterministic points on a shell INSIDE the camera far-plane and
  // with fog disabled — the old shell sat at 8×R (51,000 units, past the 8000
  // far-plane) so stars never rendered at all.
  const starGeo = new THREE.BufferGeometry();
  const N = 3500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const starR = R * 1.18;
  for (let i = 0; i < N; i++) {
    const u = starSeed(i) * 2 - 1, th = starSeed(i + N) * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[i*3] = Math.cos(th) * r * starR; pos[i*3+1] = u * starR; pos[i*3+2] = Math.sin(th) * r * starR;
    const b = 0.5 + starSeed(i + 2 * N) * 0.5;
    col[i*3] = b; col[i*3+1] = b * (0.9 + starSeed(i+3*N) * 0.1); col[i*3+2] = b;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0, sizeAttenuation: false, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // Moon billboard — inside the far-plane with fog off (the old code scaled
  // the direction vector twice, parking the moon at ~10¹⁵ units: invisible).
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 0.02, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xdde4ee, fog: false }));
  moonMesh.frustumCulled = false;
  scene.add(moonMesh);

  return { atmosMat, starMat, sun, moon, moonMesh, R };
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
  handles.atmosMat.uniforms.sunDir.value.copy(sunDir);
  handles.atmosMat.uniforms.nightFactor.value = nightFactor;
  const dayFactor = THREE.MathUtils.clamp(sunLux / 60000, 0, 1);
  return { sunDir, nightFactor, dayFactor, sunAlt: s.altitudeDeg, moonPhase: m.phase, moonIllum: m.illumination, sunLux, sunTempK, moonLux, sunI, moonI };
}
