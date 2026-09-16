// NeoGenesis — plain plane world on the reality engine.
// One flat solid plane (y=0), real gravity 9.80665 m/s², real material bodies.
// The Experience Lab (X) lets humans — and AI agents via the same engine API —
// run prompts as live experiments with REAL/NOT REAL verdicts.
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildGlobe, updateSky } from "./three/globe.js";
import { buildClouds } from "./three/clouds.js";
import { PlayerController, uiHasFocus, buildColliders } from "./three/player.js";
import { HUD } from "./ui/HUD.js";
import { Journal, type JEntry } from "./ui/Journal.js";
import { WeatherSystem } from "./sim/weather.js";
import { ambience } from "./audio/ambience.js";
import { loadSave, storeSave } from "./api/client.js";
import { DEFAULT_ERA } from "../../shared/src/era.js";
import { PHYSICS, MATERIALS, EngineWorld, NeoMemory, neoParse, neoScenario, neoNeedsExperience, runScenario, experience, neoSamples } from "../../engine/src/index.js";
import { PlaneWorld } from "./lab/planeWorld.js";
import type { RigKind } from "./lab/planeWorld.js";
import { ExperiencePanel } from "./lab/ExperiencePanel.js";
import { Terminal } from "./lab/Terminal.js";
import { NeoBar } from "./lab/NeoBar.js";
import { watchBus, type GameCtx } from "./lab/terminalCore.js";
import { stageNeo } from "./lab/stage.js";
import { NeoMind, feelsLikeC, feelWordFor, type NeoFacts } from "./lab/neoMind.js";
import { NeoBody, bodyInputChanged, type BodyInput, type BodyState, freshInjector, applyInjector, type InjectorState } from "./lab/neoBody.js";
import { BrainPanel } from "./lab/BrainPanel.js";
import { aiStep, freshAiMemory, type AiMemory } from "./lab/aiPlayer.js";

const PLAYER_ID = "last-human";
const GEO = { lat: 12.5, lon: 8.0 }; // sky/sun reference only — feet live in plane meters

