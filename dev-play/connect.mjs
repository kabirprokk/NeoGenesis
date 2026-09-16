// connect.mjs — "connect to NeoGenesis and test it", for real.
// Any AI (or human) runs ONE command and a full gameplay test sweep happens:
// server boots if needed → browser goes inside → movement, jump, terminal,
// Neo chat, live experiment, visualizer, NaN scan → assertions → report.
//
// Usage: node connect.mjs [--keep-server]
// Exit code 0 = all green, 1 = findings filed below.
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const findings = [];
const notes = [];
let serverMine = false;

const run = (cmd, args, opts = {}) => new Promise((resolve) => {
  execFile(cmd, args, { cwd: dir, timeout: 180000, ...opts }, (err, stdout, stderr) => {
    resolve({ code: err ? 1 : 0, out: String(stdout || "") + String(stderr || "") });
  });
});
const drive = (...steps) => run(process.execPath, ["drive.mjs", ...steps]);
const ok = (name, cond, detail = "") => {
  notes.push(`${cond ? "ok" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
  if (!cond) findings.push(`FINDING [connect] severity(4): ${name} — ${detail}`);
};

async function probe() {
  try {
    const r = await fetch("http://localhost:5173/");
    return r.ok;
  } catch { return false; }
}

// 1. Server: connect to it, or boot it.
if (!(await probe())) {
  notes.push("server down — booting dev server...");
  const log = fs.openSync(path.join(dir, "server.log"), "a");
  spawn("npm", ["run", "dev", "--workspace=@neogenesis/frontend"],
    { cwd: root, detached: true, stdio: ["ignore", log, log] }).unref();
  serverMine = true;
  for (let i = 0; i < 30 && !(await probe()); i++) await new Promise((r) => setTimeout(r, 1000));
}
ok("server reachable", await probe());

// 2. Enter + clean console + NaN scan.
let r = await drive("enter", "scan", "errors");
ok("enter clean", !/NaN|Failed to load resource/.test(r.out), r.out.split("\n").filter((l) => /NaN|404/.test(l)).join(" | ").slice(0, 160));

// 3. Movement: HUD position must change under W.
r = await drive("enter", "hudpos");
const before = (r.out.match(/HUD::(.*)/) || [])[1] || "";
r = await drive("enter", "w:3000", "hudpos");
const after = (r.out.match(/HUD::(.*)/) || [])[1] || "";
ok("W moves the player", before && after && before !== after, `${before.trim()} → ${after.trim()}`.slice(0, 120));

// 4. Jump: altitude must lift off ground (retry once — headless slow-mo).
let jumped = "";
for (let attempt = 0; attempt < 2; attempt++) {
  r = await drive("enter", "space", "hudpos");
  jumped = (r.out.match(/HUD::(.*)/) || [])[1] || "";
  const alt = parseFloat(((jumped.match(/▲ ([\d.]+) m/) || [])[1] || "0"));
  if (alt > 0.05) break;
}
{
  const alt = parseFloat(((jumped.match(/▲ ([\d.]+) m/) || [])[1] || "0"));
  ok("space jumps", alt > 0.05, `alt=${alt} in ${jumped.trim().slice(0, 80)}`);
}

// 5. Terminal: whereami answers coordinates, no junk verdict.
r = await drive("enter", "key:Backquote", "type:whereami", "enterkey", "termtext");
ok("terminal whereami", /x=.*z=.*y=/.test(r.out), (r.out.match(/TERM::(.*)/s) || [])[1]?.trim().slice(-80) || "");

// 6. Neo chat through the real bar: true numbers back.
r = await drive("enter", "neorun:what is the temperature here right now", "neotext");
ok("neo chat answers", /REPLY::/.test(r.out) && /°C/.test(r.out), (r.out.match(/NEO::(.*)/s) || [])[1]?.trim().slice(-120) || "");

// 7. Live experiment through the real bar: verdict renders.
r = await drive("enter", "neorun:melt a lead cube in lava", "neotext");
ok("experiment verdict", /REAL|NOT REAL|MIXED/.test(r.out), (r.out.match(/NEO::(.*)/s) || [])[1]?.trim().slice(-100) || "");

// 8. Visualizer opens without errors.
r = await drive("enter", "canvas", "key:B", "snap:connect_brain", "errors");
ok("visualizer clean", !/NaN|Failed to load/.test(r.out));

// 9. Final error sweep.
r = await drive("enter", "w:2000", "space", "errors");
ok("play session clean", /ERRORS: none/.test(r.out), r.out.split("\n").filter((l) => /ERROR|NaN|404/.test(l)).join(" | ").slice(0, 160));

const report = `# CONNECT RUN — ${new Date().toISOString()}\n\n${notes.map((n) => `- ${n}`).join("\n")}\n\n## Findings\n\n${findings.length ? findings.join("\n") : "none — all green"}\n\nScreenshots: dev-play/shots/\n`;
fs.writeFileSync(path.join(dir, "LAST_RUN.md"), report);
console.log(report);
if (serverMine) console.log("note: connect.mjs booted the dev server — stop it in its own terminal when done.");
process.exit(findings.length ? 1 : 0);
