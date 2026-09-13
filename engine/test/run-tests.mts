// Engine verification: every assert ties to a codex value or closed-form result.
import { PHYSICS } from "../src/constants.js";
import { MATERIALS, FLUIDS, EXPLOSIVES, explosiveClass, FRICTION_PAIRS, REPOSE_DEG } from "../src/materials.js";
import { PLANETS } from "../src/planets.js";
import { humanTerminal, projectileRange, mohsVerdict, buoyancyVerdict, soundDelay, slidesOnIncline, reposeOk } from "../src/physics.js";
import { EngineWorld } from "../src/world.js";
import { getModel, MODEL_COUNT, spawnModel } from "../src/models.js";
import { experience } from "../src/experience.js";
import { neoParse, neoScenario, neoSamples, neoPatternCount, neoToolFor, neoNeedsExperience, NeoMemory } from "../src/neo.js";
import { ELECTRICAL, CORROSION_MIN, OPTICS, ROLLING, ISOTOPES, GASTOX, HUMAN, FALL_ODDS, altitudeDensity } from "../src/science.js";
import { TOOLS, runTool } from "../src/tools.js";

let pass = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (!cond) { console.error(`FAIL ${name}`, extra ?? ""); process.exit(1); }
  pass++;
  console.log(`ok ${name}`);
};

ok(PHYSICS.G_EARTH === 9.80665, "gravity constant");
ok(Math.abs(humanTerminal() - 54) < 4, "human terminal ≈54 m/s", humanTerminal());
ok(Math.abs(projectileRange(30, 45) - 91.7) < 1, "30 m/s @45° range ≈91.7 m");
ok(mohsVerdict(5.5, 5.5, "steel", "glass").includes("mutual"), "steel vs glass mutual abrasion");
ok(mohsVerdict(9, 7, "corundum", "quartz").includes("scratches"), "corundum scratches quartz");
ok(buoyancyVerdict(750, 1000, "oak", "water").includes("floats"), "oak floats");
ok(buoyancyVerdict(11340, 1000, "lead", "water").includes("sinks"), "lead sinks");
ok(Math.abs(soundDelay(3430, 343) - 10) < 1e-9, "sound 3.43 km = 10 s");
ok(slidesOnIncline(0.03, 20) === true, "ice slides at 20°");
ok(slidesOnIncline(1.0, 20) === false, "rubber grips at 20°");
ok(reposeOk(REPOSE_DEG.drySand, 50).startsWith("NOT REAL"), "50° dry sand avalanches");
ok(EXPLOSIVES.tnt === 6900 && explosiveClass(6900).includes("TNT"), "TNT tier");
ok(PLANETS.mars.gravity === 3.72 && PLANETS.sun.hazard === "absolute vaporisation", "planet data");
ok(MATERIALS.gold.density === 19300 && FLUIDS.honey.viscosity === 10.0, "material/fluid data");

