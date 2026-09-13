// Engine verification: every assert ties to a codex value or closed-form result.
import { PHYSICS } from "../src/constants.js";
import { MATERIALS, FLUIDS, EXPLOSIVES, explosiveClass, FRICTION_PAIRS, REPOSE_DEG } from "../src/materials.js";
import { PLANETS } from "../src/planets.js";
import { humanTerminal, projectileRange, mohsVerdict, buoyancyVerdict, soundDelay, slidesOnIncline, reposeOk, heatEnergyJ, meltEnergyKJ, heatTimeS, lorentz, relKineticJ, orbitVelocity, escapeVelocity, orbitPeriodS, horizonM, soundSpeed, gravityAt, blackbodyFlux } from "../src/physics.js";
import { EngineWorld } from "../src/world.js";
import { getModel, MODEL_COUNT, spawnModel } from "../src/models.js";
import { experience, runScenario } from "../src/experience.js";
import { neoParse, neoScenario, neoSamples, neoPatternCount, neoToolFor, neoNeedsExperience, NeoMemory } from "../src/neo.js";
import { ELECTRICAL, CORROSION_MIN, OPTICS, ROLLING, ISOTOPES, GASTOX, HUMAN, FALL_ODDS, SPECIFIC_HEAT, UNCERTAINTY, H_CONV, CITATIONS, EMISSIVITY, us76Atmo, altitudeDensity } from "../src/science.js";
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
  // Number phrasings: every way to say 100 m must mean 100 m.
  const h1 = neoParse("throw a copper sphere from 100 meters in the water");
  ok(h1.heightM === 100, "100 meters = 100 m", h1.heightM);
  const h2 = neoParse("throw a copper sphere 100m");
  ok(h2.heightM === 100 && h2.sizeM === 0.5, "bare 100m = height, not monster", `${h2.heightM}/${h2.sizeM}`);
  const h3 = neoParse("drop a glass box from 100");
  ok(h3.heightM === 100, "bare 100 after from = 100 m", h3.heightM);
  const h4 = neoParse("throw a 2m copper ball from 100m");
  ok(h4.sizeM === 2 && h4.heightM === 100, "adjective order: 2 m ball, 100 m up", `${h4.sizeM}/${h4.heightM}`);
  const h5 = neoParse("drop a glass box 100m high");
  ok(h5.heightM === 100, "100m high = 100 m", h5.heightM);
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. data-set-1)`);
// Rest narration: moved bodies log one "came to rest".
{
  const w = new EngineWorld();
  w.spawn({ shape: "box", material: "steel", sizeM: 0.5, pos: { x: -6, y: 0.5, z: 0 }, vel: { x: 8, y: 0, z: 0 } });
  w.run(8);
  ok(w.log.some((l) => l.includes("came to rest")), "slider narrates its rest", w.log.slice(-2).join(" | "));
  const n = w.log.filter((l) => l.includes("came to rest")).length;
  ok(n === 1, "rest logged exactly once", n);
}
{
  const w = new EngineWorld();
  w.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 0, y: 0.5, z: 0 } });
  w.run(3);
  ok(!w.log.some((l) => l.includes("came to rest")), "spawned-at-rest bodies stay quiet");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. rest)`);
