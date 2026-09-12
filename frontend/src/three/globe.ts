// Globe scene: planet sphere + atmosphere shell + sun/moon lights + star field.
import * as THREE from "three";
import { ATMOS_FRAG, ATMOS_VERT } from "./atmosphere.js";
import { DEFAULT_ERA } from "../../../shared/src/era.js";
import { moonState, starSeed, sunPosition } from "../../../shared/src/astro.js";

export interface SkyState {
  sunDir: THREE.Vector3; nightFactor: number; sunAlt: number; moonPhase: number; moonIllum: number;
}

export function buildGlobe(scene: THREE.Scene) {
  const R = 6371; // scene units scaled (1 unit = 1 km, camera near-field trick)
  const texLoader = new THREE.TextureLoader();
  const dayTex = texLoader.load("/earth/earth-day.jpg", (t) => { t.colorSpace = THREE.SRGBColorSpace; });
  const bumpTex = texLoader.load("/earth/earth-topology.png");
  // Missing files (offline first run) → flat color fallback; game still boots.
  dayTex.premultiplyAlpha = false;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.MeshStandardMaterial({ map: dayTex, bumpMap: bumpTex, bumpScale: 18, color: 0xffffff, roughness: 0.95, metalness: 0 })
  );
  // Surface mode: the player stands ON the planet, so a miniature globe at the
  // scene origin would surround them with wrong geometry. Hidden — the far-field
  // terrain + atmosphere shell carry the planetary illusion. (The texture still
  // serves the 2D planetary map.) Re-enable only for an orbital/space view.
  earth.visible = false;
  earth.rotation.z = 0;
  scene.add(earth);

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

  // Stars: deterministic points on far shell, visible at night via material opacity.
  const starGeo = new THREE.BufferGeometry();
  const N = 3500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = starSeed(i) * 2 - 1, th = starSeed(i + N) * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[i*3] = Math.cos(th) * r * R * 8; pos[i*3+1] = u * R * 8; pos[i*3+2] = Math.sin(th) * r * R * 8;
    const b = 0.5 + starSeed(i + 2 * N) * 0.5;
    col[i*3] = b; col[i*3+1] = b * (0.9 + starSeed(i+3*N) * 0.1); col[i*3+2] = b;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0, sizeAttenuation: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Moon billboard
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 0.02, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xdde4ee }));
  scene.add(moonMesh);

  return { earth, atmosMat, starMat, sun, moon, moonMesh, R };
}

export function updateSky(handles: ReturnType<typeof buildGlobe>, dateUtc: Date, lat: number, lon: number): SkyState {
  const s = sunPosition(dateUtc, lat, lon);
  const m = moonState(dateUtc, lat, lon);
  const altR = (s.altitudeDeg * Math.PI) / 180, azR = (s.azimuthDeg * Math.PI) / 180;
  const sunDir = new THREE.Vector3(
    Math.cos(altR) * Math.sin(azR), Math.sin(altR), -Math.cos(altR) * Math.cos(azR)).normalize();
  handles.sun.position.copy(sunDir.clone().multiplyScalar(handles.R * 5));
  const nightFactor = THREE.MathUtils.clamp(-s.altitudeDeg / 12, 0, 1);
  handles.sun.intensity = THREE.MathUtils.lerp(3, 0, nightFactor);
  handles.sun.color.setHSL(0.1, 0.6, THREE.MathUtils.lerp(0.98, 0.55, Math.pow(1 - Math.abs(sunDir.y), 2)));
  handles.moon.intensity = 0.25 * m.illumination * nightFactor;
  const maltR = (m.altitudeDeg * Math.PI) / 180, mazR = (m.azimuthDeg * Math.PI) / 180;
  const moonDir = new THREE.Vector3(Math.cos(maltR) * Math.sin(mazR), Math.sin(maltR), -Math.cos(maltR) * Math.cos(mazR));
  handles.moon.position.copy(moonDir.multiplyScalar(handles.R * 5));
  handles.moonMesh.position.copy(moonDir.multiplyScalar(handles.R * 4));
  const sc = 1 - m.illumination * 0.5;
  (handles.moonMesh.material as THREE.MeshBasicMaterial).color.setRGB(0.85 * sc + 0.15, 0.88 * sc + 0.12, 0.95 * sc + 0.05);
  handles.starMat.opacity = nightFactor * 0.95;
  handles.atmosMat.uniforms.sunDir.value.copy(sunDir);
  handles.atmosMat.uniforms.nightFactor.value = nightFactor;
  return { sunDir, nightFactor, sunAlt: s.altitudeDeg, moonPhase: m.phase, moonIllum: m.illumination };
}
