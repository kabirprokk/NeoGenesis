// NeoGenesis — plain plane world on the reality engine.
// One flat solid plane (y=0), real gravity 9.80665 m/s², real material bodies.
// The Experience Lab (X) lets humans — and AI agents via the same engine API —
// run prompts as live experiments with REAL/NOT REAL verdicts.
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildGlobe, updateSky } from "./three/globe.js";
import { PlayerController } from "./three/player.js";
import { HUD } from "./ui/HUD.js";
import { Journal, type JEntry } from "./ui/Journal.js";
import { freshVitals, tickVitals } from "./sim/survival.js";
import { WeatherSystem } from "./sim/weather.js";
import { ambience } from "./audio/ambience.js";
import { loadSave, storeSave } from "./api/client.js";
import { DEFAULT_ERA } from "../../shared/src/era.js";
import { PHYSICS } from "../../engine/src/index.js";
import { EngineWorld } from "../../engine/src/index.js";
import { PlaneWorld } from "./lab/planeWorld.js";
import { ExperiencePanel } from "./lab/ExperiencePanel.js";
import { Terminal } from "./lab/Terminal.js";
import { watchBus, type GameCtx } from "./lab/terminalCore.js";
import { stagePrompt } from "./lab/stage.js";

const PLAYER_ID = "last-human";
const GEO = { lat: 12.5, lon: 8.0 }; // sky/sun reference only — feet live in plane meters

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState({ pos: "0.0, 0.0 m", alt: 0, tempC: 24, time: "", wx: "", faded: false });
  const [vitals, setVitals] = useState(freshVitals());
  const [journalOpen, setJournalOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [entries, setEntries] = useState<JEntry[]>([]);
  const [started, setStarted] = useState(false);
  const stateRef = useRef({ x: 0, z: 0, vitals: freshVitals(), discoveries: [] as { name: string; lat: number; lon: number }[] });
  const apiRef = useRef<GameCtx | null>(null);
  const weatherOverride = useRef("clear");

  useEffect(() => {
    if (!started) return;
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "webgl";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x9db3c8, 0.0016);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 8000);
    const sky = buildGlobe(scene);

    // The plain solid world + the engine that runs it.
    const plane = new PlaneWorld();
    scene.add(plane.group);
    const world = new EngineWorld(); // Earth-surface preset, 120 Hz fixed step
    world.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 8, y: 0.5, z: 6 } });
    world.spawn({ shape: "box", material: "steel", sizeM: 0.5, pos: { x: -6, y: 0.5, z: 12 } });
    world.spawn({ shape: "box", material: "lead", sizeM: 0.3, pos: { x: 4, y: 0.3, z: 20 } });
    world.spawn({ shape: "sphere", material: "gold", sizeM: 0.5, pos: { x: -10, y: 0.5, z: 6 } });
    world.spawn({ shape: "box", material: "ice", sizeM: 0.5, pos: { x: 12, y: 0.5, z: -4 } });
    world.spawn({ shape: "sphere", material: "steel", sizeM: 0.5, pos: { x: 15, y: 60, z: -10 } }); // opening drop demo

    const player = new PlayerController(camera);
    player.gravity = PHYSICS.G_EARTH;
    player.maxFall = PHYSICS.HUMAN_TERMINAL_V;
    player.attach(renderer.domElement);
    player.obj.position.set(0, 0, 0);
    scene.add(player.obj);

    const weather = new WeatherSystem();
    const clock = new THREE.Clock();
    let simH = 10, acc = 0, strideAcc = 0, watchIdx = 0;
    const persist = () => {
      const st = stateRef.current;
      void storeSave({ playerId: PLAYER_ID, lat: player.obj.position.x, lon: player.obj.position.z, alt: 0, ...st.vitals, eraPreset: DEFAULT_ERA.id, epochMs: Date.now(), updatedAt: new Date().toISOString() });
    };
    // Terminal bridge: the lab assistant + user commands act on the LIVE game.
    apiRef.current = {
      world,
      pos: () => ({ x: player.obj.position.x, y: player.obj.position.y, z: player.obj.position.z }),
      teleport: (x, z) => { player.obj.position.set(x, 0, z); stateRef.current.x = x; stateRef.current.z = z; },
      setTime: (h) => { simH = h; },
      setWeather: (kind) => { weatherOverride.current = kind; },
      addJournal: (text) => setEntries((p) => [{
        title: text.slice(0, 60) || "note", body: text,
        lat: player.obj.position.x, lon: player.obj.position.z, at: new Date().toISOString(),
      }, ...p]),
      doSave: persist,
      stage: (prompt) => {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(player.obj.quaternion);
        return stagePrompt(world, prompt,
          player.obj.position.x + fwd.x * 7, player.obj.position.z + fwd.z * 7);
      },
    };    let lastHud = 0, hudFaded = false, lastAct = performance.now();
    const onAct = () => { lastAct = performance.now(); };
    window.addEventListener("keydown", onAct);
    window.addEventListener("mousedown", onAct);

    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, clock.getDelta());
      simH += dt * 0.02;
      const st = stateRef.current;
      const epoch = new Date(Date.UTC(2026, 5, 20) + (simH % 24) * 3600000);
      weather.tick(dt / 3600);
      const wx = weather.sample(GEO.lat, GEO.lon, 24);
      const wov = weatherOverride.current;
      if (wov === "rain") wx.rainMmH = Math.max(wx.rainMmH, 4);
      if (wov === "storm") { wx.rainMmH = Math.max(wx.rainMmH, 12); wx.windMs += 10; wx.storm = true; }
      if (wov === "clear") { wx.rainMmH = 0; wx.storm = false; }
      ambience.setWind(wx.windMs / 20);
      world.env.ambientC = wx.tempC; // hot days can melt the ice block — really

      // Engine fixed-step, then visuals follow physics (never the reverse).
      acc = Math.min(0.25, acc + dt);
      while (acc >= 1 / 120) { world.step(1 / 120); acc -= 1 / 120; }
      plane.sync(world);
      plane.syncFluids(world.fluids);

      // Walk the plane. Feet at y=0, always.
      const px = player.obj.position.x, pz = player.obj.position.z;
      st.x += player.vel.x * dt;
      st.z += player.vel.z * dt;
      void px; void pz;
      player.update(dt, 0, false);
      plane.follow(player.obj.position.x, player.obj.position.z);
      strideAcc += Math.hypot(player.vel.x, player.vel.z) * dt;
      if (strideAcc > (player.keys.run ? 2.8 : 2.1) && player.grounded) {
        strideAcc = 0;
        ambience.footstep(player.keys.run ? 1 : 0, 0);
      }

      // Sky + sun shadow frustum follows the player.
      const skyInfo = updateSky(sky, epoch, GEO.lat, GEO.lon);
      sky.sun.position.copy(player.obj.position).addScaledVector(skyInfo.sunDir, 400);
      sky.sun.target.position.copy(player.obj.position);
      sky.sun.target.updateMatrixWorld();
      const night = sky.sun.intensity < 0.4;
      scene.fog = new THREE.FogExp2(night ? 0x05070c : wx.storm ? 0x6b7683 : 0x9db3c8, night ? 0.0022 : 0.0016 + wx.fog01 * 0.004);

      st.vitals = tickVitals(st.vitals, dt * 0.02, { tempC: wx.tempC, inWater: false, running: player.keys.run, night });
      if (Math.random() < dt * 0.02) ambience.distantCall(200 + Math.random() * 800);

      const now = performance.now();
      hudFaded = now - lastAct > 6000;
      if (now - lastHud > 250) {
        lastHud = now;
        ambience.setWater(0, Math.min(1, wx.rainMmH / 8));
        ambience.setAir(0, 0.3);
        ambience.setInsects(night ? 1 : 0, 0.3);
        const hh = Math.floor(simH % 24), mm = Math.floor(((simH % 24) - hh) * 60);
        setHud({
          pos: `${player.obj.position.x.toFixed(1)}, ${player.obj.position.z.toFixed(1)} m`,
          alt: player.obj.position.y, tempC: wx.tempC,
          time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${night ? " ☾" : ""}`,
          wx: wx.storm ? "⛈ storm" : wx.rainMmH > 0 ? `🌧 ${wx.rainMmH.toFixed(1)} mm/h` : `☁ ${Math.round(wx.cloud01 * 100)}% · ${wx.windMs.toFixed(0)} m/s`,
          faded: hudFaded,
        });
        setVitals({ ...st.vitals });
      }
      // Live engine events stream to the terminal while `watch` is armed.
      if (watchBus.want && watchBus.fn && watchIdx < world.log.length) {
        watchBus.fn(world.log.slice(watchIdx, watchIdx + 6).map((l) => `! ${l}`));
        watchIdx = world.log.length;
      }
      renderer.render(scene, camera);
    };
    tick();

    void loadSave(PLAYER_ID).then((s) => {
      if (s && typeof s.lat === "number") {
        stateRef.current.x = s.lat; stateRef.current.z = s.lon;
        player.obj.position.set(s.lat, 0, s.lon);
        stateRef.current.vitals = { ...freshVitals(), ...s };
      }
    });
    const saveTimer = window.setInterval(persist, 15000);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyH") setHud((h) => ({ ...h, faded: !h.faded }));
      if (e.code === "KeyJ") setJournalOpen((v) => !v);
      if (e.code === "KeyX") setLabOpen((v) => !v);
      if (e.code === "Backquote") setTermOpen((v) => !v);
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
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [started]);

  if (!started) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center,#101418 0%,#000 70%)",
        color: "#e8e4d8", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", zIndex: 20 }}>
        <h1 style={{ letterSpacing: "0.4em", fontWeight: 200 }}>NEOGENESIS LAB</h1>
        <p style={{ letterSpacing: "0.25em", fontSize: 12, opacity: 0.8 }}>A PLAIN WORLD. REAL PHYSICS. AN ENGINE AN AI CAN FEEL.</p>
        <p style={{ maxWidth: 560, textAlign: "center", fontSize: 14, opacity: 0.75 }}>
          A flat solid proving ground running on real gravity, real material data, and real
          thermodynamics. Walk it — then press X: give the Experience Lab a prompt, the engine
          lives the experiment with 10,000+ models behind it, and renders its verdict.
        </p>
        <button onClick={() => { setStarted(true); ambience.start(); }}
          style={{ background: "#1d2b1d", color: "#dfe8d5", border: "1px solid #3a4a3a",
            borderRadius: 8, padding: "12px 28px", cursor: "pointer", fontSize: 15, letterSpacing: "0.1em" }}>
          Enter the plane
        </button>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>WASD + mouse · X experience lab · J journal</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={mountRef} />
      <HUD pos={hud.pos} alt={hud.alt} tempC={hud.tempC} timeStr={hud.time} weather={hud.wx} vitals={vitals} faded={hud.faded} era="Reality engine · 9.80665 m/s²" />
      <Journal open={journalOpen} onClose={() => setJournalOpen(false)} entries={entries}
        onAdd={(e) => setEntries((p) => [e, ...p])} lat={stateRef.current.x} lon={stateRef.current.z} playerId={PLAYER_ID} />
      <ExperiencePanel open={labOpen} onClose={() => setLabOpen(false)}
        onStage={(p) => apiRef.current?.stage(p) ?? null} />
      <Terminal open={termOpen} getCtx={() => apiRef.current} />
    </div>
  );
}