// Singular degrees + thermal dataset: every way to say 100°C must mean 100°C,
// and every melt verdict must quote the energy, not just the threshold.
{
  const p = neoParse("melt a copper sphere in 100 degree heat");
  ok(p.action === "melt" && p.tempC === 100, "100 degree heat = 100C", p.tempC);
  const p2 = neoParse("throw a steel ball at a 45 degree angle");
  ok(p2.angleDeg === 45, "45 degree angle = 45°", p2.angleDeg);
  const p3 = neoParse("heat copper to 500C");
  ok(p3.action === "melt" && p3.tempC === 500, "heat = melt verb", `${p3.action} ${p3.tempC}`);
  const e = experience("melt copper at 100 degrees");
  ok(e.verdict === "NOT REAL" && JSON.stringify(e.measurements).includes("melt1kg"), "100C cannot melt copper + energy quoted", e.verdict);
  const e2 = experience("does lead melt at 500C");
  ok(JSON.stringify(e2.measurements).includes("melt1kg"), "lead verdict quotes melt energy");
  ok(SPECIFIC_HEAT.copper.c === 385 && SPECIFIC_HEAT.water.c === 4186, "specific heats fed");
  ok(heatEnergyJ(1, 385, 80) === 30800, "Q = mcΔT", heatEnergyJ(1, 385, 80));
  ok(Math.abs(meltEnergyKJ(385, 1085, 20, 205) - 615) < 2, "copper melt energy ≈615 kJ/kg", meltEnergyKJ(385, 1085, 20, 205));
  const t = runTool("heat-energy", { material: "copper", massKg: 2, fromC: 20, toC: 1085 });
  ok(t.ok && (t.result as { totalKJ: number }).totalKJ > 1200, "heat-energy tool totals sensible + fusion", JSON.stringify(t.result));
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. thermal)`);
// Scientist-grade: error bars, citations, kinetics, relativity, orbits, provenance.
{
  ok(Math.abs(orbitVelocity(3.986004e14, 6.371e6, 400000) - 7673) < 20, "LEO velocity ≈7673 m/s", orbitVelocity(3.986004e14, 6.371e6, 400000));
  ok(Math.abs(escapeVelocity(3.986004e14, 6.371e6) - 11186) < 20, "Earth escape ≈11186 m/s");
  ok(Math.abs(orbitPeriodS(3.986004e14, 6.371e6, 400000) / 60 - 92.5) < 2, "LEO period ≈92.5 min");
  ok(Math.abs(lorentz(0.5 * 299792458) - 1.1547) < 1e-3, "γ at 0.5c");
  ok(relKineticJ(1, 0.1 * 299792458) > 0.5 * 1 * (0.1 * 299792458) ** 2, "relativistic KE exceeds Newtonian");
  ok(Math.abs(heatTimeS(1, 385, 0.05, 10, 500, 20, 100) - 140.4) < 1, "lumped heating time", heatTimeS(1, 385, 0.05, 10, 500, 20, 100));
  ok(Number.isNaN(heatTimeS(1, 385, 0.05, 10, 50, 20, 100)), "no heating past the bath");
  ok(Math.abs(horizonM(1.7) - 4654) < 50, "horizon at eye height ≈4.65 km");
  const d = altitudeDensity(20000);
  ok(d < 0.3119 && d > 0.05, "stratospheric air keeps thinning", d);
  ok(UNCERTAINTY.range.rel === 0.15 && H_CONV.stillAir.h === 10, "uncertainty + convection tables fed");
  ok(!!CITATIONS.nist && CITATIONS.isa.publisher.includes("ISO"), "citation families fed");
}
{
  const o = experience("orbit the earth at 400km altitude");
  ok(o.verdict === "REAL" && Math.abs((o.measurements.orbitVelocityMs as number) - 7670) < 30, "LEO verdict", JSON.stringify(o.measurements));
  ok(o.citations.includes("jpl") && !!o.uncertainty.orbitVelocityMs, "orbit carries cites + bars");
  const e = experience("escape velocity from earth");
  ok(Math.abs((e.measurements.escapeVelocityKms as number) - 11.19) < 0.05, "escape verdict", JSON.stringify(e.measurements));
  const r = experience("throw a steel sphere at 300000000 m/s 45 degrees");
  ok((r.measurements.lorentzGamma as number) > 1 && r.reasons.join().includes("RELATIVITY"), "lightspeed throw flags relativity");
  const g = experience("drop a glass box from 50m");
  ok(g.id.startsWith("EXP-") && !!g.uncertainty.simRangeM && g.citations.length > 0, "provenance + bars + cites on throw verdicts", g.id);
  const fb = experience("a mysterious box");
  ok(!!fb.uncertainty.impactVms && !!fb.traces && Object.keys(fb.traces).length === 1 && fb.traces[Object.keys(fb.traces)[0]].length > 0, "multi-body traces + bars on scenario verdicts");
  const no = neoParse("orbit the earth at 400km");
  ok(no.action === "orbit" && neoNeedsExperience(no), "neo orbit routes to verdict");
  const ht = runTool("heat-time", { massKg: 1, material: "copper", areaM2: 0.05, h: 10, tInfC: 500, t0C: 20, t1C: 100 });
  ok(ht.ok && Math.abs((ht.result as { seconds: number }).seconds - 140) < 2, "heat-time tool", JSON.stringify(ht.result));
  const cs = runTool("csv", { prompt: "drop a glass box from 50m" });
  ok(cs.ok && (cs.result as { csv: string }).csv.split("\n")[0].startsWith("experiment,id,t_s"), "csv export heads correctly");
  const ci = runTool("citations", { ids: "nist, jpl" });
  ok(ci.ok && (ci.result as string[]).length === 2 && (ci.result as string[])[0].includes("@misc"), "BibTeX renders");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. scientist)`);
