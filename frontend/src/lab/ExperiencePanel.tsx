import React, { useState } from "react";
import { experience, type ExperienceResult } from "../../../engine/src/index.js";

const PRESETS = [
  "drop an oak crate from 100m",
  "can a human lift 300kg on Earth",
  "does lead melt at 500C",
  "throw a steel sphere at 30 m/s 45 degrees on Mars",
  "does steel scratch quartz",
  "float oak in water",
];

function Badge({ v }: { v: ExperienceResult["verdict"] }) {
  const bg = v === "REAL" ? "#1d3a24" : v === "NOT REAL" ? "#3a1d1d" : "#3a331d";
  const fg = v === "REAL" ? "#8fe39a" : v === "NOT REAL" ? "#ff9a8a" : "#e8cf7a";
  return <span style={{ background: bg, color: fg, padding: "3px 10px", borderRadius: 6, fontWeight: 700 }}>{v}</span>;
}

export function ExperiencePanel({ open, onClose, onStage }: { open: boolean; onClose: () => void; onStage?: (prompt: string) => string[] | null }) {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [res, setRes] = useState<ExperienceResult | null>(null);
  const [staged, setStaged] = useState<string[] | null>(null);
  if (!open) return null;
  return (
    <div className="panel">
      <h2>Experience Lab — is it even real?</h2>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        Describe an experiment. The engine lives it with real gravity, drag, impact stress,
        melt points and friction — then renders a verdict. Same API the AI uses.
      </p>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="drop a glass box from 50m" />
      <div style={{ margin: "6px 0" }}>
        {PRESETS.map((p) => (
          <button key={p} style={{ fontSize: 11, margin: "0 6px 6px 0" }} onClick={() => setPrompt(p)}>{p}</button>
        ))}
      </div>
      <button onClick={() => { try { setRes(experience(prompt)); setStaged(null); } catch (e) { setRes(null); alert(String(e)); } }}>
        Run experiment
      </button>
      {onStage && (
        <button onClick={() => { const s = onStage(prompt); setStaged(s ?? ["not stageable as a live scene — verdict above is the answer"]); }}>
          Stage it live ▶
        </button>
      )}
      <button onClick={onClose}>Close (X)</button>
      {staged && (
        <div style={{ marginTop: 10, fontSize: 13, background: "#101a10", padding: 8, borderRadius: 6 }}>
          {staged.map((s, i) => <div key={i}>{s}</div>)}
        </div>
      )}
      {res && (
        <div style={{ marginTop: 12 }}>
          <div><Badge v={res.verdict} /> <span style={{ opacity: 0.7, fontSize: 12 }}>confidence {res.confidence} · {res.environment}</span></div>
          <div style={{ fontSize: 13, marginTop: 8 }}><b>Measurements</b></div>
          <pre style={{ fontSize: 12, background: "#111", padding: 8, borderRadius: 6, overflow: "auto" }}>
            {JSON.stringify(res.measurements, null, 1)}
          </pre>
          {res.reasons.map((r, i) => <div key={i} style={{ fontSize: 13, margin: "4px 0" }}>• {r}</div>)}
          {res.events.length > 0 && (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              <b>Engine events</b>
              {res.events.slice(0, 6).map((e, i) => <div key={i}>! {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
