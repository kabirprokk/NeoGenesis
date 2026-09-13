// Neo bar — the persistent experiment search bar. Always on screen: type a
// sentence, Neo parses it (WHAT → OBJECT → FROM → TO), builds the rig in the
// live world, faces you at it, streams what happens, then renders the verdict.
import React, { useEffect, useRef, useState } from "react";
import type { GameCtx, NeoRunResult } from "./terminalCore.js";

function Badge({ v }: { v: NeoRunResult["verdict"]["verdict"] }) {
  const bg = v === "REAL" ? "#1d3a24" : v === "NOT REAL" ? "#3a1d1d" : "#3a331d";
  const fg = v === "REAL" ? "#8fe39a" : v === "NOT REAL" ? "#ff9a8a" : "#e8cf7a";
  return <span key={v} style={{ background: bg, color: fg, padding: "2px 10px", borderRadius: 12, fontWeight: 700, fontSize: 12, display: "inline-block", animation: "neo-pop 0.35s ease-out" }}>{v}</span>;
}

export function NeoBar({ getCtx }: { getCtx: () => GameCtx | null }) {
  const [value, setValue] = useState("");
  const [run, setRun] = useState<NeoRunResult | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [min, setMin] = useState(false);
  const [err, setErr] = useState("");
  const logLen = useRef(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const ctxRef = useRef(getCtx);
  ctxRef.current = getCtx;

  // Live stream: poll the engine log — what happens shows up here as it happens.
  useEffect(() => {
    if (!run?.staged) return;
    const t = window.setInterval(() => {
      const w = ctxRef.current()?.world;
      if (!w) return;
      if (w.log.length > logLen.current) {
        logLen.current = w.log.length;
        setEvents(w.log.slice(-3));
      }
    }, 600);
    return () => window.clearInterval(t);
  }, [run]);

  const go = (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const ctx = getCtx();
    if (!ctx) { setErr("world not ready yet — enter the plane first"); return; }
    setBusy(true); setErr("");
    try {
      const r = ctx.runExperiment(prompt);
      logLen.current = ctx.world.log.length;
      setEvents([]);
      setRun(r);
    } catch (e) { setErr(String((e as Error).message)); }
    setBusy(false);
  };

  if (min) {
    return (
      <button onClick={() => setMin(false)}
        style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 25,
          background: "rgba(6,10,8,0.92)", color: "#8fe39a", border: "1px solid #2c3a2c",
          borderRadius: 20, padding: "6px 18px", cursor: "pointer", fontSize: 13 }}>
        ▲ Neo — ask me an experiment
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      width: "min(680px, 92vw)", zIndex: 25, fontFamily: "ui-monospace, Consolas, monospace" }}>
      <div style={{ display: "flex", alignItems: "center", background: "rgba(6,10,8,0.92)",
        border: "1px solid #2c3a2c", borderRadius: 24, padding: "4px 4px 4px 16px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
        <span style={{ color: "#8fe39a", fontWeight: 700, marginRight: 8 }}>Neo</span>
        <textarea ref={areaRef} rows={1} value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(value); } }}
          placeholder="throw a copper sphere from 100m in the water…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#e8f2e4", fontSize: 14, fontFamily: "inherit", resize: "none", padding: "8px 0" }} />
        <button onClick={() => go(value)} disabled={busy}
          style={{ background: "#1d3a24", color: "#8fe39a", border: "1px solid #3a5a3a",
            borderRadius: 20, padding: "8px 18px", cursor: "pointer", fontWeight: 700 }}>
          {busy ? "…" : "Run ▶"}
        </button>
        <button onClick={() => setMin(true)} title="minimize"
          style={{ background: "transparent", color: "#5a6a5a", border: "none",
            cursor: "pointer", padding: "8px 10px 8px 4px" }}>—</button>
      </div>
      {err && <div style={{ marginTop: 6, fontSize: 12, color: "#ff9a8a", textAlign: "center" }}>{err}</div>}
      {run && (
        <div style={{ marginTop: 8, background: "rgba(6,10,8,0.94)", border: "1px solid #2c3a2c",
          borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#cfe3c8", maxHeight: "44vh", overflowY: "auto" }}>
          {run.plan?.action ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {run.plan.steps.map(([k, v]) => (
                <span key={k} style={{ background: "#101a10", borderRadius: 8, padding: "3px 8px" }}>
                  <b style={{ color: "#8fe39a" }}>{k}</b> {v}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.8, marginBottom: 8 }}>no action word — judged without staging. Try “throw / melt / crush …”.</div>
          )}
          {run.staged && run.staged.map((s, i) => <div key={i} style={{ opacity: 0.9 }}>▸ {s}</div>)}
          {events.length > 0 && (
            <div style={{ marginTop: 6, borderTop: "1px solid #2c3a2c", paddingTop: 6 }}>
              <b style={{ color: "#8fe39a" }}>live</b>
              {events.map((e, i) => <div key={i} style={{ color: "#e8cf7a" }}>! {e}</div>)}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <Badge v={run.verdict.verdict} />{" "}
            <span style={{ opacity: 0.7, fontSize: 11.5 }}>
              {run.verdict.confidence} · {run.verdict.environment}
            </span>
          </div>
          {run.verdict.reasons.slice(0, 2).map((r, i) => <div key={i} style={{ fontSize: 12.5, marginTop: 4 }}>• {r}</div>)}
          {run.plan && run.plan.notes.map((n, i) => <div key={i} style={{ fontSize: 11.5, opacity: 0.65 }}>· {n}</div>)}
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.55 }}>
            Neo has learned from {run.memory.runs} experiment{run.memory.runs === 1 ? "" : "s"} · {run.memory.words} of your words · {run.memory.unknown} unknown yet
          </div>
        </div>
      )}
    </div>
  );
}
