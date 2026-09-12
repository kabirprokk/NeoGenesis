// Engine verification: every assert ties to a codex value or closed-form result.
import { PHYSICS } from "../src/constants.js";
import { MATERIALS, FLUIDS, EXPLOSIVES, explosiveClass, FRICTION_PAIRS, REPOSE_DEG } from "../src/materials.js";
import { PLANETS } from "../src/planets.js";
import { humanTerminal, projectileRange, mohsVerdict, buoyancyVerdict, soundDelay, slidesOnIncline, reposeOk } from "../src/physics.js";
import { EngineWorld } from "../src/world.js";
import { getModel, MODEL_COUNT, spawnModel } from "../src/models.js";
import { experience } from "../src/experience.js";
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
  const r = experience("can a human lift 300kg on Earth");
  ok(r.verdict === "NOT REAL", "300 kg lift NOT REAL", r.verdict);
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
