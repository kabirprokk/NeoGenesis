// Experience Lab — the full Neo loop in one panel: sentence → plan → live
// rig in the world → streamed events → verdict. Same runExperiment() the Neo
// bar and the terminal use, so all three always agree.
import React, { useState } from "react";
import type { GameCtx, NeoRunResult } from "./terminalCore.js";

const PRESETS = [
  "throw a copper sphere from 100m in the water",
  "throw a metal cube at the speed of light from 10000m in the sky into the water",
  "melt a lead cube in lava",
  "crush a glass box from 50m on the ground",
  "can a human lift 300kg on Earth",
  "does brass scratch granite",
  "float oak in honey",
  "drop a silver ball from a tower on Mars",
  "drop a steel and a glass box from 50m",
  "drop steel and glass from 50m, tell me who lands first",
  "if the glass breaks, drop steel",
  "throw a steel ball at 30 m/s over the wall into the pool",
];

function Badge({ v }: { v: NeoRunResult["verdict"]["verdict"] }) {
  const bg = v === "REAL" ? "#1d3a24" : v === "NOT REAL" ? "#3a1d1d" : "#3a331d";
  const fg = v === "REAL" ? "#8fe39a" : v === "NOT REAL" ? "#ff9a8a" : "#e8cf7a";
  return <span key={v} style={{ background: bg, color: fg, padding: "3px 10px", borderRadius: 6, fontWeight: 700, display: "inline-block", animation: "neo-pop 0.35s ease-out" }}>{v}</span>;
}

export function ExperiencePanel({ open, onClose, getCtx }: { open: boolean; onClose: () => void; getCtx: () => GameCtx | null }) {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [run, setRun] = useState<NeoRunResult | null>(null);
  const [err, setErr] = useState("");
  if (!open) return null;

  const go = () => {
    const ctx = getCtx();
    if (!ctx) { setErr("world not ready yet"); return; }
    try { setRun(ctx.runExperiment(prompt)); setErr(""); }
    catch (e) { setErr(String((e as Error).message)); }
  };

  return (
    <div className="panel">
      <h2>Experience Lab — Neo builds it, then proves it</h2>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        Describe an experiment. Neo parses WHAT → OBJECT → FROM → TO, builds the rig
        in the live world in front of you, streams what happens, then renders a verdict.
      </p>
      <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder="throw a copper sphere from 100m in the water" style={{ width: "100%" }} />
      <div style={{ margin: "6px 0" }}>
        {PRESETS.map((p) => (
          <button key={p} style={{ fontSize: 11, margin: "0 6px 6px 0" }} onClick={() => setPrompt(p)}>{p}</button>
        ))}
      </div>
      <button onClick={go}>Run it in the world ▶</button>
      <button onClick={onClose}>Close (X)</button>
      {err && <div style={{ color: "#ff9a8a", fontSize: 12, marginTop: 6 }}>{err}</div>}
      {run && (
        <div style={{ marginTop: 12 }}>
          {run.plan?.action && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, fontSize: 12 }}>
              {run.plan.steps.map(([k, v]) => (
                <span key={k} style={{ background: "#101a10", borderRadius: 8, padding: "3px 8px" }}>
                  <b style={{ color: "#8fe39a" }}>{k}</b> {v}
                </span>
              ))}
            </div>
          )}
          {run.staged && (
            <div style={{ fontSize: 13, background: "#101a10", padding: 8, borderRadius: 6 }}>
              {run.staged.map((s, i) => <div key={i}>▸ {s}</div>)}
              <div style={{ opacity: 0.7, marginTop: 4 }}>look at the world — it is happening live. Then read the verdict:</div>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <Badge v={run.verdict.verdict} />{" "}
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              confidence {run.verdict.confidence} · {run.verdict.environment}
            </span>
          </div>
          <div style={{ fontSize: 13, marginTop: 8 }}><b>Measurements</b></div>
          <pre style={{ fontSize: 12, background: "#111", padding: 8, borderRadius: 6, overflow: "auto" }}>
            {JSON.stringify(run.verdict.measurements, null, 1)}
          </pre>
          {run.verdict.reasons.map((r, i) => <div key={i} style={{ fontSize: 13, margin: "4px 0" }}>• {r}</div>)}
          {run.verdict.events.length > 0 && (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              <b>Engine events</b>
              {run.verdict.events.slice(0, 6).map((e, i) => <div key={i}>! {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