/** One deterministic grammar sample Neo can offer as his own experiment idea. */
function sampleIdea(turns: number): string | null {
  try {
    const s = neoSamples(turns + 1, 1);
    return s[0] ?? null;
  } catch { return null; }
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState({ pos: "0.0, 0.0 m", alt: 0, tempC: 24, time: "", wx: "", faded: false });
  const [journalOpen, setJournalOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  // Demo mode: the AI plays with YOUR hands (keys + camera + Ask/Run only).
  // No teleports, no tool calls, no hidden state — spectate from its own eyes.
  const [demoOn, setDemoOn] = useState(false);
  const demoRef = useRef(false);
  const [feed, setFeed] = useState<string[]>([]);
  const feedPush = (line: string): void => {
    setFeed((f) => [...f.slice(-5), line]);
    thoughtRef.current = [...thoughtRef.current.slice(-29), `[AI LIVE] ${line}`];
  };
  const [entries, setEntries] = useState<JEntry[]>([]);
  const [started, setStarted] = useState(false);
  const stateRef = useRef({ x: 0, z: 0 });
  const apiRef = useRef<GameCtx | null>(null);
  const neoMem = useRef<NeoMemory | null>(null);
  if (neoMem.current === null && typeof localStorage !== "undefined") {
    neoMem.current = NeoMemory.load(localStorage);
  }
  // Neo's generative mind — learns your words across sessions (localStorage).
  const neoMind = useRef<NeoMind | null>(null);
  if (neoMind.current === null) neoMind.current = NeoMind.load();
  // Neo's virtual body — heart, arousal, VAD emotion point, homeostasis.
  const neoBody = useRef<NeoBody | null>(null);
  if (neoBody.current === null) neoBody.current = new NeoBody();
  const bodyStateRef = useRef<BodyState>(neoBody.current.snapshot());
  const lastBodyInput = useRef<BodyInput | null>(null);
  const lastBodyT = useRef(0);
  const lastChatBody = useRef<BodyState>(neoBody.current.snapshot());
  const lastDream = useRef("");
  const lastDreamTurns = useRef(-1);
  const actRef = useRef(Date.now());
  const proposalRef = useRef<string | null>(null);
  const lastProposeT = useRef(0);
  const aiMem = useRef<AiMemory>(freshAiMemory(Date.now()));
  const lastFeedNote = useRef("");
  /** Scientist injector: synthetic biometric overrides (labeled, never natural). */
  const injectorRef = useRef<InjectorState>(freshInjector());
  const thoughtRef = useRef<string[]>(["[BRAIN SYNC] Neo online — senses live, mind learning."]);
  // Live senses Neo feels — refreshed in the tick below (delta-gated).
  const senseRef = useRef<NeoFacts>({
    tempC: 24, feelsLikeC: 24, feelWord: "mild", humidity01: 0.45,
    windMs: 3, windDir: 250, rainMmH: 0, storm: false, cloud01: 0.25, fog01: 0,
    weatherKind: "clear", timeStr: "10:00", simH: 10, night: false,
    sunAlt: 45, sunLux: 90000, moonIllum: 0,
    posX: 0, posZ: 0, altY: 0, gravity: PHYSICS.G_EARTH,
    bodyCount: 0, bodies: [], fluids: [], inWater: false,
    heartBpm: 70, mood: "steady", undertone: "", arousal01: 0.3, dominance01: 0.6, valence: 0.2,
  });
  const weatherOverride = useRef("clear");

  useEffect(() => {
    if (!started) return;
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "webgl";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    if (import.meta.env.DEV) (window as unknown as { __neoScene?: THREE.Scene }).__neoScene = scene;
    // One fog object for the life of the scene — mutated, never reallocated
    // (per-frame `new` here used to trash the hot loop's zero-alloc budget).
    const fog = new THREE.FogExp2(0x9db3c8, 0.0016);
    scene.fog = fog;
    // Image-based lighting: metals/glass/water reflect a neutral studio sky.
    // This single addition is why chrome finally looks like chrome.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environmentIntensity = 0.45;
    const hemi = new THREE.HemisphereLight(0xbdd3e6, 0x54503e, 0.5);
    scene.add(hemi);
    // Scratch color for the per-frame bounce-light lerp (allocated once —
    // the hot loop must not allocate).
    const DAY_BLUE = new THREE.Color(0xbdd3e6);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 8000);
    const sky = buildGlobe(scene);
    const clouds = buildClouds(scene);

    // Bloom: lava, fire, laser, sparks and the sun glow; everything else stays clean.
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.65, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

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
    player.lookAt(2, 8); // opening frame faces the staged cluster, not empty sky
    scene.add(player.obj);

    const weather = new WeatherSystem();
    const clock = new THREE.Clock();
    let simH = 10, acc = 0, strideAcc = 0, watchIdx = 0, rafId = 0;
    const pushThought = (line: string): void => {
      thoughtRef.current = [...thoughtRef.current.slice(-29), line];
    };
    const persist = () => {
      void storeSave({ playerId: PLAYER_ID, lat: player.obj.position.x, lon: player.obj.position.z, alt: 0, eraPreset: DEFAULT_ERA.id, epochMs: Date.now(), updatedAt: new Date().toISOString() });
      // Sleep/dream cycle rides on saves: offline consolidation, never the hot loop.
      // Skipped when nothing new happened — sleep prunes noise, not signal.
      try {
        const mind = neoMind.current ?? new NeoMind();
        neoMind.current = mind;
        if (mind.turns !== lastDreamTurns.current) {
          lastDreamTurns.current = mind.turns;
          const summary = mind.dream();
          lastDream.current = summary;
          pushThought(`[DREAM] ${summary}`);
        }
      } catch { /* dreaming is best-effort */ }
    };
    // Neo bridge: one flow — parse → build the rig live → face it → judge.
    const lookAt = (x: number, z: number) => { player.lookAt(x, z); };
    apiRef.current = {
      world,
      pos: () => ({ x: player.obj.position.x, y: player.obj.position.y, z: player.obj.position.z }),
      teleport: (x, z) => { player.teleport(x, z, false); stateRef.current.x = x; stateRef.current.z = z; },
      lookAt,
      setTime: (h) => { simH = h; },
      setWeather: (kind) => { weatherOverride.current = kind; },
      addJournal: (text) => setEntries((p) => [{
        title: text.slice(0, 60) || "note", body: text,
        lat: player.obj.position.x, lon: player.obj.position.z, at: new Date().toISOString(),
      }, ...p]),
      doSave: persist,
      runExperiment: (prompt) => {
        const mem = neoMem.current ?? new NeoMemory();
        neoMem.current = mem;
        const plan = neoParse(prompt, mem);
        // One parse, one truth: sim actions judge the staged scenario, closed-form
        // actions (electrify, dissolve, lase, roll) judge via experience().
        const verdict = plan.action && !neoNeedsExperience(plan) ? runScenario(prompt, neoScenario(plan)) : experience(prompt);
        let staged: string[] | null = null;
        if (plan.action) {
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(player.obj.quaternion);
          const ax = player.obj.position.x + fwd.x * 7, az = player.obj.position.z + fwd.z * 7;
          plane.clearMarker();
          plane.setRig(null, 0, 0, 0);
          staged = stageNeo(world, plan, ax, az).lines;
          // Show what Neo built: ground marker + label, rig props per action.
          const matName = MATERIALS[plan.material]?.name ?? plan.material;
          plane.showMarker(ax, az, `${matName} ${plan.shape}`);
          const rig: RigKind | null =
            plan.action === "melt" || plan.action === "burn" || plan.action === "boil" ? "heat"
            : plan.action === "freeze" ? "frost"
            : plan.action === "electrify" ? "spark"
            : plan.action === "lase" ? "laser" : null;
          plane.setRig(rig, ax, az, Math.min(2, Math.max(0.2, plan.sizeM)));
          // Viewpoint: step back and face the rig — velocity killed and view
          // leveled inside teleport, so the experiment starts framed, not drifting.
          player.teleport(ax - fwd.x * 14, az - fwd.z * 14, true);
          lookAt(ax, az);
          stateRef.current.x = player.obj.position.x; stateRef.current.z = player.obj.position.z;
          watchBus.want = true;
        }
        mem.learn(prompt, plan);
        try { mem.save(localStorage); } catch { /* private mode — memory only */ }
        // Habit source: staged experiments lodge as significant episodes.
        try {
          neoMind.current?.recordExperiment(prompt,
            `${plan.action ?? "judged"} ${plan.material} → ${verdict.verdict}`,
            { valence: bodyStateRef.current.valence, arousal: bodyStateRef.current.arousal01, intensity: bodyStateRef.current.intensity01, mood: bodyStateRef.current.mood });
        } catch { /* memory is best-effort */ }
        return { plan, verdict, staged, memory: mem.stats() };
      },
      sense: () => ({ ...senseRef.current }),
      chat: (question) => {
        const mind = neoMind.current ?? new NeoMind();
        neoMind.current = mind;
        const reply = mind.generate(question, senseRef.current);
        const curr = bodyStateRef.current;
        const reward = NeoBody.rewardSignal(lastChatBody.current, curr);
        lastChatBody.current = { ...curr };
        mind.learnTurn(question, reply,
          { valence: curr.valence, arousal: curr.arousal01, intensity: curr.intensity01, mood: curr.mood }, reward);
        for (const line of mind.lastThink) pushThought(line);
        pushThought(`neo: ${reply.slice(0, 90)}${reply.length > 90 ? "…" : ""}`);
        return reply;
      },
      think: (question) => {
        const mind = neoMind.current ?? new NeoMind();
        neoMind.current = mind;
        const lines = mind.think(question, senseRef.current);
        for (const line of lines) pushThought(line);
        return lines;
      },
      thoughtLog: () => [...thoughtRef.current],
      /** Unprompted utterances Neo initiated while idle (consumed on read). */
      proposal: () => {
        const p = proposalRef.current;
        proposalRef.current = null;
        return p;
      },
      candidates: () => [...(neoMind.current?.lastCandidates ?? [])],
      injector: () => ({ ...injectorRef.current }),
      setInjector: (patch) => {
        injectorRef.current = { ...injectorRef.current, ...patch };
        // Recompute felt state immediately so the scientist sees the effect.
        const body = neoBody.current ?? new NeoBody();
        neoBody.current = body;
        const inp = lastBodyInput.current;
        if (inp) {
          const felt = body.update({ ...inp, tempC: inp.tempC + injectorRef.current.tempDeltaC },
            0.25, 0, Math.min(1, (neoMind.current?.turns ?? 0) / 50));
          bodyStateRef.current = applyInjector(felt, injectorRef.current);
        }
        return { ...injectorRef.current };
      },
      mindProfile: () => neoMind.current?.profile ?? "steady",
      setMindProfile: (name) => {
        const mind = neoMind.current ?? new NeoMind();
        neoMind.current = mind;
        return mind.setProfile(name);
      },
      dream: () => {
        const mind = neoMind.current ?? new NeoMind();
        neoMind.current = mind;
        const summary = mind.dream();
        lastDream.current = summary;
        pushThought(`[DREAM] ${summary}`);
        return summary;
      },
      innerState: () => {
        const mind = neoMind.current;
        const b = senseRef.current;
        const brain = mind ? mind.innerState() : "brain starting";
        return `${brain} · heart ${Math.round(b.heartBpm)} · ${b.mood}${b.undertone ? ` + ${b.undertone}` : ""}${lastDream.current ? ` · ${lastDream.current.slice(0, 60)}` : ""}`;
      },
    };    let lastHud = 0, hudFaded = false, lastAct = performance.now();
    const onAct = () => { lastAct = performance.now(); actRef.current = Date.now(); };
    window.addEventListener("keydown", onAct);
    window.addEventListener("mousedown", onAct);

    const tick = () => {
      rafId = requestAnimationFrame(tick);
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
      plane.tick(dt, clock.elapsedTime, world);

      // Walk the plane. Feet at y=0, always.
      st.x += player.vel.x * dt;
      st.z += player.vel.z * dt;
      // Perfect collider set: jump over and onto bodies, never through them;
      // your 80 kg shoves crates, bounces off lead and tank walls.
      const cols = buildColliders(world.bodies, player.obj.position.x, player.obj.position.z);
      let inWater = false;
      for (const f of world.fluids) {
        const p = player.obj.position;
        if (p.x > f.min.x && p.x < f.max.x && p.z > f.min.z && p.z < f.max.z && p.y < f.max.y) { inWater = true; break; }
      }
      player.update(dt, 0, inWater, cols.length ? { colliders: cols } : undefined);
      // Impact shake kicks the pitch holder (decays inside the controller) —
      // writing camera.position here used to fight the head-bob overwrite.
      const sh = plane.consumeShake();
      if (sh > 0.02) {
        player.kick((Math.random() - 0.5) * sh * 0.12, (Math.random() - 0.5) * sh * 0.1);
      }
      plane.follow(player.obj.position.x, player.obj.position.z);
      strideAcc += Math.hypot(player.vel.x, player.vel.z) * dt;
      if (strideAcc > (player.keys.run ? 2.8 : 2.1) && player.grounded && Math.hypot(player.vel.x, player.vel.z) > 0.5) {
        strideAcc = 0;
        ambience.footstep(player.keys.run ? 1 : 0, 0);
      }

      // Sky + sun shadow frustum follows the player. Sun/moon intensities and
      // colors come from real formulas (Beer–Lambert lux, blackbody tint);
      // the hemisphere below IS the bounce light: sky ambient from above,
      // ground color = sun × ground albedo from below. IBL + exposure follow
      // daylight so studio reflections die at midnight. No per-frame allocs.
      const skyInfo = updateSky(sky, epoch, GEO.lat, GEO.lon, wx.cloud01);
      clouds.tick(dt, sky.sun.intensity < 0.4 ? 1 : 0);
      sky.sun.position.copy(player.obj.position).addScaledVector(skyInfo.sunDir, 400);
      sky.sun.target.position.copy(player.obj.position);
      sky.sun.target.updateMatrixWorld();
      sky.moon.target.position.copy(player.obj.position);
      sky.moon.target.updateMatrixWorld();
      const dayF = skyInfo.dayFactor;
      hemi.intensity = 0.06 + 0.55 * dayF;
      hemi.color.setHex(0x0a1226).lerp(DAY_BLUE, dayF);
      hemi.groundColor.copy(sky.sun.color).multiplyScalar(0.04 + 0.42 * dayF);
      scene.environmentIntensity = 0.03 + 0.42 * dayF;
      renderer.toneMappingExposure = 1.02 + 0.25 * skyInfo.nightFactor;
      const night = sky.sun.intensity < 0.4;
      fog.color.setHex(night ? 0x05070c : wx.storm ? 0x6b7683 : 0x9db3c8);
      fog.density = night ? 0.0022 : 0.0016 + wx.fog01 * 0.004;

      // (No random distant calls — phantom cries were reported as a bug. Wind/water remain.)

      const now = performance.now();
      hudFaded = now - lastAct > 6000;
      if (now - lastHud > 250) {
        lastHud = now;
        ambience.setWater(0, Math.min(1, wx.rainMmH / 8));
        ambience.setAir(0, 0.3);
        ambience.setInsects(night ? 1 : 0, 0.3);
        const hh = Math.floor(simH % 24), mm = Math.floor(((simH % 24) - hh) * 60);
        const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${night ? " ☾" : ""}`;
        setHud({
          pos: `${player.obj.position.x.toFixed(1)}, ${player.obj.position.z.toFixed(1)} m`,
          alt: player.obj.position.y, tempC: wx.tempC,
          time: timeStr,
          wx: wx.storm ? "⛈ storm" : wx.rainMmH > 0 ? `🌧 ${wx.rainMmH.toFixed(1)} mm/h` : `☁ ${Math.round(wx.cloud01 * 100)}% · ${wx.windMs.toFixed(0)} m/s`,
          faded: hudFaded,
        });
        // Neo's live senses — same numbers the HUD, sky and engine use.
        // Delta gate: the body only recomputes when the world moved enough
        // (or 2.5 s passed) — cognition never taxes the hot loop.
        const feels = feelsLikeC(wx.tempC, wx.humidity01, wx.windMs, skyInfo.sunLux, night);
        const nearHeat = world.fluids.some((fl) => /lava|acid/i.test(fl.name))
          || world.bodies.some((b) => b.molten || b.burning);
        const bodyInput: BodyInput = { tempC: wx.tempC, rainMmH: wx.rainMmH, storm: wx.storm, windMs: wx.windMs, night, inWater, nearHeat, cloud01: wx.cloud01 };
        if (bodyInputChanged(lastBodyInput.current, bodyInput) || now - lastBodyT.current > 2500) {
          lastBodyInput.current = bodyInput;
          lastBodyT.current = now;
          const mastery = Math.min(1, (neoMind.current?.turns ?? 0) / 50);
          const body = neoBody.current ?? new NeoBody();
          neoBody.current = body;
          // Injector rides on top of nature: felt heat shifts AND felt state.
          const felt = body.update({ ...bodyInput, tempC: bodyInput.tempC + injectorRef.current.tempDeltaC },
            0.25, world.bodies.length, mastery);
          bodyStateRef.current = applyInjector(felt, injectorRef.current);
        }
        const bs = bodyStateRef.current;
        const near = [...world.bodies]
          .map((b) => {
            const d = Math.hypot(b.pos.x - player.obj.position.x, b.pos.z - player.obj.position.z);
            const matName = (MATERIALS[b.material.id]?.name ?? b.material.id).toLowerCase();
            const st = b.broken ? "shattered" : b.molten ? "molten" : b.burning ? "burning" : "rest";
            return { d, s: `${matName} ${b.shape} ${d.toFixed(0)} m away${st === "rest" ? "" : ` (${st})`}` };
          })
          .sort((a, b2) => a.d - b2.d)
          .slice(0, 6)
          .map((e) => e.s);
        senseRef.current = {
          tempC: wx.tempC, feelsLikeC: feels, feelWord: feelWordFor(feels),
          humidity01: wx.humidity01, windMs: wx.windMs, windDir: wx.windDir,
          rainMmH: wx.rainMmH, storm: wx.storm, cloud01: wx.cloud01, fog01: wx.fog01,
          weatherKind: wx.storm ? "storm" : wx.rainMmH > 0.1 ? "rain" : wx.cloud01 > 0.6 ? "overcast" : wx.cloud01 > 0.3 ? "partly cloudy" : "clear",
          timeStr, simH, night,
          sunAlt: skyInfo.sunAlt, sunLux: skyInfo.sunLux, moonIllum: skyInfo.moonIllum,
          posX: player.obj.position.x, posZ: player.obj.position.z, altY: player.obj.position.y,
          gravity: world.env.gravity,
          bodyCount: world.bodies.length, bodies: near,
          fluids: world.fluids.map((fl) => `${fl.name} at ${(fl.tempC ?? world.env.ambientC).toFixed(0)}°C`),
          inWater,
          heartBpm: bs.heartBpm, mood: bs.mood, undertone: bs.undertone,
          arousal01: bs.arousal01, dominance01: bs.dominance01, valence: bs.valence,
        };
        // Demo driver: the AI plays with your hands at UI cadence (4 Hz).
        // Keys + camera + Ask/Run only — the same handlers your UI uses.
        if (demoRef.current && apiRef.current) {
          const api = apiRef.current;
          const amem = aiMem.current;
          amem.now = performance.now() / 1000;
          const aiBodies: { x: number; z: number; top: number; massKg: number }[] = [];
          for (const b of world.bodies) {
            if (b.ghost) continue; // invisible to players, invisible to the AI
            aiBodies.push({ x: b.pos.x, z: b.pos.z,
              top: b.pos.y + (b.shape === "sphere" ? b.radiusM : (b.halfM?.y ?? b.radiusM)),
              massKg: b.massKg });
          }
          const out = aiStep({
            px: player.obj.position.x, pz: player.obj.position.z, feetY: player.obj.position.y,
            bodies: aiBodies, arousal01: bs.arousal01, tempC: wx.tempC, storm: wx.storm,
          }, amem, sampleIdea(neoMind.current?.turns ?? 0));
          player.keys.f = out.keys.f; player.keys.b = out.keys.b;
          player.keys.l = out.keys.l; player.keys.r = out.keys.r;
          player.keys.run = out.keys.run; player.keys.crouch = out.keys.crouch;
          player.keys.jump = out.keys.jump;
          player.lookAt(out.lookX, out.lookZ);
          try {
            if (out.say) {
              const r = api.chat(out.say);
              feedPush(`AI asks "${out.say}" → "${r.slice(0, 70)}${r.length > 70 ? "…" : ""}"`);
            } else if (out.run) {
              const res = api.runExperiment(out.run);
              feedPush(`AI runs "${out.run.slice(0, 55)}" → ${res.verdict.verdict}`);
            } else if (out.note !== lastFeedNote.current) {
              lastFeedNote.current = out.note;
              feedPush(`AI ${out.note}`);
            }
          } catch { /* a failed AI action is a finding, not a crash */ }
        }
      }
      // Live engine events stream to the terminal while `watch` is armed.
      if (watchBus.want && watchBus.fn && watchIdx < world.log.length) {
        watchBus.fn(world.log.slice(watchIdx, watchIdx + 6).map((l) => `! ${l}`));
        watchIdx = world.log.length;
      }
      composer.render();
    };
    tick();

    void loadSave(PLAYER_ID).then((s) => {
      if (s && typeof s.lat === "number") {
        stateRef.current.x = s.lat; stateRef.current.z = s.lon;
        player.obj.position.set(s.lat, 0, s.lon);
      }
    });
    const saveTimer = window.setInterval(persist, 15000);
    // Idle mind: when you leave Neo alone, he dreams and — if a drive is
    // strong — speaks first. Speech only; he never seizes your camera.
    const idleTimer = window.setInterval(() => {
      if (Date.now() - actRef.current < 45000) return;
      try {
        const mind = neoMind.current;
        if (!mind) return;
        if (mind.turns !== lastDreamTurns.current) {
          lastDreamTurns.current = mind.turns;
          const summary = mind.dream();
          lastDream.current = summary;
          pushThought(`[DREAM] ${summary}`);
        }
        if (Date.now() - lastProposeT.current < 60000 || proposalRef.current) return;
        const idea = mind.turns % 3 === 0 ? sampleIdea(mind.turns) : null;
        const p = mind.propose(senseRef.current, idea);
        if (p) {
          lastProposeT.current = Date.now();
          proposalRef.current = p.text;
          pushThought(`[INITIATIVE:${p.kind}] ${p.text.slice(0, 90)}`);
        }
      } catch { /* idle mind is best-effort */ }
    }, 20000);

    const onKey = (e: KeyboardEvent) => {
      if (uiHasFocus(e)) return; // writing in Neo bar / terminal / journal: only writing works
      if (demoRef.current && e.code !== "KeyG") {
        demoRef.current = false; setDemoOn(false); // any key takes your body back
        try { player.stop(); } catch { /* handoff is best-effort */ }
        feedPush("you took over — AI hands off");
      }
      if (e.code === "KeyM") {
        ambience.toggleMute(); // hard silence switch — no phantom sounds, ever
      }
      if (e.code === "KeyH") setHud((h) => ({ ...h, faded: !h.faded }));
      if (e.code === "KeyJ") setJournalOpen((v) => !v);
      if (e.code === "KeyX") setLabOpen((v) => !v);
      if (e.code === "KeyB") setBrainOpen((v) => !v);
      if (e.code === "KeyG") {
        demoRef.current = !demoRef.current;
        setDemoOn(demoRef.current);
        feedPush(demoRef.current ? "AI takes your hands — watch its eyes (any key to take over)" : "you took over — AI hands off");
      }
      if (e.code === "Backquote") {
        // Printable toggle: without this, the ` lands in the terminal's own
        // input and every command misfires (caught live in the browser).
        e.preventDefault();
        setTermOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(saveTimer);
      window.clearInterval(idleTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onAct);
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
          lives the experiment with 100,000+ sentence structures behind it, and renders its verdict.
        </p>
        <button onClick={() => { setStarted(true); ambience.start(); }}
          style={{ background: "#1d2b1d", color: "#dfe8d5", border: "1px solid #3a4a3a",
            borderRadius: 8, padding: "12px 28px", cursor: "pointer", fontSize: 15, letterSpacing: "0.1em" }}>
          Enter the plane
        </button>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>WASD + mouse · X experience lab · J journal · B brain · G watch AI play · ` fun · M mute</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={mountRef} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5,
        background: "radial-gradient(ellipse at center, transparent 52%, rgba(2,4,8,0.42) 100%)" }} />
      {demoOn && (
        <div style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", zIndex: 24,
          background: "rgba(6,10,16,0.9)", color: "#7aa3e8", border: "1px solid #2c3a5a",
          borderRadius: 16, padding: "4px 16px", fontSize: 12, fontFamily: "ui-monospace, Consolas, monospace" }}>
          ◉ AI DRIVING — its hands, your eyes · any key takes over
        </div>
      )}
      {demoOn && feed.length > 0 && (
        <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 24, width: 330,
          background: "rgba(4,8,14,0.88)", border: "1px solid #2c3a5a", borderRadius: 10,
          padding: "8px 10px", fontSize: 11, color: "#b9c9e8", fontFamily: "ui-monospace, Consolas, monospace" }}>
          <b style={{ color: "#7aa3e8" }}>AI LIVE</b>
          {feed.slice(-5).map((l, i) => <div key={i} style={{ marginTop: 3, opacity: 0.9 }}>▸ {l}</div>)}
        </div>
      )}
      <NeoBar getCtx={() => apiRef.current} onBrain={() => setBrainOpen((v) => !v)} />
      <HUD pos={hud.pos} alt={hud.alt} tempC={hud.tempC} timeStr={hud.time} weather={hud.wx} faded={hud.faded} />
      <Journal open={journalOpen} onClose={() => setJournalOpen(false)} entries={entries}
        onAdd={(e) => setEntries((p) => [e, ...p])} lat={stateRef.current.x} lon={stateRef.current.z} playerId={PLAYER_ID} />
      <ExperiencePanel open={labOpen} onClose={() => setLabOpen(false)} getCtx={() => apiRef.current} />
      <Terminal open={termOpen} getCtx={() => apiRef.current} />
      <BrainPanel open={brainOpen} onClose={() => setBrainOpen(false)} getCtx={() => apiRef.current} />
    </div>
  );
}
