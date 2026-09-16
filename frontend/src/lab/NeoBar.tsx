// Neo bar — talk AND experiment. One input, two minds:
// Ask → Neo's generative self-learning mind (novel wording every time, true
// live numbers, remembers you across sessions). Run ▶ → the reality engine
// (stages the rig live, then judges REAL / NOT REAL). Enter auto-routes.
// Replies stream token-by-token into the 1:1 visualizer's language feed —
// speed follows Neo's arousal, the way stress quickens speech.
import React, { useEffect, useRef, useState } from "react";
import type { GameCtx, NeoRunResult } from "./terminalCore.js";
import { EXPERIMENT_RE } from "./terminalCore.js";
import { streamBus } from "./streamBus.js";

function Badge({ v }: { v: NeoRunResult["verdict"]["verdict"] }) {
  const bg = v === "REAL" ? "#1d3a24" : v === "NOT REAL" ? "#3a1d1d" : "#3a331d";
  const fg = v === "REAL" ? "#8fe39a" : v === "NOT REAL" ? "#ff9a8a" : "#e8cf7a";
  return <span key={v} style={{ background: bg, color: fg, padding: "2px 10px", borderRadius: 12, fontWeight: 700, fontSize: 12, display: "inline-block", animation: "neo-pop 0.35s ease-out" }}>{v}</span>;
}

interface Msg { role: "you" | "neo"; text: string; kind: "chat" | "experiment"; run?: NeoRunResult }