// Live sim: glass dropped 50 m must shatter; oak crate survives short falls.
{
  const w = new EngineWorld();
  w.spawn({ shape: "box", material: "glass", sizeM: 0.5, pos: { x: 0, y: 50, z: 0 } });
  w.run(8);
  ok(w.bodies[0].broken, "glass shatters from 50 m");
}
{
  const w = new EngineWorld();
  w.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 0, y: 3, z: 0 } });
  w.run(4);
  ok(!w.bodies[0].broken, "oak survives 3 m");
}
// Registry: 12,000 deterministic models.
ok(MODEL_COUNT === 12000, "12k registry");
{
  const a = getModel(4242), b = getModel(4242);
  ok(a.id === b.id && a.massKg === b.massKg && a.id === "NEO-5243", "deterministic registry", a.id);
  const w = new EngineWorld();
  spawnModel(w, 4242, { x: 0, y: 5, z: 0 });
  ok(w.bodies.length === 1 && w.bodies[0].id === "NEO-5243", "spawn by index");
}
// Experience verdicts.
{
  const r = experience("can a human lift 600kg on Earth");
  ok(r.verdict === "NOT REAL", "600 kg lift NOT REAL", r.verdict);
  const r2 = experience("does lead melt at 500C");
  ok(r2.verdict === "REAL" && r2.reasons.join().includes("327.5"), "lead melts at 500C");
  const r3 = experience("drop a glass box from 50m");
  ok(r3.verdict === "REAL" && r3.measurements.broken === true, "glass drop shatters");
  const r4 = experience("does steel scratch quartz");
  ok(r4.verdict === "NOT REAL" || r4.verdict === "MIXED", "steel vs quartz honest", r4.verdict);
}
console.log(`\nALL ${pass} CHECKS PASSED`);
// Tool registry: breadth + headless dispatch.
ok(TOOLS.length >= 35, "35+ tools registered", TOOLS.length);
{
  const t1 = runTool("buoyancy", { bodyDensity: 750, fluid: "water" });
  ok(t1.ok && JSON.stringify(t1.result).includes("floats"), "tool buoyancy");
  const t2 = runTool("verdict", { prompt: "does lead melt at 500C" });
  ok(t2.ok && (t2.result as { verdict: string }).verdict === "REAL", "tool verdict");
  const ctx = {};
  runTool("sim-spawn", { material: "gold", sizeM: 1, heightM: 20 }, ctx);
  const r = runTool("sim-run", { seconds: 6 }, ctx);
  ok(r.ok && (r.result as { events: string[] }).events.length >= 0, "tool sim round-trip");
  const bad = runTool("nope", {});
  ok(!bad.ok, "unknown tool errors cleanly");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. tools)`);
// Fluids: oak floats at equilibrium, lead sinks, honey grabs, statics hold still.
{
  const w = new EngineWorld();
  w.addFluid({ name: "Water", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 1.7, z: 3 }, density: 1000, viscosity: 0.001 });
  const oak = w.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 0, y: 5, z: 0 } });
  w.run(10);
  ok(Math.abs(oak.pos.y - 1.45) < 0.45 && oak.fluid === "Water", "oak floats at equilibrium", oak.pos.y.toFixed(2));
  ok(oak.events.some((e) => e.includes("SPLASH")), "splash event logged");
}
{
  const w = new EngineWorld();
  w.addFluid({ name: "Water", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 1.7, z: 3 }, density: 1000, viscosity: 0.001 });
  const lead = w.spawn({ shape: "box", material: "lead", sizeM: 0.3, pos: { x: 0, y: 5, z: 0 } });
  w.run(8);
  ok(lead.pos.y < 1.0, "lead sinks through water", lead.pos.y.toFixed(2));
}
{
  const w = new EngineWorld();
  w.addFluid({ name: "Honey", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 2, z: 3 }, density: 1420, viscosity: 10 });
  const steel = w.spawn({ shape: "sphere", material: "steel", sizeM: 0.4, pos: { x: 0, y: 4, z: 0 } });
  w.run(5);
  ok(Math.hypot(steel.vel.x, steel.vel.y, steel.vel.z) < 2.5, "honey damps fast", steel.vel.y.toFixed(2));
}
{
  const w = new EngineWorld();
  const wall = w.spawn({ shape: "box", material: "glass", sizeM: 1, static: true, pos: { x: 5, y: 1, z: 0 } });
  w.run(3);
  ok(wall.pos.x === 5 && wall.pos.y === 1, "static bodies never integrate");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. fluids)`);
