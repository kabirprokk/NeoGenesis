// CLI: npm run experience -- "drop an oak crate from 100m"
// Single tool: npm run experience -- --tool buoyancy '{"bodyDensity":750,"fluid":"water"}'
// or pipe JSON scenarios (agents prefer this).
import { experience } from "./index.js";
import { runTool, TOOLS } from "./tools.js";

const argv = process.argv.slice(2);
if (argv[0] === "--tools") {
  console.log(TOOLS.map((t) => `${t.name}: ${t.description}`).join("\n"));
  process.exit(0);
}
if (argv[0] === "--tool") {
  const name = argv[1];
  let args = {};
  try { args = JSON.parse(argv.slice(2).join(" ") || "{}"); } catch { console.error("Bad JSON args"); process.exit(1); }
  console.log(JSON.stringify(runTool(name, args), null, 2));
  process.exit(0);
}

const raw = process.argv.slice(2).join(" ").trim();
if (!raw) {
  console.log('Usage: npm run experience -- "<prompt>"  |  echo \'{...}\' | npm run experience -- --json');
  process.exit(1);
}
let out;
if (process.argv.includes("--json")) {
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => {
    try {
      console.log(JSON.stringify(experience(JSON.parse(data)), null, 2));
    } catch (e) {
      console.error("Bad JSON:", (e as Error).message);
      process.exit(1);
    }
  });
} else {
  out = experience(raw);
  console.log(`\nPROMPT: ${out.prompt}\nENV: ${out.environment}`);
  console.log(`VERDICT: ${out.verdict} (confidence ${out.confidence})`);
  console.log("MEASUREMENTS:", JSON.stringify(out.measurements, null, 2));
  console.log("REASONS:");
  for (const r of out.reasons) console.log(`  - ${r}`);
  if (out.events.length) { console.log("EVENTS:"); for (const e of out.events) console.log(`  ! ${e}`); }
}
