#!/usr/bin/env node
// NeoGenesis Auto-Push - watches C:\NeoGenesis and pushes when stable + green
// Usage: node automation/auto-push.mjs [--once] [--interval 30] [--stable 90]

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname ? path.join(import.meta.dirname, "..") : "C:\\NeoGenesis");
const POLL_SEC = parseInt(process.env.POLL_SEC || "30", 10);
const STABLE_SEC = parseInt(process.env.STABLE_SEC || "90", 10);
const EXCLUDE = [/\.git[\\/]/, /node_modules[\\/]/, /[\\/]dist[\\/]/, /[\\/]\.vite[\\/]/, /automation[\\/]auto-push/];

function git(cmd) {
  try { return execSync(`git -C "${REPO}" ${cmd}`, { encoding: "utf8", stdio: "pipe" }).trim(); } catch(e) { return (e.stdout||"")+ (e.stderr||""); }
}
function hasChanges() {
  const s = git("status --porcelain=v1");
  const filtered = s.split("\n").filter(l => l.trim() && !l.includes("SUPERVISOR_INBOX.md") && !l.includes("automation/") && l.trim().length>0);
  return filtered.length>0;
}
function lastWriteSec() {
  let latest = 0;
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (EXCLUDE.some(rx=>rx.test(p))) continue;
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs/1000 > latest) latest = st.mtimeMs/1000;
        if (e.isDirectory()) walk(p);
      } catch {}
    }
  }
  walk(REPO);
  return latest;
}
function isGreen() {
  console.log("[auto-push] verifying: engine tests + typecheck + build");
  try {
    execSync(`npm --prefix "${path.join(REPO,"engine")}" test`, { stdio: "pipe", timeout: 120000 });
  } catch(e) { console.log("[auto-push] tests FAILED"); console.log((e.stdout||"").toString().slice(-2000)); return false; }
  const t2 = spawnSync("npm", ["run","typecheck"], { cwd: REPO, encoding:"utf8", timeout: 60000 });
  if (t2.status!==0) { console.log("[auto-push] typecheck FAILED"); console.log((t2.stdout||"").slice(-2000)); return false; }
  const t3 = spawnSync("npm", ["run","build","-w","frontend"], { cwd: REPO, encoding:"utf8", timeout: 120000 });
  if (t3.status!==0) { console.log("[auto-push] build FAILED"); console.log((t3.stdout||"").slice(-2000)); return false; }
  return true;
}
function doPush() {
  if (!hasChanges()) { console.log("[auto-push] no changes to push"); return false; }
  if (!isGreen()) { console.log("[auto-push] NOT GREEN - skip"); return false; }
  console.log("[auto-push] GREEN -> git add -A");
  execSync(`git -C "${REPO}" add -A`, { stdio:"inherit" });
  try { execSync(`git -C "${REPO}" reset HEAD -- SUPERVISOR_INBOX.md`, { stdio:"pipe" }); } catch {}
  const staged = git("diff --cached --name-only").trim();
  if (!staged) { console.log("[auto-push] nothing staged after filter"); return false; }
  const msg = `auto: polish @ ${new Date().toISOString().replace("T"," ").slice(0,19)} - ${staged.split("\n").join(", ").slice(0,200)}`;
  console.log(`[auto-push] commit: ${msg}`);
  execSync(`git -C "${REPO}" commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio:"inherit" });
  console.log("[auto-push] pushing...");
  const out = spawnSync("git", ["-C", REPO, "push", "origin", "main"], { encoding:"utf8", timeout:60000 });
  console.log(out.stdout||""); console.log(out.stderr||"");
  if (out.status===0) console.log("[auto-push] PUSH OK"); else console.log("[auto-push] PUSH FAILED");
  return out.status===0;
}

const once = process.argv.includes("--once");
if (once) {
  const age = Date.now()/1000 - lastWriteSec();
  console.log(`[auto-push] --once age=${Math.floor(age)}s stable=${STABLE_SEC}s hasChanges=${hasChanges()}`);
  if (hasChanges() && age >= STABLE_SEC) doPush();
  process.exit(0);
}

console.log(`[auto-push] watching ${REPO} poll=${POLL_SEC}s stable=${STABLE_SEC}s`);
console.log("[auto-push] Ctrl+C to stop. Excludes: .git, node_modules, dist");
let lastPushHash = git("rev-parse HEAD");

setInterval(()=>{
  const age = Date.now()/1000 - lastWriteSec();
  const changes = hasChanges();
  const branch = git("status -b");
  const ahead = branch.includes("ahead");
  console.log(`[${new Date().toLocaleTimeString()}] age=${Math.floor(age)}s changes=${changes} ahead=${ahead}`);
  if (changes && age >= STABLE_SEC) {
    console.log(`[auto-push] stable ${STABLE_SEC}s with changes -> attempting push`);
    doPush();
  } else if (ahead && !changes && age >= 10) {
    console.log("[auto-push] committed but not pushed -> pushing");
    spawnSync("git", ["-C", REPO, "push", "origin", "main"], { stdio:"inherit" });
  }
}, POLL_SEC*1000);

// also FileSystemWatcher for faster reaction (debounced)
try {
  const watcher = fs.watch(REPO, { recursive: true }, (ev, file)=>{
    if (!file) return;
    if (EXCLUDE.some(rx=>rx.test(file))) return;
    // just log, polling does the work
  });
  console.log("[auto-push] fs.watch active");
} catch(e) { console.log("[auto-push] fs.watch not available, polling only"); }