// Accuracy II: real atmosphere, real heat transfer, self-certified integration.
{
  const a20 = us76Atmo(20000);
  ok(Math.abs(a20.rho - 0.0889) < 0.005 && Math.abs(a20.tK - 216.65) < 0.5, "US76 at 20 km", a20.rho);
  ok(Math.abs(altitudeDensity(20000) - 0.0889) < 0.005, "model air extends to the stratosphere");
  ok(Math.abs(altitudeDensity(8000) - 0.5258) < 1e-9, "ISA bands untouched below 12 km");
  ok(Math.abs(soundSpeed(15) - 340.3) < 0.5 && Math.abs(soundSpeed(-65) - 289.2) < 1, "c(T) sound", soundSpeed(15));
  ok(Math.abs(gravityAt(9.81, 6.371e6, 400000) - 8.685) < 0.01, "g at ISS altitude", gravityAt(9.81, 6.371e6, 400000));
  ok(Math.abs(blackbodyFlux(1000) / 1000 - 148.9) < 1, "σT⁴ at 1000°C ≈149 kW/m²");
  ok(EMISSIVITY.copper.e === 0.3 && EMISSIVITY.water.e === 0.96, "emissivities fed");
  const h = experience("hear a blast from 2km on Mars");
  ok(Math.abs((h.measurements.soundSpeedMs as number) - 289) < 2 && h.verdict === "MIXED" && h.reasons.join().includes("CO₂"), "thin cold air + composition gap named", JSON.stringify(h.measurements));
  const m = experience("melt steel at 1600C");
  ok((m.measurements.radiationFluxKWm2 as number) > 600 && m.reasons.join().includes("Radiation rules"), "furnace verdict quotes radiation");
  const t = experience("throw a steel sphere at 30 m/s 45 degrees at 20000m altitude");
  ok((t.measurements.gravityAtStart as number) < 9.81 && t.reasons.join().includes("constant-g"), "high-drop gravity caveat", JSON.stringify(t.measurements.gravityAtStart));
}
{
  // The sim heats like the tables say: steel in a 1200°C bath warms by radiation + air.
  const w = new EngineWorld();
  w.env.ambientC = 1200;
  const b = w.spawn({ shape: "sphere", material: "steel", sizeM: 0.1, pos: { x: 0, y: 5, z: 0 }, tempC: 20 });
  w.run(45);
  ok(b.tempC > 50 && b.tempC < 1200, "radiative + convective warming", b.tempC.toFixed(1));
  // …and a body already past its threshold still melts on the spot.
  const w2 = new EngineWorld();
  w2.env.ambientC = 1200;
  const ice = w2.spawn({ shape: "box", material: "ice", sizeM: 0.3, pos: { x: 0, y: 3, z: 0 }, tempC: 1200 });
  w2.run(2);
  ok(ice.molten, "staged melt still triggers");
}
{
  const v = runTool("validate", {});
  const r = v.result as { checks: { name: string; errPct: number; pass: boolean }[]; maxErrPct: number; allPass: boolean };
  ok(v.ok && r.allPass, `sim self-certifies (max err ${r.maxErrPct}%)`, JSON.stringify(r.checks.map((c) => `${c.name}:${c.errPct}%`)));
  const cv = runTool("codex-version", {});
  ok(cv.ok && (cv.result as { codex: string }).codex === "1.5.0", "codex stamped");
  const sb = runTool("sound-speed", { tempC: -65 });
  ok(sb.ok && Math.abs((sb.result as { soundMs: number }).soundMs - 289.2) < 1, "sound tool");
  const ga = runTool("gravity-at", { planet: "earth", altitudeM: 400000 });
  ok(ga.ok && Math.abs((ga.result as { gravity: number }).gravity - 8.685) < 0.01, "gravity tool");
  const bb = runTool("blackbody", { tempC: 1000 });
  ok(bb.ok && Math.abs((bb.result as { fluxWm2: number }).fluxWm2 - 148900) < 1000, "blackbody tool");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. accuracy)`);
// Containers: singular meters, container dims, capacity reports in liters + kg.
{
  const h = neoParse("drop a box from 1 meter");
  ok(h.heightM === 1, "1 meter = 1 m", h.heightM);
  const p = neoParse("form a medium sized large container which is cubic in shape, of height 1 meter and fill it with water, generate a report of the amount it holds");
  ok(p.sizeM === 1 && p.shape === "box", "container reads 1 m", `${p.sizeM}/${p.shape}`);
  ok(p.reportCapacity === true && neoNeedsExperience(p), "capacity intent routes to verdict");
  ok(p.unknown.length <= 2, "near-zero unknowns", JSON.stringify(p.unknown));
  const s = neoParse("fill a huge barrel with water");
  ok(s.sizeM === 2.2, "huge ≈ 2.2 m", s.sizeM);
  const e = experience("fill a 1 meter cube container with water, how much does it hold");
  ok(e.verdict === "REAL" && e.measurements.capacityL === 1000 && e.measurements.fluidMassKg === 1000, "1 m cube holds 1000 L / 1000 kg", JSON.stringify(e.measurements));
  ok(!!e.uncertainty.capacityL && e.citations.includes("nist"), "capacity carries bars + cites");
  const e2 = experience("how much honey fits in a 2m tank");
  ok(e2.measurements.capacityL === 8000 && (e2.measurements.fluidMassKg as number) > 11000, "2 m tank of honey", JSON.stringify(e2.measurements));
  // Contained fluids: shells carry cargo, pools stay pools.
  const cf = neoParse("throw a cube which has water in it");
  ok(cf.material === "glass" && cf.shape === "box" && cf.unknown.length === 0, "water cube = glass shell + core", `${cf.material}/${cf.unknown.length}`);
  const scf = neoScenario(cf);
  ok((scf.bodies ?? []).length === 2, "shell + core staged");
  const bk = neoParse("throw a bucket of lava");
  ok(bk.sizeM === 0.5 && (bk.target as { kind: string }).kind === "ground", "bucket keeps true size, no pool", `${bk.sizeM}/${(bk.target as { kind: string }).kind}`);
  const gl = neoParse("throw a glass of water");
  ok(gl.material === "glass", "glass of water parsed", gl.material);
  const pl = neoParse("throw a copper cube in a lava pool");
  ok((pl.target as { fluid?: string }).fluid === "lava" && pl.unknown.length === 0, "pool words recognized", (pl.target as { fluid?: string }).fluid);
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. capacity)`);
// Wave II: full acoustic table, five new materials, deform verbs.
{
  const missingSound = Object.values(MATERIALS).filter((m) => m.soundMs === undefined).map((m) => m.id);
  ok(missingSound.length === 0, "every material carries sound speed", JSON.stringify(missingSound));
  const st = runTool("sound-through", { material: "steel", thicknessM: 1 });
  ok(st.ok && Math.abs((st.result as { transitUs: number }).transitUs - 167.8) < 0.5, "1 m steel ≈167.8 µs", JSON.stringify(st.result));
  ok(MATERIALS.silicon.density === 2330 && MATERIALS.quartz.mohs === 7 && MATERIALS.salt.meltC === 801, "new materials fed");
  ok(SPECIFIC_HEAT.silicon.c === 700, "silicon heat fed");
  const b = neoParse("bend a silicon rod");
  ok(b.action === "crush" && b.material === "silicon", "bend = strength family", `${b.action} ${b.material}`);
  const si = experience("does silicon melt at 1500C");
  ok(si.verdict === "REAL", "silicon melts at 1500C", si.verdict);
  const q = experience("does quartz scratch glass");
  ok(q.verdict === "REAL" && q.reasons.join().includes("scratches"), "quartz (7) scratches glass (5.5) by word order", q.verdict);
  // Lava is hot: bodies cook, verdicts say so.
  const wl = new EngineWorld();
  wl.addFluid({ name: "Molten Lava", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 1.7, z: 3 }, density: 2600, viscosity: 1000, tempC: 1000 });
  const oak = wl.spawn({ shape: "box", material: "oak", sizeM: 0.15, pos: { x: 0, y: 5, z: 0 } });
  wl.run(40);
  ok(oak.burning, "oak ignites in lava", oak.tempC.toFixed(0));
  const wl2 = new EngineWorld();
  wl2.addFluid({ name: "Molten Lava", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 1.7, z: 3 }, density: 2600, viscosity: 1000, tempC: 1000 });
  const lead = wl2.spawn({ shape: "sphere", material: "lead", sizeM: 0.1, pos: { x: 0, y: 5, z: 0 }, dragProfile: "sphere" });
  wl2.run(60);
  ok(lead.molten, "lead melts in lava", lead.tempC.toFixed(0));
  const lt = experience("throw an oak box into lava");
  void lt;
  const lp = neoParse("throw an oak box into lava");
  const lr = runScenario("throw oak into lava", neoScenario(lp));
  ok(lr.reasons.join().includes("ignites Oak Wood"), "lava-throw verdict calls the burning", lr.reasons.join(" / ").slice(0, 120));
  const lc = neoParse("throw a copper cube in a lava pool");
  const lcr = runScenario("throw copper in lava", neoScenario(lc));
  ok(lcr.reasons.join().includes("cannot melt Copper"), "copper rides lava (1085 > 1000)", lcr.reasons.join(" / ").slice(0, 120));
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. wave2)`);
// Fluency: plurals, verb forms, contractions, negation, versus questions.
{
  const p = neoParse("glass cubes shatter");
  ok(p.action === "crush" && p.material === "glass" && p.shape === "box" && p.unknown.length === 0, "plurals understood", `${p.action}/${p.material}`);
  const d = neoParse("what happens when a steel ball drops");
  ok(d.action === "drop" && d.material === "steel", "third-person verbs", d.action);
  const c = neoParse("can't copper melt at 500C");
  ok(c.action === "melt" && c.tempC === 500, "contractions", `${c.action}/${c.tempC}`);
  const n = neoParse("glass will not survive a 50m fall");
  ok(n.action === "drop" && (n.heightM ?? 0) >= 50 && n.notes.join().includes("negation"), "negation + survive", `${n.action}/${n.heightM}`);
  const s = neoParse("push a crate");
  ok(s.action === "slide", "push = slide family", s.action);
  const e = experience("steel vs titanium: which is stronger");
  ok(e.verdict === "REAL" && e.reasons.join().includes("Titanium Alloy wins"), "versus verdict", e.verdict);
  const w = experience("which is denser, gold or lead");
  ok(w.verdict === "REAL" && w.reasons.join().includes("Gold") && w.reasons.join().includes("denser"), "which-denser", w.verdict);
  const t = experience("is titanium stronger than steel");
  ok(t.verdict === "REAL" && (t.measurements.strengthMpaB as number) === 400, "stronger-than", t.verdict);
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. fluency)`);
// Multi-body crowds + pairwise contact.
{
  const p = neoParse("drop a steel and a glass box from 50m");
  ok(p.action === "drop" && p.multi.length === 1 && p.multi[0].material === "glass", "crowd parsed", `${p.action}+${p.multi.map((m) => m.material)}`);
  ok(p.steps[0][1].includes("× 2"), "crowd shown in WHAT");
  const s = neoScenario(p);
  ok((s.bodies ?? []).length === 2 && (s.checks ?? []).length === 2, "crowd scenario built");
  const r = runScenario("drop steel and glass", s);
  const table = (r.measurements.bodyTable ?? []) as { material: string; broken: boolean }[];
  ok(table.length === 2 && table[0].broken === false && table[1].broken === true, "steel holds, glass shatters", JSON.stringify(table.map((t) => t.broken)));
  ok(r.reasons.join().includes("Window Glass box: NOT survivable"), "per-body verdicts");
  const q = neoParse("which is denser, gold or lead");
  ok(q.multi.length === 0, "comparisons stay single (verdict path)");
}
{
  const w = new EngineWorld();
  const a = w.spawn({ shape: "sphere", material: "steel", sizeM: 0.3, pos: { x: -3, y: 1, z: 0 }, vel: { x: 8, y: 0, z: 0 }, dragProfile: "sphere" });
  const b = w.spawn({ shape: "sphere", material: "steel", sizeM: 0.3, pos: { x: 3, y: 1, z: 0 }, vel: { x: -8, y: 0, z: 0 }, dragProfile: "sphere" });
  w.run(4);
  ok(w.log.some((l) => l.includes("collided")), "impact narrated");
  ok(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) >= 0.6 - 1e-6, "no tunneling, no overlap", a.pos.x.toFixed(2));
  const w2 = new EngineWorld();
  w2.spawn({ shape: "box", material: "glass", sizeM: 1, static: true, pos: { x: 5, y: 1, z: 0 } });
  const c = w2.spawn({ shape: "sphere", material: "rubber", sizeM: 0.3, pos: { x: 0, y: 0.5, z: 0 }, vel: { x: 10, y: 0, z: 0 }, dragProfile: "sphere" });
  w2.run(0.6);
  ok(c.vel.x < 0 && c.pos.x < 5, "static walls reflect bodies", `${c.vel.x.toFixed(1)}/${c.pos.x.toFixed(1)}`);
  const w3 = new EngineWorld();
  w3.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 0, y: 0.5, z: 0 } });
  w3.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 0, y: 1.6, z: 0 } });
  w3.run(4);
  ok(Math.abs(w3.bodies[1].pos.y - 1.5) < 0.1, "boxes stack and rest", w3.bodies[1].pos.y.toFixed(2));
  const w4 = new EngineWorld();
  w4.spawn({ shape: "box", material: "steel", sizeM: 2, static: true, pos: { x: 8, y: 2, z: 0 } });
  const g = w4.spawn({ shape: "sphere", material: "glass", sizeM: 0.3, pos: { x: 0, y: 1, z: 0 }, vel: { x: 30, y: 0, z: 0 }, dragProfile: "sphere" });
  w4.run(2);
  ok(g.broken, "hard body-on-body hits fracture");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. crowds)`);
// Sealed cargo: cubes that carry their fluid with them.
{
  const p = neoParse("throw a cube which has water in it");
  ok(p.action === "throw" && p.containedFluid === "water" && p.material === "glass", "cargo parsed, glass shell", `${p.action}/${p.material}/${p.containedFluid}`);
  ok(p.target.kind === "ground" && p.unknown.length === 0, "target stays ground, nothing unknown");
  const s = neoScenario(p);
  ok((s.bodies ?? []).length === 2 && (s.bodies ?? [])[1].ghost === true, "ghost core staged");
  const c = neoParse("drop a copper box with oil");
  ok(c.containedFluid === "motorOil" && c.material === "copper", "named shell kept", `${c.material}/${c.containedFluid}`);
  const w = new EngineWorld();
  const shell = w.spawn({ shape: "box", material: "glass", sizeM: 0.5, pos: { x: 0, y: 5, z: 0 } });
  w.spawn({ shape: "box", material: "water", sizeM: 0.5, pos: { x: 0, y: 5, z: 0 }, ghost: true, massOverrideKg: shell.massKg });
  w.run(2);
  ok(!w.log.some((l) => l.includes("collided")), "nested cargo never ejects");
}
console.log(`\nALL ${pass} CHECKS PASSED (incl. cargo)`);
