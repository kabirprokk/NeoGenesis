import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildGlobe, updateSky } from "./three/globe.js";
import { TerrainPatch, groundColorFor } from "./three/terrain.js";
import { WorldStreamer } from "./three/WorldStreamer.js";
import { PlayerController } from "./three/player.js";
import { HUD } from "./ui/HUD.js";
import { Journal, type JEntry } from "./ui/Journal.js";
import { MapView } from "./ui/MapView.js";
import { freshVitals, tickVitals } from "./sim/survival.js";
import { WeatherSystem } from "./sim/weather.js";
import { LocalWildlife } from "./sim/wildlife.js";
import { FireGrid } from "./sim/fire.js";
import { ambience } from "./audio/ambience.js";
import { loadSave, storeSave } from "./api/client.js";
import { DEFAULT_ERA } from "../../shared/src/era.js";
import { climateFor } from "../../shared/src/climate.js";
import type { LLA } from "../../shared/src/geo.js";

const PLAYER_ID = "last-human";
const SPAWN: LLA = { lat: 12.5, lon: 8.0, alt: 0 }; // lush highlands spawn

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState({ lat: SPAWN.lat, lon: SPAWN.lon, alt: 0, tempC: 24, time: "", wx: "", faded: false });
  const [vitals, setVitals] = useState(freshVitals());
  const [journalOpen, setJournalOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [entries, setEntries] = useState<JEntry[]>([]);
  const [started, setStarted] = useState(false);
  const stateRef = useRef({ lat: SPAWN.lat, lon: SPAWN.lon, vitals: freshVitals(), epochMs: Date.now(), discoveries: [] as { name: string; lat: number; lon: number }[] });

  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "webgl";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x9db3c8, 0.0016);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 20000);
    const sky = buildGlobe(scene);
    const streamer = new WorldStreamer(SPAWN);
    const patch = new TerrainPatch(streamer.source);
    patch.mesh.position.y = 0;
    scene.add(patch.mesh);
    // Water plane (oceans/lakes stub — real hydrology in Phase 3)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x1a3a55, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    // Vegetation instancing stub (biome-tinted cones — real flora in Phase 3)
    const treeGeo = new THREE.ConeGeometry(1.2, 5, 6);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x24471f, roughness: 1 });
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, 400);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 400; i++) {
      dummy.position.set((Math.random() - 0.5) * 500, 0, (Math.random() - 0.5) * 500);
      dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix);
    }
    scene.add(trees);

    const player = new PlayerController(camera);
    player.attach(renderer.domElement);
    player.obj.position.set(0, 0, 0);
    scene.add(player.obj);

    // Wildlife meshes (simple capsules colored by diet — real models Phase 4)
    const fauna = new LocalWildlife(7);
    const faunaGroup = new THREE.Group();
    const faunaMeshes: THREE.Mesh[] = [];
    for (const a of fauna.agents) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, a.def.massKg > 1000 ? 4 : 1.2, 4, 8),
        new THREE.MeshStandardMaterial({ color: a.def.diet === "predator" ? 0x6b2d22 : 0x5a6b3a, roughness: 0.9 }));
      m.castShadow = true;
      faunaGroup.add(m); faunaMeshes.push(m);
    }
    scene.add(faunaGroup);

    const weather = new WeatherSystem();
    const fire = new FireGrid();
    const clock = new THREE.Clock();
    let simH = 10; // start mid-morning
    let lastHud = 0, hudFaded = false, lastAct = performance.now();
    const onAct = () => { lastAct = performance.now(); };
    window.addEventListener("keydown", onAct);
    window.addEventListener("mousedown", onAct);

    const groundAt = (lla: LLA) => streamer.groundHeight(lla);
    const mPerDegLat = 111320;

    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, clock.getDelta());
      simH += dt * 0.02; // ~50x time (a day ≈ 29 min) — tunable
      const dayOfYear = 172;
      const st = stateRef.current;
      const epoch = new Date(Date.UTC(2026, 5, 20) + (simH % 24) * 3600000);
      const clim = climateFor(DEFAULT_ERA, { lat: st.lat, lon: st.lon, altM: st.vitals ? 0 : 0, coastDistKm: 120, dayOfYear });
      weather.tick(dt / 3600);
      const wx = weather.sample(st.lat, st.lon, clim.tempC);
      ambience.setWind(wx.windMs / 20);

      // Move player in ENU meters → lat/lon (floating origin handles precision)
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(player.obj.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(player.obj.quaternion);
      const vx = (player.vel.x * right.x + player.vel.z * 0) ; // velocity already world-space
      void fwd; void right; void vx;
      const px = player.obj.position.x, pz = player.obj.position.z;
      st.lon += (player.vel.x * dt) / (111320 * Math.cos((st.lat * Math.PI) / 180));
      st.lat += (-player.vel.z * dt) / mPerDegLat;

      const g = groundAt({ lat: st.lat, lon: st.lon, alt: 0 });
      const inWater = g < 0.5;
      player.update(dt, g - groundAt({ lat: SPAWN.lat, lon: SPAWN.lon, alt: 0 }) + 0, inWater);
      // Keep patch centered under player every ~2 s or 40 m
      (tick as { acc?: number }).acc = ((tick as { acc?: number }).acc ?? 0) + dt;
      if ((tick as { acc?: number }).acc! > 2) {
        (tick as { acc?: number }).acc = 0;
        patch.rebuild({ lat: st.lat, lon: st.lon, alt: 0 }, () => ({ x: 0, z: 0 }), groundAt);
        (patch.mesh.material as THREE.MeshStandardMaterial).color.setHex(groundColorFor(clim.biome));
        water.position.y = (0.4 - (g - groundAt({ lat: SPAWN.lat, lon: SPAWN.lon, alt: 0 }))) + player.obj.position.y - 0;
        water.visible = inWater || g < 3;
        // Trees follow ground
        for (let i = 0; i < 400; i++) {
          trees.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          const lx = dummy.position.x + px * 0, lz = dummy.position.z;
          void lx; void lz;
          dummy.position.y = -2 + (i % 7) * 0.3;
          dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix);
        }
        trees.instanceMatrix.needsUpdate = true;
        streamer.markUsed(streamer.requiredTiles({ lat: st.lat, lon: st.lon, alt: 0 }));
      }

      // Sky
      updateSky(sky, epoch, st.lat, st.lon);
      const night = sky.sun.intensity < 0.4;
      scene.fog = new THREE.FogExp2(night ? 0x05070c : wx.storm ? 0x6b7683 : 0x9db3c8, night ? 0.0022 : 0.0016 + wx.fog01 * 0.004);

      // Fauna
      fauna.tick(dt, px, pz);
      fauna.agents.forEach((a, i) => {
        const m = faunaMeshes[i];
        if (!m) return;
        m.position.set(a.x - px + player.obj.position.x, player.obj.position.y + (a.def.massKg > 1000 ? 2.5 : 1), a.z - pz + player.obj.position.z);
        m.rotation.y = a.heading;
      });
      if (Math.random() < dt * 0.02) ambience.distantCall(200 + Math.random() * 800);

      // Survival (game-hour scaled)
      st.vitals = tickVitals(st.vitals, dt * 0.02, { tempC: wx.tempC, inWater, running: player.keys.run, night });

      // HUD @ 4 Hz + auto-fade after 6 s idle
      const now = performance.now();
      hudFaded = now - lastAct > 6000;
      if (now - lastHud > 250) {
        lastHud = now;
        const hh = Math.floor(simH % 24), mm = Math.floor(((simH % 24) - hh) * 60);
        setHud({ lat: st.lat, lon: st.lon, alt: Math.max(0, g), tempC: wx.tempC,
          time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${night ? " ☾" : ""}`,
          wx: wx.storm ? "⛈ storm" : wx.rainMmH > 0 ? `🌧 ${wx.rainMmH.toFixed(1)} mm/h` : `☁ ${Math.round(wx.cloud01 * 100)}% · ${wx.windMs.toFixed(0)} m/s`,
          faded: hudFaded });
        setVitals({ ...st.vitals });
      }
      renderer.render(scene, camera);
    };
    patch.rebuild(SPAWN, () => ({ x: 0, z: 0 }), groundAt);
    tick();

    // Restore save (backend or localStorage)
    void loadSave(PLAYER_ID).then((s) => {
      if (s && typeof s.lat === "number") {
        stateRef.current.lat = s.lat; stateRef.current.lon = s.lon;
        stateRef.current.vitals = { ...freshVitals(), ...s };
      }
    });
    const saveTimer = window.setInterval(() => {
      const st = stateRef.current;
      void storeSave({ playerId: PLAYER_ID, lat: st.lat, lon: st.lon, alt: 0, ...st.vitals, eraPreset: DEFAULT_ERA.id, epochMs: Date.now(), updatedAt: new Date().toISOString() });
    }, 15000);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyH") setHud((h) => ({ ...h, faded: !h.faded }));
      if (e.code === "KeyJ") setJournalOpen((v) => !v);
      if (e.code === "KeyM") setMapOpen((v) => !v);
      if (e.code === "KeyF") { fire.ignite(16, 16); }
    };
    window.addEventListener("keydown", onKey);
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearInterval(saveTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  if (!started) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center,#0a1410 0%,#000 70%)",
        color: "#e8e4d8", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", zIndex: 20 }}>
        <h1 style={{ letterSpacing: "0.4em", fontWeight: 200 }}>NEOGENESIS</h1>
        <p style={{ letterSpacing: "0.25em", fontSize: 12, opacity: 0.8 }}>ONE HUMAN. ONE EARTH. NO CIVILIZATION.</p>
        <p style={{ maxWidth: 520, textAlign: "center", fontSize: 14, opacity: 0.75 }}>
          You are the only human on a prehistoric-inspired Earth built on real geography.
          No cities. No roads. No quest markers. The world itself is the content.
        </p>
        <button onClick={() => { setStarted(true); ambience.start(); }}
          style={{ background: "#1d2b1d", color: "#dfe8d5", border: "1px solid #3a4a3a",
            borderRadius: 8, padding: "12px 28px", cursor: "pointer", fontSize: 15, letterSpacing: "0.1em" }}>
          Enter the world
        </button>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>WASD + mouse · headphones recommended · silence is part of the game</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={mountRef} />
      <HUD lat={hud.lat} lon={hud.lon} alt={hud.alt} tempC={hud.tempC} timeStr={hud.time} weather={hud.wx} vitals={vitals} faded={hud.faded} era={DEFAULT_ERA.label} />
      <Journal open={journalOpen} onClose={() => setJournalOpen(false)} entries={entries}
        onAdd={(e) => setEntries((p) => [e, ...p])} lat={hud.lat} lon={hud.lon} playerId={PLAYER_ID} />
      <MapView open={mapOpen} onClose={() => setMapOpen(false)} lat={hud.lat} lon={hud.lon} discoveries={stateRef.current.discoveries} />
    </div>
  );
}