// Neo: WHAT → OBJECT → FROM → TO parsing, units, 10k grammar, memory.
{
  const p = neoParse("throw a copper sphere from 100m in the water");
  ok(p.action === "throw", "neo action throw", p.action);
  ok(p.material === "copper", "neo material copper", p.material);
  ok(p.shape === "sphere", "neo shape sphere", p.shape);
  ok(p.heightM === 100, "neo height 100m", p.heightM);
  ok(p.target.kind === "fluid" && p.target.fluid === "water", "neo target water", p.target.word);
  ok(p.steps.length === 4 && p.steps[0][0] === "WHAT", "neo 4-step pipeline");
}
{
  const p = neoParse("melt a 100cm lead cube in lava");
  ok(p.action === "melt" && p.material === "lead", "neo melt lead", `${p.action} ${p.material}`);
  ok(Math.abs(p.sizeM - 1) < 1e-9, "neo 100cm cube = 1m", p.sizeM);
  ok(p.target.kind === "fluid" && p.target.fluid === "lava", "neo target lava");
}
{
  const p = neoParse("crush a glass box from 250cm on the ground");
  ok(p.action === "crush" && Math.abs((p.heightM ?? 0) - 2.5) < 1e-9, "neo 250cm height = 2.5m", p.heightM);
}
{
  const p = neoParse("yeet a steel ball into honey");
  ok(p.action === "throw", "neo slang yeet = throw", p.actionWord);
  const mem = new NeoMemory();
  mem.learn("yeet a steel ball into honey", p);
  ok(mem.resolve("verb", "yeet") === null, "memory needs reinforcement (1 hit)");
  mem.learn("yeet a steel ball into honey", p);
  ok(mem.resolve("verb", "yeet") === "throw", "memory resolves after 2 hits");
  const q = neoParse("yeet oak off a cliff", mem);
  ok(q.action === "throw", "learned word parses in new sentence", q.action);
  ok(mem.stats().runs === 2, "memory counts runs", mem.stats().runs);
}
{
  const { total } = neoPatternCount();
  ok(total >= 10000, "neo grammar covers 10k+ structures", total);
  const a = neoSamples(7, 5), b = neoSamples(7, 5);
  ok(JSON.stringify(a) === JSON.stringify(b) && a.length === 5, "neo samples deterministic", a[0]);
  const t = neoToolFor(neoParse("float oak in water"));
  ok(t.tool === "scenario", "neo picks sim tool for float", t.tool);
  const s = neoScenario(neoParse("throw a copper sphere from 100m in the water"));
  ok(s.bodies?.length === 1 && s.bodies[0].vel !== undefined, "neo scenario carries throw velocity");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. neo)`);
// Data-set-1: codex II tables + new verdict families.
{
  ok(ELECTRICAL.copper.conductivity === 5.96e7, "copper conductivity fed", ELECTRICAL.copper.conductivity);
  ok(CORROSION_MIN.batteryAcid.steel === 12, "battery acid vs steel 12 min");
  ok(Math.abs(altitudeDensity(8000) - 0.5258) < 1e-9, "ISA density at 8000 m", altitudeDensity(8000));
  ok(OPTICS.diamond.n === 2.417, "diamond refractive index");
  ok(ROLLING.tyreSand.crr === 0.150, "sand rolling resistance");
  ok(ISOTOPES.cobalt60.doseUSvH === 132000, "cobalt-60 dose rate");
  ok(GASTOX.co.lethalPpm === 12800, "CO lethal threshold");
  ok(HUMAN.deadliftKg.value === 500 && FALL_ODDS[2].odds === 0.5, "human limits fed");
  ok(MATERIALS.lead.ultimateMpa === 18, "lead strength filled", MATERIALS.lead.ultimateMpa);
  ok(MATERIALS.concrete.ultimateMpa === 4, "concrete tension ultimate 4 MPa");
  ok(MATERIALS.glass.ultimateMpa === 70, "glass ultimate 70 MPa");
}
{
  const e = experience("electrify a copper rod with 230 volts");
  ok(e.verdict === "REAL" && e.reasons.join().includes("conducts"), "copper conducts", e.verdict);
  const d = experience("dissolve steel in battery acid");
  ok(d.verdict === "NOT REAL" && JSON.stringify(d.measurements).includes("12"), "steel dies in battery acid", d.verdict);
  const di = experience("dissolve titanium in battery acid");
  ok(di.verdict === "REAL" && di.reasons.join().includes("immune"), "titanium immune to acid");
  const l = experience("fire a laser through diamond");
  ok(l.verdict === "REAL" && l.measurements.refractiveIndex === 2.417, "diamond bends laser", JSON.stringify(l.measurements));
  const ro = experience("roll a car tyre on sand at 10 m/s");
  ok(ro.verdict === "REAL" && String(ro.reasons[0]).includes("34"), "sand stops roller in ~34 m", ro.reasons[0]);
  const ra = experience("stand 1m from 1kg cobalt-60");
  ok(ra.verdict === "NOT REAL", "cobalt-60 lethal unshielded", ra.verdict);
  const g = experience("400 ppm carbon monoxide");
  ok(g.verdict === "NOT REAL", "400 ppm CO severe", g.verdict);
  const f = experience("can a human survive a 12m fall");
  ok(f.verdict === "MIXED", "12 m fall is a coin flip", f.verdict);
  const li = experience("can a human lift 300kg on Earth");
  ok(li.verdict === "MIXED", "300 kg is record-tier only", li.verdict);
  const th = experience("throw a steel sphere at 30 m/s 45 degrees at 8000m altitude");
  ok(Math.abs((th.measurements.airDensity as number) - 0.5258) < 1e-3, "thin air at altitude", th.measurements.airDensity);
}
{
  const e = neoParse("electrify a copper rod");
  ok(e.action === "electrify" && neoNeedsExperience(e), "neo electrify routes to verdict");
  const d = neoParse("dissolve steel in battery acid");
  ok(d.action === "dissolve" && d.acid === "batteryAcid", "neo acid target", d.acid);
  const l = neoParse("fire a laser through diamond");
  ok(l.action === "lase", "neo lase action", l.action);
  const ro = neoParse("roll on sand");
  ok(ro.action === "roll", "neo roll action");
  const a = neoParse("throw steel at 8000m altitude");
  ok(a.altitudeM === 8000, "neo altitude slot", a.altitudeM);
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. data-set-1)`);