export function NeoBar({ getCtx, onBrain }: { getCtx: () => GameCtx | null; onBrain?: () => void }) {
  const [value, setValue] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [run, setRun] = useState<NeoRunResult | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [min, setMin] = useState(false);
  const [err, setErr] = useState("");
  const [inner, setInner] = useState("");
  const logLen = useRef(0);
  const streamTimer = useRef(0);
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

  // Initiative + inner-state footer: Neo may speak first while you're idle.
  useEffect(() => {
    const t = window.setInterval(() => {
      const ctx = ctxRef.current();
      if (!ctx) return;
      try {
        const p = ctx.proposal();
        if (p) setMsgs((m) => [...m.slice(-30), { role: "neo", text: p, kind: "chat" }]);
        setInner(ctx.innerState());
      } catch { /* world busy */ }
    }, 4000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => () => window.clearInterval(streamTimer.current), []);

  /** Token-level stream: reveal the reply word by word, letters assembling,
   *  faster when Neo's arousal runs hot. Feeds the visualizer bus live. */
  const streamReply = (prompt: string, reply: string, arousal: number, cands: { text: string; p: number }[]) => {
    window.clearInterval(streamTimer.current);
    const tokens = reply.split(/(\s+)/).filter((t) => t.length > 0);
    let i = 0;
    const t0 = performance.now();
    let shown = 0;
    streamBus.active = true;
    streamBus.candidates = cands;
    streamBus.assembled = "";
    streamBus.token = "";
    streamBus.letters = "";
    const perWord = Math.max(18, 90 - arousal * 80); // ms per token
    setMsgs((m) => [...m.slice(-30), { role: "you", text: prompt, kind: "chat" }, { role: "neo", text: "", kind: "chat" }]);
    streamTimer.current = window.setInterval(() => {
      i++;
      const text = tokens.slice(0, i).join("");
      const cur = tokens.slice(0, i).filter((t) => t.trim().length > 0).pop() ?? "";
      streamBus.token = cur.slice(0, 24);
      streamBus.letters = [...cur.slice(0, 24)].join(" ");
      streamBus.assembled = text;
      streamBus.tps = (i / Math.max(1, performance.now() - t0)) * 1000;
      setMsgs((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "neo", text, kind: "chat" };
        return c;
      });
      shown = i;
      void shown;
      if (i >= tokens.length) {
        window.clearInterval(streamTimer.current);
        streamBus.active = false;
      }
    }, perWord);
  };

  const ask = (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const ctx = getCtx();
    if (!ctx) { setErr("world not ready yet — enter the plane first"); return; }
    setErr("");
    try {
      const reply = ctx.chat(prompt);
      const s = ctx.sense();
      streamReply(prompt, reply, s.arousal01, ctx.candidates());
      setValue("");
      setInner(ctx.innerState());
    } catch (e) { setErr(String((e as Error).message)); }
  };

  const go = (text: string, forceExperiment = false) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    // Enter auto-routes; the Run ▶ button ALWAYS runs the engine.
    if (!forceExperiment && !EXPERIMENT_RE.test(prompt)) { ask(prompt); return; }
    const ctx = getCtx();
    if (!ctx) { setErr("world not ready yet — enter the plane first"); return; }
    setBusy(true); setErr("");
    try {
      const r = ctx.runExperiment(prompt);
      logLen.current = ctx.world.log.length;
      setEvents([]);
      setRun(r);
      setMsgs((m) => [...m.slice(-30), { role: "you", text: prompt, kind: "experiment", run: r }]);
      setValue("");
      setInner(ctx.innerState());
    } catch (e) { setErr(String((e as Error).message)); }
    setBusy(false);
  };

  if (min) {
    return (
      <button onClick={() => setMin(false)}
        style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 25,
          background: "rgba(6,10,8,0.92)", color: "#8fe39a", border: "1px solid #2c3a2c",
          borderRadius: 20, padding: "6px 18px", cursor: "pointer", fontSize: 13 }}>
        ▲ Neo — talk or experiment
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
        <textarea rows={1} value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(value); } }}
          placeholder="what is the temperature? · melt a lead cube in lava…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#e8f2e4", fontSize: 14, fontFamily: "inherit", resize: "none", padding: "8px 0" }} />
        <button onClick={() => ask(value)} disabled={busy}
          title="Talk to Neo — generative mind, learns you"
          style={{ background: "transparent", color: "#8fe39a", border: "1px solid #3a5a3a",
            borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontWeight: 700, marginRight: 4 }}>
          Ask
        </button>
        <button onClick={() => go(value, true)} disabled={busy}
          title="Run as live experiment on the reality engine"
          style={{ background: "#1d3a24", color: "#8fe39a", border: "1px solid #3a5a3a",
            borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontWeight: 700 }}>
          {busy ? "…" : "Run ▶"}
        </button>
        <button onClick={onBrain} title="brain visualizer (B)"
          style={{ background: "transparent", color: "#7aa3e8", border: "none",
            cursor: "pointer", padding: "8px 6px", fontSize: 14 }}>🧠</button>
        <button onClick={() => setMin(true)} title="minimize"
          style={{ background: "transparent", color: "#5a6a5a", border: "none",
            cursor: "pointer", padding: "8px 10px 8px 4px" }}>—</button>
      </div>
      {err && <div style={{ marginTop: 6, fontSize: 12, color: "#ff9a8a", textAlign: "center" }}>{err}</div>}
      {msgs.length > 0 && (
        <div style={{ marginTop: 8, background: "rgba(6,10,8,0.94)", border: "1px solid #2c3a2c",
          borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#cfe3c8", maxHeight: "40vh", overflowY: "auto" }}>
          {msgs.slice(-8).map((m, i) => (
            <div key={i} style={{ margin: "6px 0", opacity: m.role === "you" ? 0.75 : 1 }}>
              <b style={{ color: m.role === "you" ? "#7aa3e8" : "#8fe39a" }}>{m.role === "you" ? "you" : "Neo"}</b>
              {m.kind === "experiment" && m.run ? (
                <span> — <Badge v={m.run.verdict.verdict} /> <span style={{ opacity: 0.8 }}>{m.text}</span>
                  <div style={{ marginTop: 2 }}>{m.run.verdict.reasons.slice(0, 1).map((r, j) => <div key={j}>• {r}</div>)}</div>
                </span>
              ) : (
                <span> — {m.text}{m.role === "neo" && m.text === "" ? <span style={{ opacity: 0.5 }}>…</span> : null}</span>
              )}
            </div>
          ))}
          {inner && <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.5 }}>{inner}</div>}
        </div>
      )}
      {run && run.staged && (
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
